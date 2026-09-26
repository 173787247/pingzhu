/*
 * Router tests — runnable on Windows or anywhere, no engine required.
 *
 * The routing rules are the part of a Windows IME shell that silently breaks
 * typing when it is wrong: swallow a key the application needed, or fail to
 * swallow one the IME needed, and the user sees characters appear in the wrong
 * place. Keeping them in a header without <windows.h> means they can be checked
 * without a keyboard hook, a tray icon or an interactive session.
 */
#include <cstdio>
#include <cstring>

#include "../src/router.h"

using namespace pingzhu;

static int failures = 0;

static const char *actionName(Action a) {
    switch (a) {
        case Action::Pass: return "Pass";
        case Action::Compose: return "Compose";
        case Action::SelectCandidate: return "SelectCandidate";
        case Action::NextPage: return "NextPage";
        case Action::OpenCandidates: return "OpenCandidates";
        case Action::CloseCandidates: return "CloseCandidates";
        case Action::MoveCursor: return "MoveCursor";
        case Action::Backspace: return "Backspace";
        case Action::Commit: return "Commit";
        case Action::Cancel: return "Cancel";
    }
    return "?";
}

static void check(const char *what, Decision got, Action want, int wantArg = 0) {
    if (got.action != want || got.arg != wantArg) {
        std::printf("  FAIL %-46s got %s(%d), want %s(%d)\n", what, actionName(got.action),
                    got.arg, actionName(want), wantArg);
        failures++;
    } else {
        std::printf("  ok   %-46s %s(%d)\n", what, actionName(got.action), got.arg);
    }
}

static KeyEvent key(KeyKind kind, char ch = 0) {
    KeyEvent e = {};
    e.kind = kind;
    e.ch = ch;
    return e;
}

int main() {
    const EngineState idle = {false, false, false};
    const EngineState composing = {true, false, true};
    const EngineState selecting = {true, true, true};

    std::printf("typing mode (chinese mode off)\n");
    check("letter passes", route(key(KeyKind::Letter, 's'), composing, false), Action::Pass);
    check("space passes", route(key(KeyKind::Space), composing, false), Action::Pass);

    std::printf("\nidle (chinese mode on, not composing)\n");
    check("a layout key starts a composition",
          route(key(KeyKind::Letter, 's'), idle, true), Action::Compose);
    check("a plain space is a space", route(key(KeyKind::Space), idle, true), Action::Pass);
    check("backspace goes to the app", route(key(KeyKind::Backspace), idle, true), Action::Pass);
    check("enter goes to the app", route(key(KeyKind::Enter), idle, true), Action::Pass);
    check("escape goes to the app", route(key(KeyKind::Escape), idle, true), Action::Pass);
    check("digits go to the app", route(key(KeyKind::Digit, '3'), idle, true), Action::Pass);
    check("ctrl combos belong to the app",
          route([] { KeyEvent e = key(KeyKind::Letter, 'c'); e.ctrl = true; return e; }(), composing,
                true),
          Action::Pass);

    std::printf("\ncomposing: the digits must still be bopomofo keys\n");
    check("3 composes (it is the ˇ key)",
          route(key(KeyKind::Digit, '3'), composing, true), Action::Compose);
    check("1 composes (it is the ㄅ key)",
          route(key(KeyKind::Digit, '1'), composing, true), Action::Compose);
    check("space accepts the composition",
          route(key(KeyKind::Space), composing, true), Action::Commit);
    check("down opens the candidates",
          route(key(KeyKind::ArrowDown), composing, true), Action::OpenCandidates);
    check("enter commits", route(key(KeyKind::Enter), composing, true), Action::Commit);
    check("escape cancels", route(key(KeyKind::Escape), composing, true), Action::Cancel);
    check("backspace edits the buffer",
          route(key(KeyKind::Backspace), composing, true), Action::Backspace);
    check("left moves the candidate cursor",
          route(key(KeyKind::ArrowLeft), composing, true), Action::MoveCursor, -1);
    check("right moves the candidate cursor",
          route(key(KeyKind::ArrowRight), composing, true), Action::MoveCursor, 1);
    check("up does nothing while closed",
          route(key(KeyKind::ArrowUp), composing, true), Action::Pass);

    std::printf("\nselecting: the digits select, one-based, with 0 for the tenth\n");
    check("1 selects the first", route(key(KeyKind::Digit, '1'), selecting, true),
          Action::SelectCandidate, 1);
    check("9 selects the ninth", route(key(KeyKind::Digit, '9'), selecting, true),
          Action::SelectCandidate, 9);
    check("0 selects the tenth", route(key(KeyKind::Digit, '0'), selecting, true),
          Action::SelectCandidate, 10);
    check("space pages while selecting",
          route(key(KeyKind::Space), selecting, true), Action::NextPage);
    check("up closes the list", route(key(KeyKind::ArrowUp), selecting, true),
          Action::CloseCandidates);

    std::printf("\nlayout key set\n");
    struct { char ch; bool expected; } layoutCases[] = {
        {'a', true}, {'z', true}, {'0', true}, {'9', true}, {'-', true}, {';', true},
        {'/', true}, {',', true}, {'.', true}, {'=', false}, {'[', false}, {'`', false},
    };
    for (auto &c : layoutCases) {
        bool got = is_layout_key(c.ch);
        if (got != c.expected) {
            std::printf("  FAIL is_layout_key('%c') = %d, want %d\n", c.ch, got, c.expected);
            failures++;
        } else {
            std::printf("  ok   is_layout_key('%c') = %d\n", c.ch, got);
        }
    }

    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall router checks passed\n", failures);
    return failures ? 1 : 0;
}
