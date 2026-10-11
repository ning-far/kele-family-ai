param([ValidateSet('web','server','verify')][string]$Target='web')
$ErrorActionPreference='Stop'
$platformRoot=Split-Path $PSScriptRoot -Parent
$nodeRoot=Join-Path (Split-Path $platformRoot -Parent) '.tools/node-v24.21.0-win-x64'
if(Test-Path (Join-Path $nodeRoot 'node.exe')){$env:PATH="$nodeRoot;$env:PATH"}
elseif(-not (Get-Command node -ErrorAction SilentlyContinue)){throw 'Install Node.js 24 LTS before starting'}
Set-Location -LiteralPath $platformRoot
if($Target -eq 'verify'){pnpm verify}else{pnpm "dev:$Target"}
exit $LASTEXITCODE
