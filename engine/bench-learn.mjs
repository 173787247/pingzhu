#!/usr/bin/env node
/**
 * Does the user dictionary actually help?
 *
 * Top-1 accuracy on a cold start is the wrong question for an IME. Nobody types
 * a phrase once and walks away — they type the same names, the same jargon and
 * the same turns of phrase for years. The question that matters is:
 *
 *   **after the user corrects the engine once, does the correction stick?**
 *
 * This harness simulates exactly that:
 *
 *   1. baseline    decode every sampled reading with an empty user dictionary
 *   2. teach       for every case the engine got wrong, have the "user" open the
 *                  candidate window at the start of the word and pick the right
 *                  one — the same chooseAt() a real candidate window calls
 *   3. measure     decode everything again with the learned dictionary
 *
 * and reports how many cases were fixed, and — far more important — how many
 * were **regressed**. A learning mechanism that fixes 400 and breaks 50 is not a
 * win, and only a per-case comparison can see that.
 *
 * usage: node bench-learn.mjs [sampleSize] [--seed N] [--candidates N]
 */
import { buildTestSet, runCases, NOTE, dict as D, inventory as INV } from "./bench-lib.mjs";
import { InputEngine } from "./src/engine.ts";
import { UserDictionary } from "./src/userdict.ts";

const sampleSize = Number(process.argv[2] ?? 3000);
const seedArg = process.argv.indexOf("--seed");
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 20260926;
const candArg = process.argv.indexOf("--candidates");
const candidateDepth = candArg >= 0 ? Number(process.argv[candArg + 1]) : 20;

const cases = buildTestSet(sampleSize, seed);

// ------------------------------------------------------- optional: recall@N
// Explicit selection is only a practical answer to homophones if the word the
// user wants is on a page they can reach in a keystroke or two. This measures
// that directly, for cases the engine got wrong.
if (process.argv.includes("--recall")) {
  console.log(`candidate recall on ${cases.length} readings, seed ${seed}`);
  console.log(`1..9 then 0 select from the visible page; space moves on ten at a time\n`);
  console.log(`  order            wrong    #1     ≤10     ≤20     ≤30   unreachable`);
  for (const order of ["same-span-first", "longest-first", "frequency"]) {
    const engine = new InputEngine(D, INV, { layout: "standard", candidateOrder: order });
    let wrong = 0, at1 = 0, at10 = 0, at20 = 0, at30 = 0, unreachable = 0;
    for (const c of cases) {
      if (!c.keystrokes) continue;
      engine.reset();
      for (const ch of c.keystrokes) engine.press(ch);
      if (engine.bestSentence === c.word) continue;
      wrong++;
      const idx = engine.candidatesAt(0, 300).findIndex((e) => e.word === c.word);
      if (idx < 0) { unreachable++; continue; }
      if (idx === 0) at1++;
      if (idx < 10) at10++;
      if (idx < 20) at20++;
      if (idx < 30) at30++;
    }
    const pct = (n) => `${((n / wrong) * 100).toFixed(1)}%`.padStart(6);
    console.log(`  ${order.padEnd(15)} ${String(wrong).padStart(5)}  ${pct(at1)}  ${pct(at10)}  ${pct(at20)}  ${pct(at30)}   ${String(unreachable).padStart(9)}`);
  }
  console.log(`\n  "unreachable" = not offered at that position at all (bounded by the`);
  console.log(`  100-candidates-per-reading cap applied at data build time).`);
  process.exit(0);
}

// ---------------------------------------------------------------- 1. baseline
const baseline = runCases(cases, {});

// ------------------------------------------------------------------ 2. teach
const DAY = 20_000;
const userDict = new UserDictionary({ today: () => DAY });
const engine = new InputEngine(D, INV, { layout: "standard", userDictionary: userDict });

let taught = 0;
let unreachable = 0;
const unreachableExamples = [];
for (const c of cases) {
  if (!c.keystrokes) continue;
  engine.reset();
  for (const ch of c.keystrokes) engine.press(ch);
  if (engine.bestSentence === c.word) continue; // nothing to correct

  const idx = engine.candidatesAt(0, candidateDepth).findIndex((e) => e.word === c.word);
  if (idx < 0) {
    unreachable++;
    if (unreachableExamples.length < 5) {
      unreachableExamples.push(`${c.reading}  ${c.word}`);
    }
    continue;
  }
  engine.chooseAt(0, idx);
  taught++;
}

// --------------------------------------------------------------- 3. measure
const after = runCases(cases, { userDictionary: userDict });

let fixed = 0, regressed = 0, collisionRegressions = 0;
const genuineRegressions = [];
// How many sampled cases share a reading with another case that wants a different
// word. Teaching one of them necessarily breaks the other, so those regressions
// are a property of the sample, not of the learning mechanism.
const wordsPerReading = new Map();
for (const c of cases) {
  if (!wordsPerReading.has(c.reading)) wordsPerReading.set(c.reading, new Set());
  wordsPerReading.get(c.reading).add(c.word);
}
for (let i = 0; i < baseline.verdicts.length; i++) {
  if (!baseline.verdicts[i] && after.verdicts[i]) fixed++;
  if (baseline.verdicts[i] && !after.verdicts[i]) {
    regressed++;
    const rivals = wordsPerReading.get(cases[i].reading);
    if (rivals && rivals.size > 1) collisionRegressions++;
    else genuineRegressions.push(cases[i]);
  }
}

const delta = after.accuracy - baseline.accuracy;
console.log(`learning A/B on ${baseline.evaluated} readings, seed ${seed}`);
console.log(`candidate window depth: ${candidateDepth}\n`);
console.log(`                              before      after`);
console.log(`  top-1 accuracy          ${baseline.accuracy.toFixed(2).padStart(9)}%  ${after.accuracy.toFixed(2).padStart(9)}%`);
console.log(`  reading accuracy        ${baseline.readingAccuracy.toFixed(2).padStart(9)}%  ${after.readingAccuracy.toFixed(2).padStart(9)}%`);
console.log(`  lost to decomposition   ${String(baseline.lostToDecomposition).padStart(9)}   ${String(after.lostToDecomposition).padStart(9)}`);
console.log(`  homophone ties          ${String(baseline.homophoneTies).padStart(9)}   ${String(after.homophoneTies).padStart(9)}`);
console.log(`\n  words taught              ${taught}`);
console.log(`  not in candidate window   ${unreachable}   (the user could not have corrected these)`);
console.log(`  fixed by learning         ${fixed}`);
console.log(`  regressed by learning     ${regressed}`);
console.log(`    unavoidable collisions      ${collisionRegressions}   (the same reading was sampled wanting`);
console.log(`                                            two different words — a user cannot`);
console.log(`                                            have both, so one must lose)`);
console.log(`    genuine regressions         ${genuineRegressions.length}   <- must stay 0`);
for (const c of genuineRegressions.slice(0, 5)) {
  console.log(`        ${c.reading}  want ${c.word}`);
}
console.log(`  net                       ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} percentage points`);
if (unreachableExamples.length) {
  console.log("\n  examples never offered in the window:");
  for (const e of unreachableExamples) console.log(`    ${e}`);
}
console.log("\n" + NOTE.join("\n"));
