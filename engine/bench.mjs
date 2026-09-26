#!/usr/bin/env node
/**
 * Benchmark harness — decoding quality.
 *
 * Measures the numbers that decide whether a phonetic IME is usable:
 *
 *   top-1 accuracy   — how often the auto-selected sentence is the intended one
 *   reading accuracy — how often the output at least reads as typed
 *   KSPC             — keystrokes per character (lower is faster to type)
 *
 * usage:
 *   node bench.mjs [sampleSize] [--seed N]     one configuration
 *   node bench.mjs [sampleSize] --promote      force promotion on (it is the default)
 *   node bench.mjs [sampleSize] --no-promote   force it off
 *   node bench.mjs [sampleSize] --compare      off vs on, case by case
 *
 * See bench-lib.mjs for the sample construction and bench-learn.mjs for how much
 * the user dictionary buys.
 */
import { buildTestSet, runCases, NOTE } from "./bench-lib.mjs";

const sampleSize = Number(process.argv[2] ?? 3000);
const seedArg = process.argv.indexOf("--seed");
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 20260926;
const compare = process.argv.includes("--compare");
const cases = buildTestSet(sampleSize, seed);

if (compare) {
  const off = runCases(cases, { promote: false });
  const on = runCases(cases, { promote: true });
  let fixed = 0, regressed = 0;
  for (let i = 0; i < off.verdicts.length; i++) {
    if (!off.verdicts[i] && on.verdicts[i]) fixed++;
    if (off.verdicts[i] && !on.verdicts[i]) regressed++;
  }
  console.log(`promotion A/B on ${off.evaluated} readings, seed ${seed}\n`);
  console.log(`                        off        on`);
  console.log(`  top-1 accuracy    ${off.accuracy.toFixed(2).padStart(7)}%  ${on.accuracy.toFixed(2).padStart(7)}%`);
  console.log(`  lost to decomp    ${String(off.lostToDecomposition).padStart(7)}   ${String(on.lostToDecomposition).padStart(7)}`);
  console.log(`  homophone ties    ${String(off.homophoneTies).padStart(7)}   ${String(on.homophoneTies).padStart(7)}`);
  console.log(`\n  fixed by promotion     ${fixed}`);
  console.log(`  REGRESSED by promotion ${regressed}   <- the number that decides whether to default it on`);
  console.log(`  net                    ${fixed - regressed >= 0 ? "+" : ""}${fixed - regressed}`);
} else {
  const promote = process.argv.includes("--no-promote")
    ? false
    : process.argv.includes("--promote") ? true : undefined;
  const r = runCases(cases, { promote });
  const effective = promote ?? true;
  console.log(`benchmark: ${r.evaluated} sampled readings (${r.skipped} untypeable, skipped)`);
  console.log(`  promotion         ${effective ? "ON   (a word may not lose to its own decomposition)" : "off"}`);
  console.log(`  top-1 accuracy    ${r.accuracy.toFixed(2)}%   (${r.correct}/${r.evaluated})  exact word match`);
  console.log(`  reading accuracy  ${r.readingAccuracy.toFixed(2)}%   (${r.readingCorrect}/${r.evaluated})  output reads as typed`);
  console.log(`    homophone ties        ${r.homophoneTies}   (another real word, same reading — needs context)`);
  console.log(`    lost to decomposition ${r.lostToDecomposition}   (a word existed and lost to single characters)`);
  console.log(`  KSPC              ${r.ksPC.toFixed(3)} keys per character`);
  console.log(`  decode time       ${r.usPerCase.toFixed(1)} µs per case`);
  console.log(`  corpus            ${r.evaluated} readings, seed ${seed}`);
  console.log("\n  'lost to decomposition' is the actionable number — those are scoring defects and");
  console.log("  promotion targets them. Homophone ties are the ceiling of a context-free decoder");
  console.log("  and need a bigram/context model, not a scoring tweak.");
  console.log(NOTE.join("\n"));
  if (r.failures.length) {
    console.log("\n  sample failures:");
    for (const f of r.failures) console.log(`    ${f.reading}  want ${f.want}  got ${f.got}`);
  }
}
