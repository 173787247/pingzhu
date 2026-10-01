/**
 * Shared pieces of the benchmark harnesses.
 *
 * Kept separate from bench.mjs / bench-learn.mjs so both measure the *same*
 * sample with the same keystroke generation. If the two harnesses drifted apart,
 * their numbers would stop being comparable, which is the whole point of having
 * them.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadDictionary, loadSyllableInventory } from "./src/node-data.ts";
import { InputEngine } from "./src/engine.ts";
import { STANDARD_LAYOUT } from "./src/keyboard.ts";
import { splitReading } from "./src/syllable.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const LM = join(here, "..", "data", "bopomofo-lm.tsv");

export const dict = loadDictionary(LM);
export const inventory = loadSyllableInventory(LM);

/** reverse of the keyboard table: component -> key */
const componentToKey = new Map();
for (const [key, comps] of STANDARD_LAYOUT.keyToComponents) {
  for (const c of comps) {
    const id = `${c.kind}:${c.index}`;
    if (!componentToKey.has(id)) componentToKey.set(id, key);
  }
}

/**
 * Turn a bopomofo reading into the keystrokes a 大千式 user would press.
 * 一聲 has no key, exactly as on a real keyboard. Returns null for readings that
 * cannot be typed at all.
 */
export function readingToKeys(reading) {
  let out = "";
  for (const syllable of splitReading(reading)) {
    for (const ch of syllable) {
      let id = null;
      if (/[ˊˇˋ˙]/.test(ch)) {
        id = `tone:${"ˊˇˋ˙".indexOf(ch) + 1}`;
      } else {
        const tables = [
          ["consonant", "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ"],
          ["medial", "ㄧㄨㄩ"],
          ["vowel", "ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ"],
        ];
        for (const [k, table] of tables) {
          const idx = table.indexOf(ch);
          if (idx >= 0) { id = `${k}:${idx + 1}`; break; }
        }
      }
      const key = id && componentToKey.get(id);
      if (!key || key === " ") return null;
      out += key;
    }
  }
  return out;
}

const CJK = /^[\u3400-\u9fff]+$/;

/**
 * Reservoir-sample multi-syllable CJK words from the language model, then
 * precompute their keystrokes.
 *
 * Sampling from the model makes this self-consistency rather than a head-to-head
 * measurement — see the note each harness prints.
 */
export function buildTestSet(sampleSize, seed) {
  let state = seed;
  const rnd = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  const lines = readFileSync(LM, "utf8").split("\n");
  const picked = [];
  let seen = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const t1 = line.indexOf("\t");
    const t2 = line.indexOf("\t", t1 + 1);
    if (t1 < 0 || t2 < 0) continue;
    const reading = line.slice(0, t1);
    const word = line.slice(t1 + 1, t2);
    const syllables = splitReading(reading);
    // Single-syllable entries belong here too. They are where character
    // frequency decides the answer outright — the reading ㄐㄧㄢˋ offers 建, 見,
    // 件 and 健 with nothing else to go on — and a sample that skipped them
    // could not tell whether a change to character frequency helped or hurt,
    // which is the one thing such a change is supposed to affect.
    if (syllables.length < 1 || syllables.length > 4) continue;
    if (!CJK.test(word) || word.length !== syllables.length) continue;
    seen++;
    if (picked.length < sampleSize) picked.push({ reading, word });
    else {
      const j = Math.floor(rnd() * seen);
      if (j < sampleSize) picked[j] = { reading, word };
    }
  }
  for (const c of picked) c.keystrokes = readingToKeys(c.reading);
  // A reading and its keystrokes are not one-to-one: the keystroke stream carries
  // no syllable boundary, so a model entry read ㄕ-ㄨˋ arrives as ㄕㄨˋ — the two
  // are the same sound — and the engine is right to decode it that way. Scoring
  // such a case against the word its reading names asks for something the
  // keystrokes cannot express, which reads as a decoder miss and is really a
  // harness artifact. Keep only cases whose reading survives the round trip.
  return picked.filter((c) => decodeReading(c.keystrokes) === c.reading);
}

/**
 * The reading the engine will actually see for a keystroke stream.
 *
 * Not the inverse of `readingToKeys` — it cannot be, and that is the point.
 * Keystrokes do not record where one syllable stopped, so this is the engine's
 * own reading of the stream, which is the only one a test may assert against.
 */
function decodeReading(keystrokes) {
  const engine = new InputEngine(dict, inventory, { layout: "standard" });
  for (const ch of keystrokes) engine.press(ch);
  const path = engine.chosenPath;
  if (!path || !path.nodes.length) return null;
  return path.nodes.map((n) => n.entry.reading).join("-");
}

/** Decode every case once under one engine configuration. */
export function runCases(cases, options = {}) {
  const engine = new InputEngine(dict, inventory, {
    layout: "standard",
    promoteWordsOverDecomposition: options.promote,
    learnFromCommit: options.learnFromCommit ?? false,
    userDictionary: options.userDictionary,
  });
  const verdicts = [];
  let correct = 0, readingCorrect = 0, homophoneTies = 0, lostToDecomposition = 0;
  let skipped = 0, keys = 0, chars = 0;
  const failures = [];
  const t0 = process.hrtime.bigint();

  for (const c of cases) {
    if (!c.keystrokes) { skipped++; continue; }
    engine.reset();
    for (const ch of c.keystrokes) engine.press(ch);
    const got = engine.bestSentence;
    keys += c.keystrokes.length;
    chars += c.word.length;
    if (got === c.word) {
      correct++; readingCorrect++; verdicts.push(true);
    } else if (!engine.usedFallback) {
      readingCorrect++;
      const path = engine.chosenPath;
      const wholeWord = path && path.nodes.length === 1
        && path.nodes[0].entry.reading === c.reading;
      if (wholeWord) homophoneTies++;
      else {
        lostToDecomposition++;
        if (failures.length < 10) failures.push({ reading: c.reading, want: c.word, got });
      }
      verdicts.push(false);
    } else {
      if (failures.length < 10) failures.push({ reading: c.reading, want: c.word, got });
      verdicts.push(false);
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const evaluated = cases.length - skipped;
  return {
    evaluated, correct, readingCorrect, homophoneTies, lostToDecomposition, skipped,
    keys, chars, failures, verdicts,
    accuracy: (correct / evaluated) * 100,
    readingAccuracy: (readingCorrect / evaluated) * 100,
    ksPC: keys / chars,
    usPerCase: (elapsedMs / evaluated) * 1000,
  };
}

export const NOTE = [
  "  NOTE: sampled from the language model itself => self-consistency,",
  "        an upper bound and a regression guard, not a head-to-head number.",
];
