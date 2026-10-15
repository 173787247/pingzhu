/*
 * Key routing for the fcitx5 addon — what a keystroke means.
 *
 * Deliberately free of any fcitx5 header, for the same reason the Windows
 * router is free of <windows.h>: routing is a table, and a table can be checked
 * without a desktop, a panel, or an input context. The addon hands it a key and
 * a small state struct and does what comes back.
 *
 * Why this file exists at all: the rules used to be written inline in
 * keyEvent(), where nothing could reach them. Three of them had already drifted
 * from the other shells —
 *
 *   - space with the list open refreshed the list instead of accepting
 *   - ↓ never opened the list
 *   - ↑↓ moved a highlight that no key ever took, so the third candidate could
 *     be lit up and space would still commit the first
 *
 * — and none of that could turn red, because the Linux side had nothing to run
 * the shared vectors (tools/routing-vectors.tsv) against. Windows, macOS and
 * Android each have a router with a test; this is the fourth.
 */
#ifndef PINGZHU_FCITX5_ROUTER_H
#define PINGZHU_FCITX5_ROUTER_H

namespace pingzhu {

enum class KeyKind {
    Character,  // anything the layout might use: letters, digits, symbols
    Space,
    Backspace,
    Enter,
    Escape,
    ArrowUp,
    ArrowDown,
    PageUp,
    PageDown,
    Other,      // modifiers, function keys, ...
};

struct KeyEvent {
    KeyKind kind = KeyKind::Other;
    char ch = 0;  // lower-case character for Character, else 0
};

struct EngineState {
    bool composing = false;            // there are keystrokes in the buffer
    bool candidateWindowOpen = false;  // digits select instead of composing
    bool hasCandidates = false;        // there is something to open or page
};

enum class Action {
    Pass,             // hand the key back to the application
    Compose,          // feed the character to the engine
    SelectCandidate,  // 1..10 in `arg`
    NextPage,         // ↓ with the list open, PageDown
    PrevPage,         // PageUp
    OpenCandidates,   // ↓ with the list shut
    CloseCandidates,  // ↑
    Backspace,
    Commit,           // Enter, or the second press of space
    Cancel,           // escape: throw the composition away
};

struct Decision {
    Action action = Action::Pass;
    int arg = 0;  // SelectCandidate: 1..10
};

/*
 * The rules, and they are the same rules as everywhere else. The two that are
 * easy to get wrong, both of which were wrong here:
 *
 *   - digits are Bopomofo keys (1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ) until the
 *     candidate list is open, or 倒 and every word beginning with ㄅㄉㄓㄚㄞㄢ
 *     becomes untypeable
 *   - space accepts on its second press, not its first, and ↓ is what browses
 *
 * PageUp/PageDown are this shell's own addition, because a panel with ten
 * candidates on it is a panel people expect to page; they are not in the shared
 * vectors, and nothing else is held to them.
 */
Decision route(const KeyEvent &key, const EngineState &state);

}  // namespace pingzhu

#endif  // PINGZHU_FCITX5_ROUTER_H
