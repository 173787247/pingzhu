#include "router.h"

namespace pingzhu {

bool is_layout_key(char ch) {
    if (ch >= 'a' && ch <= 'z') return true;   // consonants, medials, most vowels
    if (ch >= '0' && ch <= '9') return true;   // 1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ
    switch (ch) {
        case '-':  // ㄦ
        case ';':  // ㄤ
        case '/':  // ㄥ
        case ',':  // ㄝ
        case '.':  // ㄡ
            return true;
        default:
            return false;
    }
}

Decision route(const KeyEvent &key, const EngineState &state, bool chineseMode) {
    if (!chineseMode) return {Action::Pass, 0};

    /* Checked before the modifier rule below, which would otherwise hand every
     * Ctrl+Alt combination to the application. */
    if (key.ctrl && key.alt && !key.shift && key.ch == kScriptToggleKey) {
        return {Action::ToggleScript, 0};
    }

    // Modifier combos belong to the application (Ctrl+C, Alt+Tab, ...). The IME
    // only claims unmodified keys.
    if (key.ctrl || key.alt) return {Action::Pass, 0};

    switch (key.kind) {
        case KeyKind::Space:
            /* Space accepts what is being composed: type ㄋㄧˇ, press space, 你
             * comes out. That is the flow every Taiwanese IME has and what
             * people's fingers expect — making space page the candidate window
             * instead means the most-pressed key in the input method does the
             * one thing nobody asked for.
             *
             * While the window is open the digits are selecting, so space has
             * nothing to accept and pages instead. Outside a composition it is
             * an ordinary space. */
            if (!state.composing) return {Action::Pass, 0};
            return state.candidateWindowOpen ? Decision{Action::NextPage, 0}
                                             : Decision{Action::Commit, 0};

        case KeyKind::Digit: {
            /* All ten digits are bopomofo keys — 1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ
             * 0ㄢ — and several of them are *initials*, so they are the first key
             * of a word. 倒 is ㄉㄠˇ = 2l3: requiring a composition to already be
             * running before a digit may compose made every word starting with
             * ㄅ, ㄉ, ㄓ, ㄚ, ㄞ or ㄢ untypeable, and the stray digit landed in
             * the user's text instead.
             *
             * Only an open candidate window makes digits select, because that is
             * the one moment the user is choosing rather than composing. */
            if (state.composing && state.candidateWindowOpen && state.hasCandidates) {
                int n = (key.ch == '0') ? 10 : (key.ch - '0');
                return {Action::SelectCandidate, n};
            }
            return {Action::Compose, 0};
        }

        case KeyKind::ArrowDown:
            return state.composing && state.hasCandidates ? Decision{Action::OpenCandidates, 0}
                                                          : Decision{Action::Pass, 0};
        case KeyKind::ArrowUp:
            return state.composing && state.candidateWindowOpen
                       ? Decision{Action::CloseCandidates, 0}
                       : Decision{Action::Pass, 0};
        case KeyKind::ArrowLeft:
            return state.composing ? Decision{Action::MoveCursor, -1} : Decision{Action::Pass, 0};
        case KeyKind::ArrowRight:
            return state.composing ? Decision{Action::MoveCursor, 1} : Decision{Action::Pass, 0};

        case KeyKind::Backspace:
            return state.composing ? Decision{Action::Backspace, 0} : Decision{Action::Pass, 0};

        case KeyKind::Enter:
            return state.composing ? Decision{Action::Commit, 0} : Decision{Action::Pass, 0};

        case KeyKind::Escape:
            return state.composing ? Decision{Action::Cancel, 0} : Decision{Action::Pass, 0};

        case KeyKind::Letter:
        case KeyKind::Symbol:
            // A layout key always starts or continues a composition, so that the
            // IME can be used without a separate "start composing" gesture.
            return is_layout_key(key.ch) ? Decision{Action::Compose, 0} : Decision{Action::Pass, 0};

        case KeyKind::Other:
        default:
            return {Action::Pass, 0};
    }
}

}  // namespace pingzhu
