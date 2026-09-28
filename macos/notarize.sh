#!/usr/bin/env bash
# Sign and notarize PingZhu so macOS will accept it.
#
# This is the step the whole macOS port has been blocked on. The chain is:
#
#   ad-hoc signature          → macOS 26 refuses to register it   ✗ tested
#   self-signed, system-trusted → still refuses                   ✗ tested
#   Apple-issued, notarized   → this script
#
# `spctl` is the judge, and it wants a Developer ID that Apple issued:
#
#   spctl -a -vvv -t exec PingZhu.app   →  accepted
#
# Which needs the paid programme (¥688/yr in China). A free Apple ID cannot
# make one — the portal does not offer Certificates to free accounts. Xcode's
# Personal Team can, but it issues an *Apple Development* certificate, which
# spctl does not accept for `exec` either, so the paid programme is the answer
# rather than a workaround.
#
# What you need before running this:
#   1. Enrolled, and the enrolment approved
#   2. A "Developer ID Application" certificate in your keychain
#        Xcode → Settings → Accounts → Manage Certificates → + →
#        Developer ID Application
#      or developer.apple.com → Certificates → + → Developer ID Application
#   3. An app-specific password for notarytool
#        https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
#
# Then:
#   export PINGZHU_APPLE_ID="rchuang@gmail.com"
#   export PINGZHU_TEAM_ID="ABCDE12345"
#   export PINGZHU_NOTARY_PASSWORD="xxxx-xxxx-xxxx-xxxx"
#   bash macos/notarize.sh
#
#   curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/notarize.sh | bash
set -uo pipefail

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
die()  { bad "$*"; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "this is a macOS script"

APP="${1:-$HOME/Library/Input Methods/PingZhu.app}"

say "0. What certificates exist"
security find-identity -v -p codesigning 2>/dev/null | sed 's/^/  /'
IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null \
    | grep "Developer ID Application" | head -1 \
    | sed 's/.*"\(.*\)".*/\1/')"
if [ -z "$IDENTITY" ]; then
    bad "no 'Developer ID Application' certificate found"
    echo
    echo "  A free Apple ID cannot make one. Enrol first:"
    echo "    https://developer.apple.com/programs/enroll/"
    echo "  (¥688/yr in China, needs the Apple Developer iOS app for identity"
    echo "   verification — a Mac without a camera cannot do that part)"
    echo
    echo "  An 'Apple Development' certificate from Xcode's Personal Team is not"
    echo "  enough: spctl does not accept it for -t exec. Tested."
    exit 1
fi
ok "using: $IDENTITY"

[ -d "$APP" ] || die "$APP not found"

say "1. Signing with the hardened runtime"
# --options runtime is required for notarization. Without it notarytool rejects
# the submission, and the rejection is a JSON blob rather than a sentence.
codesign --force --deep --options runtime --timestamp \
    --sign "$IDENTITY" "$APP" 2>&1 | sed 's/^/  /'
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Authority|TeamIdentifier|Timestamp" | sed 's/^/  /'
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -3 | sed 's/^/  /'

say "2. Gatekeeper, before notarization"
# Expected: still rejected. Signing alone is not enough; the ticket is what
# Gatekeeper is actually looking for.
spctl -a -vvv -t exec "$APP" 2>&1 | sed 's/^/  /'

say "3. Zipping for submission"
ZIP="$HOME/Downloads/PingZhu-notarize.zip"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"    # --keepParent matters: without it the
ok "wrote $ZIP"                            # archive has no .app around Contents

say "4. Credentials"
: "${PINGZHU_APPLE_ID:?set PINGZHU_APPLE_ID}"
: "${PINGZHU_TEAM_ID:?set PINGZHU_TEAM_ID}"
: "${PINGZHU_NOTARY_PASSWORD:?set PINGZHU_NOTARY_PASSWORD (an app-specific password)}"
echo "  apple id: ${PINGZHU_APPLE_ID}"
echo "  team id:  ${PINGZHU_TEAM_ID}"
echo "  password: (${#PINGZHU_NOTARY_PASSWORD} characters)"

say "5. Submitting to Apple (this waits, usually a few minutes)"
xcrun notarytool submit "$ZIP" \
    --apple-id "$PINGZHU_APPLE_ID" \
    --team-id "$PINGZHU_TEAM_ID" \
    --password "$PINGZHU_NOTARY_PASSWORD" \
    --wait 2>&1 | sed 's/^/  /'

say "6. Stapling the ticket"
# Notarization happens on Apple's servers; the ticket has to be attached to the
# bundle, or a machine that is offline cannot check it.
xcrun stapler staple "$APP" 2>&1 | sed 's/^/  /'
xcrun stapler validate "$APP" 2>&1 | sed 's/^/  /'

say "7. Gatekeeper, after"
if spctl -a -vvv -t exec "$APP" 2>&1 | tee /tmp/spctl.out | grep -q accepted; then
    ok "accepted"
    cat <<'EOF'

  Now:
    log out, log back in
    curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/why-not-listed.sh | bash
    → section 1 should say "★ FOUND"
    → then System Settings → Keyboard → Input Sources → + → 繁體中文 → 平注
EOF
else
    bad "still not accepted — the output above says why"
    cat /tmp/spctl.out | sed 's/^/  /'
fi
