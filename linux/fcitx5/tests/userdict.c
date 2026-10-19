/*
 * Does what the user teaches survive the process?
 *
 * The engine learns from the words a user picks, and that is the only training
 * signal this input method has. Two of the five shells (this addon and the
 * HarmonyOS keyboard) used to keep those words in memory only: the corrections
 * vanished when the input method restarted, silently, because nothing anywhere
 * said they had been saved.
 *
 * This exercises the C ABI the way those shells now do it — teach, save, create a
 * second engine, load, and check the taught word wins — so the round trip has a
 * test instead of a promise.
 *
 * usage: userdict <data directory> <scratch path for the dictionary file>
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

static void expect(const char *what, int condition) {
    if (condition) {
        printf("ok    %s\n", what);
    } else {
        printf("FAIL  %s\n", what);
        failures++;
    }
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "usage: userdict <data directory> <scratch path>\n");
        return 2;
    }
    const char *dataDir = argv[1];
    const char *dictPath = argv[2];

    /* Start clean: a leftover file from an earlier run would make the test pass
     * for the wrong reason. */
    remove(dictPath);

    EngineHandle *first = engine_create(dataDir, "standard", "frequency");
    if (first == NULL) {
        fprintf(stderr, "could not create the engine from %s\n", dataDir);
        return 1;
    }

    /* tj4g/ is 畜生 by the model; 畜牲 is what a user would pick instead. */
    engine_feed_keys(first, "tj4g/");
    expect("the model's own choice is 畜生", strcmp(engine_best_sentence(first), "畜生") == 0);

    expect("the candidate window opens", engine_open_candidate_window(first) != 0);
    int taught = -1;
    const int count = engine_candidate_count(first);
    for (int i = 0; i < count; i++) {
        const char *candidate = engine_candidate_at(first, i);
        if (candidate != NULL && strcmp(candidate, "畜牲") == 0) {
            taught = i;
            break;
        }
    }
    if (taught < 0) {
        printf("FAIL  畜牲 is not in the candidate window (the rest cannot be tested)\n");
        engine_destroy(first);
        return 1;
    }
    check("selecting 畜牲 commits it", engine_select_candidate(first, taught + 1), "畜牲");

    expect("the dictionary is written", engine_save_user_dictionary(first, dictPath) != 0);
    engine_destroy(first);

    /* A new process would start here. */
    EngineHandle *second = engine_create(dataDir, "standard", "frequency");
    if (second == NULL) {
        fprintf(stderr, "could not create the second engine from %s\n", dataDir);
        return 1;
    }
    expect("the dictionary loads", engine_load_user_dictionary(second, dictPath) != 0);
    engine_feed_keys(second, "tj4g/");
    check("the taught word is remembered", engine_best_sentence(second), "畜牲");
    engine_destroy(second);

    if (failures == 0) {
        printf("\nall user dictionary checks passed\n");
    } else {
        printf("\n%d check(s) failed\n", failures);
    }
    return failures == 0 ? 0 : 1;
}
