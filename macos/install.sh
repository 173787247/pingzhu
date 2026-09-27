#!/usr/bin/env bash
# Installs PingZhu into ~/Library/Input Methods and reports what the system sees.
#
# One line on the Mac:
#
#   curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/install.sh | bash
#
# It is written to answer the question CI could not: does the system accept the
# input method? Everything after that (logging out, adding it under Keyboard →
# Input Sources, typing) is a person's job, and the script says so at the end
# rather than pretending to have finished.
#
# The download is from the project's own release page, not a third party, and the
# checksum of what arrives is printed so it can be compared against the release.
set -euo pipefail

VERSION="0.9.0"
ASSET="pingzhu-${VERSION}-macos-UNVERIFIED.zip"
URL="https://github.com/173787247/pingzhu/releases/download/v0.8.0/${ASSET}"
EXPECTED_BUNDLE_ID="tw.pingzhu.ime"
EXPECTED_SOURCE_ID="tw.pingzhu.ime.Bopomofo"

say()  { printf '\033[1;34m[pingzhu]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[pingzhu]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[pingzhu]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "this installs a macOS input method; uname says $(uname -s)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say "downloading $ASSET"
curl -fsSL "$URL" -o "$TMP/$ASSET" || fail "download failed — is the release still there?"

say "checksum (compare with the release page if you like)"
shasum -a 256 "$TMP/$ASSET" | sed 's/^/  /'

say "unpacking"
ditto -x -k "$TMP/$ASSET" "$TMP/unpacked"
APP="$TMP/unpacked/PingZhu.app"
[ -d "$APP" ] || fail "the archive does not contain PingZhu.app"

# The bundle is ad-hoc signed. `lipo` invalidates a signature and this build
# merges two architectures, so the build signs after that — but a download can
# still lose the signature, and an unsigned input method is ignored silently.
say "checking the signature"
if codesign --verify "$APP" 2>/dev/null; then
  say "  valid"
else
  warn "  not valid — re-signing (ad-hoc)"
  codesign --force --deep --sign - "$APP"
  codesign --verify "$APP" || fail "could not make the signature valid"
fi

say "installing to ~/Library/Input Methods"
DEST="$HOME/Library/Input Methods"
mkdir -p "$DEST"
rm -rf "$DEST/PingZhu.app"
ditto "$APP" "$DEST/PingZhu.app"
say "  $DEST/PingZhu.app"

# What CI could not do. This runs in a real login session, which is the whole
# reason this script exists.
say "asking the system whether it can see it"

cat > "$TMP/probe.swift" <<'SWIFT'
import Carbon
import Foundation

let wanted = ProcessInfo.processInfo.environment["PINGZHU_SOURCE_ID"] ?? ""
let sources = (TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource]) ?? []
var found: TISInputSource?
for source in sources {
    guard let raw = TISGetInputSourceProperty(source, kTISPropertyInputSourceID) else { continue }
    let id = Unmanaged<CFString>.fromOpaque(raw).takeUnretainedValue() as String
    if id == wanted { found = source }
}

print("  input sources visible: \(sources.count)")
if let source = found {
    print("  FOUND \(wanted)")
    if let raw = TISGetInputSourceProperty(source, kTISPropertyLocalizedName) {
        print("  name: \(Unmanaged<CFString>.fromOpaque(raw).takeUnretainedValue() as String)")
    }
    let enabled = TISEnableInputSource(source)
    print("  TISEnableInputSource: \(enabled == noErr ? "ok" : "failed (\(enabled))")")
    let selected = TISSelectInputSource(source)
    print("  TISSelectInputSource: \(selected == noErr ? "ok" : "needs a focused text field (\(selected))")")
} else {
    print("  NOT LISTED \(wanted)")
    let others = sources.compactMap { source -> String? in
        guard let raw = TISGetInputSourceProperty(source, kTISPropertyBundleID) else { return nil }
        let bundle = Unmanaged<CFString>.fromOpaque(raw).takeUnretainedValue() as String
        return bundle.hasPrefix("com.apple.") ? nil : bundle
    }
    print("  third-party input sources: \(others.isEmpty ? "none" : others.joined(separator: ", "))")
}
SWIFT

PINGZHU_SOURCE_ID="$EXPECTED_SOURCE_ID" swift "$TMP/probe.swift" 2>&1 | sed 's/^/  /' || \
  warn "could not run the probe (swift not available?) — the manual check is below"

# And whether the bundle identifier matches what the system was told to look for.
ACTUAL_ID=$(defaults read "$DEST/PingZhu.app/Contents/Info.plist" CFBundleIdentifier 2>/dev/null || echo "?")
[ "$ACTUAL_ID" = "$EXPECTED_BUNDLE_ID" ] || warn "bundle identifier is $ACTUAL_ID, expected $EXPECTED_BUNDLE_ID"

cat <<'EOF'

────────────────────────────────────────────────────────────

Now, by hand — these are the parts a script cannot do:

  1. Log out and back in.
     macOS reads ~/Library/Input Methods when a session starts, and a bundle
     installed during one is not noticed until the next. Four attempts to force
     it on a CI runner all failed and the reason is not known, so this step is
     not optional.

  2. System Settings → Keyboard → Input Sources → Edit… → + →
     Traditional Chinese → 平注

  3. Type somewhere:

        su3cl3      then space   → 你好
        ji394su3    then space   → 我愛你
        w96j0       then space   → 台灣

  4. Switch scripts: the input menu (top right) → 平注 → 簡體輸出,
     then w96j0 again → 台湾

If something does not work, macos/TESTING.md lists what to collect.

────────────────────────────────────────────────────────────
EOF
