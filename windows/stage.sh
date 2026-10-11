#!/usr/bin/env bash
# Where the Windows-side build is assembled.
#
# Sourced by build.sh and package.sh — not meant to be run on its own.
#
# The staging directory has to be one Windows can see: MSVC compiles with it as
# the working directory, and cmd.exe cannot start with a \\wsl.localhost\... path
# there. So it cannot live in the Linux home directory, however convenient that
# would be.
#
# It is also where the running input method loads its DLL from. That makes the
# default a per-user location Windows already owns, rather than a path with
# somebody's name baked into it — which is what it used to be, and which meant
# the staging default only worked on the machine that wrote it.
#
# WSL and Windows are not obliged to agree on a user name, so the default is
# asked of Windows itself (%LOCALAPPDATA%) and translated, instead of assuming
# the two names match.
#
#   PINGZHU_STAGE=/mnt/c/pingzhu-build bash windows/build.sh   environment
#   bash windows/build.sh /mnt/c/pingzhu-build                 argument (wins)

default_stage() {
  local win drive rest
  win="$(cmd.exe /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r\n')" || true
  case "$win" in
    [A-Za-z]:\\*)
      drive="$(printf '%s' "${win:0:1}" | tr '[:upper:]' '[:lower:]')"
      rest="${win:2}"                                   # \Users\me\AppData\Local
      printf '/mnt/%s%s/pingzhu-build\n' \
        "$drive" "$(printf '%s' "$rest" | tr '\\' '/')"
      ;;
    *)
      printf 'cannot locate a Windows-visible staging directory.\n' >&2
      printf 'Set one, e.g. PINGZHU_STAGE=/mnt/c/pingzhu-build\n' >&2
      return 1
      ;;
  esac
}

# argument > environment > ask Windows
resolve_stage() {
  if [ -n "${1:-}" ]; then
    printf '%s\n' "$1"
  elif [ -n "${PINGZHU_STAGE:-}" ]; then
    printf '%s\n' "$PINGZHU_STAGE"
  else
    default_stage
  fi
}
