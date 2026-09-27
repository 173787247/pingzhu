#!/usr/bin/env python3
"""Checks that a built macOS input method bundle is what the system expects.

Run on the bundle, on a Mac, after building it.

Written in Python rather than a pile of `plutil -extract` calls after the first
version of this check **passed while the bundle was broken**. It looked for
`tsInputModeListKey` at the top level; the key was there, so the check was happy,
and the system ignored the whole bundle because the key belongs inside
`ComponentInputModeDict`. "The key exists" is not the question. "The structure is
right" is — and that is easier to say, and to test, in a real language.

Several of these keys are also impossible to address with `plutil -extract`
because they contain dots: the input mode is named `tw.pingzhu.ime.Bopomofo`, and
a dotted key name is indistinguishable from a dotted key path.

usage: python3 tools/check-macos-bundle.py dist/PingZhu.app
"""

import plistlib
import re
import subprocess
import sys
from pathlib import Path

FAILURES = []
CHECKS = 0


def check(what, condition, detail=""):
    global CHECKS
    CHECKS += 1
    if condition:
        print(f"ok    {what}")
    else:
        print(f"FAIL  {what}{': ' + detail if detail else ''}")
        FAILURES.append(what)


def main(app_path):
    app = Path(app_path)
    contents = app / "Contents"

    # ---------------------------------------------------------------- files
    check("the bundle exists", app.is_dir(), str(app))
    if not app.is_dir():
        return finish()

    check("the executable exists", (contents / "MacOS/PingZhu").is_file())
    check("Info.plist exists", (contents / "Info.plist").is_file())
    check(
        "the language model is in the bundle",
        (contents / "Resources/data/bopomofo-lm.tsv").is_file(),
        "without it the input method installs and then types nothing",
    )
    check(
        "the conversion table is in the bundle",
        (contents / "Resources/data/ts-conversion.tsv").is_file(),
    )

    if not (contents / "Info.plist").is_file():
        return finish()

    info = plistlib.loads((contents / "Info.plist").read_bytes())

    # ------------------------------------------------------------ identity
    check("CFBundlePackageType is APPL", info.get("CFBundlePackageType") == "APPL")
    check("CFBundleIdentifier is set", bool(info.get("CFBundleIdentifier")))
    check("LSUIElement is set", info.get("LSUIElement") is True,
          "an input method must not appear in the Dock")
    check("NSPrincipalClass is NSApplication",
          info.get("NSPrincipalClass") == "NSApplication")

    # ------------------------------------------------------ the silent ones
    #
    # Each of these, when wrong, produces an input method that installs
    # successfully and then does nothing at all — no error, no warning.
    connection = info.get("InputMethodConnectionName")
    check("InputMethodConnectionName is set", bool(connection))
    if connection:
        main_swift = Path(__file__).resolve().parent.parent / "macos/Sources/main.swift"
        if main_swift.is_file():
            source = main_swift.read_text(encoding="utf-8")
            check(
                "the connection name matches main.swift",
                f'"{connection}"' in source,
                f"the system would start the server and never find it ({connection})",
            )

    controller = info.get("InputMethodServerControllerClass")
    check("InputMethodServerControllerClass is set", bool(controller))
    if controller:
        controller_swift = (
            Path(__file__).resolve().parent.parent
            / "macos/Sources/PingZhuInputController.swift"
        )
        if controller_swift.is_file():
            source = controller_swift.read_text(encoding="utf-8")
            check(
                f"the controller class matches @objc({controller})",
                f"@objc({controller})" in source,
            )

    # ------------------------------------------------------- input modes
    #
    # This is the part that was wrong. `tsInputModeListKey` must be inside
    # `ComponentInputModeDict`; at the top level it is silently ignored.
    component = info.get("ComponentInputModeDict")
    check(
        "ComponentInputModeDict exists",
        isinstance(component, dict),
        "tsInputModeListKey at the top level is ignored — the bundle installs and "
        "the system never lists it",
    )
    if not isinstance(component, dict):
        return finish()

    modes = component.get("tsInputModeListKey")
    check("tsInputModeListKey is inside ComponentInputModeDict", isinstance(modes, dict))
    if not isinstance(modes, dict) or not modes:
        return finish()

    ordered = component.get("tsVisibleInputModeOrderedArrayKey")
    check("tsVisibleInputModeOrderedArrayKey exists", isinstance(ordered, list))
    if isinstance(ordered, list):
        missing = [mode for mode in ordered if mode not in modes]
        check("every visible mode is declared", not missing, str(missing))

    source_id = info.get("TISInputSourceID")
    check("TISInputSourceID is set", bool(source_id))

    for name, mode in modes.items():
        check(f"{name}: TISIntendedLanguage is zh-Hant",
              mode.get("TISIntendedLanguage") == "zh-Hant")
        check(f"{name}: tsInputModeScriptKey is smTradChinese",
              mode.get("tsInputModeScriptKey") == "smTradChinese",
              "filed under Roman, it is never offered while typing Chinese")
        check(f"{name}: tsInputModeIsVisibleKey is set",
              mode.get("tsInputModeIsVisibleKey") is True)
        check(f"{name}: tsInputModeDefaultStateKey is set",
              mode.get("tsInputModeDefaultStateKey") is True)
        check(f"{name}: tsInputModePrimaryInScriptKey is set",
              mode.get("tsInputModePrimaryInScriptKey") is True)
        check(
            f"{name}: the mode name starts with the bundle identifier",
            source_id is not None and name.startswith(source_id + "."),
            "IMK groups modes by their prefix",
        )
        repertoire = mode.get("tsInputModeCharacterRepertoireKey")
        check(f"{name}: declares a character repertoire",
              isinstance(repertoire, list) and bool(repertoire))

    # ------------------------------------------------------- architecture
    #
    # Only on macOS: `lipo` does not exist elsewhere, and this script is meant to
    # be runnable anywhere the bundle is.
    executable = contents / "MacOS/PingZhu"
    if executable.is_file() and sys.platform == "darwin":
        try:
            archs = subprocess.run(
                ["lipo", "-archs", str(executable)],
                capture_output=True, text=True, check=True,
            ).stdout.split()
        except (subprocess.CalledProcessError, FileNotFoundError):
            archs = []
        if archs:
            check("the executable is universal (arm64 + x86_64)",
                  "arm64" in archs and "x86_64" in archs,
                  " ".join(archs) + " — an Intel Mac would install it and it would "
                  "not launch")

    return finish()


def finish():
    print()
    if FAILURES:
        print(f"{len(FAILURES)} of {CHECKS} checks failed")
        for failure in FAILURES:
            print(f"  - {failure}")
        return 1
    print(f"bundle checks passed ({CHECKS} checks)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: check-macos-bundle.py <path to PingZhu.app>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
