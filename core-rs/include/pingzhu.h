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
/// The drawn keyboard, one line per row: `key:label|key:label|...`.
///
/// Pairs, not two parallel runs of characters: the ETen layout has more keys in
/// its first row than it has Bopomofo components, so two runs would be different
/// lengths with no way to say which key was missing a label. The separators are
/// `|` and `:`, chosen because no key is either — a comma is a key, in the
/// fourth row.
///
/// Derived from the same table the decoder uses, so the keyboard that is drawn
/// and the keys that are understood cannot drift apart. A key with no component
/// has an empty label. Returns NULL for an unknown layout name. Free with
/// engine_keyboard_rows_free.
char *engine_keyboard_rows(const char *layout);
void engine_keyboard_rows_free(char *text);

uint32_t engine_abi_version(void);

/* data_dir must contain bopomofo-lm.tsv.
 * layout: "standard" | "eten" | NULL (standard).
 * candidate_order: "same-span-first" | "longest-first" | "frequency" | NULL.
 * Returns NULL if the language model cannot be read. */
EngineHandle *engine_create(const char *data_dir, const char *layout, const char *candidate_order);
/// Select the output script: "traditional" or "simplified".
///
/// Input, the language model and the user dictionary are Traditional regardless;
/// this only decides which script leaves the engine. Returns false for an
/// unknown name rather than silently keeping the old value, so a shell that
/// misspells it finds out.
bool engine_set_output_script(EngineHandle *handle, const char *script);

/// The current output script. Never NULL.
const char *engine_output_script(EngineHandle *handle);

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

/* Digits are bopomofo keys (1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ) until the window
 * is open: a shell must route 1-9,0 to engine_select_candidate only when
 * engine_candidate_window_open() is true, and to engine_feed_key otherwise. */
bool engine_candidate_window_open(EngineHandle *handle);
bool engine_open_candidate_window(EngineHandle *handle);   /* Down arrow */
void engine_close_candidate_window(EngineHandle *handle);  /* Up arrow / Esc */
bool engine_next_candidate_page(EngineHandle *handle);     /* Down arrow */
bool engine_prev_candidate_page(EngineHandle *handle);
bool engine_move_candidate_cursor(EngineHandle *handle, int32_t delta);

/* Committing. select_candidate takes 1..=10 and returns the committed text. */
const char *engine_select_candidate(EngineHandle *handle, size_t one_based);
const char *engine_commit(EngineHandle *handle);

#ifdef __cplusplus
}
#endif

#endif /* PINGZHU_H */
