#!/usr/bin/env bash
# Why does the system not list our input method?
#
# The comparison against a working input method on the same machine (自然輸入法,
# /Library/Input Methods/GOING13.app) came back with "keys it has that we do not:
# (nothing)" — our Info.plist has every key theirs has. So the difference is not
# in the plist keys, and three hypotheses have already been eliminated:
#
#   1. the script key (smRoman vs smTradChinese)  — fixed, still not listed
#   2. the structure (ComponentInputModeDict)     — fixed, still not listed
#   3. the location (~/Library vs /Library)       — tried, still not listed
#
# Two things have not been checked, and both would produce exactly this silence:
#
#   a. the executable crashes on launch. A bundle whose program cannot run is
#      never registered, and `open` returning 0 only means the launch was
#      requested — not that it succeeded. CI checked the exit status of `open`
#      and drew the wrong conclusion from it.
#
#   b. LaunchServices has never accepted the bundle. Its own database answers
#      that, and nothing else does.
#
# This script checks both. It changes nothing.
set -uo pipefail

say()  { printf '\033[1;34m[diag]\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# macOS has no `timeout` unless coreutils is installed from Homebrew. This is the
# portable version: run it in the background, kill it if it is still there.
#
# The first version of this script ran `lsregister -dump` bare. That walks the
# whole LaunchServices database — minutes on a machine with many applications —
# and with no way to stop it, it simply sat there. The user reported a timeout.
with_timeout() {
    local seconds="$1"; shift
    "$@" & local pid=$!
    ( sleep "$seconds"; kill -9 "$pid" 2>/dev/null ) & local watcher=$!
    wait "$pid" 2>/dev/null; local status=$?
    kill "$watcher" 2>/dev/null; wait "$watcher" 2>/dev/null
    return $status
}

[ "$(uname -s)" = "Darwin" ] || { echo "this is a macOS diagnostic" >&2; exit 1; }

OURS=""
for candidate in "$HOME/Library/Input Methods/PingZhu.app" "/Library/Input Methods/PingZhu.app"; do
    [ -d "$candidate" ] && OURS="$candidate"
done
[ -n "$OURS" ] || { echo "PingZhu.app is not installed; run install.sh first" >&2; exit 1; }
say "checking $OURS"
say "(every command below is time-limited; nothing should hang)"

BINARY="$OURS/Contents/MacOS/PingZhu"

head_ "1. can the program even run?"
echo "  file: $(file -b "$BINARY" 2>/dev/null || echo '?')"
echo "  executable: $([ -x "$BINARY" ] && echo yes || echo NO)"

echo
say "running it for 3 seconds…"
OUT="$(mktemp)"
( "$BINARY" >"$OUT" 2>&1 & echo $! > "$OUT.pid" ) 2>/dev/null
sleep 3
PID="$(cat "$OUT.pid" 2>/dev/null || echo '')"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "    still running after 3s (pid $PID) — it starts"
    kill "$PID" 2>/dev/null
    RUNS=yes
else
    echo "    NOT RUNNING after 3s — it exited or crashed"
    RUNS=no
fi
echo "    output:"
sed 's/^/      /' "$OUT" | head -30
[ -s "$OUT" ] || echo "      (nothing)"
rm -f "$OUT" "$OUT.pid"

head_ "2. does LaunchServices know about it?"
# -dump is the only thing that reports LaunchServices' own opinion. It is long,
# so only the lines around our bundle are shown.
LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [ -x "$LSREG" ]; then
    say "dumping the database, hard-limited to 25 seconds…"
    DUMP="$(mktemp)"
    if with_timeout 25 "$LSREG" -dump >"$DUMP" 2>/dev/null; then
        FOUND=$(grep -c -i "pingzhu" "$DUMP" || true)
        echo "  entries mentioning pingzhu: $FOUND"
        if [ "$FOUND" -gt 0 ]; then
            grep -i -B2 -A8 "pingzhu" "$DUMP" | head -40 | sed 's/^/    /'
        else
            echo "    LaunchServices has never heard of it — that is why nothing else has"
        fi
    else
        echo "  the dump did NOT finish in 25s — this machine's database is large."
        echo "  That is not a symptom, it is just a slow command. Skipping it,"
        echo "  because the previous version waited here forever."
    fi
    rm -f "$DUMP"
else
    echo "  lsregister not found at the expected path"
fi

head_ "3. what the system says about the bundle"
echo "  codesign:"
codesign -dv --verbose=2 "$OURS" 2>&1 | head -12 | sed 's/^/    /'
echo
echo "  identifier check:"
echo "    CFBundleIdentifier: $(defaults read "$OURS/Contents/Info.plist" CFBundleIdentifier 2>/dev/null || echo '?')"
echo "    TISInputSourceID:   $(defaults read "$OURS/Contents/Info.plist" TISInputSourceID 2>/dev/null || echo '?')"
echo "    (a working input method has these as the same string; ours differ by the"
echo "     mode suffix, which may or may not matter)"

head_ "4. the full difference from the working one"
REF="/Library/Input Methods/GOING13.app"
if [ -d "$REF" ]; then
    plutil -convert xml1 -o /tmp/ref.plist "$REF/Contents/Info.plist" 2>/dev/null
    plutil -convert xml1 -o /tmp/ours.plist "$OURS/Contents/Info.plist" 2>/dev/null
    echo "  --- theirs (keys only) ---"
    grep -oE '<key>[^<]+</key>' /tmp/ref.plist 2>/dev/null | sed 's/<\/*key>//g' | sort | sed 's/^/    /'
    echo "  --- ours (keys only) ---"
    grep -oE '<key>[^<]+</key>' /tmp/ours.plist 2>/dev/null | sed 's/<\/*key>//g' | sort | sed 's/^/    /'
    echo "  --- diff ---"
    diff <(grep -oE '<key>[^<]+</key>' /tmp/ref.plist 2>/dev/null | sed 's/<\/*key>//g' | sort) \
         <(grep -oE '<key>[^<]+</key>' /tmp/ours.plist 2>/dev/null | sed 's/<\/*key>//g' | sort) \
      | sed 's/^/    /' || true
else
    echo "  $REF not found"
fi

head_ "5. the same keys, printed flat, for reading"
for label in "theirs:$REF" "ours:$OURS"; do
    name="${label%%:*}"
    path="${label#*:}"
    echo "  --- $name ---"
    plutil -p "$path/Contents/Info.plist" 2>/dev/null | head -40 | sed 's/^/    /'
done

cat <<'EOF'

────────────────────────────────────────────────────────────

Send all of this. The two answers that matter are in section 1 (does it run)
and section 2 (has LaunchServices ever accepted it).
EOF
