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
import { loadDictionary, loadSyllableInventory } from "../src/node-data.ts";
import { InputEngine, CANDIDATE_PAGE_SIZE } from "../src/engine.ts";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "..", "data", "bopomofo-lm.tsv");
const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);

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

test("space opens the window, then moves on ten at a time", () => {
  const engine = type("tj4g/");
  assert.equal(engine.candidateWindowOpen, false);

  // first space only opens; it does not skip the first page
  assert.equal(engine.nextCandidatePage(), true);
  assert.equal(engine.candidateWindowOpen, true);
  assert.equal(engine.candidatePage.pageIndex, 0);

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

test("digits compose until the candidate window is open", () => {
  // The whole point. On a 大千 keyboard 1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ, so a
  // digit that selected a candidate while composing would make su3cl3 untypeable.
  const engine = type("su3cl3");
  assert.equal(engine.bestSentence, "你好");
  assert.equal(engine.candidateWindowOpen, false);
  assert.equal(engine.selectCandidate(1), "", "digits must not select while composing");

  // open it, and the same key now selects
  assert.equal(engine.openCandidateWindow(), true);
  assert.equal(engine.candidateWindowOpen, true);
  const first = engine.candidatePage.entries[0].word;
  assert.equal(engine.selectCandidate(1), first);
});

test("typing closes the candidate window again", () => {
  const engine = type("tj4g/");
  engine.openCandidateWindow();
  assert.equal(engine.candidateWindowOpen, true);
  engine.press("g"); // back to composing
  assert.equal(engine.candidateWindowOpen, false);
  assert.equal(engine.selectCandidate(1), "");
});

test("a digit fed through press() still composes", () => {
  // The shell's key router feeds digits to press() unless the window is open;
  // this pins the engine half of that contract. `su3` is ㄋㄧˇ, so the extra `3`
  // is a second tone key with no syllable to land on: it must end up pending,
  // which is only possible if it composed instead of selecting.
  const engine = type("su3");
  assert.equal(engine.bestSentence, "你");
  assert.equal(engine.press("3"), true, "3 is a composing key");
  assert.equal(engine.composing, "ㄋㄧˇ [3]");
  assert.equal(engine.bestSentence, "你", "the buffer was not committed");
  assert.equal(engine.isComposing(), true);
});

test("selectCandidate addresses the visible page, one-based", () => {
  const engine = type("tj4g/");
  engine.openCandidateWindow();
  const first = engine.candidatePage.entries[0].word;
  assert.equal(engine.selectCandidate(1), first);
  assert.equal(engine.isComposing(), false, "selecting commits");

  // selecting a candidate that does not cover the whole buffer still commits the
  // rest of it: picking the single character 怵 for ㄔㄨˋ leaves ㄕㄥ to decode,
  // so the returned sentence is 怵生, not 怵.
  const again = type("tj4g/");
  again.openCandidateWindow();
  const tenth = again.candidatePage.entries[9].word;
  const committed = again.selectCandidate(10);
  assert.ok(committed.startsWith(tenth), `expected ${committed} to start with ${tenth}`);
});

test("selectCandidate rejects numbers off the page", () => {
  const engine = type("tj4g/");
  engine.openCandidateWindow();
  assert.equal(engine.selectCandidate(0), "");
  assert.equal(engine.selectCandidate(11), "");
  assert.equal(engine.selectCandidate(-1), "");
  assert.equal(engine.isComposing(), true, "a rejected selection changes nothing");
});

test("selecting from the second page picks the right word", () => {
  const engine = type("tj4g/");
  engine.openCandidateWindow();
  assert.ok(engine.nextCandidatePage());
  const target = engine.candidatePage.entries[0].word;
  assert.ok(engine.selectCandidate(1).startsWith(target));
});

test("the candidate window starts on the word still under the cursor", () => {
  const engine = type("su3cl3"); // 你好, one word covering both syllables
  assert.equal(engine.candidateCursor, 0);
  assert.equal(engine.candidatePage.entries[0].word, "你好");
});

test("arrow keys walk the window along the buffer, and open it", () => {
  const engine = type("su3cl3");
  assert.equal(engine.moveCandidateCursor(1), true);
  assert.equal(engine.candidateWindowOpen, true, "arrows imply the user is choosing");
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
