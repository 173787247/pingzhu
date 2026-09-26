/*
 * C ABI smoke test.
 *
 * The whole point of M3 is that four platform shells — a Windows TSF COM DLL, a
 * macOS IMKInputController, an Android InputMethodService and a HarmonyOS
 * InputMethodExtensionAbility — can all sit on one decoder. None of them speaks
 * Rust, so "the Rust tests pass" is not the claim being made here. This file
 * makes the claim that matters: **a plain C program, with the header below and
 * nothing else, can drive the engine**.
 *
 * build & run:
 *   cd core-rs && cargo build --release
 *   gcc -I include tests/c_abi_smoke.c -o /tmp/c_abi_smoke \
 *       -L target/release -lpingzhu_core -lm -lpthread -ldl
 *   /tmp/c_abi_smoke ../data
 */
#include <stdio.h>
#include <string.h>

#include "pingzhu.h"

static int failures = 0;

static void expect_str(const char *what, const char *got, const char *want) {
    if (strcmp(got, want) != 0) {
        printf("  FAIL %s: got \"%s\", want \"%s\"\n", what, got, want);
        failures++;
    } else {
        printf("  ok   %s = \"%s\"\n", what, got);
    }
}

int main(int argc, char **argv) {
    const char *data_dir = argc > 1 ? argv[1] : "../data";

    printf("abi version: %u\n", engine_abi_version());

    EngineHandle *engine = engine_create(data_dir, "standard", NULL);
    if (!engine) {
        printf("FAIL: engine_create returned NULL (data dir: %s)\n", data_dir);
        return 1;
    }

    /* su3cl3 = ㄋㄧˇ ㄏㄠˇ = 你好 */
    const char *keys = "su3cl3";
    for (const char *k = keys; *k; k++) {
        char buf[2] = {*k, 0};
        engine_feed_key(engine, buf);
    }
    expect_str("composing", engine_composing(engine), "ㄋㄧˇ ㄏㄠˇ");
    expect_str("sentence", engine_best_sentence(engine), "你好");
    expect_str("candidate 1", engine_candidate_at(engine, 0), "你好");

    uint64_t info = engine_candidate_page_info(engine);
    printf("  page %llu/%llu\n",
           (unsigned long long)(info & 0xffffffffu),
           (unsigned long long)(info >> 32));

    expect_str("commit", engine_commit(engine), "你好");
    if (engine_syllable_count(engine) != 0) {
        printf("  FAIL: buffer not cleared after commit\n");
        failures++;
    }

    /* ji394su3 = ㄨㄛˇ ㄞˋ ㄋㄧˇ = 我愛你 — the ambiguous segmentation */
    engine_feed_keys(engine, "ji394su3");
    expect_str("sentence (ambiguous)", engine_best_sentence(engine), "我愛你");
    if (!engine_output_is_faithful(engine)) {
        printf("  FAIL: output should be provably read as typed\n");
        failures++;
    }

    /* j0420 = ㄨㄢˋ ㄉㄢ = 萬丹 — a tone key must not migrate to the next syllable */
    engine_reset(engine);
    engine_feed_keys(engine, "j0420");
    expect_str("composing (tone migration)", engine_composing(engine), "ㄨㄢˋ ㄉㄢ");
    expect_str("sentence (tone migration)", engine_best_sentence(engine), "萬丹");

    /* a key the layout does not use must be handed back to the application */
    engine_reset(engine);
    if (engine_feed_key(engine, "z") != 1 || engine_feed_key(engine, " ") != 0) {
        printf("  FAIL: key ownership is wrong (z should be consumed, space should not)\n");
        failures++;
    }

    engine_destroy(engine);

    printf(failures ? "\n%d FAILURE(S)\n" : "\nall C ABI checks passed\n", failures);
    return failures ? 1 : 0;
}
