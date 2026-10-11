$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$deviceType = [Windows.Devices.Bluetooth.BluetoothLEDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$operation = $deviceType::FromBluetoothAddressAsync([uint64]0xc49e7e079b56)
$task = $asTask.MakeGenericMethod($deviceType).Invoke($null,@($operation))
if (-not $task.Wait(5000)) { throw 'Bluetooth query timed out' }
$device = $task.Result
if ($null -eq $device) { @{available=$true;paired=$false;connected=$false;name='EasyInput Board';easyInputRunning=[bool](Get-Process EasyInput -ErrorAction SilentlyContinue)} | ConvertTo-Json -Compress; exit }
@{available=$true;name=$device.Name;paired=$device.DeviceInformation.Pairing.IsPaired;connected=($device.ConnectionStatus.ToString() -eq 'Connected');easyInputRunning=[bool](Get-Process EasyInput -ErrorAction SilentlyContinue)} | ConvertTo-Json -Compress
$device.Dispose()
