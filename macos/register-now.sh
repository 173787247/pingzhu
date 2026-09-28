#!/usr/bin/env bash
# Register the installed input method with the system, by hand.
#
# This is what every working macOS input method does and this one never did:
#
#   vChewing   TISRegisterInputSource(Bundle.main.bundleURL)   on launch
#   WeType     WeTypeInstaller.app calls it                    (the Homebrew
#                                                               issue was that
#                                                               the installer
#                                                               stopped running)
#   自然輸入法   its installer calls it
#   PingZhu    nothing calls it                                ← the bug
#
# Putting a bundle in ~/Library/Input Methods is not registration. Older macOS
# scanned that directory at login and registered what it found; macOS 26 does
# not appear to, which is why every check came back "not installed" while the
# bundle sat in the right place with a valid signature.
#
# Nothing here needs a Developer ID. Registration and Gatekeeper are separate
# questions, and this script answers the first one.
#
#   curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/register-now.sh | bash
set -uo pipefail

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

[ "$(uname -s)" = "Darwin" ] || { echo "this is a macOS script" >&2; exit 1; }

APP="${1:-$HOME/Library/Input Methods/PingZhu.app}"
BUNDLE_ID="tw.pingzhu.ime"

say "0. The bundle"
if [ -d "$APP" ]; then
    ok "$APP"
    plutil -p "$APP/Contents/Info.plist" 2>/dev/null | grep -E "CFBundleIdentifier|TISInputSourceID" | sed 's/^/    /'
else
    bad "$APP not found — pass the path as an argument"
    exit 1
fi

say "1. Before"
python3 - "$BUNDLE_ID" <<'PY'
import ctypes, ctypes.util, sys
bid = sys.argv[1]
carbon = ctypes.cdll.LoadLibrary(ctypes.util.find_library('Carbon'))
cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library('CoreFoundation'))
carbon.TISCreateInputSourceList.restype = ctypes.c_void_p
carbon.TISCreateInputSourceList.argtypes = [ctypes.c_void_p, ctypes.c_bool]
carbon.TISGetInputSourceProperty.restype = ctypes.c_void_p
carbon.TISGetInputSourceProperty.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
cf.CFArrayGetCount.restype = ctypes.c_long
cf.CFArrayGetCount.argtypes = [ctypes.c_void_p]
cf.CFArrayGetValueAtIndex.restype = ctypes.c_void_p
cf.CFArrayGetValueAtIndex.argtypes = [ctypes.c_void_p, ctypes.c_long]
cf.CFStringCreateWithCString.restype = ctypes.c_void_p
cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
cf.CFStringGetCStringPtr.restype = ctypes.c_char_p
cf.CFStringGetCStringPtr.argtypes = [ctypes.c_void_p, ctypes.c_uint32]

def tostr(p):
    if not p: return None
    q = cf.CFStringGetCStringPtr(p, 0x08000100)
    return q.decode('utf-8', 'replace') if q else None

def cfstr(s):
    return cf.CFStringCreateWithCString(None, s.encode(), 0x08000100)

k_id = cfstr('TISInputSourceID')
arr = carbon.TISCreateInputSourceList(None, True)
n = cf.CFArrayGetCount(arr)
found = []
for i in range(n):
    sid = tostr(carbon.TISGetInputSourceProperty(cf.CFArrayGetValueAtIndex(arr, i), k_id))
    if sid and bid in sid:
        found.append(sid)
print(f"  {n} input sources installed")
if found:
    for s in found:
        print(f"  \033[32m★ ALREADY REGISTERED: {s}\033[0m")
else:
    print(f"  \033[31m✗ nothing matching {bid}\033[0m")
PY

say "2. Calling TISRegisterInputSource on the bundle"
python3 - "$APP" <<'PY'
import ctypes, ctypes.util, sys, os
app = os.path.abspath(sys.argv[1])
carbon = ctypes.cdll.LoadLibrary(ctypes.util.find_library('Carbon'))
cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library('CoreFoundation'))

cf.CFURLCreateFromFileSystemRepresentation.restype = ctypes.c_void_p
cf.CFURLCreateFromFileSystemRepresentation.argtypes = [
    ctypes.c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_bool]
carbon.TISRegisterInputSource.restype = ctypes.c_int32
carbon.TISRegisterInputSource.argtypes = [ctypes.c_void_p]

url = cf.CFURLCreateFromFileSystemRepresentation(None, app.encode(), len(app.encode()), True)
if not url:
    print("  ✗ could not make a CFURL for the bundle")
    sys.exit(1)
rc = carbon.TISRegisterInputSource(url)
if rc == 0:
    print("  \033[32m✓ TISRegisterInputSource returned noErr\033[0m")
else:
    print(f"  \033[31m✗ TISRegisterInputSource returned {rc}\033[0m")
PY

say "3. Enabling every mode this bundle declares"
python3 - "$BUNDLE_ID" "$APP" <<'PY'
import ctypes, ctypes.util, sys, plistlib, os
bid, app = sys.argv[1], sys.argv[2]
carbon = ctypes.cdll.LoadLibrary(ctypes.util.find_library('Carbon'))
cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library('CoreFoundation'))

for f, r, a in (
    ('TISCreateInputSourceList', ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_bool]),
    ('TISGetInputSourceProperty', ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_void_p]),
    ('TISEnableInputSource', ctypes.c_int32, [ctypes.c_void_p]),
    ('TISSelectInputSource', ctypes.c_int32, [ctypes.c_void_p]),
):
    getattr(carbon, f).restype = r
    getattr(carbon, f).argtypes = a
cf.CFArrayGetCount.restype = ctypes.c_long
cf.CFArrayGetCount.argtypes = [ctypes.c_void_p]
cf.CFArrayGetValueAtIndex.restype = ctypes.c_void_p
cf.CFArrayGetValueAtIndex.argtypes = [ctypes.c_void_p, ctypes.c_long]
cf.CFStringCreateWithCString.restype = ctypes.c_void_p
cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
cf.CFStringGetCStringPtr.restype = ctypes.c_char_p
cf.CFStringGetCStringPtr.argtypes = [ctypes.c_void_p, ctypes.c_uint32]

def tostr(p):
    if not p: return None
    q = cf.CFStringGetCStringPtr(p, 0x08000100)
    return q.decode('utf-8', 'replace') if q else None

k_id = cf.CFStringCreateWithCString(None, b'TISInputSourceID', 0x08000100)

# The mode IDs this bundle declares — read from its own Info.plist, not guessed
with open(os.path.join(app, 'Contents', 'Info.plist'), 'rb') as fh:
    plist = plistlib.load(fh)
modes = list(plist.get('ComponentInputModeDict', {}).get('tsInputModeListKey', {}).keys())
print(f"  declared modes: {modes or '(none)'}")

arr = carbon.TISCreateInputSourceList(None, True)
n = cf.CFArrayGetCount(arr)
targets = []
for i in range(n):
    src = cf.CFArrayGetValueAtIndex(arr, i)
    sid = tostr(carbon.TISGetInputSourceProperty(src, k_id))
    if sid and (sid in modes or bid in sid):
        targets.append((sid, src))

if not targets:
    print("  \033[31m✗ the system still does not list it — registration did not take\033[0m")
    print("    This is the point where a Developer ID / notarization question would")
    print("    begin. Run macos/why-not-listed.sh for the full picture.")
    sys.exit(0)

for sid, src in targets:
    rc = carbon.TISEnableInputSource(src)
    print(f"  {'✓' if rc == 0 else '✗'} TISEnableInputSource({sid}) -> {rc}")
PY

say "4. After"
python3 - "$BUNDLE_ID" <<'PY'
import ctypes, ctypes.util, sys
bid = sys.argv[1]
carbon = ctypes.cdll.LoadLibrary(ctypes.util.find_library('Carbon'))
cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library('CoreFoundation'))
carbon.TISCreateInputSourceList.restype = ctypes.c_void_p
carbon.TISCreateInputSourceList.argtypes = [ctypes.c_void_p, ctypes.c_bool]
carbon.TISGetInputSourceProperty.restype = ctypes.c_void_p
carbon.TISGetInputSourceProperty.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
cf.CFArrayGetCount.restype = ctypes.c_long
cf.CFArrayGetCount.argtypes = [ctypes.c_void_p]
cf.CFArrayGetValueAtIndex.restype = ctypes.c_void_p
cf.CFArrayGetValueAtIndex.argtypes = [ctypes.c_void_p, ctypes.c_long]
cf.CFStringCreateWithCString.restype = ctypes.c_void_p
cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
cf.CFStringGetCStringPtr.restype = ctypes.c_char_p
cf.CFStringGetCStringPtr.argtypes = [ctypes.c_void_p, ctypes.c_uint32]

def tostr(p):
    if not p: return None
    q = cf.CFStringGetCStringPtr(p, 0x08000100)
    return q.decode('utf-8', 'replace') if q else None

k_id = cf.CFStringCreateWithCString(None, b'TISInputSourceID', 0x08000100)
arr = carbon.TISCreateInputSourceList(None, True)
n = cf.CFArrayGetCount(arr)
found = []
for i in range(n):
    sid = tostr(carbon.TISGetInputSourceProperty(cf.CFArrayGetValueAtIndex(arr, i), k_id))
    if sid and bid in sid:
        found.append(sid)
if found:
    print(f"  \033[32m★ NOW REGISTERED ({len(found)}):\033[0m")
    for s in found:
        print(f"      {s}")
    print()
    print("  Next: System Settings -> Keyboard -> Input Sources -> Edit -> + ->")
    print("        Traditional Chinese -> 平注")
else:
    print(f"  \033[31m✗ still not registered\033[0m")
PY
