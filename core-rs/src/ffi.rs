//! The C ABI every platform shell sits on.
//!
//! Three design constraints, all of them about the shells rather than the engine:
//!
//! 1. **Returned strings are owned by the engine**, not the caller. A TSF DLL, a
//!    Swift `IMKInputController`, a Kotlin `InputMethodService` and an ArkTS
//!    `InputMethodExtensionAbility` would otherwise each need their own matching
//!    free() — four chances to leak or double-free across four runtimes.
//! 2. **Keys arrive as UTF-8 text, not keycodes.** Keyboard layout knowledge stays
//!    in the core, so adding 許氏 later does not touch four platform shells.
//! 3. **No async.** Decoding is a synchronous pure computation measured at ~15 µs
//!    per keystroke; an async surface would only make four shells invent four
//!    callback lifecycles.
//!
//! Strings are handed back through a thread-local buffer and stay valid until the
//! next call on the same thread. That is enough for a candidate window that
//! renders immediately, and it keeps all allocation on this side of the boundary.

use std::cell::RefCell;
use std::ffi::{c_char, CStr, CString};
use std::path::Path;

use crate::converter::{Converter, OutputScript};
use crate::dictionary::{build_syllable_inventory, Dictionary};
use crate::engine::{EngineOptions, InputEngine};
use crate::grid::CandidateOrder;
use crate::keyboard::Layout;
use crate::userdict::UserDictionary;

/// Opaque handle. Shells only ever see a pointer to this.
pub struct EngineHandle {
    engine: InputEngine,
}

thread_local! {
    static LAST_STRING: RefCell<CString> = RefCell::new(CString::new("").unwrap());
}

/// Copy `s` into the thread-local buffer and hand back a borrowed pointer.
fn ret(s: String) -> *const c_char {
    LAST_STRING.with(|cell| {
        let c = CString::new(s).unwrap_or_else(|_| CString::new("").unwrap());
        *cell.borrow_mut() = c;
        cell.borrow().as_ptr()
    })
}

unsafe fn cstr(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    Some(unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned())
}

/// Create an engine. `data_dir` must contain `bopomofo-lm.tsv`.
///
/// `layout` is `"standard"` or `"eten"`; NULL means standard.
/// `candidate_order` is `"same-span-first"`, `"longest-first"` or `"frequency"`;
/// NULL means the default.
///
/// Returns NULL when the language model cannot be read.
///
/// # Safety
/// `data_dir` must be a valid NUL-terminated UTF-8 string.
#[no_mangle]
pub unsafe extern "C" fn engine_create(
    data_dir: *const c_char,
    layout: *const c_char,
    candidate_order: *const c_char,
) -> *mut EngineHandle {
    let Some(dir) = (unsafe { cstr(data_dir) }) else { return std::ptr::null_mut() };
    let layout = unsafe { cstr(layout) }
        .and_then(|s| Layout::from_id(&s))
        .unwrap_or(Layout::Standard);
    let order = match unsafe { cstr(candidate_order) }.as_deref() {
        Some("longest-first") => CandidateOrder::LongestFirst,
        Some("frequency") => CandidateOrder::Frequency,
        _ => CandidateOrder::SameSpanFirst,
    };

    let lm = Path::new(&dir).join("bopomofo-lm.tsv");
    let Ok(dict) = Dictionary::load(&lm) else { return std::ptr::null_mut() };
    let Ok(inventory) = build_syllable_inventory(&lm) else { return std::ptr::null_mut() };

    /* The Traditional -> Simplified table lives next to the language model. It
     * is optional: without it the engine still works and simply cannot convert,
     * which is the right failure mode for a missing data file. */
    let conversion = Path::new(&dir).join("ts-conversion.tsv");
    let converter = match std::fs::read_to_string(&conversion) {
        Ok(text) => Converter::from_text(&text),
        Err(_) => Converter::identity(),
    };

    let engine = InputEngine::new(dict, inventory, EngineOptions {
            layout,
            candidate_order: order,
            converter,
            ..Default::default()
        })
        // Always attach an empty user dictionary. Without this, a fresh install
        // has nowhere to record a correction: `select_candidate` would teach
        // nothing, `engine_save_user_dictionary` would fail, and the user would
        // silently lose every word they taught — until they happened to already
        // have a dictionary file, which a new user by definition does not.
        .with_user_dictionary(UserDictionary::new(Default::default()));
    Box::into_raw(Box::new(EngineHandle { engine }))
}

/// Select the output script: `"traditional"` or `"simplified"`.
///
/// Input, the language model and the user dictionary are Traditional regardless;
/// this only decides which script leaves the engine. Returns false for an
/// unknown name rather than silently keeping the old value, so a shell that
/// misspells it finds out.
///
/// # Safety
/// `handle` must come from `engine_create` and not have been destroyed;
/// `script` must be a NUL-terminated string.
#[no_mangle]
pub unsafe extern "C" fn engine_set_output_script(
    handle: *mut EngineHandle,
    script: *const c_char,
) -> bool {
    let Some(handle) = (unsafe { handle.as_mut() }) else { return false };
    let Some(name) = (unsafe { cstr(script) }) else { return false };
    let Some(script) = OutputScript::from_id(&name) else { return false };
    handle.engine.set_output_script(script);
    true
}

/// The current output script, as a static string owned by the library.
///
/// # Safety
/// `handle` must come from `engine_create` and not have been destroyed.
#[no_mangle]
pub unsafe extern "C" fn engine_output_script(handle: *mut EngineHandle) -> *const c_char {
    let Some(handle) = (unsafe { handle.as_ref() }) else { return std::ptr::null() };
    let id = handle.engine.output_script().id();
    // Static, NUL-terminated, lives for the program's lifetime.
    match id {
        "simplified" => c"simplified".as_ptr(),
        _ => c"traditional".as_ptr(),
    }
}

/// # Safety
/// `handle` must come from `engine_create` and not have been destroyed.
#[no_mangle]
pub unsafe extern "C" fn engine_destroy(handle: *mut EngineHandle) {
    if !handle.is_null() {
        drop(unsafe { Box::from_raw(handle) });
    }
}

/// Load the user's learned words from a plain-text file, creating the engine's
/// dictionary if it is not already there.
///
/// # Safety
/// `handle` must be valid; `path` must be a valid NUL-terminated string.
#[no_mangle]
pub unsafe extern "C" fn engine_load_user_dictionary(
    handle: *mut EngineHandle,
    path: *const c_char,
) -> bool {
    let Some(h) = (unsafe { handle.as_mut() }) else { return false };
    let Some(path) = (unsafe { cstr(path) }) else { return false };
    match UserDictionary::load(&path) {
        Ok(ud) => {
            h.engine.set_user_dictionary(ud);
            true
        }
        Err(_) => false,
    }
}

/// Persist learned words. Returns false if the file cannot be written.
///
/// # Safety
/// `handle` must be valid; `path` must be a valid NUL-terminated string.
#[no_mangle]
pub unsafe extern "C" fn engine_save_user_dictionary(
    handle: *mut EngineHandle,
    path: *const c_char,
) -> bool {
    let Some(h) = (unsafe { handle.as_mut() }) else { return false };
    let Some(path) = (unsafe { cstr(path) }) else { return false };
    match h.engine.user_dictionary() {
        Some(ud) => ud.save(&path).is_ok(),
        None => false,
    }
}

/// Feed one UTF-8 key. Returns false when the layout does not use it, which is
/// how a shell knows to pass the key on to the application.
///
/// # Safety
/// `handle` must be valid; `key` must be a valid NUL-terminated string.
#[no_mangle]
pub unsafe extern "C" fn engine_feed_key(handle: *mut EngineHandle, key: *const c_char) -> bool {
    let Some(h) = (unsafe { handle.as_mut() }) else { return false };
    let Some(s) = (unsafe { cstr(key) }) else { return false };
    let Some(ch) = s.chars().next() else { return false };
    h.engine.press(ch)
}

/// Feed a whole UTF-8 string of keys. Convenience for tests and for shells that
/// read a paste; returns the number of keys the layout consumed.
///
/// # Safety
/// `handle` must be valid; `keys` must be a valid NUL-terminated string.
#[no_mangle]
pub unsafe extern "C" fn engine_feed_keys(handle: *mut EngineHandle, keys: *const c_char) -> usize {
    let Some(h) = (unsafe { handle.as_mut() }) else { return 0 };
    let Some(s) = (unsafe { cstr(keys) }) else { return 0 };
    let mut consumed = 0;
    for ch in s.chars() {
        if h.engine.press(ch) {
            consumed += 1;
        }
    }
    consumed
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_backspace(handle: *mut EngineHandle) -> bool {
    unsafe { handle.as_mut() }.map(|h| h.engine.backspace()).unwrap_or(false)
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_reset(handle: *mut EngineHandle) {
    if let Some(h) = unsafe { handle.as_mut() } {
        h.engine.reset();
    }
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_composing(handle: *mut EngineHandle) -> *const c_char {
    match unsafe { handle.as_mut() } {
        Some(h) => ret(h.engine.composing()),
        None => ret(String::new()),
    }
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_best_sentence(handle: *mut EngineHandle) -> *const c_char {
    match unsafe { handle.as_mut() } {
        Some(h) => ret(h.engine.best_sentence()),
        None => ret(String::new()),
    }
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_best_score(handle: *mut EngineHandle) -> f64 {
    unsafe { handle.as_mut() }.map(|h| h.engine.best_score()).unwrap_or(0.0)
}

/// True when the output is *provably* read exactly as typed.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_output_is_faithful(handle: *mut EngineHandle) -> bool {
    unsafe { handle.as_mut() }.map(|h| !h.engine.used_fallback()).unwrap_or(false)
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_syllable_count(handle: *mut EngineHandle) -> usize {
    unsafe { handle.as_mut() }.map(|h| h.engine.syllable_count()).unwrap_or(0)
}

/// Number of candidates on the current page.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_candidate_count(handle: *mut EngineHandle) -> usize {
    unsafe { handle.as_mut() }.map(|h| h.engine.candidate_page().entries.len()).unwrap_or(0)
}

/// Candidate `index` (0-based) on the current page.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_candidate_at(handle: *mut EngineHandle, index: usize) -> *const c_char {
    match unsafe { handle.as_mut() } {
        Some(h) => {
            let page = h.engine.candidate_page();
            ret(page.entries.get(index).map(|e| e.word.clone()).unwrap_or_default())
        }
        None => ret(String::new()),
    }
}

/// Current page index (0-based) and page count, packed as `page | (count << 32)`.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_candidate_page_info(handle: *mut EngineHandle) -> u64 {
    match unsafe { handle.as_mut() } {
        Some(h) => {
            let p = h.engine.candidate_page();
            (p.page_index as u64) | ((p.page_count as u64) << 32)
        }
        None => 0,
    }
}

/// Is the candidate window open for selection? Digits are composing keys until
/// it is.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_candidate_window_open(handle: *mut EngineHandle) -> bool {
    unsafe { handle.as_mut() }.map(|h| h.engine.candidate_window_open()).unwrap_or(false)
}

/// Down arrow.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_open_candidate_window(handle: *mut EngineHandle) -> bool {
    unsafe { handle.as_mut() }.map(|h| h.engine.open_candidate_window()).unwrap_or(false)
}

/// Up arrow or Esc.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_close_candidate_window(handle: *mut EngineHandle) {
    if let Some(h) = unsafe { handle.as_mut() } {
        h.engine.close_candidate_window();
    }
}

/// Space. Returns false when already on the last page.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_next_candidate_page(handle: *mut EngineHandle) -> bool {
    unsafe { handle.as_mut() }.map(|h| h.engine.next_candidate_page()).unwrap_or(false)
}

/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_prev_candidate_page(handle: *mut EngineHandle) -> bool {
    unsafe { handle.as_mut() }.map(|h| h.engine.prev_candidate_page()).unwrap_or(false)
}

/// Arrow keys. `delta` is -1 or +1.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_move_candidate_cursor(handle: *mut EngineHandle, delta: i32) -> bool {
    unsafe { handle.as_mut() }
        .map(|h| h.engine.move_candidate_cursor(delta as isize))
        .unwrap_or(false)
}

/// Pick candidate `one_based` (1..=10) and return the committed text.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_select_candidate(handle: *mut EngineHandle, one_based: usize) -> *const c_char {
    match unsafe { handle.as_mut() } {
        Some(h) => ret(h.engine.select_candidate(one_based)),
        None => ret(String::new()),
    }
}

/// Accept the auto-selected sentence and clear the buffer.
///
/// # Safety
/// `handle` must be valid.
#[no_mangle]
pub unsafe extern "C" fn engine_commit(handle: *mut EngineHandle) -> *const c_char {
    match unsafe { handle.as_mut() } {
        Some(h) => ret(h.engine.commit()),
        None => ret(String::new()),
    }
}

/// The drawn keyboard, one line per row: `key:label|key:label|…`.
///
/// The layout lives in `keyboard.rs` — `key_rows()` derives it from the same
/// table the decoder uses, so the keyboard that is drawn and the keys that are
/// understood cannot drift apart. Windows, Android and macOS each reach it
/// through their own binding; this is the C ABI one, for shells that link the
/// header.
///
/// **Pairs, not two parallel strings.** The first version emitted the keys and
/// the labels as two runs of characters, which is shorter and was wrong: the
/// 倚天 (ETen) layout has more keys in its first row than it has Bopomofo
/// components, so the two runs were different lengths and nothing said which key
/// was missing a label. A test caught it on the first run.
///
/// A key with no component has an empty label — `7:` — which is information, not
/// a gap.
///
/// **The separators are `|` and `:`, and that is not arbitrary.** The obvious
/// choice was a comma, and a comma is a key: the fourth row of every layout is
/// `zxcvbnm,./`. A test caught that too, on the second run — the separator has
/// to be a character the keyboard does not have.
///
/// The format is deliberately not JSON: this crate has no dependencies, and
/// every character involved is ASCII except single Bopomofo codepoints.
///
/// Returns NULL for an unknown layout name.
///
/// # Safety
/// `layout` must be a valid NUL-terminated UTF-8 string or NULL.
#[no_mangle]
pub unsafe extern "C" fn engine_keyboard_rows(layout: *const c_char) -> *mut c_char {
    let layout = unsafe { cstr(layout) }
        .and_then(|s| Layout::from_id(&s))
        .unwrap_or(Layout::Standard);

    let text = layout
        .key_rows()
        .iter()
        .map(|row| {
            row.iter()
                .map(|(key, label)| format!("{key}:{label}"))
                .collect::<Vec<_>>()
                .join("|")
        })
        .collect::<Vec<_>>()
        .join("\n");

    match CString::new(text) {
        Ok(value) => value.into_raw(),
        // Cannot happen: the format excludes NUL by construction, and a test
        // checks the character set. Returning NULL here would be silent, so it
        // is at least documented as unreachable rather than expected.
        Err(_) => std::ptr::null_mut(),
    }
}

/// Frees a string returned by `engine_keyboard_rows`.
///
/// # Safety
/// `text` must have come from `engine_keyboard_rows`, or be NULL.
#[no_mangle]
pub unsafe extern "C" fn engine_keyboard_rows_free(text: *mut c_char) {
    if !text.is_null() {
        drop(unsafe { CString::from_raw(text) });
    }
}

/// ABI version, so a shell can refuse to load a mismatched library instead of
/// corrupting memory.
///
/// `#[no_mangle]` is not decoration. Without it this symbol gets a Rust-mangled
/// name, the header declares something the linker cannot find, and nothing says
/// so until something tries to link — which is what the HarmonyOS build did.
#[no_mangle]
pub extern "C" fn engine_abi_version() -> u32 {
    1
}

#[cfg(test)]
mod header_tests {
    use super::*;
    use std::collections::BTreeSet;
    use std::ffi::CStr;

    /// The public header and the actual ABI must agree.
    ///
    /// They did not: `engine_set_output_script` and `engine_output_script` were
    /// exported by the Rust core and missing from `pingzhu.h` for two releases.
    /// The Windows shell never noticed because it loads the library *dynamically*
    /// and looks symbols up by name — it never reads the header. The macOS shell
    /// links against it, and was the first thing to try to compile against a
    /// declaration that was not there.
    ///
    /// A header that describes something other than the library is worse than no
    /// header: it is a document that is wrong in a way nobody can see.
    #[test]
    fn every_exported_function_has_no_mangle() {
        // Without #[no_mangle] the symbol gets a Rust-mangled name and no C
        // linker can find it. Nothing else notices: the function compiles, the
        // tests pass, the header declares it, and the failure appears only when
        // something tries to link.
        //
        // That is exactly what happened here. Inserting a new function above
        // `engine_abi_version` split that function from its own #[no_mangle]
        // attribute — the attribute stayed behind and attached to the new
        // function's doc comment. 28 tests passed. The linker did not.
        let source = include_str!("ffi.rs");
        let lines: Vec<&str> = source.lines().collect();
        let mut missing = Vec::new();
        for (index, line) in lines.iter().enumerate() {
            let trimmed = line.trim_start();
            if !trimmed.starts_with("pub ") || !trimmed.contains("extern \"C\" fn") {
                continue;
            }
            // The attribute has to be on the function, which means somewhere in
            // the run of attributes and doc comments immediately above it. The
            // first line that is neither stops the search.
            let mut found = false;
            for previous in lines[..index].iter().rev() {
                let p = previous.trim_start();
                if p.starts_with("#[no_mangle]") {
                    found = true;
                    break;
                }
                if !(p.starts_with("#[") || p.starts_with("///")) {
                    break;
                }
            }
            if !found {
                missing.push(trimmed.split('(').next().unwrap_or(trimmed).to_string());
            }
        }
        assert!(missing.is_empty(),
            "these are exported but will be name-mangled, so no C linker can find them: {missing:?}");
    }

    #[test]
    fn the_keyboard_wire_format_is_what_the_shells_parse() {
        // The format is `key:label` pairs, comma-separated, one row per line,
        // and it is parsed by hand on the other side. The claim in the doc
        // comment is that no character in it can be `,`, `:`, `|` or a newline —
        // if that stops being true the format breaks silently, and the shell
        // that breaks is not the one being changed.
        fn rows(layout: &str) -> Vec<Vec<(char, String)>> {
            let name = CString::new(layout).unwrap();
            let raw = unsafe { engine_keyboard_rows(name.as_ptr()) };
            assert!(!raw.is_null(), "{layout} produced nothing");
            let text = unsafe { CStr::from_ptr(raw) }.to_str().unwrap().to_string();
            unsafe { engine_keyboard_rows_free(raw) };
            text.split('\n')
                .map(|line| {
                    line.split('|')
                        .map(|pair| {
                            let (key, label) = pair.split_once(':').expect("each entry is key:label");
                            assert_eq!(key.chars().count(), 1, "{layout}: {key:?} is not one key");
                            (key.chars().next().unwrap(), label.to_string())
                        })
                        .collect()
                })
                .collect()
        }

        for layout in ["standard", "eten"] {
            let board = rows(layout);
            assert_eq!(board.len(), 4, "{layout}: expected four rows");
            assert!(board[0].len() >= 10, "{layout}: first row is too short");

            for (index, row) in board.iter().enumerate() {
                for (key, label) in row {
                    assert!(!"|:\n\0".contains(*key), "{layout}: key {key:?} breaks the format");
                    assert!(label.chars().count() <= 1, "{layout}: {label:?} is not a single component");
                    assert!(label.is_empty() || !"|:\n\0".contains(label.chars().next().unwrap()),
                        "{layout}: label {label:?} breaks the format");
                }
                let _ = index;
            }
        }

        // The first row is the digits, and it is the one the digit rule depends
        // on: 1 is ㄅ, 2 is ㄉ, 5 is ㄓ, 8 is ㄚ, 9 is ㄞ, 0 is ㄢ.
        let standard = rows("standard");
        let first: Vec<(char, String)> = standard[0].clone();
        assert_eq!(first.len(), 11, "standard: the digit row has eleven keys");
        let labels: Vec<&str> = first.iter().map(|(_, l)| l.as_str()).collect();
        assert_eq!(labels, vec!["ㄅ", "ㄉ", "ˇ", "ˋ", "ㄓ", "ˊ", "˙", "ㄚ", "ㄞ", "ㄢ", "ㄦ"]);

        // 倚天 is not the standard layout, and this is where that shows up: its
        // first row has eleven keys and only nine of them are Bopomofo
        // components. The two-run format this replaced could not represent that
        // — it produced two strings of different lengths and no way to tell
        // which key was the one without a label.
        let eten = rows("eten");
        assert_eq!(eten[0].len(), 11, "eten: the digit row has eleven keys");
        let missing: Vec<char> = eten[0]
            .iter()
            .filter(|(_, label)| label.is_empty())
            .map(|(key, _)| *key)
            .collect();
        assert_eq!(missing.len(), 2, "eten: expected two keys with no component");
        for key in &missing {
            // Those keys still compose nothing, so the decoder must not claim
            // them either — the drawn keyboard and the decoder come from the
            // same table, and this is the assertion that says so.
            assert!(Layout::ETen.components_for(*key).is_empty(),
                "eten: {key} is drawn without a label but the decoder accepts it");
        }

        // An unknown layout falls back to the standard one rather than failing,
        // which is what engine_create does too.
        let unknown = rows("dvorak");
        assert_eq!(unknown[0].len(), 11);
        assert_eq!(unknown[0][0].1, "ㄅ");
    }

    #[test]
    fn the_header_declares_every_exported_function() {
        let source = include_str!("ffi.rs");
        let header = include_str!("../include/pingzhu.h");

        let mut exported = BTreeSet::new();
        for line in source.lines() {
            if let Some(rest) = line.split("extern \"C\" fn engine_").nth(1) {
                let name = rest.split(|c: char| !c.is_ascii_alphanumeric() && c != '_').next().unwrap_or("");
                if !name.is_empty() {
                    exported.insert(format!("engine_{name}"));
                }
            }
        }
        assert!(exported.len() > 20, "only found {} exports — the parser broke", exported.len());

        let mut declared = BTreeSet::new();
        for line in header.lines() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") || trimmed.starts_with('*') {
                continue;
            }
            let mut rest = trimmed;
            while let Some(index) = rest.find("engine_") {
                rest = &rest[index..];
                let name: String = rest
                    .chars()
                    .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                    .collect();
                declared.insert(name);
                rest = &rest[1..];
            }
        }

        let missing: Vec<_> = exported.difference(&declared).cloned().collect();
        assert!(
            missing.is_empty(),
            "exported but not declared in include/pingzhu.h: {missing:?}"
        );
    }
}
