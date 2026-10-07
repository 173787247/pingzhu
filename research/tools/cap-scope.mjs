#!/usr/bin/env node
/**
 * What is the per-reading cap actually deleting?
 *
 * `data/build.mjs` keeps the 100 highest-scoring words per reading. The build's
 * own counter (`stats.json: dropped_low_probability: 699`) counts deleted rows
 * without saying what they were, and that number is easy to read as harmless.
 *
 * This separates the two cases that the one number mixes together:
 *
 *   - a multi-syllable reading that ranked past 100  -> a ranking decision
 *   - a single-syllable reading that ranked past 100 -> the character is in no
 *     file the engine reads; pressing the keys never offers it
 *
 * Prints counts and aggregate scores only. No corpus text, no word lists.
 *
 * usage: node cap-scope.mjs [--cap N] [--sample N]
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const vendorDir = join(root, "data", "vendor");

const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const CAP = argOf("--cap", 100);
const SAMPLE = argOf("--sample", 10);

const CONSONANTS = ["", "ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ", "ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ",
  "ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"];
const MIDDLES = ["", "ㄧ", "ㄨ", "ㄩ"];
const VOWELS = ["", "ㄚ", "ㄛ", "ㄜ", "ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ"];
const TONES = ["", "ˊ", "ˇ", "ˋ", "˙"];

function decodeSyllable(pair) {
  const order = pair.charCodeAt(0) - 48 + (pair.charCodeAt(1) - 48) * 79;
  return CONSONANTS[order % 22] + MIDDLES[Math.floor(order / 22) % 4]
    + VOWELS[Math.floor(order / 88) % 14] + TONES[Math.floor(order / 1232) % 5];
}
function decodeKey(key) {
  if (key.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < key.length; i += 2) {
    const s = decodeSyllable(key.slice(i, i + 2));
    if (!s) return null;
    out.push(s);
  }
  return out.join("-");
}

const src = readFileSync(join(vendorDir, "WebData.ts"), "utf8");
const tmp = join(vendorDir, ".cap-scope.gen.mjs");
writeFileSync(tmp, src);
const { webData } = await import(pathToFileURL(tmp).href);
if (existsSync(tmp)) unlinkSync(tmp);

/** reading -> [{word, score}] as the builder would see it, plus its own cap cut */
const upstream = new Map();
for (const [key, value] of Object.entries(webData)) {
  if (key.startsWith("_")) continue;
  const reading = decodeKey(key);
  if (!reading) continue;
  const toks = value.split(" ");
  if (toks.length % 2 !== 0) continue;
  let list = upstream.get(reading);
  if (!list) { list = []; upstream.set(reading, list); }
  for (let i = 0; i + 1 < toks.length; i += 2) {
    const word = toks[i];
    const score = Number.parseFloat(toks[i + 1]);
    if (!word || word.startsWith("MACRO@") || !Number.isFinite(score)) continue;
    list.push({ word, score });
  }
}

let totalEntries = 0, maxDepth = 0;
const depths = [];
const overCapReadings = [];
for (const [reading, list] of upstream) {
  const uniq = new Map();
  for (const x of list) if (!uniq.has(x.word)) uniq.set(x.word, x.score);
  const sorted = [...uniq.entries()].map(([word, score]) => ({ word, score }))
    .sort((a, b) => b.score - a.score);
  upstream.set(reading, sorted);
  totalEntries += sorted.length;
  depths.push(sorted.length);
  if (sorted.length > maxDepth) maxDepth = sorted.length;
  if (sorted.length > CAP) overCapReadings.push([reading, sorted]);
}
depths.sort((a, b) => a - b);

console.log(`cap under test                     ${CAP}`);
console.log(`readings                           ${upstream.size}`);
console.log(`entries upstream (uncapped)        ${totalEntries}`);
console.log(`deepest reading                    ${maxDepth} candidates`);
console.log(`readings over the cap              ${overCapReadings.length}`);
console.log(`  of which single-syllable         ${overCapReadings.filter(([r]) => !r.includes("-")).length}`);
console.log();
console.log("depth distribution of readings");
for (const [lo, hi] of [[1, 1], [2, 3], [4, 10], [11, 50], [51, 100], [101, 200], [201, 500], [501, 1000], [1001, Infinity]]) {
  const n = depths.filter((d) => d >= lo && d <= hi).length;
  if (n) console.log(`  ${String(lo).padStart(5)}-${hi === Infinity ? "  inf" : String(hi).padStart(5)}   ${String(n).padStart(7)}   ${(100 * n / depths.length).toFixed(2)}%`);
}

// ------------------------------------------------------------- what is cut
let cutTotal = 0, cutSingle = 0, cutMulti = 0;
let scoreSumCut = 0, scoreSumKept = 0;
let tailRank = 0;
const singleExamples = [];
const multiExamples = [];
for (const [reading, sorted] of upstream) {
  if (sorted.length <= CAP) { scoreSumKept += sorted.reduce((n, x) => n + x.score, 0); continue; }
  scoreSumKept += sorted.slice(0, CAP).reduce((n, x) => n + x.score, 0);
  for (let i = CAP; i < sorted.length; i++) {
    cutTotal++;
    scoreSumCut += sorted[i].score;
    tailRank += i + 1;
    if (reading.includes("-")) {
      cutMulti++;
      if (multiExamples.length < SAMPLE) multiExamples.push([reading, sorted[i], i + 1]);
    } else {
      cutSingle++;
      if (singleExamples.length < SAMPLE) singleExamples.push([reading, sorted[i], i + 1]);
    }
  }
}

console.log();
console.log(`entries deleted by the cap         ${cutTotal}`);
console.log(`  single-syllable (unreachable)    ${cutSingle}`);
console.log(`  multi-syllable (ranked out)      ${cutMulti}`);
console.log(`mean rank of a deleted entry       ${(tailRank / Math.max(1, cutTotal)).toFixed(1)}`);
console.log(`mean -log10(P) kept                ${(scoreSumKept / Math.max(1, totalEntries - cutTotal)).toFixed(3)}`);
console.log(`mean -log10(P) deleted             ${(scoreSumCut / Math.max(1, cutTotal)).toFixed(3)}`);

/**
 * The decisive comparison: how bad is the best deleted single character?
 *
 * If the best cut single-syllable score is close to the worst *kept* score in
 * the same reading, the cut is a ranking choice. If it is far worse, the cut is
 * removing entries the model itself already considered unlikely.
 */
const cutSingles = [];
for (const [reading, sorted] of upstream) {
  if (reading.includes("-") || sorted.length <= CAP) continue;
  for (let i = CAP; i < sorted.length; i++) {
    cutSingles.push({ reading, ...sorted[i], rank: i + 1, cutAt: sorted[CAP - 1].score });
  }
}
cutSingles.sort((a, b) => b.score - a.score);
console.log();
console.log(`best deleted single characters (top ${SAMPLE} by score)`);
for (const x of cutSingles.slice(0, SAMPLE)) {
  console.log(`  ${x.reading.padEnd(6)} ${x.word}   rank ${String(x.rank).padStart(5)}   score ${x.score.toFixed(3)}   (last kept ${x.cutAt.toFixed(3)}, delta ${(x.score - x.cutAt).toFixed(3)})`);
}
console.log();
console.log(`deleted single chars scoring better than their reading's last kept one  ${cutSingles.filter((x) => x.score > x.cutAt).length}`);
console.log(`deleted single chars within 0.5 of the last kept one                    ${cutSingles.filter((x) => x.cutAt - x.score <= 0.5).length}`);
console.log(`deleted single chars within 1.0 of the last kept one                    ${cutSingles.filter((x) => x.cutAt - x.score <= 1.0).length}`);

// --------------------------------------------- how many distinct chars total
const singleCharReadings = new Map();
for (const [reading, sorted] of upstream) {
  if (reading.includes("-")) continue;
  singleCharReadings.set(reading, sorted);
}
const cutChars = new Set();
for (const [reading, sorted] of singleCharReadings) {
  for (let i = CAP; i < sorted.length; i++) cutChars.add(sorted[i].word);
}
console.log();
console.log(`single-syllable readings           ${singleCharReadings.size}`);
console.log(`distinct characters only reachable past the cap   ${cutChars.size}`);

// ------------------------------------------------- is the cut a tie or a gap?
console.log();
console.log(`per-reading detail for the ${overCapReadings.length} readings over the cap`);
console.log(`  reading  depth  kept  score@cap  score@cap+1  kept==cut  floor?`);
for (const [reading, sorted] of overCapReadings.slice().sort((a, b) => b[1].length - a[1].length)) {
  const atCap = sorted[CAP - 1].score;
  const afterCap = sorted[CAP].score;
  const floor = sorted[sorted.length - 1].score;
  const distinctKept = new Set(sorted.slice(0, CAP).map((x) => x.score)).size;
  console.log(`  ${reading.padEnd(7)} ${String(sorted.length).padStart(5)} ${String(CAP).padStart(5)}  ${atCap.toFixed(3).padStart(9)}  ${afterCap.toFixed(3).padStart(11)}  ${String(atCap === afterCap).padStart(8)}  ${String(atCap === floor && distinctKept === 1).padStart(5)}`);
}

// ------------------------------- is a cut character reachable under ANOTHER reading?
/**
 * The cap removes a character from one reading. The engine can still offer it
 * if the character appears at all in some other reading that survives the cap.
 * This is the difference between "one entry short" and "untypable".
 */
const reachableByAnyReading = new Set();
for (const list of upstream.values()) {
  for (const x of list.slice(0, CAP)) reachableByAnyReading.add(x.word);
}
const cutCharsTypable = [...cutChars].filter((w) => reachableByAnyReading.has(w));
console.log();
console.log(`cut characters still typable under some other reading   ${cutCharsTypable.length} / ${cutChars.size}`);
console.log(`cut characters typable NOWHERE                          ${cutChars.size - cutCharsTypable.length}`);

// ------------------------------------- second axis: the frequency-order char table
const CHARS = join(root, "data", "bopomofo-chars.tsv");
if (existsSync(CHARS)) {
  const lmWords = new Set();
  for (const list of upstream.values()) for (const x of list) lmWords.add(x.word);
  let charsRows = 0, charsTotal = 0, charsNotInLm = 0;
  const worstRank = [];
  for (const line of readFileSync(CHARS, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [reading, listStr] = line.split("\t");
    if (!reading || !listStr) continue;
    charsRows++;
    const list = listStr.split(" ").filter(Boolean);
    charsTotal += list.length;
    let rank = 0;
    for (const ch of list) {
      rank++;
      if (!lmWords.has(ch)) {
        charsNotInLm++;
        if (worstRank.length < SAMPLE) worstRank.push([reading, ch, rank]);
      }
    }
  }
  console.log();
  console.log(`chars.tsv rows / total characters        ${charsRows} / ${charsTotal}`);
  console.log(`characters in chars.tsv but absent from the LM everywhere   ${charsNotInLm}`);
  for (const [r, ch, rank] of worstRank) console.log(`    ${r.padEnd(6)} ${ch}  at rank ${rank} in chars.tsv`);

  /**
   * The decisive question for the 485 untypable characters.
   *
   * There are two independent orderings of the same characters in the vendor
   * data: the scored LM (WebData, what the engine ranks by) and the plain
   * frequency list (WebDataPlain, what chars.tsv preserves). A character the LM
   * cut at rank 101+ but that the frequency list puts at rank 5 is evidence the
   * two orderings disagree about it — the case worth acting on. A character near
   * the bottom of both is one nothing considers common.
   */
  const rankInChars = new Map();
  for (const line of readFileSync(CHARS, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [reading, listStr] = line.split("\t");
    if (!reading || !listStr) continue;
    listStr.split(" ").filter(Boolean).forEach((ch, i) => {
      const k = `${reading}\t${ch}`;
      if (!rankInChars.has(k)) rankInChars.set(k, i + 1);
    });
  }
  const buckets = [[1, 10], [11, 30], [31, 60], [61, 100], [101, 200], [201, Infinity]];
  const anyRank = [], perBucket = new Map(buckets.map(([lo, hi]) => [`${lo}-${hi}`, 0]));
  const untypable = [];
  for (const [reading, sorted] of singleCharReadings) {
    for (let i = CAP; i < sorted.length; i++) {
      const w = sorted[i].word;
      const rank = rankInChars.get(`${reading}\t${w}`);
      if (rank === undefined) continue;
      anyRank.push(rank);
      for (const [lo, hi] of buckets) if (rank >= lo && rank <= hi) { perBucket.set(`${lo}-${hi}`, perBucket.get(`${lo}-${hi}`) + 1); break; }
      if (!reachableByAnyReading.has(w)) untypable.push({ reading, word: w, rank, lmRank: i + 1 });
    }
  }
  console.log();
  console.log(`cut entries that have a chars.tsv rank   ${anyRank.length} / ${cutTotal}`);
  console.log(`their rank in chars.tsv (the frequency list)`);
  for (const [k, v] of perBucket) console.log(`  ${k.padEnd(9)} ${String(v).padStart(5)}`);
  const untypableRanked = untypable.slice().sort((a, b) => a.rank - b.rank);
  console.log();
  console.log(`of the ${cutChars.size - cutCharsTypable.length} characters typable nowhere, best chars.tsv ranks:`);
  for (const x of untypableRanked.slice(0, 15)) {
    console.log(`  ${x.reading.padEnd(6)} ${x.word}   chars.tsv rank ${String(x.rank).padStart(4)}   LM rank ${x.lmRank}`);
  }
}
