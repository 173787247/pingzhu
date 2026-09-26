#!/usr/bin/env node
/*
 * 注音 vs 拼音 — a measurement, not an opinion.
 *
 * Both input methods encode the same thing: how a word is pronounced. The
 * language model already carries a Bopomofo reading for every entry, and
 * engine/src/pinyin.ts derives the Pinyin it would be typed as. So the same
 * words, with the same frequencies, can be compared under two encodings.
 *
 * What is measured
 *
 *   composition   keys to spell the word. Bopomofo types tones explicitly and
 *                 packs zh/ch/sh/ang/eng into one key each; Pinyin is letters.
 *   ambiguity     how many *different* words share one keystroke sequence.
 *                 Pinyin drops tones, so it collides far more — and it collides
 *                 across syllable boundaries too ("xian" is both 先 and 西+安).
 *   rank          where the intended word sits in its group ordered by
 *                 frequency. Rank 1 means it was chosen automatically.
 *   effective     composition keys plus the keystrokes needed to select the
 *                 intended word. This is the number that decides how fast a
 *                 person actually types.
 *
 * No sampling: every entry in the model is scored, so these are exact counts
 * rather than estimates with a confidence interval.
 *
 * Caveat, stated up front: the model was built from a Traditional Chinese
 * corpus, so it reflects that vocabulary. The comparison is internally
 * consistent — same words, same frequencies, two encodings — but it is not a
 * claim about a Simplified corpus.
 *
 *   node tools/zhuyin-vs-pinyin.mjs [--json]
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readingToPinyin, readingKeys } from "../engine/src/pinyin.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asJson = process.argv.includes("--json");

const LM = join(repo, "data", "bopomofo-lm.tsv");

/** entries: { word, reading, pinyin, score, bopomofoKeys } */
const entries = [];
let unreadable = 0;
let pinyinGaps = 0;

for (const line of readFileSync(LM, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [reading, word, scoreText] = line.split("\t");
  if (!reading || !word || scoreText === undefined) continue;
  const score = Number(scoreText);
  if (!Number.isFinite(score)) continue;

  const keys = readingKeys(reading);
  const pinyin = readingToPinyin(reading);
  if (keys === null) {
    unreadable++;
    continue;
  }
  if (pinyin === null) {
    pinyinGaps++;
    continue;
  }
  entries.push({
    word,
    reading,
    pinyin,
    score,
    bopomofoKeys: keys,
    pinyinKeys: [...pinyin].length,
    characters: [...word].length,
  });
}

/* Two scopes, because they answer different questions and a reader will
 * otherwise try to reconcile these numbers with bench.mjs and fail.
 *
 *   all    every entry in the model, single characters included. Single
 *          characters are the most ambiguous part of any phonetic encoding.
 *   words  two to four syllables, one character per syllable — the same filter
 *          bench.mjs uses, so its 90.38% top-1 figure can be compared directly.
 */
const SCOPES = {
  all: () => entries,
  words: () =>
    entries.filter((e) => {
      const syllables = e.reading.split("-").length;
      return syllables >= 2 && syllables <= 4 && e.characters === syllables;
    }),
};

/* Rank by score within a group. Ties keep file order, matching how the decoder
 * breaks them. */
/* The rank is written to a named field, not to `entry.rank`. Ranking twice and
 * sharing one field silently gives both systems the second system's ranks —
 * which produced three identical columns before this was fixed. */
function ranks(pool, groupKey, field) {
  const groups = new Map();
  for (const entry of pool) {
    const key = groupKey(entry);
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(entry);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.score - a.score);
    list.forEach((entry, index) => {
      entry[field] = index + 1;
    });
  }
  return groups;
}

function measure(pool) {
  const bopomofoGroups = ranks(pool, (e) => e.reading, "bopomofoRank");
  const pinyinGroups = ranks(pool, (e) => e.pinyin, "pinyinRank");

  /* Guard the mistake made the first time this ran: ranking twice into one
   * field gave both systems the second system's ranks, and three columns came
   * out identical. If that ever happens again, stop rather than report. */
  let same = 0;
  for (const entry of pool) if (entry.bopomofoRank === entry.pinyinRank) same++;
  if (same === pool.length && pool.length > 0) {
    console.error("all ranks identical — the two groupings were not applied separately");
    process.exit(1);
  }

  return {
    count: pool.length,
    bopomofo: summarise(pool, "bopomofo", bopomofoGroups),
    pinyin: summarise(pool, "pinyin", pinyinGroups),
  };
}

/* Keystrokes to accept the intended word once it is found: the digits address
 * ten per page, so a rank beyond ten costs page-downs first. */
const selectionCost = (rank) => (rank === 1 ? 0 : 1 + Math.floor((rank - 1) / 10));

function summarise(pool, label, groups) {
  let composition = 0;
  let characters = 0;
  let effective = 0;
  let top1 = 0;
  let inPage1 = 0;
  let rankSum = 0;
  let groupSizes = 0;

  for (const entry of pool) {
    composition += label === "bopomofo" ? entry.bopomofoKeys : entry.pinyinKeys;
    characters += entry.characters;
    const rank = label === "bopomofo" ? entry.bopomofoRank : entry.pinyinRank;
    effective += (label === "bopomofo" ? entry.bopomofoKeys : entry.pinyinKeys) + selectionCost(rank);
    if (rank === 1) top1++;
    if (rank <= 10) inPage1++;
    rankSum += rank;
  }
  for (const list of groups.values()) groupSizes += list.length * list.length;

  const n = pool.length;
  return {
    compositionPerCharacter: composition / characters,
    effectivePerCharacter: effective / characters,
    top1: (top1 / n) * 100,
    inPage1: (inPage1 / n) * 100,
    meanRank: rankSum / n,
    /* Mean group size weighted by entry count: the average number of candidates
     * a keystroke sequence offers, as experienced by the words in the model. */
    meanAmbiguity: groupSizes / n,
    groups: groups.size,
  };
}

const results = {
  entries: entries.length,
  unreadable,
  pinyinGaps,
  all: measure(SCOPES.all()),
  words: measure(SCOPES.words()),
};

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const f = (x, d = 2) => x.toFixed(d).padStart(9);
const pct = (x) => x.toFixed(2).padStart(8) + "%";

console.log(`注音 vs 拼音 — 同一份語言模型、同一批詞、兩種編碼`);
console.log(`語料  data/bopomofo-lm.tsv`);
console.log(`詞條  ${entries.length.toLocaleString()} 條（全部計分，非抽樣）`);
console.log(`      注音無法解析 ${unreadable} 條，拼音對應缺漏 ${pinyinGaps} 條`);

for (const [name, label] of [
  ["all", "範圍一：全部詞條（含單字）"],
  ["words", "範圍二：2–4 音節、一字一音（與 bench.mjs 同範圍）"],
]) {
  const { count, bopomofo: bo, pinyin: py } = results[name];
  console.log(`\n${label}`);
  console.log(`  ${count.toLocaleString()} 條\n`);
  console.log(`                             注音        拼音`);
  console.log(`  組字按鍵／字          ${f(bo.compositionPerCharacter)}  ${f(py.compositionPerCharacter)}`);
  console.log(`  有效按鍵／字          ${f(bo.effectivePerCharacter)}  ${f(py.effectivePerCharacter)}`);
  console.log(`  首選正確率            ${pct(bo.top1)}  ${pct(py.top1)}`);
  console.log(`  前十個內找得到        ${pct(bo.inPage1)}  ${pct(py.inPage1)}`);
  console.log(`  目標詞平均名次        ${f(bo.meanRank)}  ${f(py.meanRank)}`);
  console.log(`  平均同碼候選數        ${f(bo.meanAmbiguity)}  ${f(py.meanAmbiguity)}`);
  console.log(`  相異按鍵序列數        ${f(bo.groups, 0)}  ${f(py.groups, 0)}`);
  const ratio = py.effectivePerCharacter / bo.effectivePerCharacter;
  console.log(
    `\n  有效按鍵比（拼音／注音）：${ratio.toFixed(3)}  ` +
      (ratio > 1 ? `→ 注音少 ${((1 - 1 / ratio) * 100).toFixed(1)}% 的按鍵` : `→ 拼音較少`),
  );
}
