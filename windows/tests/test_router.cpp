/*
 * Router tests — runnable on Windows or anywhere, no engine required.
 *
 * The routing rules are the part of a Windows IME shell that silently breaks
 * typing when it is wrong: swallow a key the application needed, or fail to
 * swallow one the IME needed, and the user sees characters appear in the wrong
 * place. Keeping them in a header without <windows.h> means they can be checked
 * without a keyboard hook, a tray icon or an interactive session.
 *
 * Beyond the expectations below, this reads tools/routing-vectors.tsv — the
 * same file macOS, Android and the TypeScript reference are held to. The file
 * exists so that a rule change turns all four shells red at once instead of
 * each being noticed separately; before this it only did that for macOS.
 */
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>

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
        case Action::ToggleScript: return "ToggleScript";
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

// The escape spellings the vector file uses, so it stays readable in a diff.
// The same five are spelled out in macos/Tests/Router/main.swift.
static bool key_from_field(const std::string &field, KeyEvent &out) {
    if (field == "\\n") { out = key(KeyKind::Enter); return true; }
    if (field == "\\b") { out = key(KeyKind::Backspace); return true; }
    if (field == "\\e") { out = key(KeyKind::Escape); return true; }
    if (field == "\\v") { out = key(KeyKind::ArrowDown); return true; }
    if (field == "\\f") { out = key(KeyKind::ArrowUp); return true; }
    if (field == "space") { out = key(KeyKind::Space); return true; }
    if (field.size() != 1) return false;
    char c = field[0];
    if (c >= '0' && c <= '9') { out = key(KeyKind::Digit, c); return true; }
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
        out = key(KeyKind::Letter, c);
        return true;
    }
    // The rest of the layout's keys — - ; / , . = — are Symbol, which the router
    // treats exactly like Letter when deciding whether to compose.
    out = key(KeyKind::Symbol, c);
    return true;
}

/// Feed the shared vectors through the same `route()` the shell uses.
///
/// Returns false only when the file cannot be read: that is a setup problem the
/// caller reports, not a routing failure.
static bool run_shared_vectors(const char *path) {
    std::ifstream in(path);
    if (!in) return false;

    std::printf("\nlayout key set → shared vectors (%s)\n", path);
    int checked = 0, bad = 0;
    std::string line;
    int lineno = 0;
    while (std::getline(in, line)) {
        lineno++;
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty() || line[0] == '#' || line.rfind("key\t", 0) == 0) continue;

        std::vector<std::string> f;
        std::stringstream ss(line);
        std::string field;
        while (std::getline(ss, field, '\t')) f.push_back(field);
        if (f.size() != 5) {
            std::printf("  FAIL line %d: expected 5 fields, got %zu\n", lineno, f.size());
            failures++;
            bad++;
            continue;
        }

        KeyEvent ev = {};
        if (!key_from_field(f[0], ev)) {
            std::printf("  FAIL line %d: unknown key field '%s'\n", lineno, f[0].c_str());
            failures++;
            bad++;
            continue;
        }
        EngineState state = {f[1] == "1", f[2] == "1", f[3] == "1"};
        const std::string want = f[4];
        const Action got = route(ev, state, true).action;
        checked++;

        if (actionName(got) != want) {
            std::printf("  FAIL line %d: key %s composing=%s window=%s candidates=%s "
                        "→ expected %s, got %s\n",
                        lineno, f[0].c_str(), f[1].c_str(), f[2].c_str(), f[3].c_str(),
                        want.c_str(), actionName(got));
            failures++;
            bad++;
        }
    }
    std::printf("  %d shared vectors, %d failed\n", checked, bad);
    return checked > 0;
}

int main(int argc, char **argv) {
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
    // Was asserted as Pass, which was the bug written down as an expectation:
    // the digits are bopomofo keys and several are initials, so the first key of
    // a word is often a digit key.
    check("a digit key starts a composition", route(key(KeyKind::Digit, '3'), idle, true),
          Action::Compose);
    check("Ctrl+Alt+S toggles the output script",
          route([] { KeyEvent e = key(KeyKind::Letter, 's'); e.ctrl = true; e.alt = true; return e; }(),
                idle, true),
          Action::ToggleScript);
    check("Ctrl+Alt+S also works mid-composition",
          route([] { KeyEvent e = key(KeyKind::Letter, 's'); e.ctrl = true; e.alt = true; return e; }(),
                composing, true),
          Action::ToggleScript);
    check("Ctrl+S is still the application's",
          route([] { KeyEvent e = key(KeyKind::Letter, 's'); e.ctrl = true; return e; }(), idle, true),
          Action::Pass);
    check("Ctrl+Alt+Shift+S is not the toggle",
          route([] { KeyEvent e = key(KeyKind::Letter, 's'); e.ctrl = true; e.alt = true;
                     e.shift = true; return e; }(), idle, true),
          Action::Pass);
    check("ctrl combos belong to the app",
          route([] { KeyEvent e = key(KeyKind::Letter, 'c'); e.ctrl = true; return e; }(), composing,
                true),
          Action::Pass);

    std::printf("\ncomposing: the digits must still be bopomofo keys\n");
    check("3 composes (it is the ˇ key)",
          route(key(KeyKind::Digit, '3'), composing, true), Action::Compose);
    check("1 composes (it is the ㄅ key)",
          route(key(KeyKind::Digit, '1'), composing, true), Action::Compose);
    // Space ends in an acceptance, but not on its first press: with candidates
    // to show it opens them, so the second candidate is reachable without the
    // user having to know about the down arrow. The next press accepts.
    check("space opens the candidates when there are some",
          route(key(KeyKind::Space), composing, true), Action::OpenCandidates);
    check("space accepts once the list is open",
          route(key(KeyKind::Space), selecting, true), Action::Commit);
    check("space accepts when there is nothing to offer",
          route(key(KeyKind::Space), EngineState{true, false, false}, true), Action::Commit);
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
    check("down pages while the list is open",
          route(key(KeyKind::ArrowDown), selecting, true), Action::NextPage);
    check("up closes the list", route(key(KeyKind::ArrowUp), selecting, true),
          Action::CloseCandidates);

    /* The case the unit expectations above missed entirely: an actual word,
     * key by key, starting from an empty buffer. Every a priori "digit means X"
     * rule passed while 倒 — and every word beginning with ㄅㄉㄓㄚㄞㄢ — was
     * impossible to type. */
    std::printf("\ntyping a whole word: 倒 (ㄉㄠˇ = 2l3)\n");
    {
        struct { char ch; KeyKind kind; } keys[] = {
            {'2', KeyKind::Digit}, {'l', KeyKind::Letter}, {'3', KeyKind::Digit}};
        EngineState state = idle;
        for (auto &entry : keys) {
            Decision decision = route(key(entry.kind, entry.ch), state, true);
            char label[64];
            std::snprintf(label, sizeof(label), "  '%c' is composed, not passed", entry.ch);
            check(label, decision, Action::Compose);
            state.composing = true;  // from the second key onwards we are composing
        }
    }

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

    // The shared vectors, if a path was given. Absent is not a failure — a hand
    // run from the staging directory has no checkout nearby — but a path that
    // was given and cannot be read is, because that is a CI wiring mistake that
    // would otherwise look like a pass.
    if (argc > 1) {
        if (!run_shared_vectors(argv[1])) {
            std::printf("  FAIL cannot read routing vectors at %s\n", argv[1]);
            failures++;
        }
    } else {
        std::printf("\n(no routing-vectors path given; ran the built-in expectations only)\n");
    }

    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall router checks passed\n", failures);
    return failures ? 1 : 0;
}
