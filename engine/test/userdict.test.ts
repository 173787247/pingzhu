/**
 * User dictionary and learning tests.
 *
 * The cases are chosen from the benchmark's actual failure list, not invented:
 * 畜牲/畜生 is a real homophone pair in the shipped dictionary where the model
 * prefers 畜生, and 平注 does not exist in the model at all. If learning cannot
 * flip the first and reach the second, M2 has not been delivered.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { loadDictionary, loadSyllableInventory } from "../src/node-data.ts";
import { InputEngine } from "../src/engine.ts";
import { UserDictionary } from "../src/userdict.ts";
import { loadUserDictionary, saveUserDictionary } from "../src/node-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "..", "data", "bopomofo-lm.tsv");

const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);

const DAY = 20_000;

function type(keys: string, engine: InputEngine) {
  engine.reset();
  for (const ch of keys) engine.press(ch);
  return engine;
}

// ------------------------------------------------------------------ scoring

test("a freshly taught word gets the top tier", () => {
  const ud = new UserDictionary({ today: () => DAY });
  ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
  assert.equal(ud.bonusFor("畜牲", "ㄔㄨˋ-ㄕㄥ"), ud.options.bonusNew);
});

test("bonus decays by recency but never to nothing", () => {
  const ud = new UserDictionary({ today: () => DAY });
  ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
  const r = "ㄔㄨˋ-ㄕㄥ";

  // still inside the "newly learned" window
  assert.equal(ud.bonusFor("畜牲", r, DAY + 3), ud.options.bonusNew);
  // past it, into the mid tier
  assert.equal(ud.bonusFor("畜牲", r, DAY + 20), ud.options.bonusMid);
  // long unused: lowest tier, but still a real bonus — we do not forget a
  // correction just because it has not come up in two months
  const old = ud.bonusFor("畜牲", r, DAY + 400);
  assert.equal(old, ud.options.bonusOld);
  assert.ok(old > 1.0, `an old user word must still beat the model, got ${old}`);
});

test("repeated use reinforces, and the cap holds", () => {
  const ud = new UserDictionary({ today: () => DAY });
  const r = "ㄔㄨˋ-ㄕㄥ";
  ud.record("畜牲", r);
  const once = ud.bonusFor("畜牲", r);
  ud.record("畜牲", r);
  assert.ok(ud.bonusFor("畜牲", r) > once, "second use should reinforce");
  for (let i = 0; i < 50; i++) ud.record("畜牲", r);
  assert.equal(ud.bonusFor("畜牲", r), ud.options.bonusCap);
});

test("unknown words have no bonus", () => {
  const ud = new UserDictionary({ today: () => DAY });
  assert.equal(ud.bonusFor("沒學過", "ㄇㄟˊ-ㄒㄩㄝˊ-ㄍㄨㄛˋ"), 0);
});

// -------------------------------------------------------------- persistence

test("user dictionary survives a text round trip", () => {
  const ud = new UserDictionary({ today: () => DAY });
  ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
  ud.record("畜牲", "ㄔㄨˋ-ㄕㄥ");
  ud.record("平注", "ㄆㄧㄥˊ-ㄓㄨˋ");
  const text = ud.toText();
  const back = UserDictionary.fromText(text, { today: () => DAY });

  assert.equal(back.size, 2);
  assert.equal(back.get("畜牲", "ㄔㄨˋ-ㄕㄥ")?.count, 2);
  assert.equal(back.get("平注", "ㄆㄧㄥˊ-ㄓㄨˋ")?.count, 1);
  assert.equal(back.bonusFor("畜牲", "ㄔㄨˋ-ㄕㄥ"), ud.bonusFor("畜牲", "ㄔㄨˋ-ㄕㄥ"));
});

test("save/load hits the disk and forget() removes", () => {
  const path = join(tmpdir(), `pingzhu-userdict-${process.pid}.txt`);
  try {
    const ud = new UserDictionary({ today: () => DAY });
    ud.record("平注", "ㄆㄧㄥˊ-ㄓㄨˋ");
    saveUserDictionary(ud, path);
    const back = loadUserDictionary(path, { today: () => DAY });
    assert.equal(back.size, 1);
    assert.ok(back.forget("平注", "ㄆㄧㄥˊ-ㄓㄨˋ"));
    assert.equal(back.size, 0);
    assert.equal(back.forget("平注", "ㄆㄧㄥˊ-ㄓㄨˋ"), false);
  } finally {
    rmSync(path, { force: true });
  }
});

// ----------------------------------------------------------------- learning

test("the model prefers 畜生, and teaching flips it to 畜牲", () => {
  const plain = new InputEngine(dict, inventory, { layout: "standard" });
  assert.equal(type("tj4g/", plain).bestSentence, "畜生");

  const ud = new UserDictionary({ today: () => DAY });
  const engine = new InputEngine(dict, inventory, { layout: "standard", userDictionary: ud });
  type("tj4g/", engine);
  const idx = engine.candidatesAt(0, 9).findIndex((e) => e.word === "畜牲");
  assert.ok(idx >= 0, "畜牲 must be reachable in the candidate window");
  engine.chooseAt(0, idx);

  assert.equal(ud.get("畜牲", "ㄔㄨˋ-ㄕㄥ")?.count, 1, "selection should have been learned");
  assert.equal(type("tj4g/", engine).bestSentence, "畜牲");
});

test("a word the model has never seen becomes typeable", () => {
  const ud = new UserDictionary({ today: () => DAY });
  const engine = new InputEngine(dict, inventory, { layout: "standard", userDictionary: ud });
  const reading = "ㄆㄧㄥˊ-ㄓㄨˋ";

  assert.equal(dict.lookup(reading).some((e) => e.word === "平注"), false,
    "precondition: 平注 must not be in the shipped model");
  ud.record("平注", reading);
  assert.equal(type("qu/65j4", engine).bestSentence, "平注");
});

test("chooseAt returns the whole sentence, not just the picked word", () => {
  const ud = new UserDictionary({ today: () => DAY });
  const engine = new InputEngine(dict, inventory, { layout: "standard", userDictionary: ud });
  type("tj4g/", engine);
  const idx = engine.candidatesAt(0, 9).findIndex((e) => e.word === "畜牲");
  assert.equal(engine.chooseAt(0, idx), "畜牲");
  assert.equal(engine.isComposing(), false, "choosing commits and clears the buffer");
});

test("commit() alone does not teach by default, and does when asked", () => {
  const quiet = new UserDictionary({ today: () => DAY });
  const e1 = new InputEngine(dict, inventory, { layout: "standard", userDictionary: quiet });
  type("tj4g/", e1).commit();
  assert.equal(quiet.size, 0, "an auto-selected homophone is not evidence of intent");

  const loud = new UserDictionary({ today: () => DAY });
  const e2 = new InputEngine(dict, inventory, {
    layout: "standard", userDictionary: loud, learnFromCommit: true,
  });
  type("tj4g/", e2).commit();
  assert.equal(loud.size, 1);
});

// ---------------------------------------------------------------- promotion

test("a word no longer loses to a decomposition of its own span", () => {
  // ㄧˊ-ㄔㄣˊ has exactly one dictionary word, 遺臣 (-6.694), and the engine used
  // to output 一陳 (-6.56) by spelling the same sounds with single characters.
  const engine = new InputEngine(dict, inventory, { layout: "standard" });
  assert.equal(type("u6tp6", engine).composing, "ㄧˊ ㄔㄣˊ");
  assert.equal(engine.bestSentence, "遺臣");

  const off = new InputEngine(dict, inventory, {
    layout: "standard", promoteWordsOverDecomposition: false,
  });
  assert.equal(type("u6tp6", off).bestSentence, "一陳",
    "the escape hatch must still reproduce the old behaviour");
});

test("promotion does not override an explicit user choice", () => {
  const ud = new UserDictionary({ today: () => DAY });
  const engine = new InputEngine(dict, inventory, { layout: "standard", userDictionary: ud });
  ud.record("一陳", "ㄧˊ-ㄔㄣˊ");
  assert.equal(type("u6tp6", engine).bestSentence, "一陳");
});
