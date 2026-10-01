$lt = 'C:\Users\sdfg\AppData\Roaming\npm\lt.cmd'
$log = Join-Path (Split-Path $PSScriptRoot -Parent) 'tunnel-loop.log'
for ($i = 0; $i -lt 500; $i++) {
  & $lt --port 4173 *>> $log
  Start-Sleep -Seconds 5
}
