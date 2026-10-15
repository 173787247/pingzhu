#include "router.h"

namespace pingzhu {

Decision route(const KeyEvent &key, const EngineState &state) {
    switch (key.kind) {
        case KeyKind::Enter:
            // Only while composing: outside one the key belongs to whatever the
            // user is editing, and an input method that swallows Enter is one
            // nobody can press Enter in.
            return {state.composing ? Action::Commit : Action::Pass, 0};

        case KeyKind::Escape:
            return {state.composing ? Action::Cancel : Action::Pass, 0};

        case KeyKind::Backspace:
            return {state.composing ? Action::Backspace : Action::Pass, 0};

        case KeyKind::Space:
            // Space ends in an acceptance, but not on its first press. A first
            // press that committed would leave the second candidate reachable
            // only by someone who already knew to press ↓, so the first press
            // opens the list and the second takes what is on it. With nothing to
            // offer it accepts as before; outside a composition it is a space.
            if (!state.composing) return {Action::Pass, 0};
            if (!state.candidateWindowOpen && state.hasCandidates) {
                return {Action::OpenCandidates, 0};
            }
            return {Action::Commit, 0};

        case KeyKind::ArrowDown:
            // One key for both halves of browsing: shut, it opens; open, it
            // moves on ten. Nothing to browse without a composition to resolve.
            if (!state.composing || !state.hasCandidates) return {Action::Pass, 0};
            return {state.candidateWindowOpen ? Action::NextPage : Action::OpenCandidates, 0};

        case KeyKind::ArrowUp:
            // Only while the list is open: with nothing to close, the key
            // belongs to the application.
            return {(state.composing && state.candidateWindowOpen) ? Action::CloseCandidates
                                                                   : Action::Pass,
                    0};

        case KeyKind::PageDown:
            return {state.candidateWindowOpen ? Action::NextPage : Action::Pass, 0};

        case KeyKind::PageUp:
            return {state.candidateWindowOpen ? Action::PrevPage : Action::Pass, 0};

        case KeyKind::Character: {
            // The digits are Bopomofo keys — 1 is ㄅ, 2 is ㄉ, 5 is ㄓ — so they
            // may only select a candidate once the list is actually open.
            // Requiring the key to compose before it could compose is the bug
            // that shipped in v0.6.0.
            if (key.ch >= '0' && key.ch <= '9') {
                if (state.composing && state.candidateWindowOpen && state.hasCandidates) {
                    const int oneBased = (key.ch == '0') ? 10 : (key.ch - '0');
                    return {Action::SelectCandidate, oneBased};
                }
            }
            return {Action::Compose, 0};
        }

        case KeyKind::Other:
        default:
            return {Action::Pass, 0};
    }
}

}  // namespace pingzhu
