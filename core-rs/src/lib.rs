//! 平注 PingZhu — cross-platform Bopomofo (注音) input method engine core.
//!
//! This crate is the port of the TypeScript reference implementation in
//! `engine/`, and it exists because of one constraint: **every platform shell
//! needs the same decoder, and every platform shell speaks C**.
//!
//! | platform | shell | how it reaches this crate |
//! |---|---|---|
//! | Windows | TSF text service (in-proc COM DLL) | links the C ABI |
//! | macOS | InputMethodKit | Swift `@_silgen_name` / a thin C shim |
//! | Android | `InputMethodService` | JNI |
//! | HarmonyOS | `InputMethodExtensionAbility` | NAPI |
//!
//! The TypeScript version is the specification: it has the tests, the two
//! benchmark harnesses and the reasoning in its comments. This port is held to
//! byte-identical output by `tests/differential.rs`, which replays a fixture
//! dumped from the reference.
//!
//! ```no_run
//! use pingzhu_core::{EngineOptions, InputEngine};
//!
//! let mut engine = InputEngine::from_data_dir("../data", EngineOptions::default()).unwrap();
//! engine.press_str("su3cl3");
//! assert_eq!(engine.best_sentence(), "你好");
//! ```

pub mod converter;
pub mod dictionary;
pub mod engine;
pub mod ffi;
pub mod grid;
pub mod keyboard;
pub mod syllable;
pub mod userdict;

pub use dictionary::{build_syllable_inventory, Dictionary, Entry};
pub use engine::{CandidatePage, EngineOptions, InputEngine, CANDIDATE_PAGE_SIZE};
pub use grid::{CandidateOrder, GridPath, ReadingGrid};
pub use keyboard::Layout;
pub use userdict::{UserDictionary, UserDictionaryOptions};

use std::path::Path;

/// Convenience loader: point at the repository's `data/` directory.
impl InputEngine {
    pub fn from_data_dir(
        data_dir: impl AsRef<Path>,
        options: EngineOptions,
    ) -> std::io::Result<InputEngine> {
        let lm = data_dir.as_ref().join("bopomofo-lm.tsv");
        let dict = Dictionary::load(&lm)?;
        let inventory = build_syllable_inventory(&lm)?;
        Ok(InputEngine::new(dict, inventory, options))
    }
}
