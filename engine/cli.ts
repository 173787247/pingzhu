#!/usr/bin/env node
/**
 * PingZhu CLI — a keystroke-level demo of the engine.
 *
 *   node cli.ts                  interactive: type bopomofo keys, watch it decode
 *   node cli.ts su3cl3 ji394su3  decode key strings non-interactively
 *   node cli.ts --layout eten …  use another keyboard layout
 *   node cli.ts --order longest-first …  candidate window ordering
 *
 * Interactive keys, following 自然輸入法:
 *   letters/digits   type bopomofo
 *   1 2 3 … 9 0      pick the 1st … 10th candidate on the page
 *   space            next page of ten
 *   ← →              move the candidate window along the buffer
 *   Backspace        undo one keystroke
 *   Enter            commit the line
 *   Esc / Ctrl-C     quit
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

function loadEngine(layout, order) {
  const dict = Dictionary.load(LM);
  const inventory = buildSyllableInventory(LM);
  return {
    dict,
    inventory,
    engine: new InputEngine(dict, inventory, { layout, candidateOrder: order }),
  };
}

/** The numbers a user actually presses: 1..9 then 0 for the tenth. */
function pageKeys(n) {
  return Array.from({ length: n }, (_, i) => (i === 9 ? "0" : String(i + 1)));
}

function render(engine) {
  const page = engine.candidatePage;
  const keys = pageKeys(page.entries.length);
  const label = page.pageCount > 1
    ? `第 ${page.pageIndex + 1}/${page.pageCount} 頁${page.hasMore ? "（空白鍵下一頁）" : "（末頁）"}`
    : "唯一一頁";
  const cands = page.entries
    .map((c, i) => `${keys[i]}.${c.word}`)
    .join("  ");
  const path = engine.chosenPath;
  const segmentation = path ? path.nodes.map((n) => n.entry.word).join("｜") : "-";
  return [
    `  按鍵      ${engine.rawKeys || "-"}`,
    `  注音      ${engine.composing || "(空)"}`,
    `  → 中文    ${engine.bestSentence || "(尚無)"}   (score ${engine.bestScore.toFixed(2)})`,
    `  斷詞      ${segmentation}`,
    `  候選      ${cands || "-"}`,
    `            ${label}　游標在第 ${engine.candidateCursor + 1} 音節`,
  ].join("\n");
}

function runScripts(args, layout, order) {
  const { engine } = loadEngine(layout, order);
  for (const arg of args) {
    engine.reset();
    for (const ch of arg) engine.press(ch);
    console.log(`\n> ${arg}`);
    console.log(render(engine));
  }
}

function runInteractive(layout, order) {
  const { engine } = loadEngine(layout, order);
  const committed = [];
  console.log(`PingZhu 注音引擎 demo — ${LAYOUTS[layout].label}，候選排序：${order}`);
  console.log("輸入大千式按鍵（例：su3cl3 = 你好、ji394su3 = 我愛你）。Esc 離開。\n");

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const draw = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    console.log(`PingZhu 注音引擎 — ${LAYOUTS[layout].label}　候選排序：${order}`);
    console.log(`已輸入: ${committed.join("")}\n`);
    console.log(render(engine));
    console.log("\n1-9,0=選字　空白=下一頁　←→=移動候選游標　Backspace=退一格　Enter=送出　Esc=離開");
  };

  stdin.on("data", (chunk) => {
    for (const ch of chunk) {
      if (ch === "\u001b") {
        // arrow keys arrive as ESC [ C / ESC [ D; a bare ESC quits
        if (chunk.length > 1) continue;
        stdin.setRawMode(false);
        console.log("\nbye");
        process.exit(0);
      }
      if (chunk.includes("\u001b[C")) { engine.moveCandidateCursor(1); draw(); continue; }
      if (chunk.includes("\u001b[D")) { engine.moveCandidateCursor(-1); draw(); continue; }
      if (ch === "\r" || ch === "\n") {
        const out = engine.bestSentence;
        if (out) committed.push(out);
        engine.reset();
      } else if (ch === "\u007f" || ch === "\b") {
        engine.backspace();
      } else if (ch === " ") {
        engine.nextCandidatePage();
      } else if (/[0-9]/.test(ch) && engine.candidatePage.entries.length) {
        // 1..9 are the first nine, 0 is the tenth
        const picked = engine.selectCandidate(ch === "0" ? 10 : Number(ch));
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
let order = "frequency";
const rest = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--layout") { layout = argv[++i]; continue; }
  if (argv[i] === "--order") { order = argv[++i]; continue; }
  if (argv[i] === "--help" || argv[i] === "-h") {
    console.log("usage: node cli.ts [--layout standard|eten] [--order frequency|longest-first] [key-strings...]");
    process.exit(0);
  }
  rest.push(argv[i]);
}
if (!LAYOUTS[layout]) { console.error(`unknown layout ${layout}`); process.exit(1); }

if (rest.length > 0) runScripts(rest, layout, order);
else if (process.stdin.isTTY) runInteractive(layout, order);
else {
  const rl = createInterface({ input: process.stdin });
  const lines = [];
  rl.on("line", (l) => lines.push(l.trim()));
  rl.on("close", () => runScripts(lines.filter(Boolean), layout, order));
}
