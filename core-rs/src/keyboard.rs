//! Keyboard layouts.
//!
//! Tables transcribed from McBopomofo's `BopomofoKeyboardLayout.ts` (MIT), which
//! carries a test suite per layout, and cross-checked against strings Taiwanese
//! IMEs are expected to honour (`su3cl3` → 你好, `ji394su3` → 我愛你).
//!
//! Space is deliberately not a composing key: it pages the candidate window,
//! following 自然輸入法. 一聲 needs no key — a syllable is closed by the next
//! syllable's first key or by a tone key, and ㄓㄔㄕㄖㄗㄘㄙ stand alone.

use crate::syllable::{Component, Kind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Standard,
    ETen,
    Hsu,
    ETen26,
    Ibm,
    Ginyieh,
    Mitac,
}

impl Layout {
    pub fn id(self) -> &'static str {
        match self {
            Layout::Standard => "standard",
            Layout::ETen => "eten",
            Layout::Hsu => "hsu",
            Layout::ETen26 => "eten26",
            Layout::Ibm => "ibm",
            Layout::Ginyieh => "ginyieh",
            Layout::Mitac => "mitac",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Layout::Standard => "標準 (大千式)",
            Layout::ETen => "倚天式",
            Layout::Hsu => "許氏",
            Layout::ETen26 => "倚天 26 鍵",
            Layout::Ibm => "IBM",
            Layout::Ginyieh => "精業",
            Layout::Mitac => "神通",
        }
    }

    pub fn from_id(id: &str) -> Option<Layout> {
        match id {
            "standard" => Some(Layout::Standard),
            "eten" => Some(Layout::ETen),
            "hsu" => Some(Layout::Hsu),
            "eten26" => Some(Layout::ETen26),
            "ibm" => Some(Layout::Ibm),
            "ginyieh" => Some(Layout::Ginyieh),
            "mitac" => Some(Layout::Mitac),
            _ => None,
        }
    }

    /// Every layout the engine knows.
    ///
    /// Tests walk this rather than listing variants, so a layout added tomorrow is
    /// exercised the day it exists instead of the day someone remembers to add it.
    pub fn all() -> &'static [Layout] {
        &[
            Layout::Standard,
            Layout::ETen,
            Layout::Hsu,
            Layout::ETen26,
            Layout::Ibm,
            Layout::Ginyieh,
            Layout::Mitac,
        ]
    }

    /// Components a key can produce. An empty slice means the key is not part of
    /// this layout's composing alphabet.
    pub fn components_for(self, key: char) -> &'static [Component] {
        match self {
            Layout::Standard => standard_components(key),
            Layout::ETen => eten_components(key),
            Layout::Hsu => hsu_components(key),
            Layout::ETen26 => eten26_components(key),
            Layout::Ibm => ibm_components(key),
            Layout::Ginyieh => ginyieh_components(key),
            Layout::Mitac => mitac_components(key),
        }
    }

    /// The keyboard as it should be drawn: four rows of `(key, label)`.
    ///
    /// Derived from the same table `components_for` uses rather than kept as a
    /// second copy. A hand-maintained keyboard picture is the kind of thing that
    /// drifts one key at a time and is only noticed by someone who already knows
    /// the layout by heart — which is exactly the person who does not need the
    /// picture. `the_drawn_keyboard_matches_the_decoder` pins them together.
    ///
    /// A key with no label is not a composing key; the shell draws it dimmed.
    pub fn key_rows(self) -> Vec<Vec<(char, &'static str)>> {
        const ROWS: [&str; 4] = ["1234567890-", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
        ROWS.iter()
            .map(|row| {
                row.chars()
                    .map(|key| {
                        let label = self
                            .components_for(key)
                            .first()
                            .map(|component| component.ch())
                            .unwrap_or("");
                        (key, label)
                    })
                    .collect()
            })
            .collect()
    }

    pub fn is_composing_key(self, key: char) -> bool {
        !self.components_for(key).is_empty()
    }
}

const fn cons(i: usize) -> Component {
    Component::new(Kind::Consonant, i)
}
const fn med(i: usize) -> Component {
    Component::new(Kind::Medial, i)
}
const fn vow(i: usize) -> Component {
    Component::new(Kind::Vowel, i)
}
const fn tone(i: usize) -> Component {
    Component::new(Kind::Tone, i)
}

// Static tables, so a key can hand back a &'static slice instead of a reference
// to a temporary.
static CONS: [Component; 22] = [
    cons(0), cons(1), cons(2), cons(3), cons(4), cons(5), cons(6), cons(7), cons(8), cons(9),
    cons(10), cons(11), cons(12), cons(13), cons(14), cons(15), cons(16), cons(17), cons(18),
    cons(19), cons(20), cons(21),
];
static MEDS: [Component; 4] = [med(0), med(1), med(2), med(3)];
static VOWS: [Component; 14] = [
    vow(0), vow(1), vow(2), vow(3), vow(4), vow(5), vow(6), vow(7), vow(8), vow(9), vow(10),
    vow(11), vow(12), vow(13),
];
static TONES: [Component; 5] = [tone(0), tone(1), tone(2), tone(3), tone(4)];

fn standard_components(key: char) -> &'static [Component] {
    match key {
        '1' => &CONS[1..1 + 1],
        'q' => &CONS[2..2 + 1],
        'a' => &CONS[3..3 + 1],
        'z' => &CONS[4..4 + 1],
        '2' => &CONS[5..5 + 1],
        'w' => &CONS[6..6 + 1],
        's' => &CONS[7..7 + 1],
        'x' => &CONS[8..8 + 1],
        'e' => &CONS[9..9 + 1],
        'd' => &CONS[10..10 + 1],
        'c' => &CONS[11..11 + 1],
        'r' => &CONS[12..12 + 1],
        'f' => &CONS[13..13 + 1],
        'v' => &CONS[14..14 + 1],
        '5' => &CONS[15..15 + 1],
        't' => &CONS[16..16 + 1],
        'g' => &CONS[17..17 + 1],
        'b' => &CONS[18..18 + 1],
        'y' => &CONS[19..19 + 1],
        'h' => &CONS[20..20 + 1],
        'n' => &CONS[21..21 + 1],
        'u' => &MEDS[1..1 + 1],
        'j' => &MEDS[2..2 + 1],
        'm' => &MEDS[3..3 + 1],
        '8' => &VOWS[1..1 + 1],
        'i' => &VOWS[2..2 + 1],
        'k' => &VOWS[3..3 + 1],
        ',' => &VOWS[4..4 + 1],
        '9' => &VOWS[5..5 + 1],
        'o' => &VOWS[6..6 + 1],
        'l' => &VOWS[7..7 + 1],
        '.' => &VOWS[8..8 + 1],
        '0' => &VOWS[9..9 + 1],
        'p' => &VOWS[10..10 + 1],
        ';' => &VOWS[11..11 + 1],
        '/' => &VOWS[12..12 + 1],
        '-' => &VOWS[13..13 + 1],
        '3' => &TONES[2..2 + 1],
        '4' => &TONES[3..3 + 1],
        '6' => &TONES[1..1 + 1],
        '7' => &TONES[4..4 + 1],
        _ => &[],
    }
}

fn eten_components(key: char) -> &'static [Component] {
    match key {
        'b' => &CONS[1..1 + 1],
        'p' => &CONS[2..2 + 1],
        'm' => &CONS[3..3 + 1],
        'f' => &CONS[4..4 + 1],
        'd' => &CONS[5..5 + 1],
        't' => &CONS[6..6 + 1],
        'n' => &CONS[7..7 + 1],
        'l' => &CONS[8..8 + 1],
        'v' => &CONS[9..9 + 1],
        'k' => &CONS[10..10 + 1],
        'h' => &CONS[11..11 + 1],
        'g' => &CONS[12..12 + 1],
        '7' => &CONS[13..13 + 1],
        'c' => &CONS[14..14 + 1],
        ',' => &CONS[15..15 + 1],
        '.' => &CONS[16..16 + 1],
        '/' => &CONS[17..17 + 1],
        'j' => &CONS[18..18 + 1],
        ';' => &CONS[19..19 + 1],
        '\'' => &CONS[20..20 + 1],
        's' => &CONS[21..21 + 1],
        'e' => &MEDS[1..1 + 1],
        'x' => &MEDS[2..2 + 1],
        'u' => &MEDS[3..3 + 1],
        'a' => &VOWS[1..1 + 1],
        'o' => &VOWS[2..2 + 1],
        'r' => &VOWS[3..3 + 1],
        'w' => &VOWS[4..4 + 1],
        'i' => &VOWS[5..5 + 1],
        'q' => &VOWS[6..6 + 1],
        'z' => &VOWS[7..7 + 1],
        'y' => &VOWS[8..8 + 1],
        '8' => &VOWS[9..9 + 1],
        '9' => &VOWS[10..10 + 1],
        '0' => &VOWS[11..11 + 1],
        '-' => &VOWS[12..12 + 1],
        '=' => &VOWS[13..13 + 1],
        '2' => &TONES[1..1 + 1],
        '3' => &TONES[2..2 + 1],
        '4' => &TONES[3..3 + 1],
        '1' => &TONES[4..4 + 1],
        _ => &[],
    }
}

/// Layouts that are planned but deliberately not implemented: transcribing them
/// without an authoritative, tested source would introduce silent errors.
/// 許氏 in particular is a stateful editor, not a key table — see
/// `research/04-zhuyin-ime-internals.md` §2.2.5.
pub const PLANNED_LAYOUTS: [&str; 5] = ["hsu", "eten26", "ibm", "ginyieh", "mitac"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_layout_spells_the_classic_strings() {
        for (key, expected) in [('s', "ㄋ"), ('u', "ㄧ"), ('3', "ˇ"), ('c', "ㄏ"), ('l', "ㄠ")] {
            assert_eq!(
                Layout::Standard.components_for(key)[0].ch(),
                expected,
                "key {key}"
            );
        }
    }

    #[test]
    fn one_is_a_consonant_not_a_tone() {
        assert_eq!(
            Layout::Standard.components_for('1')[0],
            Component::new(Kind::Consonant, 1)
        );
    }

    #[test]
    fn space_is_not_a_composing_key() {
        assert!(!Layout::Standard.is_composing_key(' '));
        assert!(!Layout::ETen.is_composing_key(' '));
    }

    #[test]
    fn eten_spells_the_same_syllable_a_different_way() {
        // n=ㄋ, e=ㄧ, 3=ˇ
        let comps: Vec<_> = "ne3".chars().map(|k| Layout::ETen.components_for(k)[0]).collect();
        assert_eq!(crate::syllable::compose_syllable(&comps).unwrap(), "ㄋㄧˇ");
    }

    /// The drawn keyboard and the decoding keyboard come from one table, and
    /// this is what says so. Without it, `key_rows` could be "derived" in name
    /// only the first time someone finds it easier to special-case a label.
    #[test]
    fn the_drawn_keyboard_matches_the_decoder() {
        for layout in Layout::all() {
            for row in layout.key_rows() {
                for (key, label) in row {
                    match layout.components_for(key).first() {
                        Some(component) => assert_eq!(
                            component.ch(),
                            label,
                            "{:?}: key {:?} is drawn as {:?} but decodes as {:?}",
                            layout,
                            key,
                            label,
                            component.ch()
                        ),
                        None => assert_eq!(
                            label, "",
                            "{:?}: key {:?} has no component but is drawn as {:?}",
                            layout, key, label
                        ),
                    }
                }
            }
        }
    }

    /// Every composing key must appear somewhere on the drawn keyboard, or the
    /// picture is missing a key the user can actually press.
    #[test]
    fn every_composing_key_is_drawn() {
        const ALL_KEYS: &str = "1234567890-qwertyuiopasdfghjkl;zxcvbnm,./";
        for layout in Layout::all() {
            let drawn: Vec<char> = layout
                .key_rows()
                .iter()
                .flatten()
                .filter(|(_, label)| !label.is_empty())
                .map(|(key, _)| *key)
                .collect();
            for key in ALL_KEYS.chars() {
                if layout.is_composing_key(key) {
                    assert!(
                        drawn.contains(&key),
                        "{:?}: key {:?} composes but is not on the drawn keyboard",
                        layout,
                        key
                    );
                }
            }
        }
    }
}

// The five tables below are generated from the reference implementation's
// BopomofoKeyboardLayout.ts by research/tools/import-mcbopomofo-layouts.mjs
// (`--rust`). Do not edit them by hand: rerun the generator.

fn hsu_components(key: char) -> &'static [Component] {
    match key {
        'w' => &VOWS[7..7 + 1],
        'e' => &HSU_E,
        'r' => &CONS[18..18 + 1],
        't' => &CONS[6..6 + 1],
        'y' => &VOWS[1..1 + 1],
        'u' => &MEDS[3..3 + 1],
        'i' => &VOWS[5..5 + 1],
        'o' => &VOWS[8..8 + 1],
        'p' => &CONS[2..2 + 1],
        'a' => &HSU_A,
        's' => &HSU_S,
        'd' => &HSU_D,
        'f' => &HSU_F,
        'g' => &HSU_G,
        'h' => &HSU_H,
        'j' => &HSU_J,
        'k' => &HSU_K,
        'l' => &HSU_L,
        'z' => &CONS[19..19 + 1],
        'x' => &MEDS[2..2 + 1],
        'c' => &HSU_C,
        'v' => &HSU_V,
        'b' => &CONS[1..1 + 1],
        'n' => &HSU_N,
        'm' => &HSU_M,
        _ => &[],
    }
}

static HSU_E: [Component; 2] = [med(1), vow(4)];
static HSU_A: [Component; 2] = [cons(20), vow(6)];
static HSU_S: [Component; 2] = [cons(21), tone(4)];
static HSU_D: [Component; 2] = [cons(5), tone(1)];
static HSU_F: [Component; 2] = [cons(4), tone(2)];
static HSU_G: [Component; 2] = [cons(9), vow(3)];
static HSU_H: [Component; 2] = [cons(11), vow(2)];
static HSU_J: [Component; 3] = [cons(12), cons(15), tone(3)];
static HSU_K: [Component; 2] = [cons(10), vow(11)];
static HSU_L: [Component; 3] = [cons(8), vow(12), vow(13)];
static HSU_C: [Component; 2] = [cons(14), cons(17)];
static HSU_V: [Component; 2] = [cons(13), cons(16)];
static HSU_N: [Component; 2] = [cons(7), vow(10)];
static HSU_M: [Component; 2] = [cons(3), vow(9)];

fn eten26_components(key: char) -> &'static [Component] {
    match key {
        'q' => &ETEN26_Q,
        'w' => &ETEN26_W,
        'e' => &MEDS[1..1 + 1],
        'r' => &VOWS[3..3 + 1],
        't' => &ETEN26_T,
        'y' => &CONS[16..16 + 1],
        'u' => &MEDS[3..3 + 1],
        'i' => &VOWS[5..5 + 1],
        'o' => &VOWS[2..2 + 1],
        'p' => &ETEN26_P,
        'a' => &VOWS[1..1 + 1],
        's' => &CONS[21..21 + 1],
        'd' => &ETEN26_D,
        'f' => &ETEN26_F,
        'g' => &ETEN26_G,
        'h' => &ETEN26_H,
        'j' => &ETEN26_J,
        'k' => &ETEN26_K,
        'l' => &ETEN26_L,
        'z' => &VOWS[7..7 + 1],
        'x' => &MEDS[2..2 + 1],
        'c' => &ETEN26_C,
        'v' => &ETEN26_V,
        'b' => &CONS[1..1 + 1],
        'n' => &ETEN26_N,
        'm' => &ETEN26_M,
        _ => &[],
    }
}

static ETEN26_Q: [Component; 2] = [cons(19), vow(6)];
static ETEN26_W: [Component; 2] = [cons(20), vow(4)];
static ETEN26_T: [Component; 2] = [cons(6), vow(11)];
static ETEN26_P: [Component; 2] = [cons(2), vow(8)];
static ETEN26_D: [Component; 2] = [cons(5), tone(4)];
static ETEN26_F: [Component; 2] = [cons(4), tone(1)];
static ETEN26_G: [Component; 2] = [cons(15), cons(12)];
static ETEN26_H: [Component; 2] = [cons(11), vow(13)];
static ETEN26_J: [Component; 2] = [cons(18), tone(2)];
static ETEN26_K: [Component; 2] = [cons(10), tone(3)];
static ETEN26_L: [Component; 2] = [cons(8), vow(12)];
static ETEN26_C: [Component; 2] = [cons(17), cons(14)];
static ETEN26_V: [Component; 2] = [cons(9), cons(13)];
static ETEN26_N: [Component; 2] = [cons(7), vow(10)];
static ETEN26_M: [Component; 2] = [cons(3), vow(9)];

fn ibm_components(key: char) -> &'static [Component] {
    match key {
        '1' => &CONS[1..1 + 1],
        '2' => &CONS[2..2 + 1],
        '3' => &CONS[3..3 + 1],
        '4' => &CONS[4..4 + 1],
        '5' => &CONS[5..5 + 1],
        '6' => &CONS[6..6 + 1],
        '7' => &CONS[7..7 + 1],
        '8' => &CONS[8..8 + 1],
        '9' => &CONS[9..9 + 1],
        '0' => &CONS[10..10 + 1],
        'q' => &CONS[12..12 + 1],
        'w' => &CONS[13..13 + 1],
        'e' => &CONS[14..14 + 1],
        'r' => &CONS[15..15 + 1],
        't' => &CONS[16..16 + 1],
        'y' => &CONS[17..17 + 1],
        'u' => &CONS[18..18 + 1],
        'i' => &CONS[19..19 + 1],
        'o' => &CONS[20..20 + 1],
        'p' => &CONS[21..21 + 1],
        'a' => &MEDS[1..1 + 1],
        's' => &MEDS[2..2 + 1],
        'd' => &MEDS[3..3 + 1],
        'f' => &VOWS[1..1 + 1],
        'g' => &VOWS[2..2 + 1],
        'h' => &VOWS[3..3 + 1],
        'j' => &VOWS[4..4 + 1],
        'k' => &VOWS[5..5 + 1],
        'l' => &VOWS[6..6 + 1],
        ';' => &VOWS[7..7 + 1],
        'z' => &VOWS[8..8 + 1],
        'x' => &VOWS[9..9 + 1],
        'c' => &VOWS[10..10 + 1],
        'v' => &VOWS[11..11 + 1],
        'b' => &VOWS[12..12 + 1],
        'n' => &VOWS[13..13 + 1],
        'm' => &TONES[1..1 + 1],
        ',' => &TONES[2..2 + 1],
        '.' => &TONES[3..3 + 1],
        '/' => &TONES[4..4 + 1],
        '-' => &CONS[11..11 + 1],
        _ => &[],
    }
}

fn ginyieh_components(key: char) -> &'static [Component] {
    match key {
        '1' => &TONES[4..4 + 1],
        '2' => &CONS[1..1 + 1],
        '3' => &CONS[5..5 + 1],
        '6' => &CONS[15..15 + 1],
        '8' => &VOWS[1..1 + 1],
        '9' => &VOWS[5..5 + 1],
        '0' => &VOWS[9..9 + 1],
        'q' => &TONES[1..1 + 1],
        'w' => &CONS[2..2 + 1],
        'e' => &CONS[6..6 + 1],
        'r' => &CONS[9..9 + 1],
        't' => &CONS[12..12 + 1],
        'y' => &CONS[16..16 + 1],
        'u' => &CONS[19..19 + 1],
        'i' => &VOWS[2..2 + 1],
        'o' => &VOWS[6..6 + 1],
        'p' => &VOWS[10..10 + 1],
        'a' => &TONES[2..2 + 1],
        's' => &CONS[3..3 + 1],
        'd' => &CONS[7..7 + 1],
        'f' => &CONS[10..10 + 1],
        'g' => &CONS[13..13 + 1],
        'h' => &CONS[17..17 + 1],
        'j' => &CONS[20..20 + 1],
        'k' => &VOWS[3..3 + 1],
        'l' => &VOWS[7..7 + 1],
        ';' => &VOWS[11..11 + 1],
        'z' => &TONES[3..3 + 1],
        'x' => &CONS[4..4 + 1],
        'c' => &CONS[8..8 + 1],
        'v' => &CONS[11..11 + 1],
        'b' => &CONS[14..14 + 1],
        'n' => &CONS[18..18 + 1],
        'm' => &CONS[21..21 + 1],
        ',' => &VOWS[4..4 + 1],
        '.' => &VOWS[8..8 + 1],
        '/' => &VOWS[12..12 + 1],
        '-' => &MEDS[1..1 + 1],
        _ => &[],
    }
}

fn mitac_components(key: char) -> &'static [Component] {
    match key {
        '1' => &TONES[4..4 + 1],
        '2' => &TONES[1..1 + 1],
        '3' => &TONES[2..2 + 1],
        '4' => &TONES[3..3 + 1],
        '5' => &VOWS[5..5 + 1],
        '6' => &VOWS[7..7 + 1],
        '7' => &VOWS[9..9 + 1],
        '8' => &VOWS[10..10 + 1],
        '9' => &VOWS[11..11 + 1],
        '0' => &VOWS[12..12 + 1],
        'q' => &CONS[13..13 + 1],
        'w' => &MEDS[2..2 + 1],
        'e' => &VOWS[3..3 + 1],
        'r' => &CONS[18..18 + 1],
        't' => &CONS[6..6 + 1],
        'y' => &MEDS[1..1 + 1],
        'u' => &VOWS[8..8 + 1],
        'i' => &VOWS[6..6 + 1],
        'o' => &VOWS[2..2 + 1],
        'p' => &CONS[2..2 + 1],
        'a' => &VOWS[1..1 + 1],
        's' => &CONS[21..21 + 1],
        'd' => &CONS[5..5 + 1],
        'f' => &CONS[4..4 + 1],
        'g' => &CONS[9..9 + 1],
        'h' => &CONS[11..11 + 1],
        'j' => &CONS[12..12 + 1],
        'k' => &CONS[10..10 + 1],
        'l' => &CONS[8..8 + 1],
        ';' => &VOWS[6..6 + 1],
        'z' => &CONS[19..19 + 1],
        'x' => &CONS[14..14 + 1],
        'c' => &CONS[20..20 + 1],
        'v' => &MEDS[3..3 + 1],
        'b' => &CONS[1..1 + 1],
        'n' => &CONS[7..7 + 1],
        'm' => &CONS[3..3 + 1],
        ',' => &CONS[15..15 + 1],
        '.' => &CONS[16..16 + 1],
        '/' => &CONS[17..17 + 1],
        '-' => &VOWS[3..3 + 1],
        _ => &[],
    }
}
