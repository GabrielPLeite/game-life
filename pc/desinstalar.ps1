# Tira a Brasa do PC: fecha o programa, apaga os atalhos e a pasta dela.
Get-Process BrasaPC -ErrorAction SilentlyContinue | Stop-Process -Force
foreach ($pasta in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('Desktop'))) {
  Remove-Item (Join-Path $pasta 'Brasa.lnk') -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 300
Remove-Item (Join-Path $env:LOCALAPPDATA 'BrasaPC') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'A Brasa saiu do PC.'
