#!/usr/bin/env bash
# Try to satisfy macOS with a certificate we make ourselves.
#
# The kernel's complaint was specific:
#
#   amfid: not valid: AppleMobileFileIntegrityError Code=-423
#          "The file is adhoc signed or signed by an unknown certificate chain"
#
# and Gatekeeper's verdict was:
#
#   spctl: rejected
#
# Neither says "not issued by Apple". They say *unknown*. A certificate this
# script makes, imported into the login keychain and trusted at the system
# level, is known. It may or may not be enough — codesign will accept any
# keychain identity, and whether the input method registration path accepts a
# locally-trusted one is the thing being tested.
#
# It is worth five minutes before paying ¥688 and scanning a face.
#
# Everything it creates is named so it can be removed again:
#
#   security delete-identity -c "PingZhu Local Signing"
#   sudo security delete-certificate -c "PingZhu Local Signing" /Library/Keychains/System.keychain
#
#   curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/selfsign-local.sh | bash
set -uo pipefail

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

[ "$(uname -s)" = "Darwin" ] || { echo "this is a macOS script" >&2; exit 1; }

CN="PingZhu Local Signing"
APP="${1:-$HOME/Library/Input Methods/PingZhu.app}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say "0. What is already available"
security find-identity -v -p codesigning 2>/dev/null | sed 's/^/  /'
has_apple=$(security find-identity -v -p codesigning 2>/dev/null | grep -c "Apple Development")
if [ "$has_apple" -gt 0 ]; then
    ok "there is already an Apple Development identity — use that instead of this script"
    echo "     security find-identity -v -p codesigning   # copy the quoted name"
    echo "     codesign --force --deep --sign \"Apple Development: ...\" \"$APP\""
    exit 0
fi

say "1. Making a self-signed code-signing certificate"
openssl req -x509 -newkey rsa:2048 \
    -keyout "$TMP/key.pem" -out "$TMP/cert.pem" \
    -days 3650 -nodes \
    -subj "/CN=$CN/O=PingZhu/C=CN" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,digitalSignature,keyCertSign" \
    -addext "extendedKeyUsage=critical,codeSigning" 2>/dev/null \
    || { bad "openssl failed"; exit 1; }
ok "certificate made"

say "2. Importing it"
openssl pkcs12 -export -out "$TMP/id.p12" \
    -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
    -passout pass:pingzhu -name "$CN" 2>/dev/null
security import "$TMP/id.p12" -k "$HOME/Library/Keychains/login.keychain-db" \
    -P pingzhu -T /usr/bin/codesign -T /usr/bin/security 2>&1 | sed 's/^/  /'
ok "imported into the login keychain"

say "3. Trusting it system-wide (this asks for your password)"
echo "  A dialog may appear asking whether to trust it. Choose Always Trust."
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain "$TMP/cert.pem" 2>&1 | sed 's/^/  /'

say "4. Is codesign willing to use it"
security find-identity -v -p codesigning 2>/dev/null | sed 's/^/  /'

say "5. Signing the bundle"
if [ -d "$APP" ]; then
    codesign --force --deep --sign "$CN" "$APP" 2>&1 | sed 's/^/  /'
    codesign -dv "$APP" 2>&1 | grep -E "Identifier|Authority|TeamIdentifier|Signature" | sed 's/^/  /'
else
    bad "$APP not found — pass the path as an argument"
fi

say "6. Gatekeeper's verdict now"
spctl -a -vvv -t exec "$APP" 2>&1 | sed 's/^/  /'

say "7. What to do next"
cat <<EOF
  If section 6 says "accepted":
      log out, log back in, then
      curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/why-not-listed.sh | bash
      → section 1 should say "★ FOUND"

  If it still says "rejected":
      the registration path wants an Apple-issued chain, and the choices are
        - Xcode + a free Apple ID (Personal Team certificate, no ¥688)
        - the paid programme (¥688, face scan, iPhone)

  To undo this script:
      security delete-identity -c "$CN"
      sudo security delete-certificate -c "$CN" /Library/Keychains/System.keychain
EOF
