/*
 * Key routing — the part of a Windows IME shell that decides what a keystroke
 * means. Deliberately free of <windows.h> so it can be unit-tested headlessly;
 * the hook, the tray icon and the injection are thin wrappers around this.
 *
 * The rules mirror what the engine itself enforces (see core-rs/src/engine.rs):
 *
 *   - digits are bopomofo keys (1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ) until the
 *     candidate window is open, because otherwise su3cl3 would be untypeable
 *   - space pages the candidate window while composing, and is an ordinary
 *     space otherwise
 *   - arrows, backspace and escape only mean something while composing
 *
 * Getting this wrong is not a subtle bug: it makes the IME swallow keys the
 * application needed, or fail to type its own characters.
 */
#ifndef PINGZHU_ROUTER_H
#define PINGZHU_ROUTER_H

#include <cstdint>

namespace pingzhu {

enum class KeyKind {
    Letter,      // a-z
    Digit,       // 0-9
    Symbol,      // - ; / , . and friends that the layout uses
    Space,
    Backspace,
    Enter,
    Escape,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Other,       // anything else: modifiers, F-keys, tab, ...
};

struct KeyEvent {
    KeyKind kind;
    char ch;         // lower-case character for Letter/Digit/Symbol, else 0
    bool ctrl;
    bool alt;
    bool shift;
};

struct EngineState {
    bool composing;            // there are keystrokes in the buffer
    bool candidateWindowOpen;  // digits currently select instead of compose
    bool hasCandidates;
};

enum class Action {
    Pass,             // hand the key back to the application
    Compose,          // feed the character to the engine
    SelectCandidate,  // 1..10 in `arg`
    NextPage,         // space
    OpenCandidates,   // down arrow
    CloseCandidates,  // up arrow / escape
    MoveCursor,       // -1 or +1 in `arg`
    Backspace,
    Commit,           // enter: accept the current sentence
    Cancel,           // escape: throw the composition away
    ToggleScript,     // Ctrl+Alt+S: switch between Traditional and Simplified
};

struct Decision {
    Action action;
    int arg;  // SelectCandidate: 1..10, MoveCursor: -1 or +1
};

/* The 繁/簡 toggle. Lives in the router rather than in a shell because both
 * shells need it and only one of them can be tested without a language bar —
 * and because the language bar button turned out not to be available everywhere
 * (Windows 11 ships with the language bar off, and AddItem refuses without it). */
constexpr char kScriptToggleKey = 's';

/* `chineseMode` is the shell's IME on/off switch; when off everything passes. */
Decision route(const KeyEvent &key, const EngineState &state, bool chineseMode);

/* True when the 大千式 layout uses this character as a bopomofo key. */
bool is_layout_key(char ch);

}  // namespace pingzhu

#endif  // PINGZHU_ROUTER_H
