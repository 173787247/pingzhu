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
#include <stdlib.h>
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


/* Reads a whole file into a malloc'd, NUL-terminated buffer. The association
 * table is passed as text, not as a path — the core knows nothing about the
 * filesystem, and four shells read files four different ways. */
static char *slurp(const char *path, long *size_out) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (size <= 0) { fclose(f); return NULL; }
    char *buf = (char *)malloc((size_t)size + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t got = fread(buf, 1, (size_t)size, f);
    fclose(f);
    buf[got] = 0;
    if (size_out) *size_out = (long)got;
    return buf;
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

    /* ---- 接续表 ---- */
    {
        char *word = (char *)"不断";   /* 接续表是简体：语料是大陆公文 */
        char *none = engine_suggest_after(engine, word, 5);
        if (!none || strcmp(none, "") != 0) {
            printf("  FAIL: 没有接续表时应该返回空串, got \"%s\"\n", none ? none : "(NULL)");
            failures++;
        } else {
            printf("  ok   suggestions without a table = \"\"\n");
        }
        engine_suggest_after_free(none);

        char path[512];
        snprintf(path, sizeof(path), "%s/bigram.tsv", data_dir);
        char *tsv = slurp(path, NULL);
        if (!tsv) {
            printf("  skip bigram.tsv not found at %s\n", path);
        } else {
            size_t n = engine_associations_load(engine, tsv);
            printf("  associations loaded: %zu\n", n);
            if (n < 1000) { printf("  FAIL: table looks truncated\n"); failures++; }

            char *out = engine_suggest_after(engine, word, 3);
            if (!out || !*out) {
                printf("  FAIL: 「不断」 should have continuations\n");
                failures++;
            } else {
                printf("  ok   「不断」 → %s\n", out);
                int spaces = 0;
                for (const char *c = out; *c; c++) if (*c == ' ') spaces++;
                if (spaces > 2) { printf("  FAIL: limit 3 not respected\n"); failures++; }
            }
            engine_suggest_after_free(out);

            char *empty = engine_suggest_after(engine, "這個詞不在表裡", 3);
            if (!empty || strcmp(empty, "") != 0) {
                printf("  FAIL: unknown word should give an empty string\n");
                failures++;
            } else {
                printf("  ok   unknown word = \"\"\n");
            }
            engine_suggest_after_free(empty);
            free(tsv);
        }
        engine_suggest_after_free(NULL);   /* must be safe */
    }

    engine_destroy(engine);

    printf(failures ? "\n%d FAILURE(S)\n" : "\nall C ABI checks passed\n", failures);
    return failures ? 1 : 0;
}
