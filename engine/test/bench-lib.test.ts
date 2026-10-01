/**
 * Test-set construction tests.
 *
 * The benchmark samples multi-syllable words from the language model and types
 * them back. Its numbers are quoted as the decoder's quality, so a case the
 * keystrokes cannot express does not stay a private quirk of the harness — it
 * gets read as a decoder miss. These tests pin the property that keeps that from
 * happening: every case the sample keeps must survive the trip through the
 * keyboard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadDictionary, loadSyllableInventory } from "../src/node-data.ts";
import { InputEngine } from "../src/engine.ts";
import { buildTestSet, readingToKeys } from "../bench-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "..", "data", "bopomofo-lm.tsv");
const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);

/** The reading the engine reaches from a keystroke stream. */
function engineReading(keystrokes) {
  const engine = new InputEngine(dict, inventory, { layout: "standard" });
  for (const ch of keystrokes) engine.press(ch);
  const path = engine.chosenPath;
  return path && path.nodes.length ? path.nodes.map((n) => n.entry.reading).join("-") : null;
}

test("every sampled case is one the keyboard can actually spell", () => {
  const cases = buildTestSet(3000, 20260926);
  assert.ok(cases.length > 2000, `sample looks truncated: ${cases.length}`);

  const unreachable = cases.filter((c) => engineReading(c.keystrokes) !== c.reading);
  assert.deepEqual(
    unreachable.map((c) => `${c.word} (${c.reading})`),
    [],
    "a case whose reading the keystrokes cannot express scores the decoder " +
      "against a word it was never given",
  );
});

test("keystrokes carry no syllable boundary, and the sample accounts for it", () => {
  // ㄕ-ㄨˋ and ㄕㄨˋ are the same sound, and the keystroke stream says only the
  // sound: both spell "gj4". A language model may hold entries under either
  // spelling, so the two collapse onto one another and only one of them can be
  // typed. This is the shape that produced unscoreable cases.
  assert.equal(readingToKeys("ㄕ-ㄨˋ"), readingToKeys("ㄕㄨˋ"));
  assert.equal(engineReading(readingToKeys("ㄕ-ㄨˋ")), "ㄕㄨˋ");

  const cases = buildTestSet(3000, 20260926);
  const collapsed = cases.filter((c) => c.reading.split("-").length !== engineReading(c.keystrokes).split("-").length);
  assert.deepEqual(collapsed, [], "a reading that changes shape in transit must not be kept");
});
