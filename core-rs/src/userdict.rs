//! User dictionary — the part of an IME that makes it *yours*.
//!
//! Direct port of `engine/src/userdict.ts`; read that file for the reasoning
//! behind the numbers. The short version: user knowledge is a **log10 bonus**
//! added on top of the language model score, it never decays to nothing (a word
//! you deliberately chose should keep winning for that reading), and a leading
//! ˙-style "newly learned" window stops a one-off correction from quietly falling
//! behind a week later.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub const EPOCH_DAY_MS: u64 = 86_400_000;

#[derive(Debug, Clone, Copy)]
pub struct UserDictionaryOptions {
    /// bonus for a word taught for the first time
    pub bonus_new: f64,
    /// bonus for a word used within recent_days
    pub bonus_recent: f64,
    /// bonus for a word used within mid_days
    pub bonus_mid: f64,
    /// bonus for anything older
    pub bonus_old: f64,
    pub recent_days: i64,
    pub mid_days: i64,
    /// added per extra use beyond the first, up to reinforcement_cap
    pub reinforcement_per_use: f64,
    pub reinforcement_cap: f64,
    /// hard ceiling on the total bonus
    pub bonus_cap: f64,
    /// base score given to a user word the language model has never seen
    pub unknown_base_score: f64,
}

impl Default for UserDictionaryOptions {
    fn default() -> Self {
        Self {
            bonus_new: 4.0,
            bonus_recent: 3.0,
            bonus_mid: 2.0,
            bonus_old: 1.5,
            recent_days: 7,
            mid_days: 30,
            reinforcement_per_use: 0.25,
            reinforcement_cap: 2.0,
            bonus_cap: 6.0,
            unknown_base_score: -6.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct UserEntry {
    pub word: String,
    pub reading: String,
    pub count: u32,
    pub last_used: i64,
    pub first_seen: i64,
}

/// Epoch day, matching `Math.floor(Date.now() / 86_400_000)`.
pub fn today_epoch_day() -> i64 {
    (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
        / EPOCH_DAY_MS) as i64
}

/// Not `Debug`: the injected clock is a boxed closure.
pub struct UserDictionary {
    by_reading: HashMap<String, HashMap<String, UserEntry>>,
    options: UserDictionaryOptions,
    /// injected clock, in epoch days
    today: Box<dyn Fn() -> i64 + Send + Sync>,
}

impl Default for UserDictionary {
    fn default() -> Self {
        Self::new(UserDictionaryOptions::default())
    }
}

impl UserDictionary {
    pub fn new(options: UserDictionaryOptions) -> Self {
        Self { by_reading: HashMap::new(), options, today: Box::new(today_epoch_day) }
    }

    /// Fixed clock, for tests and for callers that keep their own notion of "now".
    pub fn with_today(options: UserDictionaryOptions, today: i64) -> Self {
        Self {
            by_reading: HashMap::new(),
            options,
            today: Box::new(move || today),
        }
    }

    pub fn options(&self) -> UserDictionaryOptions {
        self.options
    }

    pub fn today(&self) -> i64 {
        (self.today)()
    }

    /// Number of distinct learned words.
    pub fn size(&self) -> usize {
        self.by_reading.values().map(HashMap::len).sum()
    }

    /// Teach one word. Repeated calls reinforce rather than duplicate.
    pub fn record(&mut self, word: &str, reading: &str) {
        self.record_at(word, reading, self.today());
    }

    pub fn record_at(&mut self, word: &str, reading: &str, today: i64) {
        assert!(!word.is_empty() && !reading.is_empty(), "record() needs both word and reading");
        let per_reading = self.by_reading.entry(reading.to_string()).or_default();
        match per_reading.get_mut(word) {
            Some(entry) => {
                entry.count += 1;
                entry.last_used = today;
            }
            None => {
                per_reading.insert(
                    word.to_string(),
                    UserEntry {
                        word: word.to_string(),
                        reading: reading.to_string(),
                        count: 1,
                        last_used: today,
                        first_seen: today,
                    },
                );
            }
        }
    }

    pub fn forget(&mut self, word: &str, reading: &str) -> bool {
        let Some(per_reading) = self.by_reading.get_mut(reading) else { return false };
        let removed = per_reading.remove(word).is_some();
        if per_reading.is_empty() {
            self.by_reading.remove(reading);
        }
        removed
    }

    pub fn clear(&mut self) {
        self.by_reading.clear();
    }

    pub fn get(&self, word: &str, reading: &str) -> Option<&UserEntry> {
        self.by_reading.get(reading).and_then(|m| m.get(word))
    }

    pub fn set_count(&mut self, word: &str, reading: &str, count: u32, first_seen: i64) {
        if let Some(e) = self.by_reading.get_mut(reading).and_then(|m| m.get_mut(word)) {
            e.count = count;
            e.first_seen = first_seen;
        }
    }

    /// log10 bonus for a candidate, or 0 if the user has never taught it.
    pub fn bonus_for(&self, word: &str, reading: &str) -> f64 {
        self.bonus_for_at(word, reading, self.today())
    }

    pub fn bonus_for_at(&self, word: &str, reading: &str, today: i64) -> f64 {
        let Some(entry) = self.get(word, reading) else { return 0.0 };
        let age = (today - entry.last_used).max(0);
        let learned_age = (today - entry.first_seen).max(0);

        let mut base = if age <= self.options.recent_days {
            self.options.bonus_recent
        } else if age <= self.options.mid_days {
            self.options.bonus_mid
        } else {
            self.options.bonus_old
        };
        if learned_age <= self.options.recent_days {
            base = base.max(self.options.bonus_new);
        }
        let reinforcement =
            ((entry.count.saturating_sub(1)) as f64 * self.options.reinforcement_per_use)
                .min(self.options.reinforcement_cap);
        (base + reinforcement).min(self.options.bonus_cap)
    }

    /// All learned words for one reading, strongest first.
    pub fn entries_for(&self, reading: &str) -> Vec<UserEntry> {
        let today = self.today();
        let Some(per_reading) = self.by_reading.get(reading) else { return Vec::new() };
        let mut out: Vec<UserEntry> = per_reading.values().cloned().collect();
        out.sort_by(|a, b| {
            self.bonus_for_at(&b.word, reading, today)
                .total_cmp(&self.bonus_for_at(&a.word, reading, today))
                .then_with(|| a.word.cmp(&b.word))
        });
        out
    }

    pub fn readings(&self) -> Vec<&str> {
        self.by_reading.keys().map(String::as_str).collect()
    }

    // ------------------------------------------------------------ persistence

    /// Plain text, tab separated, one entry per line. The user's own data must be
    /// greppable, diffable and editable by hand — and must survive this project
    /// being abandoned.
    pub fn to_text(&self) -> String {
        let mut lines = vec![
            "# PingZhu user dictionary v1".to_string(),
            "# word<TAB>reading<TAB>count<TAB>lastUsedEpochDay<TAB>firstSeenEpochDay".to_string(),
        ];
        let mut readings: Vec<&String> = self.by_reading.keys().collect();
        readings.sort();
        for reading in readings {
            let per_reading = &self.by_reading[reading];
            let mut words: Vec<&String> = per_reading.keys().collect();
            words.sort();
            for word in words {
                let e = &per_reading[word];
                lines.push(format!(
                    "{}\t{}\t{}\t{}\t{}",
                    e.word, e.reading, e.count, e.last_used, e.first_seen
                ));
            }
        }
        lines.join("\n") + "\n"
    }

    pub fn from_text(text: &str, options: UserDictionaryOptions, today: i64) -> Self {
        let mut d = UserDictionary::with_today(options, today);
        for line in text.lines() {
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let p: Vec<&str> = line.split('\t').collect();
            if p.len() < 5 {
                continue;
            }
            let (word, reading) = (p[0], p[1]);
            let Ok(count) = p[2].parse::<u32>() else { continue };
            let Ok(last_used) = p[3].parse::<i64>() else { continue };
            let Ok(first_seen) = p[4].parse::<i64>() else { continue };
            if word.is_empty() || reading.is_empty() || count < 1 {
                continue;
            }
            d.record_at(word, reading, last_used);
            d.set_count(word, reading, count, first_seen);
        }
        d
    }

    pub fn load(path: impl AsRef<Path>) -> std::io::Result<Self> {
        let text = fs::read_to_string(path)?;
        Ok(Self::from_text(&text, UserDictionaryOptions::default(), today_epoch_day()))
    }

    pub fn save(&self, path: impl AsRef<Path>) -> std::io::Result<()> {
        if let Some(parent) = path.as_ref().parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, self.to_text())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 20_000;

    #[test]
    fn a_freshly_taught_word_gets_the_top_tier() {
        let mut ud = UserDictionary::with_today(UserDictionaryOptions::default(), DAY);
        ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
        assert_eq!(ud.bonus_for("畜牲", "ㄔㄨˋ-ㄕㄥ"), ud.options().bonus_new);
    }

    #[test]
    fn bonus_decays_by_recency_but_never_to_nothing() {
        let mut ud = UserDictionary::with_today(UserDictionaryOptions::default(), DAY);
        ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
        let r = "ㄔㄨˋ-ㄕㄥ";
        assert_eq!(ud.bonus_for_at("畜牲", r, DAY + 3), ud.options().bonus_new);
        assert_eq!(ud.bonus_for_at("畜牲", r, DAY + 20), ud.options().bonus_mid);
        let old = ud.bonus_for_at("畜牲", r, DAY + 400);
        assert_eq!(old, ud.options().bonus_old);
        assert!(old > 1.0, "an old user word must still beat the model, got {old}");
    }

    #[test]
    fn repeated_use_reinforces_and_the_cap_holds() {
        let mut ud = UserDictionary::with_today(UserDictionaryOptions::default(), DAY);
        let r = "ㄔㄨˋ-ㄕㄥ";
        ud.record("畜牲", r);
        let once = ud.bonus_for("畜牲", r);
        ud.record("畜牲", r);
        assert!(ud.bonus_for("畜牲", r) > once);
        for _ in 0..50 {
            ud.record("畜牲", r);
        }
        assert_eq!(ud.bonus_for("畜牲", r), ud.options().bonus_cap);
    }

    #[test]
    fn text_round_trip() {
        let mut ud = UserDictionary::with_today(UserDictionaryOptions::default(), DAY);
        ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
        ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
        ud.record("平注", "ㄆㄧㄥˊ-ㄓㄨˋ");
        let back = UserDictionary::from_text(&ud.to_text(), UserDictionaryOptions::default(), DAY);
        assert_eq!(back.size(), 2);
        assert_eq!(back.get("畜牲", "ㄔㄨˋ-ㄕㄥ").unwrap().count, 2);
        assert_eq!(back.bonus_for("畜牲", "ㄔㄨˋ-ㄕㄥ"), ud.bonus_for("畜牲", "ㄔㄨˋ-ㄕㄥ"));
    }
}
