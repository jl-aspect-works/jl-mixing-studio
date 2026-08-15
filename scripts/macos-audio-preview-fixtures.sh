#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-/tmp/jl-mixing-studio-audio-preview-fixtures}"
mkdir -p "$OUT_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate the audio preview spike fixtures." >&2
  exit 2
fi

make_fixture() {
  local output="$1"
  shift
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "sine=frequency=440:duration=1" \
    "$@" "$OUT_DIR/$output"
}

# Cover the established preview baseline plus common client reference formats.
make_fixture wav16-44100-mono.wav    -ar 44100 -ac 1 -c:a pcm_s16le
make_fixture wav24-48000-stereo.wav  -ar 48000 -ac 2 -c:a pcm_s24le
make_fixture wavf32-96000-stereo.wav  -ar 96000 -ac 2 -c:a pcm_f32le
make_fixture aiff24-48000-stereo.aiff -ar 48000 -ac 2 -c:a pcm_s24be
make_fixture mp3-44100-stereo.mp3     -ar 44100 -ac 2 -c:a libmp3lame -q:a 2
make_fixture flac-48000-stereo.flac   -ar 48000 -ac 2 -c:a flac
make_fixture aac-48000-stereo.aac     -ar 48000 -ac 2 -c:a aac -b:a 192k
make_fixture m4a-48000-stereo.m4a     -ar 48000 -ac 2 -c:a aac -b:a 192k
make_fixture mp4-48000-stereo.mp4     -ar 48000 -ac 2 -c:a aac -b:a 192k

printf '%s\n' \
  "$OUT_DIR/wav16-44100-mono.wav" \
  "$OUT_DIR/wav24-48000-stereo.wav" \
  "$OUT_DIR/wavf32-96000-stereo.wav" \
  "$OUT_DIR/aiff24-48000-stereo.aiff" \
  "$OUT_DIR/mp3-44100-stereo.mp3" \
  "$OUT_DIR/flac-48000-stereo.flac" \
  "$OUT_DIR/aac-48000-stereo.aac" \
  "$OUT_DIR/m4a-48000-stereo.m4a" \
  "$OUT_DIR/mp4-48000-stereo.mp4"
