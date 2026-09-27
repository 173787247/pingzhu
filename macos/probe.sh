#!/usr/bin/env bash
# Asks the system what it sees, and compares our input method against one that
# works — on the same machine.
#
# The comparison is the point. An earlier attempt compared against McBopomofo
# read from GitHub, which found two real mistakes but could not answer the
# question that remains: ours is installed, signed, correctly structured by every
# check we have, and the system still does not list it. A working input method
# sitting in /Library/Input Methods on this very machine can answer it.
#
# One line:
#
#   curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/probe.sh | bash
set -uo pipefail

say()  { printf '\033[1;34m[probe]\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

[ "$(uname -s)" = "Darwin" ] || { echo "this is a macOS diagnostic" >&2; exit 1; }

head_ "is PingZhu listed?"
cat > /tmp/pingzhu-probe.swift <<'SWIFT'
import Carbon
import Foundation

let sources = (TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource]) ?? []
var pingzhu: TISInputSource?
var thirdParty: [(String, String)] = []

for source in sources {
    func str(_ key: CFString) -> String? {
        guard let raw = TISGetInputSourceProperty(source, key) else { return nil }
        return Unmanaged<CFString>.fromOpaque(raw).takeUnretainedValue() as String
    }
    guard let id = str(kTISPropertyInputSourceID) else { continue }
    if id.hasPrefix("tw.pingzhu") { pingzhu = source }
    if let bundle = str(kTISPropertyBundleID), !bundle.hasPrefix("com.apple.") {
        thirdParty.append((id, bundle))
    }
}

print("  visible input sources: \(sources.count)")
if pingzhu != nil {
    print("  PINGZHU IS LISTED")
} else {
    print("  PingZhu is NOT listed")
}
print("  other third-party input sources:")
for (id, bundle) in thirdParty {
    print("    \(id)   [\(bundle)]")
}
if thirdParty.isEmpty {
    print("    (none)")
}
SWIFT
swift /tmp/pingzhu-probe.swift 2>&1 | sed 's/^/  /'

head_ "where input methods live on this machine"
for dir in "/Library/Input Methods" "$HOME/Library/Input Methods"; do
    echo "  $dir"
    if [ -d "$dir" ]; then
        ls -1 "$dir" 2>/dev/null | sed 's/^/    /'
    else
        echo "    (does not exist)"
    fi
done

head_ "our bundle, as the system reads it"
OURS="$HOME/Library/Input Methods/PingZhu.app"
if [ -d "$OURS" ]; then
    echo "  bundle identifier: $(defaults read "$OURS/Contents/Info.plist" CFBundleIdentifier 2>/dev/null || echo '?')"
    echo "  package type:      $(defaults read "$OURS/Contents/Info.plist" CFBundlePackageType 2>/dev/null || echo '?')"
    echo "  signature:         $(codesign --verify "$OURS" 2>&1 && echo valid || echo INVALID)"
    echo "  executable archs:  $(lipo -archs "$OURS/Contents/MacOS/PingZhu" 2>/dev/null || echo '?')"
else
    echo "  not installed at $OURS — run install.sh first"
fi

head_ "a working input method, for comparison"
# Anything not ours, preferring a system-wide install: those are the ones the
# system accepts, which is exactly what we are trying to match.
REFERENCE=""
for dir in "/Library/Input Methods" "$HOME/Library/Input Methods"; do
    [ -d "$dir" ] || continue
    for candidate in "$dir"/*.app; do
        [ -d "$candidate" ] || continue
        case "$(basename "$candidate")" in
            PingZhu.app) continue ;;
        esac
        REFERENCE="$candidate"
        break 2
    done
done

if [ -z "$REFERENCE" ]; then
    echo "  no other input method found to compare against"
else
    echo "  reference: $REFERENCE"
    echo "  identifier: $(defaults read "$REFERENCE/Contents/Info.plist" CFBundleIdentifier 2>/dev/null || echo '?')"
    echo "  package type: $(defaults read "$REFERENCE/Contents/Info.plist" CFBundlePackageType 2>/dev/null || echo '?')"
    echo "  signature: $(codesign --verify "$REFERENCE" 2>&1 && echo valid || echo 'not valid (may be a signed installer)')"

    echo
    echo "  --- its Info.plist keys we care about ---"
    for key in CFBundlePackageType CFBundleSignature LSBackgroundOnly LSUIElement \
               NSPrincipalClass InputMethodConnectionName InputMethodServerControllerClass \
               InputMethodServerDelegateClass TISInputSourceID TISIntendedLanguage \
               ComponentInputModeDict; do
        value=$(defaults read "$REFERENCE/Contents/Info.plist" "$key" 2>/dev/null | head -20 | tr '\n' ' ')
        if [ -n "$value" ]; then
            echo "    $key = $value"
        fi
    done

    echo
    echo "  --- ours ---"
    for key in CFBundlePackageType CFBundleSignature LSBackgroundOnly LSUIElement \
               NSPrincipalClass InputMethodConnectionName InputMethodServerControllerClass \
               InputMethodServerDelegateClass TISInputSourceID TISIntendedLanguage \
               ComponentInputModeDict; do
        value=$(defaults read "$OURS/Contents/Info.plist" "$key" 2>/dev/null | head -20 | tr '\n' ' ')
        if [ -n "$value" ]; then
            echo "    $key = $value"
        fi
    done

    echo
    echo "  --- keys it has that we do not ---"
    REF_KEYS=$(defaults read "$REFERENCE/Contents/Info.plist" 2>/dev/null | grep -oE '^    "[A-Za-z]+" =' | tr -d ' "=' | sort)
    OUR_KEYS=$(defaults read "$OURS/Contents/Info.plist" 2>/dev/null | grep -oE '^    "[A-Za-z]+" =' | tr -d ' "=' | sort)
    comm -23 <(echo "$REF_KEYS") <(echo "$OUR_KEYS") | sed 's/^/    /'
fi

head_ "session"
echo "  launchctl managername: $(launchctl managername 2>/dev/null || echo '?')"
echo "  console owner: $(stat -f%Su /dev/console 2>/dev/null || echo '?')"
echo "  logged in as: $(whoami)"

cat <<'EOF'

────────────────────────────────────────────────────────────

Now: log out and back in, then run this again. Send both outputs.

The reason: macOS reads ~/Library/Input Methods when a session starts. The
install happened during a session, so it may simply not have been seen yet —
and that is the one thing CI structurally cannot test, because a runner cannot
log out and back in.

If it is STILL not listed after logging in, the comparison above against a
working input method is what will show why.
EOF
