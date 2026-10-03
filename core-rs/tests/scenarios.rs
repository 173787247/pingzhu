//! Interaction parity: the Rust core must reproduce the reference's *stateful*
//! behaviour, not just its decoding.
//!
//! `differential.rs` covers "keys in, sentence out". This covers the half a
//! shell's key router actually depends on, and the half most likely to drift
//! between two implementations:
//!
//! * digits are bopomofo keys until the candidate window is open
//! * space opens the window, then pages through it
//! * arrows open it too, and move along the buffer
//! * typing or backspace closes it again
//! * selecting commits and teaches the user dictionary
//!
//! Regenerate with:
//! ```bash
//! cd engine && node dump-scenarios.mjs > ../core-rs/tests/scenarios.tsv
//! ```

use std::path::{Path, PathBuf};

use pingzhu_core::{
    build_syllable_inventory, Dictionary, EngineOptions, InputEngine, UserDictionary,
    UserDictionaryOptions,
};

const DAY: i64 = 20_000;

/// One engine for the whole file — the language model is read-only and reloading
/// it per row would dominate the runtime.
fn engine() -> InputEngine {
    let lm = Path::new(env!("CARGO_MANIFEST_DIR")).join("../data/bopomofo-lm.tsv");
    let dict = Dictionary::load(&lm).expect("language model");
    let inventory = build_syllable_inventory(&lm).expect("inventory");
    InputEngine::new(dict, inventory, EngineOptions::default())
}

#[test]
fn rust_core_reproduces_the_reference_interaction_model() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/scenarios.tsv");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        panic!(
            "cannot read {}: {e}\nregenerate with: cd engine && node dump-scenarios.mjs > ../core-rs/tests/scenarios.tsv",
            path.display()
        )
    });

    let mut engine = engine();
    let mut checked = 0usize;
    let mut mismatches: Vec<String> = Vec::new();

    for line in text.lines() {
        if line.is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split('\t').collect();
        assert_eq!(f.len(), 6, "malformed scenario row: {line}");
        let (ops, want_sentence, want_composing, want_open, want_page, want_committed) =
            (f[0], f[1], f[2], f[3] == "1", f[4], f[5]);

        // Every scenario must start from the same place the generator did: a
        // fresh user dictionary. Reusing one would let a selection in an earlier
        // row teach a word that changes a later row's candidate order — which is
        // exactly the false positive this test reported the first time it ran.
        engine.reset(); // clear the previous row's keystrokes before re-decoding
        engine.set_user_dictionary(UserDictionary::with_today(
            UserDictionaryOptions::default(),
            DAY,
        ));
        let mut committed: Vec<String> = Vec::new();
        for op in ops.split(' ') {
            if let Some(key) = op.strip_prefix("k:") {
                engine.press(key.chars().next().unwrap());
            } else if let Some(n) = op.strip_prefix("sel:") {
                let out = engine.select_candidate(n.parse().unwrap());
                if !out.is_empty() {
                    committed.push(out);
                }
            } else {
                match op {
                    // Space as every shell routes it: the first press opens the
                    // list, the next takes what is on it, and with nothing to
                    // offer it accepts. It used to page while the list was open.
                    "space" => {
                        if engine.candidate_window_open() {
                            let out = engine.commit();
                            if !out.is_empty() {
                                committed.push(out);
                            }
                        } else if !engine.open_candidate_window() {
                            let out = engine.commit();
                            if !out.is_empty() {
                                committed.push(out);
                            }
                        }
                    }
                    // ↓ opens and pages with one key.
                    "down" => {
                        engine.next_candidate_page();
                    }
                    "open" => {
                        engine.open_candidate_window();
                    }
                    "close" => engine.close_candidate_window(),
                    "left" => {
                        engine.move_candidate_cursor(-1);
                    }
                    "right" => {
                        engine.move_candidate_cursor(1);
                    }
                    "bs" => {
                        engine.backspace();
                    }
                    "enter" => {
                        let out = engine.commit();
                        if !out.is_empty() {
                            committed.push(out);
                        }
                    }
                    other => panic!("unknown op in fixture: {other}"),
                }
            }
        }

        let got_page =
            engine.candidate_page().entries.iter().map(|e| e.word.clone()).collect::<Vec<_>>().join("|");
        let got_committed = committed.join("\u{241f}");

        let mut problems: Vec<String> = Vec::new();
        if engine.best_sentence() != want_sentence {
            problems.push(format!("sentence {:?} != {want_sentence:?}", engine.best_sentence()));
        }
        if engine.composing() != want_composing {
            problems.push(format!("composing {:?} != {want_composing:?}", engine.composing()));
        }
        if engine.candidate_window_open() != want_open {
            problems.push(format!("open {} != {want_open}", engine.candidate_window_open()));
        }
        if got_page != want_page {
            problems.push(format!("page {got_page:?} != {want_page:?}"));
        }
        if got_committed != want_committed {
            problems.push(format!("committed {got_committed:?} != {want_committed:?}"));
        }
        if !problems.is_empty() && mismatches.len() < 15 {
            mismatches.push(format!("  ops {ops:?}: {}", problems.join("; ")));
        }
        checked += 1;
    }

    assert!(checked > 100, "scenario fixture looks truncated: {checked} rows");
    assert!(
        mismatches.is_empty(),
        "Rust core disagrees with the reference on interaction:\n{}",
        mismatches.join("\n")
    );
}
