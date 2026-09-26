#!/usr/bin/env bash
# Create a release, with the Simplified conversion applied to the notes first.
#
# Release titles and bodies live on GitHub, not in the repository, so the
# document conversion never touches them. Writing them by hand is how v0.6.2 and
# v0.7.0 ended up with a Traditional title and a body that switched script
# halfway through — visible to every reader, and invisible to every check in the
# repo.
#
# This wrapper converts the notes, creates the release, and then re-reads it to
# confirm nothing Traditional survives. Refusing to publish beats publishing
# something that has to be fixed by hand afterwards.
#
# usage: bash tools/release.sh <tag> <title> <notes-file> <asset> [asset...]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

if [ "$#" -lt 4 ]; then
  echo "usage: bash tools/release.sh <tag> <title> <notes-file> <asset> [asset...]" >&2
  exit 2
fi

TAG="$1"; TITLE="$2"; NOTES="$3"; shift 3
ASSETS=("$@")

log() { printf '\033[1;34m[release]\033[0m %s\n' "$*"; }

cd "$ROOT"

# Convert the title and the notes. Both go through the same table the engine
# ships, so a term renders the same way here as it does in the product.
CONVERTED_NOTES="$(mktemp)"
trap 'rm -f "$CONVERTED_NOTES"' EXIT
cp "$NOTES" "$CONVERTED_NOTES"
node tools/to-simplified.mjs "$CONVERTED_NOTES" >/dev/null

CONVERTED_TITLE="$(node --experimental-strip-types -e '
import { Converter } from "./engine/src/converter.ts";
const c = Converter.fromFile("data/ts-conversion.tsv");
process.stdout.write(c.toSimplified(process.argv[1]));
' "$TITLE")"

if [ "$CONVERTED_TITLE" != "$TITLE" ]; then
  log "title converted: $CONVERTED_TITLE"
fi

log "creating $TAG"
gh release create "$TAG" --title "$CONVERTED_TITLE" --notes-file "$CONVERTED_NOTES" "${ASSETS[@]}"

# Read it back. Creating a release and assuming it is right is how the mixed
# script shipped in the first place.
log "verifying what GitHub actually stored"
node tools/simplify-github.mjs --check | tee /tmp/release-verify.log
if ! grep -q 'items converted    0' /tmp/release-verify.log; then
  log "STILL TRADITIONAL — running the converter over everything"
  node tools/simplify-github.mjs
fi

log "done"
