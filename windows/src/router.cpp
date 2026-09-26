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

    // Modifier combos belong to the application (Ctrl+C, Alt+Tab, ...). The IME
    // only claims unmodified keys.
    if (key.ctrl || key.alt) return {Action::Pass, 0};

    switch (key.kind) {
        case KeyKind::Space:
            // Space opens the candidate window and then pages through it, which
            // is how 自然輸入法 behaves. Outside a composition it is a space.
            return state.composing ? Decision{Action::NextPage, 0} : Decision{Action::Pass, 0};

        case KeyKind::Digit: {
            if (!state.composing) return {Action::Pass, 0};
            // 1..9 then 0 for the tenth, matching the candidate window labels.
            if (state.candidateWindowOpen && state.hasCandidates) {
                int n = (key.ch == '0') ? 10 : (key.ch - '0');
                return {Action::SelectCandidate, n};
            }
            return {Action::Compose, 0};  // digits *are* bopomofo keys
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
