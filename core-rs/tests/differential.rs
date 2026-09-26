//! Differential test: the Rust port must reproduce the TypeScript reference
//! *exactly*, on 1,500+ real keystroke strings.
//!
//! This is the whole reason the port can be trusted. Re-deriving "what correct
//! means" in a second language is how ports quietly disagree in the corners —
//! and those corners are where an input method produces the wrong character.
//! Instead, `engine/dump-fixture.mjs` records what the reference actually does,
//! and this test replays it:
//!
//! ```text
//! keys <TAB> composing <TAB> sentence <TAB> score <TAB> usedFallback <TAB> pathWords <TAB> page1
//! ```
//!
//! Regenerate the fixture after any intentional behaviour change:
//!
//! ```bash
//! cd engine && node dump-fixture.mjs 1500 > ../core-rs/tests/fixture.tsv
//! ```

use std::path::{Path, PathBuf};

use pingzhu_core::{build_syllable_inventory, Dictionary, EngineOptions, InputEngine, Layout};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn engine(layout: Layout) -> InputEngine {
    let lm = repo_root().join("data/bopomofo-lm.tsv");
    let dict = Dictionary::load(&lm).expect("language model");
    let inventory = build_syllable_inventory(&lm).expect("inventory");
    InputEngine::new(dict, inventory, EngineOptions { layout, ..Default::default() })
}

struct Case {
    keys: String,
    composing: String,
    sentence: String,
    score: f64,
    used_fallback: bool,
    path_words: String,
    page1: String,
}

fn load_fixture() -> Vec<Case> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixture.tsv");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        panic!(
            "cannot read {}: {e}\nregenerate with: cd engine && node dump-fixture.mjs 1500 > ../core-rs/tests/fixture.tsv",
            path.display()
        )
    });
    text.lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let f: Vec<&str> = line.split('\t').collect();
            assert_eq!(f.len(), 7, "malformed fixture row: {line}");
            Case {
                keys: f[0].to_string(),
                composing: f[1].to_string(),
                sentence: f[2].to_string(),
                score: f[3].parse().expect("score"),
                used_fallback: f[4] == "1",
                path_words: f[5].to_string(),
                page1: f[6].to_string(),
            }
        })
        .collect()
}

#[test]
fn rust_core_reproduces_the_typescript_reference() {
    let cases = load_fixture();
    assert!(cases.len() > 1000, "fixture looks truncated: {} cases", cases.len());

    // The fixture ends with two ETen cases; everything before them is Standard.
    let eten_from = cases.len() - 2;
    let mut standard = engine(Layout::Standard);
    let mut eten = engine(Layout::ETen);

    let mut mismatches: Vec<String> = Vec::new();
    for (i, case) in cases.iter().enumerate() {
        let eng = if i >= eten_from { &mut eten } else { &mut standard };
        eng.reset();
        eng.press_str(&case.keys);

        let page1: Vec<String> =
            eng.candidate_page().entries.iter().map(|e| e.word.clone()).collect();
        let page1 = page1.join("|");
        let path_words = eng
            .chosen_path()
            .map(|p| p.nodes.iter().map(|n| n.word.clone()).collect::<Vec<_>>().join("|"))
            .unwrap_or_default();

        let mut problems: Vec<String> = Vec::new();
        if eng.composing() != case.composing {
            problems.push(format!("composing {:?} != {:?}", eng.composing(), case.composing));
        }
        if eng.best_sentence() != case.sentence {
            problems.push(format!("sentence {:?} != {:?}", eng.best_sentence(), case.sentence));
        }
        // Sums of the same parsed f64 values in the same order; a tolerance keeps
        // this from failing on formatting rather than behaviour.
        if (eng.best_score() - case.score).abs() > 1e-6 {
            problems.push(format!("score {} != {}", eng.best_score(), case.score));
        }
        if eng.used_fallback() != case.used_fallback {
            problems.push(format!("usedFallback {} != {}", eng.used_fallback(), case.used_fallback));
        }
        if path_words != case.path_words {
            problems.push(format!("pathWords {path_words:?} != {:?}", case.path_words));
        }
        if page1 != case.page1 {
            problems.push(format!("page1 {page1:?} != {:?}", case.page1));
        }

        if !problems.is_empty() && mismatches.len() < 20 {
            mismatches.push(format!("  keys {:?}: {}", case.keys, problems.join("; ")));
        }
    }

    assert!(
        mismatches.is_empty(),
        "Rust core disagrees with the TypeScript reference on {} case(s):\n{}",
        mismatches.len(),
        mismatches.join("\n")
    );
}
