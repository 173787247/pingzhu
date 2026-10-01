#!/usr/bin/env node
/**
 * Does a bigram model move the homophone ties the unigram decoder cannot?
 *
 * `bench.mjs` reports ~91% top-1 with every remaining miss being a homophone
 * tie: the engine outputs a real word that reads exactly as typed, just not the
 * one the corpus meant. No amount of unigram reweighting touches those, because
 * the competitors are different words with the same sound, not the same word
 * mis-ranked. What separates them is the word beside them.
 *
 * This script answers the question with a number instead of an opinion:
 *
 *   for every tied case in the benchmark
 *     enumerate the segmentations the dictionary allows
 *     score each one by unigram only, and by unigram + bigram
 *     count how often the bigram ranking puts the intended word first
 *
 * It is a measurement harness, not a proposal. It runs beside the engine and
 * changes nothing.
 *
 * usage:
 *   node research/tools/bigram-trial.mjs <bigram_p50.arpa> [sampleSize]
 */
import { readFileSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, "..", "..", "engine");
const { dict, inventory, buildTestSet } = await import(join(ENGINE, "bench-lib.mjs"));
const { InputEngine } = await import(join(ENGINE, "src/engine.ts"));

const arpaPath = process.argv[2];
const sampleSize = Number(process.argv[3] ?? 3000);
if (!arpaPath) {
  console.error("usage: node research/tools/bigram-trial.mjs <bigram_p50.arpa> [sampleSize]");
  process.exit(1);
}

// ------------------------------------------------------------ read the model
//
// 143 MB, and only a few thousand entries can affect the answer. So the pairs
// worth loading are worked out first, then the file is streamed once collecting
// those and nothing else. A full parse costs more memory than the tables hold
// and answers no more of the question.
const uni = new Map();
const bi = new Map();

/** Which words and pairs to keep. Filled by the collection pass below. */
let wantedWords = null;
let wantedPairs = null;

/**
 * Open the model, locally or straight off the network.
 *
 * A URL is read through `curl`, which keeps the whole 143 MB out of both memory
 * and the working tree: the file is streamed, filtered on the way past, and the
 * bytes that answer no question are never stored.
 */
function openModel(source) {
  if (!/^https?:/.test(source)) return createReadStream(source);
  const curl = spawn("curl", ["-fsSL", "--compressed", source], { stdio: ["ignore", "pipe", "inherit"] });
  return curl.stdout;
}

function readModel(source) {
  const input = openModel(source);
  return new Promise((resolve, reject) => {
    let section = null;
    const rl = createInterface({ input, crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line) return;
      if (line.startsWith("\\1-grams:")) { section = 1; return; }
      if (line.startsWith("\\2-grams:")) { section = 2; return; }
      if (line.startsWith("\\")) { section = null; return; }
      if (line.startsWith("ngram")) return;
      if (section === 1) {
        const sp = line.indexOf(" ");
        if (sp < 0) return;
        const word = line.slice(sp + 1).trim();
        if (wantedWords === null || wantedWords.has(word)) uni.set(word, Number(line.slice(0, sp)));
      } else if (section === 2) {
        const a = line.indexOf(" ");
        if (a < 0) return;
        const b = line.indexOf(" ", a + 1);
        if (b < 0) return;
        const key = `${line.slice(a + 1, b)} ${line.slice(b + 1).trim()}`;
        if (wantedPairs === null || wantedPairs.has(key)) bi.set(key, Number(line.slice(0, a)));
      }
    });
    rl.on("close", resolve);
    rl.on("error", reject);
    input.on?.("error", reject);
  });
}

// A path is only a rival if every word in it is a word. The dictionary says what
// the input method can spell; the model says what it can rank. Both are needed,
// and they are known at different times — the dictionary now, the model after
// the file has been read — so the two tests happen in that order.
const inDictionary = (paths) => paths.filter((p) => p.every((e) => dict.lookup(e.reading).some((d) => d.word === e.word)));
const inModel = (paths) => paths.filter((p) => p.every((e) => uni.has(e.word)));

/**
 * P(w | previous), with the ARPA file's own backoff.
 *
 * The table is pruned, so a missing pair is not evidence of an impossible one —
 * it means the pair was not discriminative enough to keep. Falling back to the
 * unigram is the estimate that makes: "beside this word, w is about as likely
 * as it is anywhere." A flat penalty for absence would instead rank by how
 * often the pruning happened to keep a pair, which is an artefact of the file.
 */
const biOf = (prev, w) => bi.get(`${prev} ${w}`) ?? uni.get(w);

const scoreOf = (path, prev, useBigram) => {
  let total = 0, last = prev;
  for (const e of path) {
    // At the start of a sentence there is no previous word, so the unigram is
    // the best estimate available — not the bigram backoff.
    total += useBigram && last !== null ? biOf(last, e.word) : uni.get(e.word);
    last = e.word;
  }
  return total;
};

const pickPath = (paths, prev, useBigram) =>
  paths.reduce((best, p) => (scoreOf(p, prev, useBigram) > scoreOf(best, prev, useBigram) ? p : best), paths[0]);

// ------------------------------------------------------- enumerate the paths
//
// Every way the dictionary lets these syllables be spelled. Short inputs, so
// the lattice is small; the point is to include the rival the engine lost to,
// which a search over "the engine's answer" alone would miss.

function segmentations(syllables) {
  const out = [];
  const walk = (i, acc) => {
    if (i === syllables.length) { out.push([...acc]); return; }
    for (let j = i + 1; j <= syllables.length; j++) {
      const reading = syllables.slice(i, j).join("-");
      const entries = dict.lookup(reading);
      if (!entries.length) continue;
      for (const e of entries) {
        acc.push(e);
        walk(j, acc);
        acc.pop();
      }
    }
  };
  walk(0, []);
  return out;
}

// ------------------------------------------------------------------- measure
//
// Pass 1: decide what the model needs to contain. Everything else in the file
// is, for this question, noise.
const cases = buildTestSet(sampleSize, 20260926);
const engine = new InputEngine(dict, inventory, { layout: "standard" });

const trials = [];
wantedWords = new Set();
wantedPairs = new Set();

for (const c of cases) {
  if (!c.keystrokes) continue;
  engine.reset();
  for (const ch of c.keystrokes) engine.press(ch);
  const got = engine.bestSentence;
  if (got === c.word) continue;                       // not a miss
  if (engine.usedFallback) continue;

  const syllables = c.reading.split("-");
  const allPaths = segmentations(syllables);
  const paths = inDictionary(allPaths);
  if (!paths.length) continue;

  // The miss the report calls a tie: a rival that reads the same as the target.
  const rival = paths.find((p) => p.map((e) => e.word).join("") === got
    && p.map((e) => e.reading).join("-") === c.reading);
  if (!rival) continue;                               // a decomposition defect, not a tie

  const target = paths.find((p) => p.map((e) => e.word).join("") === c.word);
  if (!target) continue;

  trials.push({ reading: c.reading, want: c.word, got, paths });
  for (const p of paths) {
    for (const e of p) wantedWords.add(e.word);
    for (let i = 1; i < p.length; i++) wantedPairs.add(`${p[i - 1].word} ${p[i].word}`);
  }
}

console.error(`需要查的 unigram ${wantedWords.size} 项 · bigram ${wantedPairs.size} 对`);
await readModel(arpaPath);
console.error(`模型已读：unigram ${uni.size} · bigram ${bi.size}\n`);

// Pass 2: score.
let unigramHit = 0, bigramHit = 0, agrees = 0, usable = 0;
const examples = [];

for (const t of trials) {
  // The model has the final say on what is rankable; a word it does not hold
  // cannot be scored, so the paths through it leave the comparison here.
  const paths = inModel(t.paths);
  if (paths.length < 2) continue;
  usable++;

  const pick = (useBigram) => pickPath(paths, null, useBigram).map((e) => e.word).join("");
  if (pick(false) === t.got) agrees++;
  if (pick(false) === t.want) unigramHit++;
  if (pick(true) === t.want) bigramHit++;

  if (examples.length < 12 && pick(true) === t.want && pick(false) !== t.want) {
    examples.push(`  ${t.reading.padEnd(14)} ${t.want}  ← 被 bigram 救回（原本给 ${t.got}）`);
  }
}

// Without this the comparison means nothing: if replaying unigram-only scoring
// does not land where the engine lands, the harness is modelling the decoder
// rather than measuring it, and any difference attributed to the bigram is
// really a difference from the engine.
console.log(`自检：unigram 基线复现引擎选择  ${agrees} / ${usable}` +
  (agrees === usable && usable > 0 ? "  ✓" : "  ★ 不一致，数字不可信"));

console.log(`\n可比样本:               ${usable} / ${trials.length}`);
console.log(`仅 unigram 排序选对:    ${unigramHit}`);
console.log(`加 bigram 后选对:       ${bigramHit}`);
if (usable) {
  const n = cases.length;
  console.log(`\ntop-1 正确率: ${(unigramHit / n * 100).toFixed(2)}% → ${(bigramHit / n * 100).toFixed(2)}%`);
  console.log(`改变: ${bigramHit - unigramHit} 例 / ${n} 例样本`);
}
if (examples.length) { console.log("\n样例:"); console.log(examples.join("\n")); }
