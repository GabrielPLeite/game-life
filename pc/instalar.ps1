# Instala a Brasa no PC: compila o programa com o csc que já vem no Windows,
# copia as imagens e faz ela abrir junto com o Windows (atalho em Inicializar e na Área de Trabalho).
$ErrorActionPreference = 'Stop'
$origem = $PSScriptRoot
$destino = Join-Path $env:LOCALAPPDATA 'BrasaPC'

Get-Process BrasaPC -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 300
New-Item -ItemType Directory -Force -Path $destino | Out-Null
Copy-Item (Join-Path $origem 'brasa') $destino -Recurse -Force
Copy-Item (Join-Path $origem 'brasa.ico') $destino -Force

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw 'Não achei o .NET Framework 4 (csc.exe) neste Windows.' }
& $csc /nologo /codepage:65001 /target:winexe /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll `
  "/win32icon:$(Join-Path $origem 'brasa.ico')" "/out:$(Join-Path $destino 'BrasaPC.exe')" (Join-Path $origem 'BrasaPC.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar a Brasa.' }

$shell = New-Object -ComObject WScript.Shell
foreach ($pasta in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('Desktop'))) {
  $atalho = $shell.CreateShortcut((Join-Path $pasta 'Brasa.lnk'))
  $atalho.TargetPath = Join-Path $destino 'BrasaPC.exe'
  $atalho.WorkingDirectory = $destino
  $atalho.IconLocation = Join-Path $destino 'brasa.ico'
  $atalho.Description = 'Brasa, do Game Life'
  $atalho.Save()
}

Start-Process (Join-Path $destino 'BrasaPC.exe')
Write-Host 'Pronto: a Brasa está em cima da barra de tarefas e vai abrir junto com o Windows.'
