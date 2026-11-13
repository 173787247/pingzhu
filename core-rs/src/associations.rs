//! 接续表 —— 「打了某个词之后，下一个词最可能是什么」。
//!
//! 数据来自 `data/bigram.tsv`，由 `tools/build-bigram.mjs` 从语料统计出来。格式三列：
//!
//! ```text
//! word<TAB>next<TAB>count
//! ```
//!
//! **它不参与解码。** 接续是「已经送出一个词之后」的提示，不是候选列的一部分：候选列回答
//! 「这个读音有哪些字」，接续回答「接下来大概会写什么」。混在一起会让空缓冲区也冒出东西。
//!
//! 与 `Dictionary` 刻意保持同一种形状（`from_text` / `lookup` / `len`）—— 它们是同一类东西，
//! 一份只读的派生数据。读文件是调用方的事，所以这个模块不知道文件系统。

use std::collections::HashMap;

/// 一个接续词与它的频次。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Association {
    pub next: String,
    pub count: u32,
}

/// 每个词最多保留多少个接续。表再大也要能塞进内存。
pub const DEFAULT_MAX_PER_WORD: usize = 8;

/// 接续表。
#[derive(Debug, Default, Clone)]
pub struct Associations {
    by_word: HashMap<String, Vec<Association>>,
}

impl Associations {
    /// 从编译好的 TSV 文本建出来。
    ///
    /// 坏行跳过而不是报错：这张表是派生物，不值得为一行格式错误让整个输入法载入失败。
    pub fn from_text(text: &str) -> Self {
        Self::from_text_with_limit(text, DEFAULT_MAX_PER_WORD)
    }

    pub fn from_text_with_limit(text: &str, max_per_word: usize) -> Self {
        let mut by_word: HashMap<String, Vec<Association>> = HashMap::new();
        for line in text.lines() {
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let mut fields = line.split('\t');
            let (Some(word), Some(next), Some(count)) = (fields.next(), fields.next(), fields.next())
            else {
                continue;
            };
            if word.is_empty() || next.is_empty() {
                continue;
            }
            let Ok(count) = count.parse::<u32>() else {
                continue;
            };
            if count == 0 {
                continue;
            }
            let list = by_word.entry(word.to_string()).or_default();
            if list.len() >= max_per_word {
                continue;
            }
            list.push(Association { next: next.to_string(), count });
        }
        // 频次高的在前。TSV 已经是这个顺序，但排序不花钱，也不依赖调用方守规矩。
        for list in by_word.values_mut() {
            list.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.next.cmp(&b.next)));
        }
        Self { by_word }
    }

    /// 某个词之后最可能的接续词，最好的在前。没有就是空 slice。
    pub fn lookup(&self, word: &str) -> &[Association] {
        self.by_word.get(word).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// 只要词，不要频次。
    pub fn suggestions(&self, word: &str, limit: usize) -> Vec<&str> {
        self.lookup(word).iter().take(limit).map(|a| a.next.as_str()).collect()
    }

    /// 有多少条接续（不是一个词一个 —— 一个词可以有好几个）。
    pub fn len(&self) -> usize {
        self.by_word.values().map(|v| v.len()).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.by_word.is_empty()
    }

    /// 有多少个词有接续。
    pub fn words(&self) -> usize {
        self.by_word.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_sorts_best_first() {
        let t = "好\t嗎\t3\n好\t的\t7\n好\t呀\t1\n";
        let a = Associations::from_text(t);
        assert_eq!(a.len(), 3);
        assert_eq!(a.suggestions("好", 2), vec!["的", "嗎"]);
    }

    #[test]
    fn unknown_word_is_empty_not_error() {
        let a = Associations::from_text("好\t嗎\t1\n");
        assert!(a.lookup("不存在").is_empty());
        assert!(a.suggestions("不存在", 5).is_empty());
    }

    #[test]
    fn malformed_rows_are_skipped() {
        let t = "# comment\n\n只有一列\n好\t\t2\n好\t呀\t不是数字\n好\t的\t0\n好\t吧\t1\n";
        let a = Associations::from_text(t);
        assert_eq!(a.len(), 1);
        assert_eq!(a.suggestions("好", 5), vec!["吧"]);
    }

    #[test]
    fn per_word_limit_is_respected() {
        let t = (0..20).map(|i| format!("甲\t乙{i}\t{}", 20 - i)).collect::<Vec<_>>().join("\n");
        let a = Associations::from_text_with_limit(&t, 3);
        assert_eq!(a.lookup("甲").len(), 3);
    }

    #[test]
    fn the_shipped_table_loads() {
        // 真实数据：tools/build-bigram.mjs 的产物。文件不在时跳过，免得 CI 里因为
        // 少一份数据就红 —— 那不是这个模块的错。
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../data/bigram.tsv");
        let Ok(text) = std::fs::read_to_string(path) else {
            return;
        };
        let a = Associations::from_text(&text);
        assert!(a.len() > 1000, "表太小了: {}", a.len());
        assert!(a.words() > 100, "有接续的词太少: {}", a.words());
        // 「不断」在一批国务院公文里出现很多次。
        assert!(!a.lookup("不断").is_empty(), "不断 没有接续");
    }
}
