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
}

impl Layout {
    pub fn id(self) -> &'static str {
        match self {
            Layout::Standard => "standard",
            Layout::ETen => "eten",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Layout::Standard => "標準 (大千式)",
            Layout::ETen => "倚天式",
        }
    }

    pub fn from_id(id: &str) -> Option<Layout> {
        match id {
            "standard" => Some(Layout::Standard),
            "eten" => Some(Layout::ETen),
            _ => None,
        }
    }

    /// Components a key can produce. An empty slice means the key is not part of
    /// this layout's composing alphabet.
    pub fn components_for(self, key: char) -> &'static [Component] {
        match self {
            Layout::Standard => standard_components(key),
            Layout::ETen => eten_components(key),
        }
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
}
