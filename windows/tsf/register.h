/*
 * CTF registration.
 *
 * Two separate registrations, and it matters that they are separate:
 *
 *   1. the COM in-proc server — HKLM\SOFTWARE\Classes\CLSID\{...}\InprocServer32
 *   2. the *language profile* — the thing the language bar actually lists, kept
 *      by the CTF manager rather than in a registry key we own
 *
 * Both live in HKLM, so both need elevation. That is a Windows design decision,
 * not an oversight here: a per-user text service could not be loaded into
 * processes running as other users.
 *
 * All of it is reversible, and unregistering must be complete — a language
 * profile whose CLSID no longer resolves leaves a dead entry in the language bar
 * that the user cannot remove through the UI.
 */
#ifndef PINGZHU_TSF_REGISTER_H
#define PINGZHU_TSF_REGISTER_H

#include <windows.h>

#include <string>

namespace pingzhu::tsf {

HRESULT registerComServer(const std::wstring &dllPath);
HRESULT unregisterComServer();

HRESULT registerProfiles();
HRESULT unregisterProfiles();

/* Add or remove the input method in the *user's* language list.
 *
 * Registering a TIP makes it available; it does not put it in the language bar.
 * The user's list of input methods lives elsewhere, and the supported way to
 * change it programmatically is InstallLayoutOrTip in input.dll — undocumented,
 * but it is what every IME installer uses, Microsoft's own included. Without
 * this call the text service is registered, correct, and completely invisible. */
HRESULT installLayoutOrTip(bool install);

/* True when the language profile is present, so an installer can report state
 * instead of guessing. Read-only; works without elevation. */
bool isRegistered();

/* True when the input method is in the current user's language list, i.e. the
 * user can actually select it. */
bool isInLanguageList();

/* Human-readable description of an HRESULT for the installer's output. */
std::wstring describe(HRESULT hr);

}  // namespace pingzhu::tsf

#endif  // PINGZHU_TSF_REGISTER_H
