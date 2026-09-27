#!/usr/bin/env bash
# Builds PingZhu.app — a macOS input method bundle.
#
# Must run on macOS: it compiles Swift against InputMethodKit and links the Rust
# core for Darwin. Neither exists anywhere else, which is why the build also runs
# in CI on a macOS runner — so that "it compiles" is a fact rather than a hope.
#
# usage: bash macos/build.sh [--debug]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

log() { printf '\033[1;34m[macos]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[macos]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "this builds on macOS only (uname says $(uname -s))"
command -v swiftc >/dev/null || fail "swiftc not found — install the Xcode command line tools"

PROFILE="release"
CARGO_FLAGS=(--release)
[ "${1:-}" = "--debug" ] && { PROFILE="debug"; CARGO_FLAGS=(); }

APP="$ROOT/dist/PingZhu.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

# ---------------------------------------------------------------- Rust core

log "building the Rust core for macOS"
export PATH="$HOME/.cargo/bin:$PATH"
command -v cargo >/dev/null || fail "cargo not found"

# Both architectures, then one universal library. Intel Macs still exist and the
# core has nothing platform-specific in it, so there is no reason to ship half an
# input method.
for target in aarch64-apple-darwin x86_64-apple-darwin; do
  rustup target add "$target" >/dev/null 2>&1 || true
  log "  $target"
  cargo build --manifest-path "$ROOT/core-rs/Cargo.toml" --target "$target" "${CARGO_FLAGS[@]}"
done

CORE_DIR="$ROOT/core-rs/target"
lipo -create \
  "$CORE_DIR/aarch64-apple-darwin/$PROFILE/libpingzhu_core.a" \
  "$CORE_DIR/x86_64-apple-darwin/$PROFILE/libpingzhu_core.a" \
  -output "$CORE_DIR/libpingzhu_core_universal.a"

# ---------------------------------------------------------------- bundle

log "assembling $APP"
rm -rf "$APP"
mkdir -p "$MACOS" "$RESOURCES/data"

cp "$HERE/Resources/Info.plist" "$CONTENTS/Info.plist"
cp "$ROOT/data/bopomofo-lm.tsv" "$ROOT/data/ts-conversion.tsv" "$RESOURCES/data/"

# ---------------------------------------------------------------- Swift

log "compiling Swift"
SOURCES=("$HERE/Sources/main.swift"
         "$HERE/Sources/Engine.swift"
         "$HERE/Sources/Router.swift"
         "$HERE/Sources/CandidateWindow.swift"
         "$HERE/Sources/PingZhuInputController.swift")

# -import-objc-header is how the C ABI reaches Swift without an Xcode project:
# one header, one archive, no build system in between.
swiftc \
  -O \
  -target "$(uname -m)-apple-macos12.0" \
  -import-objc-header "$HERE/Sources/PingZhu-Bridging-Header.h" \
  -I "$ROOT/core-rs/include" \
  -L "$CORE_DIR" \
  -lpingzhu_core_universal \
  -framework Cocoa \
  -framework InputMethodKit \
  -o "$MACOS/PingZhu" \
  "${SOURCES[@]}"

log "  $(du -h "$MACOS/PingZhu" | cut -f1) binary"

# ------------------------------------------------------------------ tests

log "running the routing vectors"
VECTORS="$ROOT/tools/routing-vectors.tsv"
swiftc \
  -target "$(uname -m)-apple-macos12.0" \
  -o "$ROOT/dist/PingZhuSelfTest" \
  "$HERE/Sources/Router.swift" \
  "$HERE/Tests/main.swift"
"$ROOT/dist/PingZhuSelfTest" "$VECTORS"

log "done: $APP"
cat <<EOF

Install:

    cp -R "$APP" ~/Library/Input\\ Methods/
    # then log out and back in, and add 平注 under
    # System Settings → Keyboard → Input Sources

EOF
