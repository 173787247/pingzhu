/*
 * Does the output script actually convert, in both directions?
 *
 * The decoder always works in traditional — that is a deliberate design choice,
 * not a limitation — and the conversion happens at the boundary where text goes
 * out. Until this addon had a way to choose, Linux users got traditional and
 * nothing else, while Windows, macOS and Android could switch.
 *
 * The two words here are picked because they differ visibly: 台灣/台湾 keeps its
 * reading in both scripts, so a failure means the conversion, not the decoding.
 *
 * usage: script <data directory>
 */
#include <stdio.h>
#include <string.h>

#include "pingzhu.h"

static int failures = 0;

static void check(const char *what, const char *actual, const char *expected) {
    if (actual != NULL && strcmp(actual, expected) == 0) {
        printf("ok    %s: %s\n", what, actual);
    } else {
        printf("FAIL  %s: expected \"%s\", got \"%s\"\n",
               what, expected, actual == NULL ? "(null)" : actual);
        failures++;
    }
}

/* Types a string from a clean buffer and returns what would be committed. */
static const char *type(EngineHandle *engine, const char *keys) {
    engine_reset(engine);
    engine_feed_keys(engine, keys);
    return engine_best_sentence(engine);
}

static void expect(const char *what, int condition) {
    if (condition) {
        printf("ok    %s\n", what);
    } else {
        printf("FAIL  %s\n", what);
        failures++;
    }
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: script <data directory>\n");
        return 2;
    }
    EngineHandle *engine = engine_create(argv[1], "standard", "frequency");
    if (engine == NULL) {
        fprintf(stderr, "could not create the engine from %s\n", argv[1]);
        return 1;
    }

    /* Traditional is where the engine starts, and it stays there until asked. */
    check("default script", engine_output_script(engine), "traditional");
    check("traditional output", type(engine, "w96j0"), "台灣");

    expect("switch to simplified", engine_set_output_script(engine, "simplified") != 0);
    check("the setting is remembered", engine_output_script(engine), "simplified");
    check("simplified output", type(engine, "w96j0"), "台湾");

    expect("switch back to traditional", engine_set_output_script(engine, "traditional") != 0);
    check("back to traditional output", type(engine, "w96j0"), "台灣");

    /* A name the engine does not know must be refused, not silently ignored. */
    expect("an unknown script is refused", engine_set_output_script(engine, "klingon") == 0);
    check("and the setting is unchanged", engine_output_script(engine), "traditional");

    engine_destroy(engine);

    if (failures == 0) {
        printf("\nall output script checks passed\n");
    } else {
        printf("\n%d check(s) failed\n", failures);
        return 1;
    }
    return 0;
}
