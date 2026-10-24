/*
 * pingzhu.ini: does a hand-edited file survive being read?
 *
 * `configValue` has carried "exposed for tests" in its comment since it was
 * written and never had one — the input method's settings were verified by
 * editing the file and typing, which is a fine way to check the happy path and a
 * poor way to check that a typo is refused instead of half-applied.
 *
 * The layout is the newest key and the one where a bad value would be quiet: the
 * engine falls back to standard silently, so a mistyped `hsu` in the file would
 * otherwise look exactly like a layout that does not work.
 *
 * usage: pingzhu-config-test
 */
#include <cstdio>
#include <string>

#include "config.h"

namespace {

int failures = 0;

void expect(const char *what, const std::string &actual, const std::string &expected) {
    if (actual == expected) {
        std::printf("ok    %s: %s\n", what, actual.c_str());
    } else {
        std::printf("FAIL  %s: expected \"%s\", got \"%s\"\n", what, expected.c_str(),
                    actual.c_str());
        failures++;
    }
}

void expectTrue(const char *what, bool condition) {
    if (condition) {
        std::printf("ok    %s\n", what);
    } else {
        std::printf("FAIL  %s\n", what);
        failures++;
    }
}

}  // namespace

int main() {
    using pingzhu::configValue;
    using pingzhu::isKnownLayout;

    /* Values, comments, whitespace, CRLF: a file a person edited. */
    const std::string text =
        "# comment\r\n"
        "\r\n"
        "output = simplified\r\n"
        "  layout=hsu  \r\n"
        "; semicolon is a comment too\r\n"
        "status_x = -400\r\n";
    expect("a plain value", configValue(text, "output"), "simplified");
    expect("value without spaces around =", configValue(text, "layout"), "hsu");
    expect("a missing key is empty", configValue(text, "candidate_order"), "");
    expect("commented keys do not count", configValue("# layout = eten\r\n", "layout"), "");

    /* The layout list: exactly the seven names the engine has. */
    for (const char *name : {"standard", "eten", "hsu", "eten26", "ibm", "ginyieh", "mitac"}) {
        const std::string what = std::string("layout accepted: ") + name;
        expectTrue(what.c_str(), isKnownLayout(name));
    }
    expectTrue("a typo is refused", !isKnownLayout("hsuu"));
    expectTrue("an old name is refused", !isKnownLayout("bopomofo"));
    expectTrue("an empty name is refused", !isKnownLayout(""));

    if (failures == 0) {
        std::printf("\nall config checks passed\n");
        return 0;
    }
    std::printf("\n%d check(s) failed\n", failures);
    return 1;
}
