#!/usr/bin/env node
/**
 * Dump interaction scenarios the Rust core must reproduce.
 *
 * `fixture.tsv` covers decoding: keys in, sentence and candidates out. This file
 * covers the *stateful* half — the part a shell's key router depends on, and the
 * part most likely to drift between two implementations:
 *
 *   - digits are bopomofo keys until the candidate window is open
 *   - space opens the window, then pages through it
 *   - arrows open it too, and move along the buffer
 *   - typing or backspace closes it again
 *   - selecting commits and teaches the user dictionary
 *
 * usage: node dump-scenarios.mjs > ../core-rs/tests/scenarios.tsv
 *
 * Columns: ops, sentence, composing, open, page, committed
 * `ops` is space-separated: k:X feed key X, space, open, close, left, right,
 * bs, sel:N, enter.
 */
import { loadDictionary, loadSyllableInventory } from "./src/node-data.ts";
import { InputEngine } from "./src/engine.ts";
import { UserDictionary } from "./src/userdict.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "data", "bopomofo-lm.tsv");
const DAY = 20_000;

const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);

/**
 * Key strings worth poking at, chosen for the behaviour they exercise.
 *
 * `ru04gk4` covers the shape the others miss: a word the *second* syllable
 * creates. On its own, ru04 is ㄐㄧㄢˋ — 建, 見, 件 and 健 all read that way, and
 * the model picks one of them without any way to know which was meant. Typing
 * gk4 after it turns the two syllables into ㄐㄧㄢˋ-ㄕㄜˋ, which the language
 * model holds as a single entry, so the buffer rereads itself as 建設.
 *
 * The failure this guards against is not a wrong pick — it is a decoder that
 * commits early. If the first syllable were settled when it was completed,
 * the second one could never reconsider it, and 建設 would be unreachable
 * however good the candidate list looked.
 */
const SUBJECTS = [
  "su3cl3", "ji394su3", "tj4g/", "u6tp6", "j0420", "g4", "su3", "su3c",
  "ru04gk4",
];

/** Action scripts appended after typing the subject. */
const SCRIPTS = [
  [],
  ["sel:1"],
  ["sel:3"],
  ["space"],
  ["space", "sel:1"],
  ["space", "space"],
  ["space", "space", "sel:1"],
  ["open", "sel:2"],
  ["open", "close", "sel:1"],
  ["open", "k:g"],
  ["open", "bs"],
  ["right"],
  ["right", "left", "left"],
  ["left"],
  ["open", "right", "sel:1"],
  ["enter"],
  ["space", "space", "space", "space"],
  ["open", "sel:10"],
  ["open", "sel:11"],
];

const rows = [];
for (const subject of SUBJECTS) {
  for (const script of SCRIPTS) {
    const userDict = new UserDictionary({ today: () => DAY });
    const engine = new InputEngine(dict, inventory, { layout: "standard", userDictionary: userDict });
    const committed = [];
    let ops = [];

    for (const ch of subject) {
      engine.press(ch);
      ops.push(`k:${ch}`);
    }
    for (const op of script) {
      ops.push(op);
      if (op.startsWith("k:")) engine.press(op.slice(2));
      else if (op === "space") engine.nextCandidatePage();
      else if (op === "open") engine.openCandidateWindow();
      else if (op === "close") engine.closeCandidateWindow();
      else if (op === "left") engine.moveCandidateCursor(-1);
      else if (op === "right") engine.moveCandidateCursor(1);
      else if (op === "bs") engine.backspace();
      else if (op === "enter") committed.push(engine.commit());
      else if (op.startsWith("sel:")) {
        const out = engine.selectCandidate(Number(op.slice(4)));
        if (out) committed.push(out);
      }
    }

    const page = engine.candidatePage.entries.map((e) => e.word).join("|");
    rows.push([
      ops.join(" "),
      engine.bestSentence,
      engine.composing,
      engine.candidateWindowOpen ? "1" : "0",
      page,
      committed.join("␟"),
    ].join("\t"));
  }
}

process.stderr.write(`scenarios: ${rows.length} (${SUBJECTS.length} subjects × ${SCRIPTS.length} scripts)\n`);
process.stdout.write(rows.join("\n") + "\n");
