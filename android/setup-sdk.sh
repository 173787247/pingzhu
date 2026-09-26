#!/usr/bin/env bash
# Installs the Android SDK pieces this project needs, on a machine that has none.
#
# Written down because two of the steps are not obvious and both fail with an
# error that points somewhere else entirely.
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
CMDLINE_VERSION="${CMDLINE_VERSION:-11076708}"
NDK_VERSION="${NDK_VERSION:-26.1.10909125}"

log() { printf '\033[1;34m[android-setup]\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 1. A JDK that is actually a Linux JDK.
#
# This is the trap. On a machine where `java` resolves through a symlink into a
# Windows install — which is the default in some WSL setups — `sdkmanager` fails
# with:
#
#     ClassNotFoundException: com.android.sdklib.tool.sdkmanager.SdkManagerCli
#
# which reads like a broken download or a missing jar. It is neither: it is a
# Windows JVM being handed Linux classpath separators. Check it, do not assume it.
# ---------------------------------------------------------------------------
JDK="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
if [ ! -x "$JDK/bin/java" ]; then
  log "no Linux JDK at $JDK"
  log "install one: sudo apt-get install -y openjdk-21-jdk-headless"
  exit 1
fi
if ! "$JDK/bin/java" -version 2>&1 | grep -qi "openjdk\|temurin"; then
  log "$JDK/bin/java does not look like a Linux JDK"
  exit 1
fi
export JAVA_HOME="$JDK"
export PATH="$JAVA_HOME/bin:$PATH"
log "using JDK at $JAVA_HOME"

# ---------------------------------------------------------------------------
# 2. The command-line tools.
# ---------------------------------------------------------------------------
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  log "downloading command-line tools"
  mkdir -p "$ANDROID_HOME/cmdline-tools" /tmp/android-setup
  cd /tmp/android-setup
  curl -sSL -o cmdline.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VERSION}_latest.zip"
  # Python rather than unzip: a minimal container often has neither, and python3
  # is a dependency of the rest of this project anyway.
  python3 -c "
import zipfile, sys
zipfile.ZipFile('cmdline.zip').extractall('$ANDROID_HOME/cmdline-tools')
"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  chmod +x "$ANDROID_HOME/cmdline-tools/latest/bin/"*
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
log "sdkmanager $(sdkmanager --version)"

# ---------------------------------------------------------------------------
# 3. Platforms, build tools and the NDK.
# ---------------------------------------------------------------------------
yes | sdkmanager --licenses >/dev/null 2>&1 || true
log "installing platform-tools, android-34, build-tools 34.0.0, ndk $NDK_VERSION"
sdkmanager --install \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0" \
  "ndk;$NDK_VERSION"

cat <<EOF

Done. Add this to your shell before building:

    export JAVA_HOME=$JAVA_HOME
    export ANDROID_HOME=$ANDROID_HOME
    export PATH="\$JAVA_HOME/bin:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH"

Then:

    bash android/build-rust.sh --release   # the shared engine, for each ABI
    cd android && gradle assembleDebug     # the APK
EOF
