param(
  [string]$Version = "v0.1.0-preview.1"
)

$ErrorActionPreference = "Stop"

$platformRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$shareRoot = Join-Path $platformRoot ".temp\share"
$sourceRoot = Join-Path $shareRoot "kele-family-ai-$Version"
$manifestPath = Join-Path $sourceRoot "SOURCE-MANIFEST.json"
$zipPath = Join-Path $shareRoot "kele-family-ai-$Version-source.zip"
$checksumPath = "$zipPath.sha256"

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Missing source manifest: $manifestPath"
}

$resolvedSource = (Resolve-Path -LiteralPath $sourceRoot).Path
$resolvedShare = (Resolve-Path -LiteralPath $shareRoot).Path
if (-not $resolvedSource.StartsWith($resolvedShare, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Source directory is outside the expected share directory."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$entries = @($manifest.files)
if ($entries.Count -eq 0) {
  throw "Source manifest contains no files."
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$fileStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
try {
  $archive = [System.IO.Compression.ZipArchive]::new(
    $fileStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $false
  )
  try {
    foreach ($item in $entries) {
      $relativePath = [string]$item.path
      $sourcePath = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot $relativePath))
      if (-not $sourcePath.StartsWith($resolvedSource, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest path escapes the source directory: $relativePath"
      }
      if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Manifest file is missing: $relativePath"
      }
      $actualHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actualHash -ne ([string]$item.sha256).ToLowerInvariant()) {
        throw "Manifest checksum mismatch: $relativePath"
      }
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $sourcePath,
        $relativePath.Replace("\", "/"),
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }

    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $manifestPath,
      "SOURCE-MANIFEST.json",
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
  finally {
    $archive.Dispose()
  }
}
finally {
  $fileStream.Dispose()
}

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $checksumPath -Encoding ascii -NoNewline -Value "$zipHash  $(Split-Path $zipPath -Leaf)"

[PSCustomObject]@{
  Zip = $zipPath
  Files = $entries.Count + 1
  Bytes = (Get-Item -LiteralPath $zipPath).Length
  Sha256 = $zipHash
}
