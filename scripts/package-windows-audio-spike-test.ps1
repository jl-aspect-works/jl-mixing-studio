param(
  [Parameter(Mandatory = $true)]
  [string]$FixtureDir,
  [Parameter(Mandatory = $true)]
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$probeExe = Join-Path $repoRoot "src-tauri/target/release/windows_audio_preview_spike.exe"
if (-not (Test-Path $probeExe)) {
  throw "Windows audio spike probe was not built: $probeExe"
}
if (-not (Test-Path $FixtureDir)) {
  throw "Fixture directory does not exist: $FixtureDir"
}

$stage = Join-Path $env:RUNNER_TEMP "jl-windows-audio-spike-installer"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Path $stage | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage "fixtures") | Out-Null
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

Copy-Item $probeExe (Join-Path $stage "windows_audio_preview_spike.exe")
Copy-Item (Join-Path $FixtureDir "*.wav") (Join-Path $stage "fixtures")
Copy-Item (Join-Path $FixtureDir "*.aiff") (Join-Path $stage "fixtures")
Copy-Item (Join-Path $FixtureDir "*.mp3") (Join-Path $stage "fixtures")

$launcher = @'
@echo off
setlocal
cd /d "%~dp0"
echo JL Mixing Studio - Windows Native Audio Spike Test
echo.
echo This test uses the native Windows audio backend selected by spike #247.
echo It will play the required format fixtures through your current default Windows output device.
echo.
if not "%~1"=="" (
  echo Testing supplied file: %~1
  windows_audio_preview_spike.exe --manual-play "%~1"
  goto done
)
windows_audio_preview_spike.exe --manual-play ^
  "fixtures\wav16-44100-mono.wav" ^
  "fixtures\wav24-48000-stereo.wav" ^
  "fixtures\wavf32-96000-stereo.wav" ^
  "fixtures\aiff24-48000-stereo.aiff" ^
  "fixtures\mp3-44100-stereo.mp3"
:done
echo.
if errorlevel 1 (
  echo TEST FAILED. Please send the output above back to the JL Mixing Studio development thread.
) else (
  echo TEST PASSED if you heard each fixture play through the expected Windows audio device.
)
echo.
pause
'@
Set-Content -Path (Join-Path $stage "Run-Audio-Spike-Test.cmd") -Value $launcher -Encoding ASCII

$readme = @'
JL Mixing Studio - Windows Native Audio Spike Test

Purpose
-------
This is a temporary validation package for Studio v2.1 issue #247. It is not the production Studio installer.

How to test
-----------
1. Install this package for your Windows user account.
2. Double-click the desktop shortcut "JL Audio Spike Test".
3. Confirm that all five test tones are audible through the expected default Windows audio device:
   - WAV 16-bit PCM / 44.1 kHz / mono
   - WAV 24-bit PCM / 48 kHz / stereo
   - WAV 32-bit float / 96 kHz / stereo
   - AIFF 24-bit PCM / 48 kHz / stereo
   - MP3 / 44.1 kHz / stereo
4. The console should finish with PASS messages and no file-lock errors.

Optional real-file test
-----------------------
Drag a WAV, AIFF, or MP3 file onto Run-Audio-Spike-Test.cmd in the install folder. The probe will play that file through the same native backend.

What CI already verified
------------------------
Decode, duration reporting, seek, play/pause/clear state, unsupported-input rejection, release-mode compilation, and file-handle release.
This package is specifically for the remaining real-Windows output-device/audibility validation.
'@
Set-Content -Path (Join-Path $stage "README.txt") -Value $readme -Encoding ASCII

$escapedStage = $stage.Replace('\', '\\')
$escapedOut = (Join-Path $OutDir "JL-Mixing-Studio_Windows-Audio-Spike-Test_x64.exe").Replace('\', '\\')
$nsi = @"
Unicode true
Name "JL Mixing Studio Windows Audio Spike Test"
OutFile "$escapedOut"
InstallDir "`$LOCALAPPDATA\JL Aspect Works\JL Audio Spike Test"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show

Section "Install"
  SetOutPath "`$INSTDIR"
  File "$escapedStage\\windows_audio_preview_spike.exe"
  File "$escapedStage\\Run-Audio-Spike-Test.cmd"
  File "$escapedStage\\README.txt"
  SetOutPath "`$INSTDIR\\fixtures"
  File "$escapedStage\\fixtures\\*.*"
  SetOutPath "`$INSTDIR"
  CreateShortcut "`$DESKTOP\\JL Audio Spike Test.lnk" "`$INSTDIR\\Run-Audio-Spike-Test.cmd"
  WriteUninstaller "`$INSTDIR\\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "`$DESKTOP\\JL Audio Spike Test.lnk"
  Delete "`$INSTDIR\\windows_audio_preview_spike.exe"
  Delete "`$INSTDIR\\Run-Audio-Spike-Test.cmd"
  Delete "`$INSTDIR\\README.txt"
  Delete "`$INSTDIR\\fixtures\\*.*"
  RMDir "`$INSTDIR\\fixtures"
  Delete "`$INSTDIR\\Uninstall.exe"
  RMDir "`$INSTDIR"
SectionEnd
"@
$nsiPath = Join-Path $stage "audio-spike-test.nsi"
Set-Content -Path $nsiPath -Value $nsi -Encoding UTF8

$makensisCommand = Get-Command makensis.exe -ErrorAction SilentlyContinue
if ($makensisCommand) {
  $makensisPath = $makensisCommand.Source
} else {
  $candidate = "C:\Program Files (x86)\NSIS\makensis.exe"
  if (Test-Path $candidate) {
    $makensisPath = $candidate
  }
}
if (-not $makensisPath) {
  throw "makensis.exe was not found"
}

& $makensisPath $nsiPath
if ($LASTEXITCODE -ne 0) { throw "NSIS packaging failed with exit code $LASTEXITCODE" }

$installer = Join-Path $OutDir "JL-Mixing-Studio_Windows-Audio-Spike-Test_x64.exe"
if (-not (Test-Path $installer)) { throw "Expected installer was not produced: $installer" }
Write-Output $installer
