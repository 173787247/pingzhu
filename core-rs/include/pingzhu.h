/*
 * 平注 PingZhu — C ABI for platform shells.
 *
 * Link against libpingzhu_core (static or shared) and drive the engine from
 * Windows TSF (C++), macOS IMK (Swift/C), Android (JNI) or HarmonyOS (NAPI).
 *
 * Ownership: every `const char *` returned here is owned by the engine and stays
 * valid until the next call on the same thread. Do not free it, and copy it if
 * you need it to outlive that.
 *
 * Keys are UTF-8 text, not keycodes: keyboard-layout knowledge lives in the
 * core, so adding a layout never touches a platform shell.
 */
#ifndef PINGZHU_H
#define PINGZHU_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct EngineHandle EngineHandle;

/* ABI version, so a shell can refuse a mismatched library instead of corrupting
 * memory. Bump on any signature change. */
uint32_t engine_abi_version(void);

/* data_dir must contain bopomofo-lm.tsv.
 * layout: "standard" | "eten" | NULL (standard).
 * candidate_order: "same-span-first" | "longest-first" | "frequency" | NULL.
 * Returns NULL if the language model cannot be read. */
EngineHandle *engine_create(const char *data_dir, const char *layout, const char *candidate_order);
void engine_destroy(EngineHandle *handle);

/* Learned words, plain text. */
bool engine_load_user_dictionary(EngineHandle *handle, const char *path);
bool engine_save_user_dictionary(EngineHandle *handle, const char *path);

/* Input. engine_feed_key returns false when the layout does not use the key,
 * which is how the shell knows to pass it on to the application. */
bool engine_feed_key(EngineHandle *handle, const char *key);
size_t engine_feed_keys(EngineHandle *handle, const char *keys);
bool engine_backspace(EngineHandle *handle);
void engine_reset(EngineHandle *handle);

/* Output. */
const char *engine_composing(EngineHandle *handle);
const char *engine_best_sentence(EngineHandle *handle);
double engine_best_score(EngineHandle *handle);
bool engine_output_is_faithful(EngineHandle *handle);
size_t engine_syllable_count(EngineHandle *handle);

/* Candidate window: ten per page, addressed by 1234567890. */
size_t engine_candidate_count(EngineHandle *handle);
const char *engine_candidate_at(EngineHandle *handle, size_t index);
uint64_t engine_candidate_page_info(EngineHandle *handle); /* page | (count << 32) */
bool engine_next_candidate_page(EngineHandle *handle);
bool engine_prev_candidate_page(EngineHandle *handle);
bool engine_move_candidate_cursor(EngineHandle *handle, int32_t delta);

/* Committing. select_candidate takes 1..=10 and returns the committed text. */
const char *engine_select_candidate(EngineHandle *handle, size_t one_based);
const char *engine_commit(EngineHandle *handle);

#ifdef __cplusplus
}
#endif

#endif /* PINGZHU_H */
