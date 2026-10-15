/*
 * Router tests for the fcitx5 addon.
 *
 * Reads tools/routing-vectors.tsv — the same file the Windows, macOS and Android
 * suites read — and checks this router against it, plus the expectations that
 * belong to this shell alone (PageUp/PageDown, and Enter passing through when
 * nothing is being composed).
 *
 * Before this file existed, the addon's rules lived inline in keyEvent() and
 * nothing could reach them: three of them had drifted from every other shell and
 * none of it could turn red.
 *
 *   usage: pingzhu-router-test [path to routing-vectors.tsv]
 */
#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "../src/router.h"

using namespace pingzhu;

namespace {

int failures = 0;

const char *nameOf(Action action) {
    switch (action) {
        case Action::Pass: return "Pass";
        case Action::Compose: return "Compose";
        case Action::SelectCandidate: return "SelectCandidate";
        case Action::NextPage: return "NextPage";
        case Action::PrevPage: return "PrevPage";
        case Action::OpenCandidates: return "OpenCandidates";
        case Action::CloseCandidates: return "CloseCandidates";
        case Action::Backspace: return "Backspace";
        case Action::Commit: return "Commit";
        case Action::Cancel: return "Cancel";
    }
    return "?";
}

void check(const char *what, const Decision &got, Action want) {
    const bool ok = got.action == want;
    std::printf("  %-54s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok) {
        std::printf("      expected %s, got %s\n", nameOf(want), nameOf(got.action));
        failures++;
    }
}

void checkIndex(const char *what, const Decision &got, int want) {
    const bool ok = got.arg == want;
    std::printf("  %-54s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok) {
        std::printf("      expected %d, got %d\n", want, got.arg);
        failures++;
    }
}

/* The escape spellings the vectors file uses, so it stays readable in a diff. */
bool keyFromField(const std::string &field, KeyEvent &event) {
    if (field == "\\n") { event = {KeyKind::Enter, 0}; return true; }
    if (field == "\\e") { event = {KeyKind::Escape, 0}; return true; }
    if (field == "\\b") { event = {KeyKind::Backspace, 0}; return true; }
    if (field == "\\v") { event = {KeyKind::ArrowDown, 0}; return true; }
    if (field == "\\f") { event = {KeyKind::ArrowUp, 0}; return true; }
    if (field == "space") { event = {KeyKind::Space, 0}; return true; }
    if (field.size() == 1) { event = {KeyKind::Character, field[0]}; return true; }
    return false;
}

bool runSharedVectors(const char *path) {
    std::ifstream in(path);
    if (!in) return false;

    std::printf("\nshared vectors (%s)\n", path);
    int checked = 0, bad = 0, line = 0;
    std::string text;
    while (std::getline(in, text)) {
        line++;
        if (!text.empty() && text.back() == '\r') text.pop_back();
        if (text.empty() || text[0] == '#' || text.rfind("key\t", 0) == 0) continue;

        std::vector<std::string> fields;
        std::stringstream stream(text);
        std::string field;
        while (std::getline(stream, field, '\t')) fields.push_back(field);
        if (fields.size() != 5) {
            std::printf("  FAIL line %d: expected 5 fields, got %zu\n", line, fields.size());
            failures++;
            bad++;
            continue;
        }

        KeyEvent event;
        if (!keyFromField(fields[0], event)) {
            std::printf("  FAIL line %d: unknown key field '%s'\n", line, fields[0].c_str());
            failures++;
            bad++;
            continue;
        }
        const EngineState state{fields[1] == "1", fields[2] == "1", fields[3] == "1"};
        const Decision got = route(event, state);
        checked++;
        if (nameOf(got.action) != fields[4]) {
            std::printf("  FAIL line %d: %s %s/%s/%s → %s, expected %s\n", line, fields[0].c_str(),
                        fields[1].c_str(), fields[2].c_str(), fields[3].c_str(),
                        nameOf(got.action), fields[4].c_str());
            failures++;
            bad++;
        }
    }
    std::printf("  %d shared vectors, %d failed\n", checked, bad);
    return checked > 0;
}

}  // namespace

int main(int argc, char **argv) {
    const EngineState idle{false, false, false};
    const EngineState halfTyped{true, false, false};  // composing, nothing to choose from
    const EngineState typing{true, false, true};      // composing, list shut, candidates exist
    const EngineState choosing{true, true, true};

    std::printf("space accepts on the second press, not the first\n");
    check("with nothing to offer it accepts", route({KeyKind::Space, 0}, halfTyped), Action::Commit);
    check("with something to offer it opens", route({KeyKind::Space, 0}, typing), Action::OpenCandidates);
    check("the second press accepts", route({KeyKind::Space, 0}, choosing), Action::Commit);
    check("and it is a space when idle", route({KeyKind::Space, 0}, idle), Action::Pass);

    std::printf("\nthe browsing keys\n");
    check("↓ opens the list", route({KeyKind::ArrowDown, 0}, typing), Action::OpenCandidates);
    check("↓ moves on ten once it is open", route({KeyKind::ArrowDown, 0}, choosing), Action::NextPage);
    check("↓ has nothing to browse when idle", route({KeyKind::ArrowDown, 0}, idle), Action::Pass);
    check("↑ closes it", route({KeyKind::ArrowUp, 0}, choosing), Action::CloseCandidates);
    check("↑ passes when there is nothing to close", route({KeyKind::ArrowUp, 0}, typing), Action::Pass);
    check("PageDown pages while open", route({KeyKind::PageDown, 0}, choosing), Action::NextPage);
    check("PageDown passes when shut", route({KeyKind::PageDown, 0}, typing), Action::Pass);
    check("PageUp pages back", route({KeyKind::PageUp, 0}, choosing), Action::PrevPage);

    std::printf("\nthe digits are bopomofo keys until the list opens\n");
    check("1 composes when the list is shut", route({KeyKind::Character, '1'}, typing), Action::Compose);
    check("1 selects when the list is open", route({KeyKind::Character, '1'}, choosing), Action::SelectCandidate);
    checkIndex("and it is the first candidate", route({KeyKind::Character, '1'}, choosing), 1);
    checkIndex("0 is the tenth", route({KeyKind::Character, '0'}, choosing), 10);
    check("5 composes when idle — 倒 begins with ㄉ", route({KeyKind::Character, '5'}, idle), Action::Compose);

    std::printf("\nkeys that are not ours\n");
    check("Enter passes when nothing is composed", route({KeyKind::Enter, 0}, idle), Action::Pass);
    check("Enter accepts while composing", route({KeyKind::Enter, 0}, typing), Action::Commit);
    check("Backspace passes when nothing is composed", route({KeyKind::Backspace, 0}, idle), Action::Pass);
    check("Backspace steps back while composing", route({KeyKind::Backspace, 0}, typing), Action::Backspace);
    check("Escape passes when nothing is composed", route({KeyKind::Escape, 0}, idle), Action::Pass);
    check("Escape cancels while composing", route({KeyKind::Escape, 0}, typing), Action::Cancel);

    if (argc > 1) {
        if (!runSharedVectors(argv[1])) {
            std::printf("  FAIL cannot read routing vectors at %s\n", argv[1]);
            failures++;
        }
    } else {
        std::printf("\n(no routing-vectors path given; ran the built-in expectations only)\n");
    }

    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall router checks passed\n", failures);
    return failures ? 1 : 0;
}
