#!/usr/bin/env node
/**
 * Build the PingZhu language-model data from McBopomofo's MIT-licensed data.
 *
 * Input  (data/vendor/, fetched by data/fetch-source.sh):
 *   WebData.ts       -- 134k entries: packed reading sequence -> "詞 -log10(P)"
 *   WebDataPlain.ts  -- 2k entries:   packed syllable      -> "字 0 字 0 ..." (frequency order)
 *
 * Output (data/):
 *   bopomofo-lm.tsv    詞<TAB>ㄩㄥˋ-ㄗㄞˋ<TAB>-4.597
 *   bopomofo-chars.tsv ㄩㄥˋ<TAB>用 佣 醟 ...
 *   stats.json
 *
 * The packed key format is McBopomofo's "absolute order string": 2 ASCII chars per
 * syllable, where the order number packs
 *   consonant(0..21) + middleVowel(0..3)*22 + vowel(0..13)*88 + tone(0..4)*1232
 * and is emitted as  String.fromCharCode(48 + order % 79, 48 + (order / 79) & 127).
 * Decoding it here is what makes the data human-readable and portable.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const vendor = join(here, "vendor");

const CONSONANTS = ["", "ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ", "ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ",
  "ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"];
const MIDDLES = ["", "ㄧ", "ㄨ", "ㄩ"];
const VOWELS = ["", "ㄚ", "ㄛ", "ㄜ", "ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ"];
const TONES = ["", "ˊ", "ˇ", "ˋ", "˙"];

/** packed 2-char string -> composed bopomofo syllable, e.g. "~l" -> "ㄩㄥˋ" */
function decodeSyllable(pair) {
  const low = pair.charCodeAt(0) - 48;
  const high = (pair.charCodeAt(1) - 48) * 79;
  const order = low + high;
  const consonant = order % 22;
  const middle = Math.floor(order / 22) % 4;
  const vowel = Math.floor(order / 88) % 14;
  const tone = Math.floor(order / 1232) % 5;
  const s = CONSONANTS[consonant] + MIDDLES[middle] + VOWELS[vowel] + TONES[tone];
  return s;
}

/** packed key (2 chars per syllable) -> "ㄩㄥˋ-ㄗㄞˋ" */
function decodeKey(key) {
  if (key.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < key.length; i += 2) {
    const s = decodeSyllable(key.slice(i, i + 2));
    if (!s) return null; // empty syllable => padding/garbage
    out.push(s);
  }
  return out.join("-");
}

/** WebData.ts is plain JS in a .ts file; re-emit as .mjs so Node imports it directly. */
async function loadWebData(file, exportName) {
  const src = readFileSync(join(vendor, file), "utf8");
  const tmp = join(vendor, `.${file.replace(/\.ts$/, "")}.gen.mjs`);
  writeFileSync(tmp, src);
  const mod = await import(pathToFileURL(tmp).href);
  return mod[exportName];
}

function main() {
  if (!existsSync(join(vendor, "WebData.ts"))) {
    console.error("missing data/vendor/WebData.ts -- run data/fetch-source.sh first");
    process.exit(1);
  }
  return (async () => {
    const webData = await loadWebData("WebData.ts", "webData");
    const webDataPlain = await loadWebData("WebDataPlain.ts", "webDataPlain");

    // ---- phrases + single characters with real log10 probabilities ----
    // A value is a run of "token score" pairs, best candidate first, e.g.
    //   "ㄋㄧˇ-ㄏㄠˇ" -> "你好 -5.089 妳好 -5.995"
    //   "ㄧˋ"        -> "意 -3.167 議 -3.436 義 -3.514 ..."
    const lm = [];
    let skipped = 0;
    for (const [key, value] of Object.entries(webData)) {
      if (key.startsWith("_")) continue; // punctuation pseudo-entries
      const reading = decodeKey(key);
      if (!reading) { skipped++; continue; }
      const toks = value.split(" ");
      if (toks.length % 2 !== 0) { skipped++; continue; }
      let parsed = 0;
      for (let i = 0; i + 1 < toks.length; i += 2) {
        const word = toks[i];
        const score = Number.parseFloat(toks[i + 1]);
        // MACRO@... entries are date/time templates handled separately by the
        // input controller, not dictionary words.
        if (!word || word.startsWith("MACRO@") || !Number.isFinite(score)) continue;
        lm.push([reading, word, score]);
        parsed++;
      }
      if (!parsed) skipped++;
    }
    // Cap candidates per reading. A single-syllable reading carries every
    // character read that way, so this is where a character can be lost
    // entirely: past the cap it is in no file the engine reads, and no
    // keystroke will offer it.
    //
    // Two things about the number, both measured rather than assumed:
    //
    //   * The cap cuts inside a block of tied scores. 15 readings go over it
    //     (deepest 236), and in every one the 100th and 101st entries carry the
    //     same score (-7.904, the floor the upstream data gives a character it
    //     has no frequency for). So the 100/101 line is arbitrary, not a
    //     judgement that the first hundred are more common.
    //   * The original justification was file size and grid-search time. Both
    //     were measured: lifting the cap entirely adds 12,769 bytes (+0.20%),
    //     and load time stays inside run-to-run noise.
    //
    // 200 matches CANDIDATE_CAP, the engine's own limit on how many candidates
    // it will ever ask for, so the data now fills exactly what the engine can
    // use. Going higher buys 38 more characters; the numbers are in
    // research/tools/cap-raise-trial.mjs.
    //
    // The cap counts *distinct words*, not rows. Rows were the old unit and it
    // mattered: ㄧˋ carries 236 rows but only 221 distinct characters, and with a
    // row-counted cap fifteen of its hundred slots went to duplicates that the
    // engine would have collapsed anyway — the characters they displaced (㑊 and
    // 㔴, which rank 99th and 100th by score) were then in no file at all.
    const MAX_PER_READING = Number(process.env.PINGZHU_MAX_CANDIDATES ?? 200);
    const byReading = new Map();
    for (const row of lm) {
      const list = byReading.get(row[0]);
      if (list) list.push(row); else byReading.set(row[0], [row]);
    }
    const kept = [];
    let dropped = 0;
    let duplicates = 0;
    for (const list of byReading.values()) {
      list.sort((a, b) => b[2] - a[2]);
      const seen = new Set();
      const distinct = [];
      for (const row of list) {
        if (seen.has(row[1])) { duplicates++; continue; }
        seen.add(row[1]);
        distinct.push(row);
      }
      kept.push(...distinct.slice(0, MAX_PER_READING));
      dropped += Math.max(0, distinct.length - MAX_PER_READING);
    }
    lm.length = 0;
    for (const row of kept) lm.push(row); // spread would blow the stack at ~100k rows
    lm.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : b[2] - a[2]));

    const lmPath = join(here, "bopomofo-lm.tsv");
    writeFileSync(lmPath, "# reading<TAB>word<TAB>log10_prob\n" +
      lm.map(([r, w, s]) => `${r}\t${w}\t${s}`).join("\n") + "\n");

    // ---- per-syllable candidate characters, in frequency order ----
    const chars = [];
    for (const [key, value] of Object.entries(webDataPlain)) {
      if (key.startsWith("_")) continue;
      const reading = decodeKey(key);
      if (!reading) continue;
      const list = [];
      const toks = value.split(" ");
      for (let i = 0; i < toks.length; i += 2) {
        const ch = toks[i];
        if (ch && ch !== "0") list.push(ch);
      }
      if (list.length) chars.push([reading, list]);
    }
    chars.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    writeFileSync(join(here, "bopomofo-chars.tsv"),
      "# reading<TAB>candidates in frequency order\n" +
      chars.map(([r, l]) => `${r}\t${l.join(" ")}`).join("\n") + "\n");

    const stats = {
      source: "McBopomofo (openvanilla/McBopomofo, MIT) WebData/WebDataPlain",
      phrases: lm.length,
      distinct_readings: new Set(lm.map(([r]) => r)).size,
      syllables_with_chars: chars.length,
      total_chars: chars.reduce((n, [, l]) => n + l.length, 0),
      skipped_entries: skipped,
      dropped_low_probability: dropped,
      duplicate_rows_collapsed: duplicates,
      longest_word: lm.reduce((m, [, w]) => Math.max(m, w.length), 0),
    };
    writeFileSync(join(here, "stats.json"), JSON.stringify(stats, null, 2) + "\n");
    console.log(JSON.stringify(stats, null, 2));

    // self-check: strings every Taiwanese IME user knows.
    //
    // These have to be words the upstream data actually carries. "台灣注音"
    // does not (it is in neither WebData nor the phrase list it descends from),
    // so it printed MISSING on every single build — a false alarm that reads as
    // a broken build. Keep every entry checkable against the vendor source.
    const idx = new Map(lm.map(([r, w, s]) => [`${r}\t${w}`, s]));
    const check = (reading, word) =>
      console.log(`  ${reading} ${word} -> ${idx.has(`${reading}\t${word}`) ? idx.get(`${reading}\t${word}`) : "MISSING"}`);
    console.log("self-check (decoded readings must be valid bopomofo):");
    check("ㄋㄧˇ-ㄏㄠˇ", "你好");
    check("ㄨㄛˇ-ㄞˋ-ㄋㄧˇ", "我愛你");
    check("ㄩㄥˋ-ㄗㄞˋ", "用在");
    check("ㄊㄞˊ-ㄨㄢ", "台灣");
    check("ㄊㄞˊ-ㄨㄢ-ㄆㄧˊ-ㄐㄧㄡˇ", "台灣啤酒");
    check("ㄓㄨˋ-ㄧㄣ", "注音");
  })();
}

main();
