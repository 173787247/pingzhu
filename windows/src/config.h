/*
 * Settings, read from `pingzhu.ini` next to the DLL or executable.
 *
 * A TSF text service has nowhere to put a settings UI: it is loaded into other
 * people's processes and has no window of its own. A small text file next to the
 * binary is the honest answer — editable in Notepad, diffable, and it survives
 * being copied to another machine.
 *
 * Format is deliberately forgiving: `key = value` per line, `#` or `;` starts a
 * comment, unknown keys are ignored rather than fatal. A settings file that
 * refuses to load because of a stray character is worse than one that ignores it.
 */
#ifndef PINGZHU_CONFIG_H
#define PINGZHU_CONFIG_H

#include <climits>
#include <string>

namespace pingzhu {

struct Config {
    /* "traditional" or "simplified" */
    std::string output = "traditional";

    /* Where the floating 繁／簡 button was left. INT_MIN means "never moved",
     * which is different from a position that happens to be off-screen. */
    int statusX = INT_MIN;
    int statusY = INT_MIN;

    /* Resolved from the same directory search the data files use. */
    std::wstring path;
};

/* Load `<moduleDir>\pingzhu.ini`. A missing or unreadable file yields defaults:
 * the input method must still work, because a settings problem is not a reason
 * to stop typing. */
Config loadConfig(const std::wstring &moduleDir);

/* Write a commented default file if none exists, so the settings are
 * discoverable instead of a secret. Never overwrites an existing file. */
void writeDefaultConfigIfMissing(const std::wstring &moduleDir);

/* Persist just the output script, preserving nothing else — the file is
 * rewritten from the current values, with the comments kept. */
bool saveOutputScript(const std::wstring &moduleDir, const std::string &script);

/* Remember where the floating button was dragged to. */
bool saveStatusPosition(const std::wstring &moduleDir, int x, int y);

/* Trimmed value for `key`, or "" when absent. Exposed for tests. */
std::string configValue(const std::string &text, const std::string &key);

}  // namespace pingzhu

#endif  // PINGZHU_CONFIG_H
