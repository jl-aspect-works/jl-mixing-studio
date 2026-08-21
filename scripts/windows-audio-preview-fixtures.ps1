param(
  [Parameter(Mandatory = $true)]
  [string]$OutDir
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw "ffmpeg is required to generate the Windows audio preview spike fixtures."
}

function New-AudioFixture {
  param(
    [string]$Name,
    [string[]]$Arguments
  )

  $target = Join-Path $OutDir $Name
  & ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=440:duration=1" @Arguments $target
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while creating $Name"
  }
}

New-AudioFixture "wav16-44100-mono.wav" @("-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le")
New-AudioFixture "wav24-48000-stereo.wav" @("-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le")
New-AudioFixture "wavf32-96000-stereo.wav" @("-ar", "96000", "-ac", "2", "-c:a", "pcm_f32le")
New-AudioFixture "aiff24-48000-stereo.aiff" @("-ar", "48000", "-ac", "2", "-c:a", "pcm_s24be")
New-AudioFixture "mp3-44100-stereo.mp3" @("-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-q:a", "2")

Get-ChildItem -Path $OutDir | Sort-Object Name | ForEach-Object { $_.FullName }
