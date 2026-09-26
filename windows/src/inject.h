/*
 * Text injection.
 *
 * A portable IME cannot hand characters to the application through the input
 * method framework — that is exactly what TSF would give us, and what needs COM
 * registration and administrator rights. So committed text is pushed in as
 * synthetic keystrokes carrying Unicode code units.
 *
 * This works in Notepad, browsers, Office, Electron apps and most Win32 editors.
 * It does not work in windows that read raw input (many games) or in elevated
 * processes seen from a non-elevated IME, which is a UIPI restriction rather
 * than a bug. The TSF shell is the answer to both.
 */
#ifndef PINGZHU_INJECT_H
#define PINGZHU_INJECT_H

#include <string>

namespace pingzhu {

/* Type `utf8` into whatever window has focus. Returns the number of characters
 * actually sent. */
int injectUtf8(const std::string &utf8);

/* Same, but for a single Enter press. */
void injectEnter();

}  // namespace pingzhu

#endif  // PINGZHU_INJECT_H
