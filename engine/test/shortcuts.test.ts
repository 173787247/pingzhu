/**
 * Shortcuts: a read-only phrase table appended to the language model.
 *
 * The design (docs/10-shortcuts-design.md) settles for the low-cost path: a phrase
 * is an extra entry in the same format with a score high enough to sort first. No
 * new ABI, no new UI, no shell changes. These tests hold that path to its promises.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Dictionary } from "../src/dictionary.ts";
import { InputEngine } from "../src/engine.ts";
import { loadDictionary, loadSyllableInventory } from "../src/node-data.ts";
import { UserDictionary } from "../src/userdict.ts";

const LM = fileURLToPath(new URL("../../data/bopomofo-lm.tsv", import.meta.url));
const SHORTCUTS = fileURLToPath(new URL("../../data/shortcuts.tsv", import.meta.url));

const inventory = loadSyllableInventory(LM);

function type(dict: Dictionary, keys: string): InputEngine {
  const engine = new InputEngine(dict, inventory, { layout: "standard" });
  for (const ch of keys) engine.press(ch);
  return engine;
}

test("a shortcut is the first candidate for its reading", () => {
  const dict = loadDictionary(LM, {}, SHORTCUTS);
  // 2u453 is ㄉㄧˋ-ㄓˇ, the reading of 地址.
  const engine = type(dict, "2u453");
  const page = engine.candidatePage.entries.map((e) => e.word);
  assert.ok(page.length > 0, "no candidates for the shortcut's reading");
  assert.equal(page[0], "台北市忠孝東路四段 100 號 5 樓");
  // The language model's own word for the same reading is still there, behind it.
  assert.ok(page.includes("地址"), `language model word disappeared: ${page.join("|")}`);
});

test("without the shortcuts file nothing changes", () => {
  const plain = loadDictionary(LM);
  const withShortcuts = loadDictionary(LM, {}, SHORTCUTS);
  assert.equal(type(plain, "2u453").bestSentence, "地址");
  assert.equal(type(withShortcuts, "2u453").bestSentence, "台北市忠孝東路四段 100 號 5 樓");
  // And an unrelated reading is untouched either way.
  assert.equal(type(plain, "su3cl3").bestSentence, "你好");
  assert.equal(type(withShortcuts, "su3cl3").bestSentence, "你好");
});

test("an empty phrase is rejected, not loaded as a blank candidate", () => {
  // A hand-edited file with a missing word must not produce a candidate that
  // inserts nothing — the user would pick it and watch the composition vanish.
  const dict = Dictionary.fromText("ㄉㄧˋ-ㄓˇ\t\t9\nㄉㄧˋ-ㄓˇ\t好地方\t9\n", "<test>");
  const words = dict.lookup("ㄉㄧˋ-ㄓˇ").map((e) => e.word);
  assert.deepEqual(words, ["好地方"]);
});

test("a shortcut survives being taught something else", () => {
  // Learning writes to the user dictionary, never to the phrase table. Picking
  // another candidate for the same reading must not remove the phrase.
  const dict = loadDictionary(LM, {}, SHORTCUTS);
  const userDict = UserDictionary.fromText("");
  const engine = new InputEngine(dict, inventory, {
    layout: "standard",
    userDictionary: userDict,
  });
  for (const ch of "2u453") engine.press(ch);
  engine.selectCandidate(2); // pick something other than the shortcut
  const again = type(dict, "2u453");
  assert.equal(again.candidatePage.entries[0].word, "台北市忠孝東路四段 100 號 5 樓");
});
