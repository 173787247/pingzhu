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

    let engine = InputEngine::new(dict, inventory, EngineOptions { layout, candidate_order: order, ..Default::default() });
    Box::into_raw(Box::new(EngineHandle { engine }))
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

/// ABI version, so a shell can refuse to load a mismatched library instead of
/// corrupting memory.
#[no_mangle]
pub extern "C" fn engine_abi_version() -> u32 {
    1
}
