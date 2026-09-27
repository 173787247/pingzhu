/*
 * Does the engine work with the data the addon is installed with?
 *
 * The addon itself creates the engine in activate(), which only runs when a
 * user switches to the input method — so "the addon loaded" does not prove the
 * language model was found. This calls the same C ABI the addon calls, against
 * the same installed directory, and checks that su3cl3 gives 你好.
 *
 * The same three phrases the other four platforms are held to. If this fails on
 * Linux while passing on Windows, Android, macOS and HarmonyOS, the core is not
 * as shared as it claims to be.
 *
 * usage: engine_smoke <data directory>
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

/* Types a string and returns what would be committed. */
static const char *type(EngineHandle *engine, const char *keys) {
    engine_reset(engine);
    engine_feed_keys(engine, keys);
    return engine_best_sentence(engine);
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: engine_smoke <data directory>\n");
        return 2;
    }

    printf("data: %s\n", argv[1]);
    EngineHandle *engine = engine_create(argv[1], "standard", "frequency");
    if (engine == NULL) {
        printf("FAIL  engine_create returned NULL — the language model could not be read\n");
        return 1;
    }
    printf("ok    engine created, ABI %u\n", engine_abi_version());

    check("su3cl3", type(engine, "su3cl3"), "你好");
    check("ji394su3", type(engine, "ji394su3"), "我愛你");
    check("w96j0", type(engine, "w96j0"), "台灣");

    /* The drawn keyboard comes from the engine, so the shell cannot drift from
     * the decoder. The first row is the digit rule: 1 is ㄅ, 2 is ㄉ, 5 is ㄓ,
     * 8 is ㄚ, 9 is ㄞ, 0 is ㄢ. */
    char *rows = engine_keyboard_rows("standard");
    if (rows == NULL) {
        printf("FAIL  engine_keyboard_rows returned NULL\n");
        failures++;
    } else {
        printf("ok    keyboard rows: %.20s...\n", rows);
        if (strncmp(rows, "1:ㄅ|2:ㄉ|3:ˇ|4:ˋ|5:ㄓ|", strlen("1:ㄅ|2:ㄉ|3:ˇ|4:ˋ|5:ㄓ|")) != 0) {
            printf("FAIL  the first row does not start with the digit rule\n");
            failures++;
        }
        engine_keyboard_rows_free(rows);
    }

    engine_destroy(engine);

    printf("\n");
    if (failures > 0) {
        printf("%d checks failed\n", failures);
        return 1;
    }
    printf("linux engine checks passed\n");
    return 0;
}
