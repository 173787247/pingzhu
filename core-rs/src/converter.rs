//! Traditional -> Simplified output conversion.
//!
//! Port of `engine/src/converter.ts`, which is the specification. The engine
//! works in Traditional throughout — readings, language model and user
//! dictionary are all keyed on Traditional words — so conversion is an *output*
//! transform applied at the boundary. That keeps two things true:
//!
//!   - a user who switches back to Traditional gets their learned words back,
//!     because nothing was ever rewritten
//!   - only the conversion table has to be right, instead of a second converted
//!     copy of a 170k-entry model that could drift from it
//!
//! Matching is longest-first over the file order, so phrase entries beat single
//! characters exactly as OpenCC intends.

use std::collections::HashMap;

/// Which script the engine emits. Input is Traditional either way.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputScript {
    Traditional,
    Simplified,
}

impl OutputScript {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "traditional" => Some(OutputScript::Traditional),
            "simplified" => Some(OutputScript::Simplified),
            _ => None,
        }
    }

    pub fn id(self) -> &'static str {
        match self {
            OutputScript::Traditional => "traditional",
            OutputScript::Simplified => "simplified",
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct Converter {
    /// Keys of two or more characters (phrases and multi-character rules).
    phrases: HashMap<String, String>,
    /// Single-character rules, the overwhelming majority of the table.
    characters: HashMap<String, String>,
    max_phrase_length: usize,
}

impl Converter {
    /// An empty converter passes text through unchanged.
    pub fn identity() -> Self {
        Self::default()
    }

    pub fn from_text(text: &str) -> Self {
        let mut phrases = HashMap::new();
        let mut characters = HashMap::new();
        let mut max_phrase_length = 0usize;

        for line in text.lines() {
            if line.is_empty() {
                continue;
            }
            let Some(tab) = line.find('\t') else { continue };
            let key = &line[..tab];
            let value = &line[tab + 1..];
            if key.is_empty() || value.is_empty() {
                continue;
            }
            // Count characters, not bytes or UTF-16 units: a rare CJK ideograph
            // outside the BMP is one character, and mixing units would slice a
            // code point in half.
            let length = key.chars().count();
            // A single-character identity entry is a no-op and is dropped. A
            // *phrase* identity entry is the opposite: `乾坤 -> 乾坤` exists
            // precisely to stop the character rule `乾 -> 干` from applying, and
            // 124 of OpenCC's phrase entries are exactly that. Dropping them
            // silently corrupts the output in the cases the table was built to
            // protect.
            if key == value && length == 1 {
                continue;
            }
            if length > 1 {
                if length > max_phrase_length {
                    max_phrase_length = length;
                }
                phrases.insert(key.to_string(), value.to_string());
            } else {
                characters.insert(key.to_string(), value.to_string());
            }
        }

        Converter { phrases, characters, max_phrase_length }
    }

    pub fn is_empty(&self) -> bool {
        self.phrases.is_empty() && self.characters.is_empty()
    }

    pub fn len(&self) -> usize {
        self.phrases.len() + self.characters.len()
    }

    pub fn to_simplified(&self, text: &str) -> String {
        if self.is_empty() || text.is_empty() {
            return text.to_string();
        }
        let characters: Vec<char> = text.chars().collect();
        let mut out = String::with_capacity(text.len());
        let mut i = 0usize;

        while i < characters.len() {
            // Phrases first. The loop only runs when the table has phrases, so
            // the common case of pure character substitution costs one lookup.
            if self.max_phrase_length > 1 {
                let limit = self.max_phrase_length.min(characters.len() - i);
                let mut matched = false;
                let mut length = limit;
                while length >= 2 {
                    let candidate: String = characters[i..i + length].iter().collect();
                    if let Some(replacement) = self.phrases.get(&candidate) {
                        out.push_str(replacement);
                        i += length;
                        matched = true;
                        break;
                    }
                    length -= 1;
                }
                if matched {
                    continue;
                }
            }
            let current = characters[i];
            match self.characters.get(&current.to_string()) {
                Some(replacement) => out.push_str(replacement),
                None => out.push(current),
            }
            i += 1;
        }
        out
    }

    /// Convenience for the common "convert unless Traditional" call site.
    pub fn apply(&self, text: &str, script: OutputScript) -> String {
        match script {
            OutputScript::Simplified => self.to_simplified(text),
            OutputScript::Traditional => text.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Converter {
        // A phrase, a character rule, and an identity entry that must be ignored.
        Converter::from_text("乾坤\t乾坤\n乾\t干\n個\t个\n同\t同\n旋轉乾坤\t旋转乾坤\n")
    }

    #[test]
    fn converts_single_characters() {
        let c = sample();
        assert_eq!(c.to_simplified("個個"), "个个");
    }

    #[test]
    fn phrases_win_over_characters() {
        // 乾坤 must not become 干坤, which is what the character rule alone gives.
        let c = sample();
        assert_eq!(c.to_simplified("旋轉乾坤"), "旋转乾坤");
        assert_eq!(c.to_simplified("乾坤"), "乾坤");
        assert_eq!(c.to_simplified("乾杯"), "干杯");
    }

    #[test]
    fn single_character_identity_is_dropped_but_phrase_identity_is_kept() {
        let c = sample();
        // 乾, 個, 旋轉乾坤, and the identity phrase 乾坤 — but not the single-char
        // identity 同, which carries no information.
        assert_eq!(c.len(), 4);
        assert_eq!(c.to_simplified("同"), "同");
    }

    #[test]
    fn traditional_is_untouched() {
        let c = sample();
        assert_eq!(c.apply("個乾", OutputScript::Traditional), "個乾");
        assert_eq!(c.apply("個乾", OutputScript::Simplified), "个干");
    }

    #[test]
    fn empty_converter_passes_through() {
        let c = Converter::identity();
        assert_eq!(c.to_simplified("繁體字"), "繁體字");
    }
}
