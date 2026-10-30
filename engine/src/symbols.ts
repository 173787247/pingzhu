/**
 * The punctuation page.
 *
 * The same page the Rust core has (`core-rs/src/symbols.rs`). Two copies exist
 * because the demo has no C ABI to ask — the whole point of it is that nothing is
 * installed. `core-rs/tests/symbols.tsv` is generated from this table and checked
 * against the Rust one, so the two cannot drift apart silently.
 *
 * Full-width: that is what a Chinese sentence uses. Grouped by how often they are
 * reached for, not by Unicode order.
 */
export const SYMBOL_ROWS: string[][] = [
  ["，", "。", "、", "；", "：", "？", "！"],
  ["「", "」", "『", "』", "（", "）", "《", "》"],
  ["【", "】", "〈", "〉", "…", "—", "～", "·"],
  ["／", "＼", "＃", "＄", "％", "＆", "＊", "＋"],
  ["－", "＝", "＠", "＿", "｜", "＾"],
];
