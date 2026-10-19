#!/usr/bin/env bash
# Verify the actual app distributed inside a macOS DMG, not only the build tree.
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: bash scripts/verify-macos-dmg-signature.sh <installer.dmg>" >&2
  exit 2
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This check requires macOS." >&2
  exit 2
fi

dmg="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
mount_dir="$(mktemp -d "${TMPDIR:-/tmp/}jl-studio-dmg.XXXXXX")"
mounted=0
cleanup() {
  if [[ "$mounted" -eq 1 ]]; then
    hdiutil detach "$mount_dir" -quiet || echo "WARNING: Could not detach $mount_dir" >&2
  fi
  rmdir "$mount_dir" 2>/dev/null || true
}
trap cleanup EXIT

hdiutil verify "$dmg"
hdiutil attach -readonly -nobrowse -mountpoint "$mount_dir" "$dmg" >/dev/null
mounted=1

app="$mount_dir/JL Mixing Studio.app"
if [[ ! -d "$app" ]]; then
  echo "Expected JL Mixing Studio.app inside DMG, but it was not found." >&2
  exit 1
fi
if [[ ! -s "$app/Contents/_CodeSignature/CodeResources" ]]; then
  echo "App inside DMG lacks a resource-sealing CodeResources signature." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app"
details="$(codesign --display --verbose=4 "$app" 2>&1)"
printf '%s\n' "$details" | grep -F "Signature=adhoc"
# The CodeResources file and strict codesign check above verify the bundle seal.
# codesign --display formats its human-readable summary differently by macOS version.
echo "PASS: mounted DMG contains an ad-hoc signed, resource-sealed, strictly verifiable app."
