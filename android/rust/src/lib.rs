//! JNI bindings for the Android IME shell.
//!
//! The Android app talks to the same Rust core the Windows shells use. This
//! crate is the only place that knows both sides: it exposes the engine as
//! `tw.pingzhu.ime.Engine`'s native methods and nothing else.
//!
//! Design notes that are not obvious:
//!
//! * **Strings, not arrays.** The candidate page crosses the boundary as one
//!   newline-joined string rather than a `String[]`. Building an object array
//!   through the JNI function table is a dozen calls that can each throw, for no
//!   benefit — candidates never contain a newline, and splitting in Kotlin is one
//!   line.
//! * **A handle, not a global.** Each engine instance is a boxed pointer the
//!   Kotlin side owns and must destroy. Android can tear the input method down at
//!   any moment, so nothing may be held in a static.
//! * **Never panic across the boundary.** A Rust panic unwinding into the JVM is
//!   undefined behaviour; the release profile already aborts, and every entry
//!   point here returns a neutral value instead of unwrapping.

use std::os::raw::{c_char, c_void};
use std::panic::{catch_unwind, AssertUnwindSafe};

use jni_sys::{jboolean, jclass, jint, jlong, jstring, JNIEnv, JNI_FALSE, JNI_TRUE};
use pingzhu_core::{Dictionary, EngineOptions, InputEngine, UserDictionary};
use pingzhu_core::converter::{Converter, OutputScript};
use pingzhu_core::keyboard::Layout;
use pingzhu_core::dictionary::build_syllable_inventory;

use std::path::Path;

/// The boxed engine the Kotlin side holds as a `long`.
struct Handle {
    engine: InputEngine,
}

// ---------------------------------------------------------------- JNI helpers

/// # Safety
/// `env` must be a valid JNI environment and `s` a valid `jstring` or null.
unsafe fn to_string(env: *mut JNIEnv, s: jstring) -> Option<String> {
    if s.is_null() {
        return None;
    }
    let get = unsafe { (**env).GetStringUTFChars }.expect("GetStringUTFChars");
    let release = unsafe { (**env).ReleaseStringUTFChars }.expect("ReleaseStringUTFChars");
    let chars = unsafe { get(env, s, std::ptr::null_mut()) };
    if chars.is_null() {
        return None;
    }
    // The JVM hands out modified UTF-8. Bopomofo keys are ASCII and dictionary
    // paths are ASCII, so this is exact for every string this API accepts.
    let out = unsafe { std::ffi::CStr::from_ptr(chars) }
        .to_string_lossy()
        .into_owned();
    unsafe { release(env, s, chars) };
    Some(out)
}

/// # Safety
/// `env` must be a valid JNI environment.
unsafe fn to_jstring(env: *mut JNIEnv, value: &str) -> jstring {
    let new = unsafe { (**env).NewStringUTF }.expect("NewStringUTF");
    match std::ffi::CString::new(value) {
        Ok(c) => unsafe { new(env, c.as_ptr()) },
        // Interior NUL cannot appear in anything the engine produces; returning
        // null makes the failure visible instead of truncating silently.
        Err(_) => std::ptr::null_mut(),
    }
}

/// Runs `body`, turning a panic into `default` rather than unwinding into the JVM.
fn guarded<T>(default: T, body: impl FnOnce() -> T) -> T {
    match catch_unwind(AssertUnwindSafe(body)) {
        Ok(value) => value,
        Err(payload) => {
            // The message is kept, not discarded. The first version of this
            // returned the default silently, so a panic in the keyboard builder
            // arrived on the Java side as an empty string and the keyboard drew
            // nothing — with no exception, no log line, and no clue. Catching a
            // panic is right; hiding it is what made it hard to find.
            LAST_PANIC.with(|cell| *cell.borrow_mut() = panic_message(&payload));
            default
        }
    }
}

thread_local! {
    static LAST_PANIC: std::cell::RefCell<String> = std::cell::RefCell::new(String::new());
}

fn panic_message(payload: &Box<dyn std::any::Any + Send>) -> String {
    if let Some(text) = payload.downcast_ref::<&str>() {
        (*text).to_string()
    } else if let Some(text) = payload.downcast_ref::<String>() {
        text.clone()
    } else {
        "panic with a non-string payload".to_string()
    }
}

/// Runs `body`, and on a panic returns a string that *says* it panicked.
///
/// Used by the entry points that hand text back to Java: a silent empty string
/// is indistinguishable from a legitimate empty result, so the shell would draw
/// nothing and never know why.
fn guarded_string(body: impl FnOnce() -> String) -> String {
    let value = guarded(String::new(), body);
    LAST_PANIC.with(|cell| {
        let message = cell.borrow().clone();
        if message.is_empty() {
            value
        } else {
            format!("\u{1}PANIC IN NATIVE CODE: {message}")
        }
    })
}

/// # Safety
/// `handle` must be a pointer returned by `nativeCreate` and not yet destroyed.
unsafe fn engine<'a>(handle: jlong) -> Option<&'a mut InputEngine> {
    if handle == 0 {
        return None;
    }
    let h = unsafe { &mut *(handle as *mut Handle) };
    Some(&mut h.engine)
}

// ------------------------------------------------------------------- exports

/// Creates an engine, loading `bopomofo-lm.tsv` and `ts-conversion.tsv` from
/// `data_dir`. Returns 0 when the language model cannot be read.
///
/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeCreate(
    env: *mut JNIEnv,
    _class: jclass,
    data_dir: jstring,
) -> jlong {
    guarded(0, || {
        let Some(dir) = (unsafe { to_string(env, data_dir) }) else { return 0 };
        let lm = Path::new(&dir).join("bopomofo-lm.tsv");
        let Ok(dict) = Dictionary::load(&lm) else { return 0 };
        let Ok(inventory) = build_syllable_inventory(&lm) else { return 0 };

        // Optional, exactly as on the desktop: without the table the input method
        // still works and simply cannot convert, which is the right failure mode
        // for a missing data file.
        let conversion = Path::new(&dir).join("ts-conversion.tsv");
        let converter = match std::fs::read_to_string(&conversion) {
            Ok(text) => Converter::from_text(&text),
            Err(_) => Converter::identity(),
        };

        let engine = InputEngine::new(dict, inventory, EngineOptions {
            converter,
            ..Default::default()
        })
        // Always attach a user dictionary: without one, selecting a candidate
        // teaches nothing and every correction the user makes is lost.
        .with_user_dictionary(UserDictionary::new(Default::default()));
        Box::into_raw(Box::new(Handle { engine })) as jlong
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeDestroy(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) {
    if handle == 0 {
        return;
    }
    guarded((), || {
        drop(unsafe { Box::from_raw(handle as *mut Handle) });
    });
}

/// Feeds one key. Returns true when the input method consumed it.
///
/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeFeedKey(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
    key: jstring,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(engine) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        let Some(text) = (unsafe { to_string(env, key) }) else { return JNI_FALSE };
        let Some(ch) = text.chars().next() else { return JNI_FALSE };
        if engine.press(ch) { JNI_TRUE } else { JNI_FALSE }
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeBackspace(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        if e.backspace() { JNI_TRUE } else { JNI_FALSE }
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeReset(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) {
    guarded((), || {
        if let Some(e) = unsafe { engine(handle) } {
            e.reset();
        }
    });
}

// ------------------------------------------------------------------ read-only

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeComposing(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jstring {
    let text = guarded_string(|| {
        unsafe { engine(handle) }.map(|e| e.composing()).unwrap_or_default()
    });
    unsafe { to_jstring(env, &text) }
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeBestSentence(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jstring {
    let text = guarded_string(|| {
        unsafe { engine(handle) }.map(|e| e.best_sentence()).unwrap_or_default()
    });
    unsafe { to_jstring(env, &text) }
}

/// True when the current sentence is a real decode rather than a per-syllable
/// guess. The shell shows the difference, so the user knows when to check.
///
/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeOutputIsFaithful(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jboolean {
    guarded(JNI_TRUE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        if !e.used_fallback() { JNI_TRUE } else { JNI_FALSE }
    })
}

// ----------------------------------------------------------------- candidates

/// The current candidate page, one candidate per line.
///
/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeCandidates(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jstring {
    let text = guarded_string(|| {
        let Some(e) = (unsafe { engine(handle) }) else { return String::new() };
        e.candidate_page()
            .entries
            .iter()
            .map(|entry| entry.word.clone())
            .collect::<Vec<_>>()
            .join("\n")
    });
    unsafe { to_jstring(env, &text) }
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeWindowOpen(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        if e.candidate_window_open() { JNI_TRUE } else { JNI_FALSE }
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeOpenWindow(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        if e.open_candidate_window() { JNI_TRUE } else { JNI_FALSE }
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeNextPage(
    _env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        if e.next_candidate_page() { JNI_TRUE } else { JNI_FALSE }
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeSelect(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
    one_based: jint,
) -> jstring {
    let text = guarded_string(|| {
        let Some(e) = (unsafe { engine(handle) }) else { return String::new() };
        if one_based < 1 { return String::new() }
        // select_candidate is one-based and returns an empty string when the
        // index is past the page: "nothing was chosen", never "chose empty".
        e.select_candidate(one_based as usize)
    });
    unsafe { to_jstring(env, &text) }
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeCommit(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jstring {
    let text = guarded_string(|| {
        unsafe { engine(handle) }.map(|e| e.commit()).unwrap_or_default()
    });
    unsafe { to_jstring(env, &text) }
}

// --------------------------------------------------------------------- script

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeOutputScript(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
) -> jstring {
    let text = guarded_string(|| {
        unsafe { engine(handle) }
            .map(|e| e.output_script().id().to_string())
            .unwrap_or_else(|| "traditional".to_string())
    });
    unsafe { to_jstring(env, &text) }
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeSetOutputScript(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
    script: jstring,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        let Some(name) = (unsafe { to_string(env, script) }) else { return JNI_FALSE };
        match OutputScript::from_id(&name) {
            Some(s) => {
                e.set_output_script(s);
                JNI_TRUE
            }
            None => JNI_FALSE,
        }
    })
}

// ------------------------------------------------------------ user dictionary

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeLoadUserDictionary(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
    path: jstring,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        let Some(p) = (unsafe { to_string(env, path) }) else { return JNI_FALSE };
        // Same shape as the C ABI: a missing dictionary on first run is not an
        // error, it is the normal state, so a load failure leaves the empty
        // dictionary in place rather than clearing it.
        match UserDictionary::load(&p) {
            Ok(loaded) => {
                e.set_user_dictionary(loaded);
                JNI_TRUE
            }
            Err(_) => JNI_FALSE,
        }
    })
}

/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeSaveUserDictionary(
    env: *mut JNIEnv,
    _class: jclass,
    handle: jlong,
    path: jstring,
) -> jboolean {
    guarded(JNI_FALSE, || {
        let Some(e) = (unsafe { engine(handle) }) else { return JNI_FALSE };
        let Some(p) = (unsafe { to_string(env, path) }) else { return JNI_FALSE };
        match e.user_dictionary() {
            Some(dictionary) if dictionary.save(&p).is_ok() => JNI_TRUE,
            _ => JNI_FALSE,
        }
    })
}

/// The keyboard layout's key labels, one per line, in reading order.
///
/// The shell draws the keyboard from this rather than keeping its own copy of
/// the layout: two copies of a 41-key table is two chances to disagree, and the
/// one on screen is the one nobody tests.
///
/// # Safety
/// Called by the JVM.
#[no_mangle]
pub unsafe extern "C" fn Java_tw_pingzhu_ime_Engine_nativeKeyboardLabels(
    env: *mut JNIEnv,
    _class: jclass,
    _handle: jlong,
) -> jstring {
    let text = guarded_string(|| {
        // "key\tlabel" pairs, rows separated by newlines: enough for the shell
        // to draw the keyboard without keeping a second copy of the layout.
        Layout::Standard
            .key_rows()
            .iter()
            .map(|row| {
                row.iter()
                    .map(|(key, label)| format!("{}\t{}", key, label))
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .collect::<Vec<_>>()
            .join("\n")
    });
    unsafe { to_jstring(env, &text) }
}

/// Unused parameter kept for ABI symmetry with the other entry points.
#[allow(dead_code)]
fn _touch(_: *mut c_void, _: *const c_char) {}
