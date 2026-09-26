//! The input engine: keystrokes in, Chinese out.
//!
//! Port of `engine/src/engine.ts`. The pipeline per keystroke (the whole buffer is
//! re-decoded, which is cheap because a composing buffer is short):
//!
//! ```text
//! keys -> component options -> syllable segmentations -> reading grid Viterbi
//!      -> best sentence + candidate page
//! ```
//!
//! Segmentation is genuinely ambiguous — `ji394su3` legally reads as 我愛你 or as
//! 我奈以 — so segmentation and decoding are scored together rather than decided
//! in two independent passes.

use std::collections::HashSet;

use crate::converter::{Converter, OutputScript};
use crate::dictionary::{Dictionary, Entry};
use crate::grid::{CandidateOrder, GridOptions, GridPath, ReadingGrid};
use crate::keyboard::Layout;
use crate::syllable::{
    compose_syllable, is_canonical_component_order, is_well_formed_components, Component,
};
use crate::userdict::UserDictionary;

/// Ten, because that is how many a keyboard can address with 1234567890.
pub const CANDIDATE_PAGE_SIZE: usize = 10;

/// Upper bound on candidates kept per position; the data caps a reading at 100.
pub const CANDIDATE_CAP: usize = 200;

#[derive(Debug, Clone, Default)]
pub struct CandidatePage {
    pub entries: Vec<Entry>,
    pub cursor: usize,
    pub offset: usize,
    pub page_index: usize,
    pub page_count: usize,
    pub total: usize,
    pub has_more: bool,
    pub has_previous: bool,
}

#[derive(Debug, Clone, PartialEq)]
struct Segmentation {
    syllables: Vec<String>,
    consumed_keys: usize,
}

#[derive(Debug, Clone)]
pub struct EngineOptions {
    pub layout: Layout,
    /// cap on segmentations explored per keystroke
    pub max_segmentations: usize,
    /// see ReadingGrid promotion — measured, not assumed
    pub promote_words_over_decomposition: bool,
    pub promotion_epsilon: f64,
    pub candidate_order: CandidateOrder,
    pub learn_from_commit: bool,
    /// Traditional -> Simplified table. Injected rather than loaded here so the
    /// engine keeps knowing nothing about the filesystem.
    pub converter: Converter,
    /// Which script leaves the engine. Input is always Traditional.
    pub output_script: OutputScript,
}

impl Default for EngineOptions {
    fn default() -> Self {
        Self {
            layout: Layout::Standard,
            max_segmentations: 4000,
            promote_words_over_decomposition: true,
            promotion_epsilon: 0.001,
            candidate_order: CandidateOrder::default(),
            learn_from_commit: false,
            converter: Converter::identity(),
            output_script: OutputScript::Traditional,
        }
    }
}

pub struct InputEngine {
    dict: Dictionary,
    inventory: HashSet<String>,
    options: EngineOptions,
    user_dict: Option<UserDictionary>,

    keys: Vec<char>,
    syllables: Vec<String>,
    pending_keys: Vec<char>,
    path: Option<GridPath>,
    all_candidates: Vec<Entry>,
    cursor_index: usize,
    candidate_offset: usize,
    candidates_open: bool,
    segmentation: Option<Segmentation>,
    converter: Converter,
    output_script: OutputScript,
}

impl InputEngine {
    pub fn new(dict: Dictionary, inventory: HashSet<String>, mut options: EngineOptions) -> Self {
        // Taken out of the options before they are moved into the struct: the
        // engine keeps its own copy so set_converter() can replace it later.
        let converter = std::mem::take(&mut options.converter);
        let output_script = options.output_script;
        let mut engine = InputEngine {
            dict,
            inventory,
            options,
            user_dict: None,
            keys: Vec::new(),
            syllables: Vec::new(),
            pending_keys: Vec::new(),
            path: None,
            all_candidates: Vec::new(),
            cursor_index: 0,
            candidate_offset: 0,
            candidates_open: false,
            segmentation: None,
            converter,
            output_script,
        };
        engine.decode();
        engine
    }

    pub fn with_user_dictionary(mut self, user_dict: UserDictionary) -> Self {
        self.set_user_dictionary(user_dict);
        self
    }

    /// Attach learned words and re-decode, so a shell can load the user's
    /// dictionary into an engine that is already running.
    pub fn set_user_dictionary(&mut self, user_dict: UserDictionary) {
        self.user_dict = Some(user_dict);
        self.decode();
    }

    pub fn user_dictionary(&self) -> Option<&UserDictionary> {
        self.user_dict.as_ref()
    }

    pub fn user_dictionary_mut(&mut self) -> Option<&mut UserDictionary> {
        self.user_dict.as_mut()
    }

    fn grid_options(&self) -> GridOptions {
        GridOptions {
            promote_words_over_decomposition: self.options.promote_words_over_decomposition,
            promotion_epsilon: self.options.promotion_epsilon,
            candidate_order: self.options.candidate_order,
        }
    }

    // ---------------------------------------------------------------- input

    /// Feed one printable key. Returns false if the layout does not use it.
    pub fn press(&mut self, key: char) -> bool {
        let k = key.to_ascii_lowercase();
        if !self.options.layout.is_composing_key(k) {
            return false;
        }
        self.candidates_open = false; // typing resumes composing
        self.keys.push(k);
        self.decode();
        true
    }

    pub fn press_str(&mut self, keys: &str) {
        for ch in keys.chars() {
            self.press(ch);
        }
    }

    pub fn backspace(&mut self) -> bool {
        if self.keys.is_empty() {
            return false;
        }
        if self.candidates_open {
            self.close_candidate_window();
            return true;
        }
        self.keys.pop();
        self.decode();
        true
    }

    pub fn reset(&mut self) {
        self.keys.clear();
        self.decode();
    }

    // --------------------------------------------------------------- output

    /// What the user typed, as bopomofo, with unfinished keys in [brackets].
    pub fn composing(&self) -> String {
        let done = self.syllables.join(" ");
        let pending = if self.pending_keys.is_empty() {
            String::new()
        } else {
            format!("[{}]", self.pending_keys.iter().collect::<String>())
        };
        if done.is_empty() {
            pending
        } else if pending.is_empty() {
            done
        } else {
            format!("{done} {pending}")
        }
    }

    pub fn raw_keys(&self) -> String {
        self.keys.iter().collect()
    }

    pub fn best_sentence(&self) -> String {
        let text = self.path.as_ref().map(|p| p.words.join("")).unwrap_or_default();
        self.out(&text)
    }

    /// Which script the engine emits. The input side is unaffected either way,
    /// because readings and the language model are Traditional no matter what
    /// the user wants to read.
    pub fn set_output_script(&mut self, script: OutputScript) {
        self.output_script = script;
    }

    pub fn output_script(&self) -> OutputScript {
        self.output_script
    }

    pub fn set_converter(&mut self, converter: Converter) {
        self.converter = converter;
    }

    /// The single place output crosses from Traditional to the user's script.
    fn out(&self, text: &str) -> String {
        self.converter.apply(text, self.output_script)
    }

    pub fn best_score(&self) -> f64 {
        self.path.as_ref().map(|p| p.score).unwrap_or(0.0)
    }

    /// True when some syllable had no dictionary word at all and was passed
    /// through as raw bopomofo. When false the output is *provably* read exactly
    /// as typed — that is what makes it a sound correctness signal.
    pub fn used_fallback(&self) -> bool {
        self.path.as_ref().map(|p| p.nodes.iter().any(|n| n.fallback)).unwrap_or(false)
    }

    pub fn chosen_path(&self) -> Option<&GridPath> {
        self.path.as_ref()
    }

    pub fn syllable_count(&self) -> usize {
        self.syllables.len()
    }

    pub fn syllables(&self) -> &[String] {
        &self.syllables
    }

    pub fn is_composing(&self) -> bool {
        !self.keys.is_empty()
    }

    pub fn candidates(&self) -> &[Entry] {
        &self.all_candidates
    }

    pub fn candidate_cursor(&self) -> usize {
        self.cursor_index
    }

    /// The ten candidates the user is looking at right now.
    pub fn candidate_page(&self) -> CandidatePage {
        let total = self.all_candidates.len();
        let page_count = ((total + CANDIDATE_PAGE_SIZE - 1) / CANDIDATE_PAGE_SIZE).max(1);
        let page_index = self.candidate_offset / CANDIDATE_PAGE_SIZE;
        let end = (self.candidate_offset + CANDIDATE_PAGE_SIZE).min(total);
        CandidatePage {
            entries: self.all_candidates[self.candidate_offset.min(total)..end]
                .iter()
                .map(|entry| {
                    let mut converted = entry.clone();
                    converted.word = self.out(&entry.word);
                    converted
                })
                .collect(),
            cursor: self.cursor_index,
            offset: self.candidate_offset,
            page_index,
            page_count,
            total,
            has_more: self.candidate_offset + CANDIDATE_PAGE_SIZE < total,
            has_previous: self.candidate_offset > 0,
        }
    }

    /// Is the candidate window open for selection?
    ///
    /// Not a UI detail — it decides what the number keys mean. On a 大千 keyboard
    /// `1234567890` *are* bopomofo keys (1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ), so if a
    /// digit selected while composing, `su3cl3` would be untypeable.
    pub fn candidate_window_open(&self) -> bool {
        self.candidates_open
    }

    /// ↓ — open the list without changing the page.
    pub fn open_candidate_window(&mut self) -> bool {
        if self.all_candidates.is_empty() {
            return false;
        }
        self.candidates_open = true;
        true
    }

    /// ↑ or Esc — back to composing.
    pub fn close_candidate_window(&mut self) {
        self.candidates_open = false;
        self.candidate_offset = 0;
    }

    /// Space. Opens the window if it is closed; otherwise moves on ten.
    pub fn next_candidate_page(&mut self) -> bool {
        if self.all_candidates.is_empty() {
            return false;
        }
        if !self.candidates_open {
            self.candidates_open = true;
            return true;
        }
        if self.candidate_offset + CANDIDATE_PAGE_SIZE >= self.all_candidates.len() {
            return false;
        }
        self.candidate_offset += CANDIDATE_PAGE_SIZE;
        true
    }

    pub fn prev_candidate_page(&mut self) -> bool {
        if !self.candidates_open || self.candidate_offset == 0 {
            return false;
        }
        self.candidate_offset = self.candidate_offset.saturating_sub(CANDIDATE_PAGE_SIZE);
        true
    }

    /// Move the candidate window along the composing buffer, the way arrows do.
    /// Returns true when the state changed — including merely opening the window.
    pub fn move_candidate_cursor(&mut self, delta: isize) -> bool {
        if self.all_candidates.is_empty() {
            return false;
        }
        let was_open = self.candidates_open;
        self.candidates_open = true;
        let max = self.syllables.len().saturating_sub(1);
        let next = (self.cursor_index as isize + delta).clamp(0, max as isize) as usize;
        if next == self.cursor_index {
            return !was_open; // opened, but nowhere to move
        }
        self.cursor_index = next;
        self.refresh_candidates();
        self.candidates_open = true;
        true
    }

    /// Pick candidate `one_based` (1..=10) from the visible page.
    pub fn select_candidate(&mut self, one_based: usize) -> String {
        if !self.candidates_open {
            return String::new(); // digits are composing keys until the list is open
        }
        if one_based < 1 || one_based > CANDIDATE_PAGE_SIZE {
            return String::new();
        }
        self.choose_at(self.cursor_index, self.candidate_offset + one_based - 1)
    }

    /// Accept the auto-selected sentence and clear the buffer.
    pub fn commit(&mut self) -> String {
        let out = self.best_sentence();
        if self.options.learn_from_commit {
            let learned: Vec<(String, String)> = self
                .path
                .as_ref()
                .map(|p| {
                    p.nodes
                        .iter()
                        .filter(|n| !n.fallback)
                        .map(|n| (n.word.clone(), n.reading.clone()))
                        .collect()
                })
                .unwrap_or_default();
            if let Some(ud) = self.user_dict.as_mut() {
                for (word, reading) in learned {
                    ud.record(&word, &reading);
                }
            }
        }
        self.reset();
        out
    }

    pub fn choose(&mut self, index: usize) -> String {
        let last = self.syllables.len().saturating_sub(1);
        self.choose_at(last, index)
    }

    /// Candidate words attached to the span that starts at `syllable_index`.
    pub fn candidates_at(&mut self, syllable_index: usize, limit: usize) -> Vec<Entry> {
        if syllable_index >= self.syllables.len() {
            return Vec::new();
        }
        let mut grid = ReadingGrid::new(
            &self.syllables,
            &self.dict,
            self.user_dict.as_ref(),
            self.grid_options(),
        );
        grid.candidates_for_span(syllable_index, limit)
            .into_iter()
            .map(|entry| {
                let mut converted = entry;
                converted.word = self.out(&converted.word);
                converted
            })
            .collect()
    }

    /// Pick candidate `index` for the span starting at `syllable_index`, decode
    /// whatever surrounds it, and commit. The only place learning happens: a
    /// deliberate selection is evidence of intent, an auto-selected homophone is
    /// not.
    pub fn choose_at(&mut self, syllable_index: usize, index: usize) -> String {
        if self.path.is_none() || syllable_index >= self.syllables.len() {
            return String::new();
        }
        let entry = {
            let mut grid = ReadingGrid::new(
                &self.syllables,
                &self.dict,
                self.user_dict.as_ref(),
                self.grid_options(),
            );
            grid.candidates_for_span(syllable_index, CANDIDATE_CAP)
        };
        let Some(entry) = entry.get(index).cloned() else { return String::new() };

        let start = syllable_index;
        let end = (start + entry.syllables).min(self.syllables.len());
        let head = if start == 0 {
            String::new()
        } else {
            let before = self.syllables[..start].to_vec();
            let mut grid =
                ReadingGrid::new(&before, &self.dict, self.user_dict.as_ref(), self.grid_options());
            grid.best_path().words.join("")
        };
        let tail = if end >= self.syllables.len() {
            String::new()
        } else {
            let after = self.syllables[end..].to_vec();
            let mut grid =
                ReadingGrid::new(&after, &self.dict, self.user_dict.as_ref(), self.grid_options());
            grid.best_path().words.join("")
        };

        // The user dictionary keeps the Traditional word even when the user
        // reads Simplified: the key is the Traditional word, and storing the
        // converted form would teach a word the model can never match against.
        if let Some(ud) = self.user_dict.as_mut() {
            ud.record(&entry.word, &entry.reading);
        }
        self.reset();
        self.out(&format!("{head}{}{tail}", entry.word))
    }

    // ------------------------------------------------------------- decoding

    fn refresh_candidates(&mut self) {
        self.candidate_offset = 0;
        if self.path.is_none() || self.syllables.is_empty() {
            self.all_candidates = Vec::new();
            return;
        }
        let cursor = self.cursor_index;
        let mut grid = ReadingGrid::new(
            &self.syllables,
            &self.dict,
            self.user_dict.as_ref(),
            self.grid_options(),
        );
        self.all_candidates = grid.candidates_for_span(cursor, CANDIDATE_CAP);
    }

    fn decode(&mut self) {
        self.syllables = Vec::new();
        self.pending_keys = Vec::new();
        self.path = None;
        self.all_candidates = Vec::new();
        self.cursor_index = 0;
        self.candidate_offset = 0;
        self.candidates_open = false;
        self.segmentation = None;
        if self.keys.is_empty() {
            return;
        }

        let segs = self.enumerate_segmentations();
        if segs.is_empty() {
            self.pending_keys = self.keys.clone();
            return;
        }

        // Prefer segmentations that consume the whole buffer. If none does — the
        // user is mid-syllable — fall back to those that consume the most keys,
        // so "su3c" still shows 你 while ㄏ sits in the pending slot.
        let complete: Vec<&Segmentation> = segs
            .iter()
            .filter(|s| s.consumed_keys == self.keys.len() && !s.syllables.is_empty())
            .collect();
        let pool: Vec<&Segmentation> = if !complete.is_empty() {
            complete
        } else {
            let max_consumed = segs.iter().map(|s| s.consumed_keys).max().unwrap_or(0);
            segs.iter()
                .filter(|s| s.consumed_keys == max_consumed && !s.syllables.is_empty())
                .collect()
        };
        if pool.is_empty() {
            self.pending_keys = self.keys.clone();
            return;
        }

        let mut best: Option<(Segmentation, GridPath)> = None;
        for seg in pool {
            let mut grid = ReadingGrid::new(
                &seg.syllables,
                &self.dict,
                self.user_dict.as_ref(),
                self.grid_options(),
            );
            let path = grid.best_path().clone();
            if best.as_ref().map(|(_, p)| path.score > p.score).unwrap_or(true) {
                best = Some((seg.clone(), path));
            }
        }
        let (seg, path) = best.unwrap();
        self.syllables = seg.syllables.clone();
        self.pending_keys = self.keys[seg.consumed_keys..].to_vec();
        self.cursor_index = path.nodes.last().map(|n| n.start).unwrap_or(0);
        self.segmentation = Some(seg);
        self.path = Some(path);
        self.refresh_candidates();
    }

    /// All ways to cut the keystroke buffer into legal syllables.
    fn enumerate_segmentations(&self) -> Vec<Segmentation> {
        let mut out: Vec<Segmentation> = Vec::new();
        let mut syllables: Vec<String> = Vec::new();
        self.walk(0, &mut syllables, &mut out);
        out
    }

    fn walk(&self, pos: usize, syllables: &mut Vec<String>, out: &mut Vec<Segmentation>) {
        if out.len() >= self.options.max_segmentations {
            return;
        }
        if pos == self.keys.len() {
            out.push(Segmentation { syllables: syllables.clone(), consumed_keys: pos });
            return;
        }
        let mut advanced = false;
        for len in 1..=4usize {
            if pos + len > self.keys.len() {
                break;
            }
            for chunk in self.chunk_options(pos, len) {
                let Some(syllable) = compose_syllable(&chunk) else { continue };
                if !self.inventory.contains(&syllable) {
                    continue;
                }
                if !is_well_formed_components(&chunk) {
                    continue; // still being typed
                }
                if !is_canonical_component_order(&chunk) {
                    continue; // keys out of order
                }
                advanced = true;
                syllables.push(syllable);
                self.walk(pos + len, syllables, out);
                syllables.pop();
            }
        }
        if !advanced && pos > 0 {
            out.push(Segmentation { syllables: syllables.clone(), consumed_keys: pos });
        }
    }

    /// Every component combination a run of `len` keys can stand for.
    fn chunk_options(&self, pos: usize, len: usize) -> Vec<Vec<Component>> {
        let mut combos: Vec<Vec<Component>> = vec![Vec::new()];
        for i in pos..(pos + len) {
            let key = self.keys[i];
            let options = self.options.layout.components_for(key);
            if options.is_empty() {
                return Vec::new();
            }
            let mut next: Vec<Vec<Component>> = Vec::new();
            for combo in &combos {
                for option in options {
                    let mut c = combo.clone();
                    c.push(*option);
                    next.push(c);
                }
            }
            combos = next;
        }
        combos.retain(|c| compose_syllable(c).is_some());
        combos
    }

    /// The segmentation chosen for the current buffer (exposed for tests/debug).
    pub fn current_segmentation_syllables(&self) -> Option<&[String]> {
        self.segmentation.as_ref().map(|s| s.syllables.as_slice())
    }
}
