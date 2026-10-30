//! The punctuation page.
//!
//! The 大千式 board has no room for punctuation: every key is a reading, `,` is
//! ㄝ, and the function row is full. On a desktop that is fine — `Shift+,` passes
//! straight through, because a key the router does not recognise is not the input
//! method's. A phone has no Shift, so its operator needs somewhere else to reach
//! a comma, a full stop, a question mark.
//!
//! The table lives here, in the engine, for the same reason the layout tables do:
//! every front end must show the same page. A table copied into each shell is
//! wrong in one cell sooner or later, and silent about it.
//!
//! Full-width, because that is what a Chinese sentence uses. Grouped by how often
//! they are reached for, not by Unicode order.

/// The page, as rows. Each entry is one glyph — no cell holds two characters,
/// because a shell inserts them by tapping one key.
pub const ROWS: &[&[&str]] = &[
    &["，", "。", "、", "；", "：", "？", "！"],
    &["「", "」", "『", "』", "（", "）", "《", "》"],
    &["【", "】", "〈", "〉", "…", "—", "～", "·"],
    &["／", "＼", "＃", "＄", "％", "＆", "＊", "＋"],
    &["－", "＝", "＠", "＿", "｜", "＾"],
];

/// The page flattened, for a shell that would rather index than nest.
pub fn all() -> impl Iterator<Item = &'static str> {
    ROWS.iter().flat_map(|row| row.iter().copied())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_glyph_is_exactly_one_character() {
        for glyph in all() {
            let mut chars = glyph.chars();
            assert!(chars.next().is_some(), "empty cell in the symbol page");
            assert!(
                chars.next().is_none(),
                "{glyph:?} is more than one character; a shell inserts it by tapping one key"
            );
        }
    }

    /// The wire format is `|` between cells and `\n` between rows, so neither may
    /// appear in a glyph — otherwise a shell would see more cells than exist.
    #[test]
    fn no_glyph_contains_a_separator() {
        for glyph in all() {
            assert!(!glyph.contains('|'), "{glyph:?} contains the cell separator");
            assert!(!glyph.contains('\n'), "{glyph:?} contains the row separator");
        }
    }

    #[test]
    fn no_duplicates() {
        let mut seen = std::collections::HashSet::new();
        for glyph in all() {
            assert!(seen.insert(glyph), "{glyph:?} appears twice on the page");
        }
    }

    /// A page with a handful of glyphs is a page someone forgot to fill in.
    #[test]
    fn the_page_is_not_empty() {
        assert!(all().count() >= 30, "the symbol page looks truncated");
    }
}
