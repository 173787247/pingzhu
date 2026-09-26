//! Reading grid + Viterbi decoding.
//!
//! Port of `engine/src/grid.ts`; the comments there carry the reasoning. The
//! three things this file must reproduce exactly, because they are where the
//! behaviour actually lives:
//!
//! * **node insertion order** — Viterbi uses strict `>` so ties keep first-come
//! * **promotion** — a word may not lose to a decomposition of its own span
//! * **candidate ordering** — 詞頻 within groups, groups by span

use crate::dictionary::{Dictionary, Entry};
use crate::userdict::UserDictionary;

#[derive(Debug, Clone, PartialEq)]
pub struct Node {
    pub start: usize,
    pub end: usize,
    pub word: String,
    pub reading: String,
    pub score: f64,
    pub syllables: usize,
    /// no dictionary word covered this span; we fell back to the raw bopomofo
    pub fallback: bool,
    /// this word exists only because the user taught it
    pub user_only: bool,
}

impl Node {
    fn entry(&self) -> Entry {
        Entry {
            word: self.word.clone(),
            score: self.score,
            reading: self.reading.clone(),
            syllables: self.syllables,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GridPath {
    pub nodes: Vec<Node>,
    pub words: Vec<String>,
    pub score: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CandidateOrder {
    /// the words covering the same span as the engine's own choice come first
    SameSpanFirst,
    LongestFirst,
    /// plain 詞頻 descending, ungrouped
    Frequency,
}

impl Default for CandidateOrder {
    fn default() -> Self {
        CandidateOrder::SameSpanFirst
    }
}

#[derive(Debug, Clone, Copy)]
pub struct GridOptions {
    pub promote_words_over_decomposition: bool,
    pub promotion_epsilon: f64,
    pub candidate_order: CandidateOrder,
}

impl Default for GridOptions {
    fn default() -> Self {
        Self {
            promote_words_over_decomposition: true,
            promotion_epsilon: 0.001,
            candidate_order: CandidateOrder::default(),
        }
    }
}

/// Penalty applied to a character reached only through the single-char table.
const FALLBACK_PENALTY: f64 = 3.0;

pub struct ReadingGrid {
    syllables: Vec<String>,
    options: GridOptions,
    nodes: Vec<Node>,
    by_end: Vec<Vec<usize>>,
    by_start: Vec<Vec<usize>>,
    path_cache: Option<GridPath>,
}

impl ReadingGrid {
    /// The dictionary and user dictionary are borrowed only while the lattice is
    /// built; everything needed afterwards is copied into `nodes`, so the grid
    /// outlives neither.
    pub fn new(
        syllables: &[String],
        dict: &Dictionary,
        user_dict: Option<&UserDictionary>,
        options: GridOptions,
    ) -> Self {
        let n = syllables.len();
        let mut grid = ReadingGrid {
            syllables: syllables.to_vec(),
            options,
            nodes: Vec::new(),
            by_end: vec![Vec::new(); n + 1],
            by_start: vec![Vec::new(); n + 1],
            path_cache: None,
        };

        let today = user_dict.map(|u| u.today()).unwrap_or(0);
        let max_span = dict.max_word_syllables();

        for start in 0..n {
            let mut len = 1usize;
            while len <= max_span && start + len <= n {
                let reading = syllables[start..start + len].join("-");
                let mut seen: Vec<&str> = Vec::new();
                for entry in dict.lookup(&reading) {
                    // User knowledge is a bonus on top of the model, never a
                    // replacement for it.
                    let bonus = user_dict
                        .map(|u| u.bonus_for_at(&entry.word, &reading, today))
                        .unwrap_or(0.0);
                    grid.push(Node {
                        start,
                        end: start + len,
                        word: entry.word.clone(),
                        reading: reading.clone(),
                        score: entry.score + bonus,
                        syllables: entry.syllables,
                        fallback: false,
                        user_only: false,
                    });
                    seen.push(&entry.word);
                }
                // Words the user taught that the language model has never heard
                // of — names, jargon, abbreviations.
                if let Some(u) = user_dict {
                    for entry in u.entries_for(&reading) {
                        if seen.contains(&entry.word.as_str()) {
                            continue;
                        }
                        let bonus = u.bonus_for_at(&entry.word, &reading, today);
                        grid.push(Node {
                            start,
                            end: start + len,
                            word: entry.word.clone(),
                            reading: reading.clone(),
                            score: u.options().unknown_base_score + bonus,
                            syllables: len,
                            fallback: false,
                            user_only: true,
                        });
                    }
                }
                len += 1;
            }
        }

        // Any syllable the dictionary cannot express at all still needs a node so
        // the path can cross it.
        for i in 0..n {
            if grid.by_start[i].is_empty() {
                grid.push(Node {
                    start: i,
                    end: i + 1,
                    word: syllables[i].clone(),
                    reading: syllables[i].clone(),
                    score: -99.0,
                    syllables: 1,
                    fallback: true,
                    user_only: false,
                });
            }
        }

        if options.promote_words_over_decomposition {
            grid.apply_promotion();
        }
        grid
    }

    fn push(&mut self, node: Node) {
        let idx = self.nodes.len();
        self.by_end[node.end].push(idx);
        self.by_start[node.start].push(idx);
        self.nodes.push(node);
    }

    fn score_of(node: &Node) -> f64 {
        node.score - if node.fallback { FALLBACK_PENALTY } else { 0.0 }
    }

    /// Lift every multi-syllable word above the best decomposition of its own span.
    fn apply_promotion(&mut self) {
        let n = self.syllables.len();
        let eps = self.options.promotion_epsilon;
        let mut best = vec![vec![f64::NEG_INFINITY; n + 1]; n + 1];

        for len in 1..=n {
            for i in 0..=(n - len) {
                let j = i + len;
                let mut decomposed = f64::NEG_INFINITY;
                for k in (i + 1)..j {
                    let left = best[i][k];
                    let right = best[k][j];
                    if left == f64::NEG_INFINITY || right == f64::NEG_INFINITY {
                        continue;
                    }
                    if left + right > decomposed {
                        decomposed = left + right;
                    }
                }
                let node_ids: Vec<usize> =
                    self.by_end[j].iter().copied().filter(|&id| self.nodes[id].start == i).collect();

                if len > 1 && decomposed > f64::NEG_INFINITY {
                    let floor = decomposed + eps;
                    for &id in &node_ids {
                        if self.nodes[id].fallback {
                            continue;
                        }
                        if self.nodes[id].score < floor {
                            self.nodes[id].score = floor;
                        }
                    }
                }

                let mut here = decomposed;
                for &id in &node_ids {
                    let s = Self::score_of(&self.nodes[id]);
                    if s > here {
                        here = s;
                    }
                }
                best[i][j] = here;
            }
        }
    }

    pub fn syllables(&self) -> &[String] {
        &self.syllables
    }

    pub fn nodes(&self) -> &[Node] {
        &self.nodes
    }

    /// Highest scoring path through the whole grid.
    pub fn best_path(&mut self) -> &GridPath {
        if self.path_cache.is_none() {
            self.path_cache = Some(self.compute_best_path());
        }
        self.path_cache.as_ref().unwrap()
    }

    fn compute_best_path(&self) -> GridPath {
        let n = self.syllables.len();
        let mut best = vec![f64::NEG_INFINITY; n + 1];
        let mut from: Vec<Option<usize>> = vec![None; n + 1];
        best[0] = 0.0;
        for end in 1..=n {
            for &id in &self.by_end[end] {
                let node = &self.nodes[id];
                let prev = best[node.start];
                if prev == f64::NEG_INFINITY {
                    continue;
                }
                let score = prev + Self::score_of(node);
                if score > best[end] {
                    best[end] = score;
                    from[end] = Some(id);
                }
            }
        }
        let mut nodes: Vec<Node> = Vec::new();
        let mut end = n;
        while end > 0 {
            let Some(id) = from[end] else { break };
            nodes.push(self.nodes[id].clone());
            end = self.nodes[id].start;
        }
        nodes.reverse();
        GridPath { words: nodes.iter().map(|x| x.word.clone()).collect(), nodes, score: best[n] }
    }

    /// Candidate words for the span that starts at `syllable_index`, best first.
    pub fn candidates_for_span(&mut self, syllable_index: usize, limit: usize) -> Vec<Entry> {
        let n = self.syllables.len();
        if syllable_index >= n {
            return Vec::new();
        }
        let order = self.options.candidate_order;
        let preferred_span = {
            let path = self.best_path();
            path.nodes
                .iter()
                .find(|nd| nd.start == syllable_index)
                .map(|nd| nd.end - nd.start)
                .unwrap_or(1)
        };

        struct Scored {
            entry: Entry,
            span: usize,
            score: f64,
        }
        let mut scored: Vec<Scored> = Vec::new();
        let mut seen: Vec<String> = Vec::new();
        for end in (syllable_index + 1)..=n {
            for &id in &self.by_end[end] {
                let node = &self.nodes[id];
                if node.start != syllable_index || node.fallback {
                    continue;
                }
                let key = format!("{}\t{}", node.word, node.reading);
                if seen.contains(&key) {
                    continue;
                }
                seen.push(key);
                scored.push(Scored { entry: node.entry(), span: node.end - node.start, score: node.score });
            }
        }
        let rank = |span: usize| -> i32 {
            match order {
                CandidateOrder::LongestFirst => -(span as i32),
                CandidateOrder::SameSpanFirst => {
                    if span == preferred_span {
                        0
                    } else {
                        1
                    }
                }
                CandidateOrder::Frequency => 0,
            }
        };
        scored.sort_by(|a, b| {
            rank(a.span)
                .cmp(&rank(b.span))
                .then_with(|| b.score.total_cmp(&a.score))
        });
        scored.into_iter().take(limit).map(|s| s.entry).collect()
    }

    /// Total candidate count at a position, for paging UIs.
    pub fn candidate_count_for_span(&mut self, syllable_index: usize) -> usize {
        self.candidates_for_span(syllable_index, usize::MAX).len()
    }
}
