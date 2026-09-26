#!/usr/bin/env bash
# Build the portable Windows IME from WSL.
#
# The Rust core is cross-compiled to x86_64-pc-windows-msvc; the C++ shell is
# compiled by the same MSVC on the Windows side. Getting cargo to drive the
# Windows linker from WSL needs two tricks, both handled by
# ~/.local/bin/msvc-link.sh (see the comment at the top of that file).
#
# usage: bash windows/build.sh [staging-dir] [--run]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
STAGE="${1:-/mnt/c/Users/rchua/pingzhu-build}"
RUN_TESTS="${2:-}"

export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
export CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER="$HOME/.local/bin/msvc-link.sh"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/pz-msvc}"

log() { printf '\033[1;34m[build]\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------- Rust core
log "building pingzhu_core.dll (x86_64-pc-windows-msvc)"
cd "$ROOT/core-rs"
cargo build --release --target x86_64-pc-windows-msvc 2>&1 | grep -vE "^warning: linker|^  = note:|Non-UTF-8" | tail -3
DLL="$CARGO_TARGET_DIR/x86_64-pc-windows-msvc/release/pingzhu_core.dll"
[ -f "$DLL" ] || { echo "missing $DLL" >&2; exit 1; }
file "$DLL" | sed 's/^/      /'

# ------------------------------------------------------------- stage for MSVC
# Windows keeps a loaded DLL locked for the lifetime of every process that
# mapped it. That now includes Notepad, Explorer and WeChat — the input method
# is running inside them. Killing the portable shell is not enough.
#
# Windows does allow *renaming* a locked file, only overwriting it is refused.
# So anything already in place is moved aside first; the old image stays mapped
# in the processes that hold it and the file becomes deletable once they exit.
if tasklist.exe /FI "IMAGENAME eq pingzhu-ime.exe" 2>/dev/null | grep -qi pingzhu-ime; then
  log "stopping the running pingzhu-ime.exe"
  taskkill.exe /IM pingzhu-ime.exe /F >/dev/null 2>&1 || true
  sleep 1
fi

log "staging into $STAGE"
rm -rf "$STAGE/src" "$STAGE/tests" "$STAGE/tsf" "$STAGE/build"
mkdir -p "$STAGE/src" "$STAGE/tests" "$STAGE/tsf" "$STAGE/build" "$STAGE/data"
cp "$HERE"/src/*.h "$HERE"/src/*.cpp "$STAGE/src/"
cp "$HERE"/tests/*.cpp "$STAGE/tests/"
cp "$HERE"/tsf/*.h "$HERE"/tsf/*.cpp "$HERE"/tsf/*.def "$STAGE/tsf/"
mkdir -p "$STAGE/tsf/tests" && cp "$HERE"/tsf/tests/*.cpp "$STAGE/tsf/tests/"
# Move any locked predecessor aside, then place the new build.
#
# The suffix has to be unique per run: a fixed one collides with the previous
# run's leftover, and moving *onto* a locked file fails with the same
# "Permission denied" this is meant to avoid. Old copies cannot be deleted while
# the processes holding them are alive, so they are swept on the next build that
# can.
# Only the engine DLL is moved aside. The text service DLL needs no such
# handling: its name carries a version, so a new build is a new file and the
# registered one is never disturbed. Renaming the *registered* file would break
# the input method outright — Windows would report ERROR_MOD_NOT_FOUND the next
# time anything tried to create the text service.
stamp="$(date +%s)"
for existing in "$STAGE"/pingzhu_core*.dll; do
  [ -e "$existing" ] || continue
  case "$existing" in
    *.previous.*|*.previous) continue ;;
  esac
  mv -f "$existing" "$existing.previous.$stamp" 2>/dev/null || true
done
rm -f "$STAGE"/*.previous.* 2>/dev/null || true
cp "$DLL" "$STAGE/"
cp "$ROOT/data/bopomofo-lm.tsv" "$STAGE/data/"
# The 繁/簡 table lives beside the language model; without it the engine still
# runs and simply cannot convert, which is the right failure mode.
cp "$ROOT/data/ts-conversion.tsv" "$STAGE/data/"
# MSVC's batch parser wants CRLF.
sed 's/\r$//; s/$/\r/' "$HERE/build.bat" > "$STAGE/build.bat"

# --------------------------------------------------------------- MSVC compile
STAGE_WIN="$(wslpath -w "$STAGE")"
log "compiling with MSVC ($STAGE_WIN)"
# cmd.exe cannot use a \\wsl.localhost\... path as its working directory, so the
# build runs with the staging directory as cwd rather than as an argument.
( cd "$STAGE" && cmd.exe /c build.bat ) 2>&1 | sed 's/^/      /'

log "artifacts"
ls -la "$STAGE"/*.exe "$STAGE"/*.dll 2>/dev/null | awk '{printf "      %8s  %s\n", $5, $9}'

if [ "$RUN_TESTS" = "--run" ]; then
  log "router tests"
  ( cd "$STAGE" && ./pingzhu-router-test.exe ) | sed 's/^/      /'
fi

cat <<EOF

Done.

  run:   $STAGE_WIN\\pingzhu-ime.exe
  core:  $STAGE_WIN\\pingzhu_core.dll
  data:  $STAGE_WIN\\data\\bopomofo-lm.tsv

Ctrl+Alt+Z toggles 中/英, left click on the tray icon does the same, right click
opens the menu. Type su3cl3 and 你好 should appear.
EOF
