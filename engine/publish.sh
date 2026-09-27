#!/usr/bin/env bash
# Publishes pingzhu-engine to npm.
#
# Run this yourself. It needs an npm account and a token, and those are yours —
# a publish credential should never pass through anyone else's hands, including
# an assistant's. Everything up to the credential is automated here.
#
# usage:
#   cd engine && bash publish.sh --dry-run     # build, test, pack, inspect
#   cd engine && bash publish.sh               # the real thing
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

log() { printf '\033[1;34m[npm]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[npm]\033[0m %s\n' "$*" >&2; exit 1; }

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# The machine's .npmrc points at registry.npmmirror.com, which is a read-only
# mirror: publishing there fails with an error about the package name rather than
# about the registry, which is a confusing way to find out. Named explicitly so
# the destination is never in doubt.
REGISTRY="https://registry.npmjs.org"

# ---------------------------------------------------------------- preflight

command -v npm >/dev/null || fail "npm not found"

# Skipped on a dry run on purpose: the point of a dry run is to exercise the
# build, the tests and the packing on a machine that has no credential — which is
# every machine until the maintainer logs in.
log "checking who you are"
if [ "$DRY_RUN" = "1" ]; then
  log "  (dry run: skipping the credential check)"
elif ! npm whoami --registry "$REGISTRY" >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[npm] not logged in to registry.npmjs.org.

      npm login --registry https://registry.npmjs.org

      Create the account at https://www.npmjs.com/signup if you do not have
      one. Two-factor auth is worth enabling: it is required for publishing
      anyway once the package has a maintainer.

      (Your ~/.npmrc currently points at registry.npmmirror.com, which is a
      read-only mirror. `npm login` with the flag above writes the real
      registry's token without touching that setting.)
EOF
  exit 1
else
  log "  $(npm whoami --registry "$REGISTRY")"
fi

# ------------------------------------------------------------------ checks

log "typecheck"
npm run --silent typecheck

# Judged by exit code, not by grepping the output: Node's reporter writes
# "ℹ pass 66", and a pattern that does not match makes grep fail — which under
# `set -o pipefail` looks exactly like the tests failing.
log "tests"
TESTS_LOG="$(mktemp)"
if ! node --test >"$TESTS_LOG" 2>&1; then
  grep -E "^(not ok|ℹ (tests|pass|fail))" "$TESTS_LOG" | sed 's/^/  /' >&2
  rm -f "$TESTS_LOG"
  fail "the test suite failed"
fi
grep -E "^ℹ (tests|pass|fail)" "$TESTS_LOG" | sed 's/^/  /'
rm -f "$TESTS_LOG"

log "build"
npm run --silent build

[ -f dist/index.js ] || fail "dist/index.js missing after build"
[ -f data/bopomofo-lm.tsv ] || fail "the language model is missing from data/"

# The pure entry point must stay free of node builtins, or a browser bundle of
# the package will not resolve. Checked here as well as in the test suite,
# because this is the last moment before it becomes somebody else's problem.
log "verifying the main entry has no node builtins"
if grep -qE 'from "(node:)' dist/index.js dist/engine.js dist/grid.js \
    dist/dictionary.ts dist/syllable.js dist/converter.js dist/keyboard.js \
    dist/userdict.js dist/pinyin.js 2>/dev/null; then
  fail "a decoding module imports a node builtin — see node-data.ts"
fi

# ------------------------------------------------------------------- publish

log "packing"
npm pack --silent | tail -1 | sed 's/^/  /'

if [ "$DRY_RUN" = "1" ]; then
  log "dry run: inspecting the tarball, not publishing"
  tar tzf pingzhu-engine-*.tgz | sed 's/^/  /'
  log "would publish $(node -p "require('./package.json').version") to $REGISTRY"
  exit 0
fi

log "publishing to $REGISTRY"
npm publish --registry "$REGISTRY" --access public

log "verifying"
sleep 5
if npm view pingzhu-engine version --registry "$REGISTRY" >/dev/null 2>&1; then
  log "  pingzhu-engine@$(npm view pingzhu-engine version --registry "$REGISTRY") is live"
else
  fail "published, but the registry does not list it yet — check again in a minute"
fi

cat <<'EOF'

[npm] done. Anyone can now:

      npm install pingzhu-engine

      import { InputEngine, LAYOUTS } from "pingzhu-engine";
      import { loadDictionary } from "pingzhu-engine/node";

EOF
