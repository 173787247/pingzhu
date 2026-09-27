#!/usr/bin/env bash
# Logs this machine in to npm, without a browser and without the token ending up
# in your shell history.
#
# Why not `npm login`: it opens a browser, and a WSL shell has none — it fails
# with "Set the BROWSER environment variable", which reads like a configuration
# problem rather than "there is no browser here".
#
# Why not a token on the command line: `npm config set ... <token>` puts the
# token in ~/.bash_history as plain text. The prompt below reads it without
# echoing and without it appearing in any command.
set -euo pipefail

REGISTRY="https://registry.npmjs.org"

log() { printf '\033[1;34m[npm-login]\033[0m %s\n' "$*"; }

cat <<'EOF'
Create a token (takes about a minute):

  1. Open  https://www.npmjs.com/settings/~/tokens  in a browser
  2. "Generate New Token" → Classic
  3. Type: Automation   (or Publish — either works for a first release)
  4. Copy the token, it starts with npm_

EOF

read -rsp "Paste the token here (it will not be echoed, and it is not saved to history): " TOKEN
echo

if [ -z "${TOKEN:-}" ]; then
  echo "[npm-login] no token entered" >&2
  exit 1
fi

if [[ "$TOKEN" != npm_* ]]; then
  log "warning: npm tokens normally start with npm_ — continuing anyway"
fi

# --location=user writes to ~/.npmrc, leaving the machine's mirror setting
# (registry.npmmirror.com) alone: that is a read-only mirror, useful for
# installs, and there is no reason to break it.
npm config set "//registry.npmjs.org/:_authToken" "$TOKEN" --location=user
unset TOKEN

log "checking"
if npm whoami --registry "$REGISTRY" >/dev/null 2>&1; then
  log "logged in as $(npm whoami --registry "$REGISTRY")"
  cat <<'EOF'

Now publish:

    bash publish.sh

EOF
else
  echo "[npm-login] the token was stored but npm still says no — check that it" >&2
  echo "           has not expired and has publish rights for pingzhu-engine." >&2
  exit 1
fi
