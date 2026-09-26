#!/usr/bin/env bash
# Fetch the MIT-licensed upstream data sources used by data/build.mjs.
# They are not committed (see .gitignore); this pins them by tag + sha256.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR="$HERE/vendor"
REF="${MCBOPOMOFO_REF:-main}"
BASE="https://raw.githubusercontent.com/openvanilla/McBopomofoWeb/$REF/src/McBopomofo"
mkdir -p "$VENDOR"
for f in WebData.ts WebDataPlain.ts; do
  if [ -s "$VENDOR/$f" ]; then echo "have  $f"; continue; fi
  echo "fetch $f"
  curl -sSL --compressed -m 180 -o "$VENDOR/$f" "$BASE/$f"
done
echo "--- sha256 ---"
sha256sum "$VENDOR"/*.ts
cat <<'EOF'

Note: McBopomofo's data is MIT licensed (Copyright (c) 2022 and onwards The
McBopomofo Authors), and its phrase list descends from libtabe's tsi.src (BSD).
See NOTICE for the full attribution chain.
EOF
