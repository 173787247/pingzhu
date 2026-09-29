/**
 * Engine tests. These are not smoke tests: every case below is a string a
 * Taiwanese user would actually type, and the ambiguous ones are the reason a
 * language model is required at all.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadDictionary, loadSyllableInventory } from "../src/node-data.ts";
import { InputEngine } from "../src/engine.ts";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "..", "data", "bopomofo-lm.tsv");

const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);

function type(keys: string, layout = "standard") {
  const engine = new InputEngine(dict, inventory, { layout });
  for (const ch of keys) engine.press(ch);
  return engine;
}

test("dictionary loads the compiled language model", () => {
  assert.ok(dict.size > 100_000, `expected >100k entries, got ${dict.size}`);
  assert.ok(inventory.size > 1_200, `expected >1200 legal syllables, got ${inventory.size}`);
  assert.equal(dict.lookup("ㄋㄧˇ-ㄏㄠˇ")[0].word, "你好");
});

test("su3cl3 decodes to 你好", () => {
  const engine = type("su3cl3");
  assert.equal(engine.composing, "ㄋㄧˇ ㄏㄠˇ");
  assert.equal(engine.bestSentence, "你好");
});

test("ji394su3 decodes to 我愛你, not the legal-but-wrong 我奈以", () => {
  const engine = type("ji394su3");
  assert.equal(engine.composing, "ㄨㄛˇ ㄞˋ ㄋㄧˇ");
  assert.equal(engine.bestSentence, "我愛你");
});

test("w96j0 decodes to 台灣", () => {
  const engine = type("w96j0");
  assert.equal(engine.bestSentence, "台灣");
});

test("一聲 needs no tone key: ㄐㄧㄣ ㄊㄧㄢ -> 今天", () => {
  const engine = type("rupwu0"); // r=ㄐ u=ㄧ p=ㄣ | w=ㄊ u=ㄧ 0=ㄢ
  assert.equal(engine.composing, "ㄐㄧㄣ ㄊㄧㄢ");
  assert.equal(engine.bestSentence, "今天");
});

test("unfinished syllable stays pending instead of guessing", () => {
  const engine = type("su3c");
  assert.equal(engine.bestSentence, "你");
  assert.equal(engine.composing, "ㄋㄧˇ [ㄏ]");
  assert.equal(engine.backspace(), true);
  assert.equal(engine.composing, "ㄋㄧˇ");
});

test("candidates for the last syllable are ranked and usable", () => {
  const engine = type("su3");
  assert.ok(engine.candidates.length > 1);
  assert.equal(engine.candidates[0].word, "你");
  const out = engine.choose(0);
  assert.equal(out, "你");
  assert.equal(engine.isComposing(), false);
});

test("multi-syllable words beat character-by-character decoding", () => {
  const engine = type("ji394su3");
  const path = engine.bestSentence;
  assert.equal(path.length, 3);
  // A character-only decoder would emit three separate single characters with a
  // far worse combined score; assert the model actually preferred one word.
  assert.ok(engine.bestScore > -9, `score ${engine.bestScore} suggests no phrase was used`);
});

test("backspace rewinds the buffer one key at a time", () => {
  const engine = type("su3cl3");
  engine.backspace();
  assert.equal(engine.rawKeys, "su3cl");
  engine.backspace();
  assert.equal(engine.rawKeys, "su3c");
  assert.equal(engine.bestSentence, "你");
});

test("commit() empties the composer", () => {
  const engine = type("su3cl3");
  assert.equal(engine.commit(), "你好");
  assert.equal(engine.isComposing(), false);
  assert.equal(engine.bestSentence, "");
});

test("倚天 layout reaches the same result by a different path", () => {
  // ETen: n=ㄋ, e=ㄧ, 3=ˇ -- this asserts the layout table is wired in, not that
  // ETen is feature complete (Hsu/ETen26 are still to be ported).
  const engine = type("ne3", "eten");
  assert.equal(engine.composing, "ㄋㄧˇ");
  assert.equal(engine.bestSentence, "你");
});

// ------------------------------------------------------- keystroke order

test("components may not be reordered inside a syllable", () => {
  // "jptjp6" is ㄨㄣ then ㄔㄨㄣˊ. Without an order check the grid composes the
  // bag [ㄨ ㄣ ㄔ] into ㄔㄨㄣ -- the ㄔ jumps in front of the ㄨ -- and the engine
  // answered ㄔㄨㄣ-ㄨㄣˊ, a reading nobody typed.
  const engine = type("jptjp6");
  assert.equal(engine.composing, "ㄨㄣ ㄔㄨㄣˊ");
  assert.equal(engine.bestSentence, "溫純");
});

test("a tone key cannot migrate to the next syllable", () => {
  // "j0420" is ㄨㄢˋ then ㄉㄢ. Composing the bag [ˋ ㄉ ㄢ] into ㄉㄢˋ moved the
  // tone off the first syllable and made 萬丹 unreachable entirely.
  const engine = type("j0420");
  assert.equal(engine.composing, "ㄨㄢˋ ㄉㄢ");
  assert.equal(engine.bestSentence, "萬丹");
});

test("˙ is accepted before its syllable, the traditional written order", () => {
  assert.equal(type("2k7").bestSentence, "的"); // tone last
  const neutralFirst = type("72k");
  assert.equal(neutralFirst.composing, "ㄉㄜ˙");
  assert.equal(neutralFirst.bestSentence, "的");
});

test("a bare tone key is not a syllable", () => {
  const engine = type("4");
  assert.equal(engine.bestSentence, "");
  // The brackets render bopomofo, not the key that produced it. A digit sitting
  // inside a syllable line meant nothing to anyone who had not read the decoder;
  // `ㄕㄨ [ㄉ]` says the same thing in the alphabet the rest of the line uses.
  assert.equal(engine.composing, "[ˋ]");
});
