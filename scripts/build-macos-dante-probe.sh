#!/usr/bin/env bash
set -euo pipefail

# Keep this diagnostic outside Studio's bundle, preferences, and user workspaces.
if [[ "$(uname -s)" != Darwin ]]; then
  echo "This probe requires macOS and Xcode Command Line Tools." >&2
  exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROBE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jl-dante-probe.XXXXXX")"
PROBE_APP="$PROBE_DIR/JL Dante Probe.app"
mkdir -p "$PROBE_APP/Contents/MacOS"
xcrun swiftc -swift-version 5 -target "$(uname -m)-apple-macos12.0" \
  "$SCRIPT_DIR/macos-dante-discovery-probe.swift" \
  -o "$PROBE_APP/Contents/MacOS/JL-Dante-Probe"
cat > "$PROBE_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>JL-Dante-Probe</string>
<key>CFBundleIdentifier</key><string>com.jlaudio.dantediscoveryprobe</string>
<key>CFBundleName</key><string>JL Dante Probe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>
PLIST
codesign --force --sign - "$PROBE_APP"
printf '%s\n' "$PROBE_APP"
