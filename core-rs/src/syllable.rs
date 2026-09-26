//! Bopomofo syllable model.
//!
//! A syllable is built from up to four components, in this order:
//! consonant (聲母) · medial (介音) · vowel (韻母) · tone (聲調).
//!
//! This is a direct port of `engine/src/syllable.ts`; the TypeScript version is
//! the specification and `tests/differential.rs` holds both to identical output.

pub const CONSONANTS: [&str; 22] = [
    "", "ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ", "ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ",
    "ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ",
];

pub const MEDIALS: [&str; 4] = ["", "ㄧ", "ㄨ", "ㄩ"];

pub const VOWELS: [&str; 14] = [
    "", "ㄚ", "ㄛ", "ㄜ", "ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ",
];

/// index 0 = 一聲 (unmarked), then ˊ ˇ ˋ ˙
pub const TONES: [&str; 5] = ["", "ˊ", "ˇ", "ˋ", "˙"];

/// ˙ (輕聲) — the one tone written *before* its syllable.
pub const NEUTRAL_TONE: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Kind {
    Consonant,
    Medial,
    Vowel,
    Tone,
}

impl Kind {
    /// Canonical typing order: 聲母 then 介音 then 韻母 then 聲調.
    fn rank(self) -> u8 {
        match self {
            Kind::Consonant => 0,
            Kind::Medial => 1,
            Kind::Vowel => 2,
            Kind::Tone => 3,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Component {
    pub kind: Kind,
    /// index into CONSONANTS / MEDIALS / VOWELS / TONES
    pub index: usize,
}

impl Component {
    pub const fn new(kind: Kind, index: usize) -> Self {
        Self { kind, index }
    }

    pub fn ch(self) -> &'static str {
        match self.kind {
            Kind::Consonant => CONSONANTS[self.index],
            Kind::Medial => MEDIALS[self.index],
            Kind::Vowel => VOWELS[self.index],
            Kind::Tone => TONES[self.index],
        }
    }
}

/// Merge a chunk of components into one syllable, or None when the chunk holds
/// two components of the same class.
pub fn compose_syllable(chunk: &[Component]) -> Option<String> {
    let (mut consonant, mut medial, mut vowel, mut tone) = (0usize, 0usize, 0usize, 0usize);
    let mut seen_consonant = false;
    let mut seen_medial = false;
    let mut seen_vowel = false;
    let mut seen_tone = false;
    for c in chunk {
        match c.kind {
            Kind::Consonant => {
                if seen_consonant {
                    return None;
                }
                seen_consonant = true;
                consonant = c.index;
            }
            Kind::Medial => {
                if seen_medial {
                    return None;
                }
                seen_medial = true;
                medial = c.index;
            }
            Kind::Vowel => {
                if seen_vowel {
                    return None;
                }
                seen_vowel = true;
                vowel = c.index;
            }
            Kind::Tone => {
                if seen_tone {
                    return None;
                }
                seen_tone = true;
                tone = c.index;
            }
        }
    }
    let s = format!(
        "{}{}{}{}",
        CONSONANTS[consonant], MEDIALS[medial], VOWELS[vowel], TONES[tone]
    );
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// Did the user press these keys in an order a syllable can be spelled in?
///
/// Without this the grid treats a syllable as an unordered bag of components,
/// which produced real misreadings — see `engine/src/syllable.ts` for the
/// worked examples (ㄨㄣ-ㄔㄨㄣˊ read as ㄔㄨㄣ-ㄨㄣˊ, and a tone key migrating off
/// its syllable). Requiring strictly increasing class rank inside a chunk
/// forbids both. A leading ˙ is the single exception.
pub fn is_canonical_component_order(chunk: &[Component]) -> bool {
    if chunk.is_empty() {
        return false;
    }
    let rest: &[Component] = if chunk[0].kind == Kind::Tone && chunk[0].index == NEUTRAL_TONE {
        if chunk.len() == 1 {
            return false; // a bare ˙ is not a syllable
        }
        &chunk[1..]
    } else {
        chunk
    };
    for i in 1..rest.len() {
        if rest[i].kind.rank() <= rest[i - 1].kind.rank() {
            return false;
        }
    }
    true
}

/// Indices of ㄓㄔㄕㄖㄗㄘㄙ — the only consonants that stand alone as syllables.
fn is_syllabic_consonant(index: usize) -> bool {
    (15..=21).contains(&index)
}

/// Is this run of components a syllable a speaker of Mandarin would recognise as
/// finished? Keeps the composer from spitting out a character mid-keystroke.
pub fn is_well_formed_components(chunk: &[Component]) -> bool {
    let (mut consonant, mut medial, mut vowel) = (0usize, 0usize, 0usize);
    for c in chunk {
        match c.kind {
            Kind::Consonant => consonant = c.index,
            Kind::Medial => medial = c.index,
            Kind::Vowel => vowel = c.index,
            Kind::Tone => {}
        }
    }
    if vowel != 0 {
        return true;
    }
    if medial != 0 {
        return true;
    }
    is_syllabic_consonant(consonant)
}

/// Split "ㄋㄧˇ-ㄏㄠˇ" into syllables.
pub fn split_reading(reading: &str) -> Vec<&str> {
    reading.split('-').filter(|s| !s.is_empty()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(kind: Kind, index: usize) -> Component {
        Component::new(kind, index)
    }

    #[test]
    fn composes_a_syllable() {
        let chunk = [c(Kind::Consonant, 7), c(Kind::Medial, 1), c(Kind::Tone, 2)];
        assert_eq!(compose_syllable(&chunk).unwrap(), "ㄋㄧˇ");
    }

    #[test]
    fn refuses_two_of_the_same_class() {
        let chunk = [c(Kind::Consonant, 7), c(Kind::Consonant, 8)];
        assert!(compose_syllable(&chunk).is_none());
    }

    #[test]
    fn refuses_out_of_order_keystrokes() {
        // [ㄨ ㄣ ㄔ] must not compose: that is how 溫純 used to become ㄔㄨㄣ-ㄨㄣˊ.
        let bad = [c(Kind::Medial, 2), c(Kind::Vowel, 10), c(Kind::Consonant, 16)];
        assert!(!is_canonical_component_order(&bad));
        let good = [c(Kind::Consonant, 16), c(Kind::Medial, 2), c(Kind::Vowel, 10)];
        assert!(is_canonical_component_order(&good));
    }

    #[test]
    fn refuses_a_tone_that_would_migrate() {
        // [ˋ ㄉ ㄢ] must not compose: that is how 萬丹 became ㄨㄢ-ㄉㄢˋ.
        let bad = [c(Kind::Tone, 3), c(Kind::Consonant, 5), c(Kind::Vowel, 9)];
        assert!(!is_canonical_component_order(&bad));
    }

    #[test]
    fn allows_a_leading_neutral_tone() {
        let de = [c(Kind::Tone, 4), c(Kind::Consonant, 5), c(Kind::Vowel, 3)];
        assert!(is_canonical_component_order(&de));
        assert_eq!(compose_syllable(&de).unwrap(), "ㄉㄜ˙");
        assert!(!is_canonical_component_order(&[c(Kind::Tone, 4)]));
    }

    #[test]
    fn well_formedness_matches_the_reference() {
        // ㄔ alone is a syllable (吃); ㄏ alone is not (it is a symbol).
        assert!(is_well_formed_components(&[c(Kind::Consonant, 16)]));
        assert!(!is_well_formed_components(&[c(Kind::Consonant, 11)]));
        assert!(!is_well_formed_components(&[c(Kind::Tone, 2)]));
        assert!(is_well_formed_components(&[c(Kind::Medial, 1)]));
        assert!(is_well_formed_components(&[c(Kind::Vowel, 1)]));
    }
}
