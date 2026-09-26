#!/usr/bin/env bash
# Cross-compile the Rust core for Android and place the libraries where Gradle
# expects them.
#
# The engine is the same code the Windows shells and the TypeScript reference
# implementation are held to; nothing here re-implements anything. This script
# only deals with the two things that differ per platform: which linker to use,
# and where the resulting .so has to land.
#
# usage: bash android/build-rust.sh [--release]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
# Pinned rather than "the newest in ndk/": the toolchain a build uses should be
# a decision, not a side effect of what happens to be installed.
NDK_VERSION="${NDK_VERSION:-26.1.10909125}"
NDK="$ANDROID_HOME/ndk/$NDK_VERSION"

log() { printf '\033[1;34m[android-rust]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[android-rust]\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$NDK" ] || fail "NDK not found at $NDK — run: sdkmanager --install 'ndk;$NDK_VERSION'"

case "$(uname -m)" in
  x86_64) HOST_TAG=linux-x86_64 ;;
  aarch64) HOST_TAG=linux-aarch64 ;;
  *) fail "unsupported host architecture $(uname -m)" ;;
esac
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/$HOST_TAG"
[ -d "$TOOLCHAIN" ] || fail "NDK toolchain missing at $TOOLCHAIN"

# 64-bit only, matching the abiFilters in app/build.gradle.kts. A 32-bit build
# would double the surface for no user: every device that can run an input method
# today is 64-bit.
TARGETS=(
  "aarch64-linux-android:arm64-v8a"
  "x86_64-linux-android:x86_64"
)

# Android 8.0, matching minSdk. The API level is part of the linker's name, so a
# mismatch here produces a library the platform refuses to load rather than a
# build error — worth keeping next to minSdk in the Gradle file.
API=26

PROFILE_DIR="debug"
CARGO_FLAGS=()
if [ "${1:-}" = "--release" ]; then
  PROFILE_DIR="release"
  CARGO_FLAGS+=(--release)
fi

export PATH="$HOME/.cargo/bin:$PATH"
command -v cargo >/dev/null || fail "cargo not found"

JNI_DIR="$HERE/app/src/main/jniLibs"

for entry in "${TARGETS[@]}"; do
  target="${entry%%:*}"
  abi="${entry##*:}"

  rustup target add "$target" >/dev/null 2>&1 || true

  linker="$TOOLCHAIN/bin/${target%%-*}-linux-android${API}-clang"
  [ -x "$linker" ] || fail "linker not found: $linker"

  log "building $target ($abi)"
  # The linker is passed through the environment rather than .cargo/config.toml:
  # that file would need an absolute path to one machine's NDK checked into the
  # repository, which works until somebody else clones it.
  env \
    "CARGO_TARGET_$(echo "$target" | tr 'a-z-' 'A-Z_')_LINKER=$linker" \
    "CC_${target//-/_}=$linker" \
    "AR_${target//-/_}=$TOOLCHAIN/bin/llvm-ar" \
    cargo build --manifest-path "$HERE/rust/Cargo.toml" \
      --target "$target" "${CARGO_FLAGS[@]}"

  mkdir -p "$JNI_DIR/$abi"
  cp "$HERE/rust/target/$target/$PROFILE_DIR/libpingzhu_android.so" "$JNI_DIR/$abi/"
  log "  -> jniLibs/$abi/libpingzhu_android.so"
done

log "done"
