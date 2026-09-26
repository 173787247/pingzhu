#!/usr/bin/env bash
# Fetch a URL through the Windows/WSL HTTP proxy and print plain text.
# usage: webfetch.sh <url> [--raw outfile]
# Requires HTTPS_PROXY (dsh-wsl sets http://127.0.0.1:16006).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
url="${1:?usage: webfetch.sh <url> [--raw outfile]}"
raw=""
if [ "${2:-}" = "--raw" ]; then raw="${3:?need outfile}"; fi
tmp="$(mktemp)"
code=$(curl -sSL --compressed -m 90 -A "$UA" \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en;q=0.8' \
  -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null)
if [ -n "$raw" ]; then cp "$tmp" "$raw"; fi
echo "### HTTP $code  $url" >&2
python3 "$HERE/h2t.py" < "$tmp"
rm -f "$tmp"
