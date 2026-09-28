#!/usr/bin/env bash
# Asks macOS one question properly: is this input method installed?
#
# Every previous check asked something adjacent:
#
#   defaults read com.apple.HIToolbox   → only *enabled* sources, and an
#                                          installed-but-not-yet-added method
#                                          is not enabled by definition
#   codesign --verify                   → the signature is valid; AMFI has a
#                                          different, higher bar
#   ls -la                              → the file is on disk; being on disk is
#                                          not being registered
#
# So "NOT LISTED" has been reported for days without anyone asking the actual
# question. This asks it: TISCreateInputSourceList(NULL, true) returns every
# input source the system has installed, enabled or not.
#
# One line on the Mac:
#
#   curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/why-not-listed.sh | bash
set -uo pipefail

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }

[ "$(uname -s)" = "Darwin" ] || { echo "this is a macOS diagnostic" >&2; exit 1; }

BUNDLE_ID="tw.pingzhu.ime"
MODE_ID="tw.pingzhu.ime.Bopomofo"

say "1. Is it installed? (the question nobody asked)"
python3 - "$BUNDLE_ID" "$MODE_ID" <<'PY'
import ctypes, ctypes.util, sys
bundle_id, mode_id = sys.argv[1], sys.argv[2]

carbon = ctypes.cdll.LoadLibrary(ctypes.util.find_library('Carbon'))
cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library('CoreFoundation'))

carbon.TISCreateInputSourceList.restype = ctypes.c_void_p
carbon.TISCreateInputSourceList.argtypes = [ctypes.c_void_p, ctypes.c_bool]
carbon.TISGetInputSourceProperty.restype = ctypes.c_void_p
carbon.TISGetInputSourceProperty.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
carbon.TISCopyInputSourceForLanguage.restype = ctypes.c_void_p
carbon.TISCopyInputSourceForLanguage.argtypes = [ctypes.c_void_p]

cf.CFArrayGetCount.restype = ctypes.c_long
cf.CFArrayGetCount.argtypes = [ctypes.c_void_p]
cf.CFArrayGetValueAtIndex.restype = ctypes.c_void_p
cf.CFArrayGetValueAtIndex.argtypes = [ctypes.c_void_p, ctypes.c_long]
cf.CFStringGetCStringPtr.restype = ctypes.c_char_p
cf.CFStringGetCStringPtr.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
cf.CFStringCreateWithCString.restype = ctypes.c_void_p
cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
cf.CFStringGetLength.restype = ctypes.c_long
cf.CFStringGetLength.argtypes = [ctypes.c_void_p]
cf.CFStringGetMaximumSizeForEncoding.restype = ctypes.c_long
cf.CFStringGetMaximumSizeForEncoding.argtypes = [ctypes.c_long, ctypes.c_uint32]
cf.CFStringGetCString.restype = ctypes.c_bool
cf.CFStringGetCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]

def tostr(cfstr):
    if not cfstr:
        return None
    p = cf.CFStringGetCStringPtr(cfstr, 0x08000100)  # kCFStringEncodingUTF8
    if p:
        return p.decode('utf-8', 'replace')
    n = cf.CFStringGetMaximumSizeForEncoding(cf.CFStringGetLength(cfstr), 0x08000100) + 1
    buf = ctypes.create_string_buffer(n)
    if cf.CFStringGetCString(cfstr, buf, n, 0x08000100):
        return buf.value.decode('utf-8', 'replace')
    return None

def cfstr(s):
    return cf.CFStringCreateWithCString(None, s.encode('utf-8'), 0x08000100)

# The properties we want, as CFStrings
k_id    = cfstr('TISInputSourceID')
k_name  = cfstr('TISInputSourceName')
k_enabled = cfstr('TISInputSourceEnabled')
k_type  = cfstr('TISInputSourceType')

# includeAllInstalled = True  ← the whole point
arr = carbon.TISCreateInputSourceList(None, True)
if not arr:
    print("  TISCreateInputSourceList returned NULL")
    sys.exit(0)

n = cf.CFArrayGetCount(arr)
print(f"  the system has {n} input sources installed")

ours = []
thirdparty = []
for i in range(n):
    src = cf.CFArrayGetValueAtIndex(arr, i)
    sid = tostr(carbon.TISGetInputSourceProperty(src, k_id))
    typ = tostr(carbon.TISGetInputSourceProperty(src, k_type))
    if sid is None:
        continue
    if bundle_id in sid or mode_id in sid:
        ours.append((sid, typ))
    if typ == 'TISTypeKeyboardInputMode' and not sid.startswith(('com.apple.', 'ai.iqt.')):
        thirdparty.append(sid)

print()
if ours:
    print("  \033[32m★ FOUND — this input method IS installed\033[0m")
    for sid, typ in ours:
        print(f"      id   = {sid}")
        print(f"      type = {typ}")
else:
    print("  \033[31m✗ NOT INSTALLED — the system does not have it at all\033[0m")
    print("      (this is different from 'not enabled': an installed source")
    print("       appears here whether or not the user has added it)")

print()
print(f"  other third-party input modes: {len(thirdparty)}")
for sid in thirdparty[:10]:
    print(f"      {sid}")
PY

say "2. Where it sits, and who owns it"
for d in "/Library/Input Methods" "$HOME/Library/Input Methods"; do
    note "$d"
    if [ -d "$d" ]; then
        ls -la "$d" 2>/dev/null | tail -n +2 | sed 's/^/        /'
    else
        note "    (does not exist)"
    fi
done

say "3. What the signature actually is"
for app in "/Library/Input Methods/PingZhu.app" "$HOME/Library/Input Methods/PingZhu.app"; do
    [ -d "$app" ] || continue
    note "$app"
    codesign -dv "$app" 2>&1 | grep -E "Identifier|Signature|Authority|TeamIdentifier" | sed 's/^/        /'
    note "  spctl (Gatekeeper's own verdict):"
    spctl -a -vvv -t exec "$app" 2>&1 | sed 's/^/        /'
done

say "4. What the kernel said about loading it"
log show --last 30m --style compact --predicate 'eventMessage CONTAINS[c] "pingzhu"' 2>/dev/null \
    | grep -iE "amfi|amfid|deny|reject|not valid|Input Methods" | tail -15 | sed 's/^/  /'
note "(empty means the kernel has said nothing about it)"

say "5. Does the scanner even look at the directories"
log show --last 30m --style compact --predicate 'process == "TextInputSwitcher" OR process == "TextInputMenuAgent"' 2>/dev/null \
    | tail -10 | sed 's/^/  /'
note "(empty means those agents did not run in the last 30 minutes)"

say "6. Verdict"
cat <<'EOF'
  Read section 1 first.
    FOUND       → the bundle registers; the problem is adding it in Settings
    NOT FOUND   → the system refuses to register it; sections 3 and 4 say why
EOF
