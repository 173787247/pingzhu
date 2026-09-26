#!/usr/bin/env bash
# Batch-fetch a list of URLs through the HTTP proxy, saving raw HTML + plain text.
# usage: crawl.sh <outdir> <urls-file>
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
out="${1:?usage: crawl.sh <outdir> <urls-file>}"
list="${2:?usage: crawl.sh <outdir> <urls-file>}"
mkdir -p "$out/html" "$out/txt"
while read -r url; do
  [ -z "$url" ] && continue
  case "$url" in \#*) continue;; esac
  slug=$(printf '%s' "$url" | sed -e 's#^https\?://##' -e 's#[^A-Za-z0-9._-]#_#g' | cut -c1-120)
  h="$out/html/$slug.html"
  if [ -s "$h" ]; then echo "skip  $url"; continue; fi
  code=$(curl -sSL --compressed -m 90 -A "$UA" \
     -H 'Accept-Language: zh-TW,zh;q=0.9,en;q=0.8' \
     -o "$h" -w '%{http_code}' "$url" 2>/dev/null)
  if [ "$code" = "200" ] && [ -s "$h" ]; then
    python3 "$HERE/h2t.py" < "$h" > "$out/txt/$slug.txt"
    printf 'ok    %-6s %8sB  %s\n' "$code" "$(wc -c < "$h")" "$url"
  else
    printf 'FAIL  %-6s %s\n' "$code" "$url"; rm -f "$h"
  fi
  sleep 0.4
done < "$list"
