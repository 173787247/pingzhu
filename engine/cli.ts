#!/usr/bin/env node
/**
 * PingZhu CLI — a keystroke-level demo of the engine.
 *
 *   node cli.ts                  interactive: type bopomofo keys, watch it decode
 *   node cli.ts su3cl3 ji394su3  decode key strings non-interactively
 *   node cli.ts --layout eten …  use another keyboard layout
 *
 * Terminal keys:  Backspace = undo, Enter = commit line, Esc/Ctrl-C = quit.
 */
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Dictionary, buildSyllableInventory } from "./src/dictionary.ts";
import { InputEngine } from "./src/engine.ts";
import { LAYOUTS } from "./src/keyboard.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");
const LM = join(dataDir, "bopomofo-lm.tsv");

function loadEngine(layout: string) {
  const dict = Dictionary.load(LM);
  const inventory = buildSyllableInventory(LM);
  return { dict, inventory, engine: new InputEngine(dict, inventory, { layout }) };
}

function render(engine: InputEngine): string {
  const composing = engine.composing || "(empty)";
  const line = engine.bestSentence || "(nothing yet)";
  const cands = engine.candidates.map((c, i) => `${i + 1}.${c.word}`).join("  ");
  return `  keys      ${engine.rawKeys || "-"}\n` +
    `  注音      ${composing}\n` +
    `  → 中文    ${line}   (score ${engine.bestScore.toFixed(2)})\n` +
    `  候選      ${cands || "-"}`;
}

function runScripts(args: string[], layout: string): void {
  const { engine } = loadEngine(layout);
  for (const arg of args) {
    engine.reset();
    for (const ch of arg) engine.press(ch);
    console.log(`\n> ${arg}`);
    console.log(render(engine));
    const chosen = engine.bestCandidates.length ? engine.bestCandidates[0].word : engine.bestSentence;
    console.log(`  commit    ${engine.bestSentence || chosen}`);
  }
}

function runInteractive(layout: string): void {
  const { engine } = loadEngine(layout);
  const committed: string[] = [];
  console.log(`PingZhu 注音引擎 demo — layout: ${LAYOUTS[layout].label}`);
  console.log("Type 大千式 keys (try: su3cl3 = 你好, ji394su3 = 我愛你). Esc quits.\n");

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const draw = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    console.log(`PingZhu 注音引擎 — ${LAYOUTS[layout].label}`);
    console.log(`已輸入: ${committed.join("")}\n`);
    console.log(render(engine));
    console.log("\nBackspace=undo  Enter=commit  1-9=pick candidate  Esc=quit");
  };

  stdin.on("data", (chunk: string) => {
    for (const ch of chunk) {
      if (ch === "\u001b") { stdin.setRawMode(false); console.log("\nbye"); process.exit(0); }
      if (ch === "\r" || ch === "\n") {
        const out = engine.bestSentence;
        if (out) committed.push(out);
        engine.reset();
      } else if (ch === "\u007f" || ch === "\b") {
        engine.backspace();
      } else if (/[1-9]/.test(ch) && engine.candidates.length) {
        const picked = engine.choose(Number(ch) - 1);
        if (picked) committed.push(picked);
      } else {
        engine.press(ch);
      }
      draw();
    }
  });
  draw();
}

const argv = process.argv.slice(2);
let layout = "standard";
const rest: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--layout") { layout = argv[++i]; continue; }
  if (argv[i] === "--help" || argv[i] === "-h") {
    console.log("usage: node cli.ts [--layout standard|eten] [key-strings...]");
    process.exit(0);
  }
  rest.push(argv[i]);
}
if (!LAYOUTS[layout]) { console.error(`unknown layout ${layout}`); process.exit(1); }

if (rest.length > 0) runScripts(rest, layout);
else if (process.stdin.isTTY) runInteractive(layout);
else {
  // piped stdin: read key strings, one per line
  const rl = createInterface({ input: process.stdin });
  const lines: string[] = [];
  rl.on("line", (l) => lines.push(l.trim()));
  rl.on("close", () => runScripts(lines.filter(Boolean), layout));
}
