#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin ]]; then
  echo "This diagnostic requires macOS and a Rust toolchain." >&2
  exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jl-dante-rodio.XXXXXX")"
PROBE_APP="$BUILD_DIR/JL Dante Rodio Probe.app"
mkdir -p "$BUILD_DIR/src" "$PROBE_APP/Contents/MacOS" "$PROBE_APP/Contents/Resources"
cp "$SCRIPT_DIR/macos-dante-rodio-probe.rs" "$BUILD_DIR/src/main.rs"
# Seed dependency resolution from Studio's lock without changing its crate/features.
# Cargo prunes the unrelated Tauri packages; preserve the resulting lock for review.
cp "$SCRIPT_DIR/../src-tauri/Cargo.lock" "$BUILD_DIR/Cargo.lock"
cat > "$BUILD_DIR/Cargo.toml" <<'TOML'
[package]
name = "jl-dante-rodio-probe"
version = "0.0.0"
edition = "2021"

[dependencies]
rodio = { version = "=0.22.2", default-features = false, features = ["playback", "symphonia-all"] }
cpal = "=0.17.3"
TOML
MACOSX_DEPLOYMENT_TARGET=12.0 cargo build --release --manifest-path "$BUILD_DIR/Cargo.toml" >&2
cp "$BUILD_DIR/target/release/jl-dante-rodio-probe" "$PROBE_APP/Contents/MacOS/JL-Dante-Rodio-Probe"
cp "$BUILD_DIR/Cargo.lock" "$PROBE_APP/Contents/Resources/Cargo.lock"
cargo tree --locked --manifest-path "$BUILD_DIR/Cargo.toml" > "$PROBE_APP/Contents/Resources/dependencies.txt"
"$PROBE_APP/Contents/MacOS/JL-Dante-Rodio-Probe" --decode-only >&2
cat > "$PROBE_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>JL-Dante-Rodio-Probe</string>
<key>CFBundleIdentifier</key><string>com.jlaudio.danterodioprobe</string>
<key>CFBundleName</key><string>JL Dante Rodio Probe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>
PLIST
codesign --force --sign - "$PROBE_APP"
printf '%s\n' "$PROBE_APP"
