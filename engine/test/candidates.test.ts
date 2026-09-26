/**
 * Candidate window tests.
 *
 * The window is the answer to homophones: the engine does not have to guess right,
 * it has to offer the right word within a keystroke or two. These tests pin the
 * conventions — ten per page addressed by 1234567890, space for the next ten,
 * arrows to move along the buffer — because those are what a Taiwanese user
 * already has in their fingers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Dictionary, buildSyllableInventory } from "../src/dictionary.ts";
import { InputEngine, CANDIDATE_PAGE_SIZE } from "../src/engine.ts";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "..", "data", "bopomofo-lm.tsv");
const dict = Dictionary.load(LM);
const inventory = buildSyllableInventory(LM);

function type(keys, options = {}) {
  const engine = new InputEngine(dict, inventory, { layout: "standard", ...options });
  for (const ch of keys) engine.press(ch);
  return engine;
}

test("a page holds ten, addressed by 1234567890", () => {
  const engine = type("tj4g/"); // ㄔㄨˋ-ㄕㄥ
  const page = engine.candidatePage;
  assert.equal(CANDIDATE_PAGE_SIZE, 10);
  assert.ok(page.total > 10, `expected more than one page, got ${page.total}`);
  assert.equal(page.entries.length, 10);
  assert.equal(page.pageIndex, 0);
  assert.equal(page.hasMore, true);
  assert.equal(page.hasPrevious, false);
});

test("space moves on ten at a time and stops at the end", () => {
  const engine = type("tj4g/");
  const total = engine.candidatePage.total;
  let pages = 1;
  while (engine.nextCandidatePage()) pages++;
  assert.equal(pages, Math.ceil(total / CANDIDATE_PAGE_SIZE));
  assert.equal(engine.candidatePage.hasMore, false);
  assert.equal(engine.nextCandidatePage(), false, "already on the last page");

  // and back again
  while (engine.prevCandidatePage());
  assert.equal(engine.candidatePage.pageIndex, 0);
});

test("selectCandidate addresses the visible page, one-based", () => {
  const engine = type("tj4g/");
  const first = engine.candidatePage.entries[0].word;
  assert.equal(engine.selectCandidate(1), first);
  assert.equal(engine.isComposing(), false, "selecting commits");

  // selecting a candidate that does not cover the whole buffer still commits the
  // rest of it: picking the single character 怵 for ㄔㄨˋ leaves ㄕㄥ to decode,
  // so the returned sentence is 怵生, not 怵.
  const again = type("tj4g/");
  const tenth = again.candidatePage.entries[9].word;
  const committed = again.selectCandidate(10);
  assert.ok(committed.startsWith(tenth), `expected ${committed} to start with ${tenth}`);
});

test("selectCandidate rejects numbers off the page", () => {
  const engine = type("tj4g/");
  assert.equal(engine.selectCandidate(0), "");
  assert.equal(engine.selectCandidate(11), "");
  assert.equal(engine.selectCandidate(-1), "");
  assert.equal(engine.isComposing(), true, "a rejected selection changes nothing");
});

test("selecting from the second page picks the right word", () => {
  const engine = type("tj4g/");
  assert.ok(engine.nextCandidatePage());
  const target = engine.candidatePage.entries[0].word;
  assert.ok(engine.selectCandidate(1).startsWith(target));
});

test("the candidate window starts on the word still under the cursor", () => {
  const engine = type("su3cl3"); // 你好, one word covering both syllables
  assert.equal(engine.candidateCursor, 0);
  assert.equal(engine.candidatePage.entries[0].word, "你好");
});

test("arrow keys walk the window along the buffer", () => {
  const engine = type("su3cl3");
  assert.equal(engine.moveCandidateCursor(1), true);
  assert.equal(engine.candidateCursor, 1);
  assert.equal(engine.moveCandidateCursor(1), false, "already at the last syllable");
  assert.equal(engine.moveCandidateCursor(-1), true);
  assert.equal(engine.candidateCursor, 0);
  assert.equal(engine.moveCandidateCursor(-1), false);
});

test("the engine's own choice is on the first page", () => {
  // A window whose first page does not contain the sentence being displayed
  // would be incoherent. Under the default ordering it always does.
  for (const keys of ["su3cl3", "ji394su3", "tj4g/", "u6tp6", "w96j0"]) {
    const engine = type(keys);
    const shown = engine.bestSentence;
    const onPage1 = engine.candidatePage.entries.some((e) => shown.startsWith(e.word));
    assert.ok(onPage1, `${keys}: "${shown}" not reachable from page 1`);
  }
});

test("frequency ordering is still available and still frequency-ordered", () => {
  const engine = type("tj4g/", { candidateOrder: "frequency" });
  const scores = engine.candidatePage.entries.map((e) => e.score);
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i] <= scores[i - 1], "frequency order must be descending");
  }
});

test("same-span-first keeps homophone rivals together at the top", () => {
  const engine = type("tj4g/", { candidateOrder: "same-span-first" });
  const top2 = engine.candidatePage.entries.slice(0, 2).map((e) => e.word);
  assert.deepEqual(top2.sort(), ["畜生", "畜牲"].sort());
});
