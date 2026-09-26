#!/usr/bin/env bash
# Package the Windows IME for download.
#
# Produces two things in dist/:
#   pingzhu-<ver>-win-x64.zip     portable: unzip anywhere and run
#   pingzhu-<ver>-setup.exe       self-extracting installer (IExpress, built in
#                                 to Windows) that runs install.cmd
#
# The layout is flat on purpose: the executable, the core DLL and the language
# model all sit in one directory. That keeps the self-extracting archive simple
# (IExpress handles subdirectories badly) and means the install directory can be
# moved anywhere afterwards without breaking.
#
# usage: bash windows/package.sh [version]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
VERSION="${1:-0.5.1}"
STAGE="${PINGZHU_STAGE:-/mnt/c/Users/rchua/pingzhu-build}"
DIST="$ROOT/dist"
PKG="$DIST/pingzhu-$VERSION-win-x64"

log() { printf '\033[1;34m[package]\033[0m %s\n' "$*"; }

# ------------------------------------------------------------------- build
log "building"
bash "$HERE/build.sh" "$STAGE" >/dev/null 2>&1 || { log "build failed; run windows/build.sh to see why"; exit 1; }
[ -f "$STAGE/pingzhu-ime.exe" ] || { log "missing pingzhu-ime.exe"; exit 1; }

# ------------------------------------------------------------------ layout
log "assembling $PKG"
rm -rf "$PKG"
mkdir -p "$PKG"
cp "$STAGE/pingzhu-ime.exe"    "$PKG/"
cp "$STAGE/pingzhu_core.dll"   "$PKG/"
# The text service DLL carries a version in its file name, so the package must
# take whatever the build produced rather than a fixed name.
cp "$STAGE"/pingzhu-tsf-*.dll "$PKG/"
cp "$STAGE/pingzhu-regtool.exe" "$PKG/"
cp "$STAGE/pingzhu-tsf-test.exe" "$PKG/" 2>/dev/null || true
cp "$STAGE/pingzhu-router-test.exe" "$PKG/" 2>/dev/null || true
cp "$STAGE/pingzhu-engine-test.exe" "$PKG/" 2>/dev/null || true
cp "$ROOT/data/bopomofo-lm.tsv" "$PKG/"

# Scripts: CRLF so Notepad and cmd.exe are both happy; the .ps1 files carry a
# UTF-8 BOM because Windows PowerShell 5.1 otherwise reads them as ANSI and the
# Chinese messages turn to mojibake.
for f in install.ps1 uninstall.ps1; do
  python3 - "$HERE/installer/$f" "$PKG/$f" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8-sig").read().replace("\r\n", "\n").replace("\n", "\r\n")
open(dst, "w", encoding="utf-8-sig", newline="").write(text)
PY
done
for f in install.cmd uninstall.cmd install-languagebar.cmd uninstall-languagebar.cmd; do
  sed 's/\r$//; s/$/\r/' "$HERE/installer/$f" > "$PKG/$f"
done

# The readme is what a user opens first; give it a BOM so Notepad shows it right.
python3 - "$HERE/installer/README.txt" "$PKG/README.txt" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read().replace("\r\n", "\n").replace("\n", "\r\n")
open(dst, "w", encoding="utf-8-sig", newline="").write(text)
PY
cp "$ROOT/LICENSE" "$PKG/LICENSE.txt" 2>/dev/null || true
cp "$ROOT/NOTICE" "$PKG/NOTICE.txt" 2>/dev/null || true

# Sanity: the app must find the language model flat next to the executable.
( cd "$PKG" && ./pingzhu-engine-test.exe . >/tmp/pkg-engine-test.log 2>&1 ) \
  && log "engine test from the flat package: passed" \
  || { log "engine test FAILED from the flat package"; tail -5 /tmp/pkg-engine-test.log; exit 1; }

# And the text service must still honour its COM contract after packaging.
( cd "$PKG" && ./pingzhu-tsf-test.exe "$(ls pingzhu-tsf-*.dll | head -1)" >/tmp/pkg-tsf-test.log 2>&1 ) \
  && log "COM contract test from the flat package: passed" \
  || { log "COM contract test FAILED from the flat package"; tail -5 /tmp/pkg-tsf-test.log; exit 1; }

# --------------------------------------------------------------------- zip
log "zipping"
python3 - "$PKG" "$DIST/pingzhu-$VERSION-win-x64.zip" <<'PY'
import os, sys, zipfile
srcdir, out = sys.argv[1], sys.argv[2]
base = os.path.basename(srcdir)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _, files in os.walk(srcdir):
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.join(base, os.path.relpath(full, srcdir))
            z.write(full, rel)
print(f"  {out}")
PY

# --------------------------------------------------------------------- sfx
# IExpress is part of Windows; no external toolchain needed.
#
# Everything about this step runs on the Windows side: cmd.exe cannot even start
# with a WSL working directory, so the .sed file, the source directory and the
# output all live under the staging tree on /mnt/c.
log "building the self-extracting installer (IExpress)"
SETUP="$STAGE/pingzhu-$VERSION-setup.exe"
SED="$STAGE/pingzhu-$VERSION-setup.sed"
SETUP_WIN="$(wslpath -w "$SETUP")"
PKG_WIN="$(wslpath -w "$PKG")"
python3 - "$PKG" "$SED" "$SETUP_WIN" "$PKG_WIN" "$VERSION" <<'PY'
import os, sys
pkg, sed_path, target, pkg_win, version = sys.argv[1:6]
files = sorted(f for f in os.listdir(pkg) if os.path.isfile(os.path.join(pkg, f)))
# Test executables would only confuse the user; leave them out of the installer.
skip = {"pingzhu-router-test.exe", "pingzhu-engine-test.exe", "pingzhu-tsf-test.exe"}
files = [f for f in files if f not in skip]
lines = [
    "[Version]", "Class=IEXPRESS", "SEDVersion=3", "[Options]",
    "PackagePurpose=InstallApp",
    "ShowInstallProgramWindow=1",
    "HideExtractAnimation=0",
    "UseLongFileName=1",
    "InsideCompressed=0", "CAB_FixedSize=0", "CAB_ResvCodeSigning=0",
    "RebootMode=N",
    "InstallPrompt=", "DisplayLicense=", "FinishMessage=",
    f"TargetName={target}",
    # ASCII only: IExpress reads this file in the ANSI code page.
    f"FriendlyName=PingZhu {version} - Bopomofo input method",
    "AppLaunched=install.cmd",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=", "UserQuietInstCmd=",
    "SourceFiles=SourceFiles",
    "[Strings]",
]
for i, f in enumerate(files):
    lines.append(f'FILE{i}="{f}"')
lines += ["[SourceFiles]", f"SourceFiles0={pkg_win}", "[SourceFiles0]"]
for i in range(len(files)):
    lines.append(f"%FILE{i}%=%FILE{i}%")
open(sed_path, "w", encoding="ascii", newline="\r\n").write("\n".join(lines) + "\n")
PY
( cd "$STAGE" && cmd.exe /c "iexpress.exe /N /Q $(basename "$SED")" ) 2>&1 | sed 's/^/      /' || true
rm -f "$SED"
if [ -f "$SETUP" ]; then
  cp "$SETUP" "$DIST/"
else
  log "IExpress produced no installer; the zip is still usable"
fi

# ------------------------------------------------------------------ report
log "artifacts"
ls -la "$DIST"/pingzhu-$VERSION-* | awk '{printf "      %10s  %s\n", $5, $9}'

cat <<EOF

Upload with:
  gh release upload v$VERSION "$DIST/pingzhu-$VERSION-win-x64.zip" "$DIST/pingzhu-$VERSION-setup.exe" --clobber
EOF
