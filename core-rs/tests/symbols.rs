//! The punctuation page has two copies; this holds them together.
//!
//! `core-rs/src/symbols.rs` is what the shells read. `engine/src/symbols.ts` is
//! what the browser demo reads — it has no C ABI to ask, because the point of the
//! demo is that nothing is installed. `engine/dump-fixture.mjs --symbols` writes
//! the TypeScript one in the FFI's wire format; this compares it with the Rust one.
//!
//! Without this, the two pages drift one glyph at a time and nobody notices until
//! a user does. That is the same failure this project keeps meeting in other
//! shapes — a second copy of a table, correct on the day it was written.

use std::path::Path;

#[test]
fn the_page_matches_the_typescript_reference() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/symbols.tsv");
    let expected = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        panic!(
            "cannot read {}: {e}\nregenerate with: cd engine && node dump-fixture.mjs --symbols > ../core-rs/tests/symbols.tsv",
            path.display()
        )
    });

    let actual = pingzhu_core::symbols::ROWS
        .iter()
        .map(|row| row.join("|"))
        .collect::<Vec<_>>()
        .join("\n");

    assert_eq!(
        expected.trim_end_matches('\n'),
        actual,
        "the Rust symbol page and the TypeScript one disagree"
    );
}
