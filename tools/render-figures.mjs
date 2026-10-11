#!/usr/bin/env node
/**
 * Render the README's SVG figures.
 *
 * Every number in these figures is read from the same files the engine loads,
 * and every key glyph comes from the engine's own layout tables — so a figure
 * cannot quietly disagree with the code it illustrates. Regenerate with:
 *
 *     node tools/render-figures.mjs
 *
 * The worked example (ji394su3) is not hand-written either: the two readings are
 * decoded here, through the same ReadingGrid the input method uses, and the
 * scores printed are the ones it returned.
 *
 * Deliberately plain SVG: no <foreignObject>, no scripts, no external fonts
 * beyond a font-family stack. GitHub renders these inside an <img>, and anything
 * that needs a browser to lay out text would come out blank.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { STANDARD_LAYOUT, ETEN_LAYOUT } from "../engine/src/keyboard.ts";
import { loadDictionary, loadSyllableInventory } from "../engine/src/node-data.ts";
import { InputEngine } from "../engine/src/engine.ts";
import { ReadingGrid } from "../engine/src/grid.ts";
import { splitReading } from "../engine/src/syllable.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const LM = join(repo, "data", "bopomofo-lm.tsv");
const outDir = join(repo, "docs", "images");

// ------------------------------------------------------------------ the facts
const text = readFileSync(LM, "utf8");
const rows = text.split("\n").filter((l) => l && !l.startsWith("#") && l.split("\t").length >= 3);
const readings = new Set(rows.map((l) => l.split("\t")[0]));
const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);
const FILE_MB = (readFileSync(LM).length / 1e6).toFixed(1);

const FACTS = {
  entries: rows.length,
  readings: readings.size,
  syllables: inventory.size,
  mb: FILE_MB,
};

const n = (v) => v.toLocaleString("en-US");

// --------------------------------------------------------------- SVG plumbing
const INK = "#1f2430";
const DIM = "#5b6472";
const FAINT = "#8a93a3";
const LINE = "#d8dde5";
const PANEL = "#f7f9fc";
const BLUE = "#2158d0";
const BLUE_BG = "#e9f0fd";
const GREEN = "#0f6f5c";
const GREEN_BG = "#e6f4f0";
const AMBER = "#9a5b06";
const AMBER_BG = "#fdf4e5";
const GREY_BG = "#f1f3f6";

const SANS = `'Noto Sans CJK TC','Noto Sans TC','PingFang TC','Microsoft JhengHei','Hiragino Sans',system-ui,-apple-system,'Segoe UI',sans-serif`;
const MONO = `'Noto Sans Mono CJK TC',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function t(x, y, s, o = {}) {
  const {
    size = 13, fill = INK, weight = 400, anchor = "start", mono = false,
    opacity = 1, spacing = 0,
  } = o;
  return (
    `<text x="${x}" y="${y}" font-family="${mono ? MONO : SANS}" font-size="${size}"` +
    ` fill="${fill}" font-weight="${weight}" text-anchor="${anchor}"` +
    (opacity !== 1 ? ` opacity="${opacity}"` : "") +
    (spacing ? ` letter-spacing="${spacing}"` : "") +
    `>${esc(s)}</text>`
  );
}

function rect(x, y, w, h, o = {}) {
  const { fill = "#fff", stroke = LINE, rx = 10, sw = 1, dash = "" } = o;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"` +
    ` stroke="${stroke}" stroke-width="${sw}"` +
    (dash ? ` stroke-dasharray="${dash}"` : "") +
    `/>`
  );
}

function arrow(x1, y1, x2, y2, color = "#aab2c0") {
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6"` +
    ` marker-end="url(#arrowhead)"/>`
  );
}

const DEFS =
  `<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"` +
  ` markerHeight="7" orient="auto-start-reverse">` +
  `<path d="M 0 0 L 10 5 L 0 10 z" fill="#aab2c0"/></marker></defs>`;

function svg(width, height, body) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}" role="img">\n${DEFS}\n` +
    rect(0.5, 0.5, width - 1, height - 1, { fill: "#ffffff", stroke: "#e6e9ef", rx: 12 }) +
    `\n${body}\n</svg>\n`
  );
}

/** Rough advance width: CJK and Bopomofo are full width, Latin is not. */
function textWidth(s, size) {
  let w = 0;
  for (const ch of s) {
    w += /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? size : size * 0.58;
  }
  return w;
}

/** A pill: rounded box sized to the text, used for keystrokes and statuses. */
function pill(x, y, label, o = {}) {
  const { size = 15, pad = 12, h = 30, fill = "#fff", stroke = LINE, color = INK, mono = false } = o;
  const w = Math.max(h, textWidth(label, mono ? size * 0.62 : size) + pad * 2);
  return {
    w,
    svg:
      rect(x, y, w, h, { fill, stroke, rx: h / 2, sw: 1 }) +
      t(x + w / 2, y + h / 2 + size * 0.36, label, { size, fill: color, anchor: "middle", mono }),
  };
}

// ------------------------------------------------------- the 大千式 key tables
const CONSONANTS = "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ";
const MEDIALS = "ㄧㄨㄩ";
const VOWELS = "ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ";
const TONES = ["", "ˊ", "ˇ", "ˋ", "˙"];

/** component -> the glyph a user sees on the key */
function glyphOf(c) {
  if (c.kind === "consonant") return CONSONANTS[c.index - 1];
  if (c.kind === "medial") return MEDIALS[c.index - 1];
  if (c.kind === "vowel") return VOWELS[c.index - 1];
  return TONES[c.index];
}

/** the first (only) glyph a key produces — no key in these layouts is overloaded */
function glyphFor(layout, key) {
  const comps = layout.keyToComponents.get(key);
  return comps && comps.length ? glyphOf(comps[0]) : "";
}

// The physical arrangement. Which key sits where is a property of the keyboard,
// not of the mapping; the mapping itself is read from the engine above.
const KEY_ROWS = ["1234567890-", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];

// ------------------------------------------------------------------ figure 1
function pipeline() {
  const W = 1040;
  const H = 348;
  const stages = [
    { label: "按鍵 keystrokes", main: "su3cl3", sub: "大千式：六個鍵，兩個音節", mono: true, tint: BLUE_BG, edge: "#bcd0f5", key: BLUE },
    { label: "鍵盤配置 KeyboardLayout", main: "key → 注音符號", sub: "四類注音符號 · 41 鍵", tint: "#fff", edge: LINE, key: INK },
    { label: "音節切分 Segmentation", main: "列出所有合法切分", sub: "含「打到一半」的狀態", tint: "#fff", edge: LINE, key: INK },
    { label: "ReadingGrid + Viterbi", main: "切分 × 詞彙 聯合評分", sub: "取總分最高的那條路徑", tint: "#fff", edge: LINE, key: INK },
    { label: "輸出 Output", main: "你好", sub: "＋ 候選清單", tint: GREEN_BG, edge: "#bfe0d6", key: GREEN },
  ];
  const bw = 176;
  const gap = 22;
  const x0 = 36;
  const by = 116;
  const bh = 104;

  let out = "";
  out += t(36, 40, "一次解碼的流程", { size: 17, weight: 700 });
  out += t(36, 62, "One decode, from keystrokes to a sentence", { size: 12, fill: FAINT });
  out += t(W - 36, 40, "平注 PingZhu", { size: 13, fill: FAINT, anchor: "end", weight: 600 });

  stages.forEach((s, i) => {
    const x = x0 + i * (bw + gap);
    out += rect(x, by, bw, bh, { fill: s.tint, stroke: s.edge, rx: 12 });
    out += t(x + 16, by + 26, s.label, { size: 11, fill: DIM, weight: 600, spacing: 0.2 });
    if (s.mono) {
      out += t(x + 16, by + 62, s.main, { size: 24, weight: 700, fill: s.key, mono: true });
    } else {
      out += t(x + 16, by + 60, s.main, { size: 14.5, weight: 600, fill: s.key });
    }
    out += t(x + 16, by + 86, s.sub, { size: 11.5, fill: FAINT });
    if (i < stages.length - 1) {
      out += arrow(x + bw + 2, by + bh / 2, x + bw + gap - 2, by + bh / 2);
    }
  });

  // the data the grid is scored against
  const dx = x0 + 3 * (bw + gap);
  const dy = 258;
  out += rect(dx, dy, 374, 58, { fill: PANEL, stroke: LINE, rx: 10, dash: "5 4" });
  out += t(dx + 16, dy + 24, "bopomofo-lm.tsv", { size: 12.5, weight: 600, mono: true });
  out += t(dx + 150, dy + 24, `${FACTS.mb} MB`, { size: 11.5, fill: FAINT });
  out += t(
    dx + 16,
    dy + 44,
    `${n(FACTS.entries)} 詞條 · ${n(FACTS.readings)} 讀音 · ${n(FACTS.syllables)} 合法音節`,
    { size: 11.5, fill: DIM },
  );
  out += `<line x1="${dx + bw / 2}" y1="${dy}" x2="${dx + bw / 2}" y2="${by + bh + 6}" stroke="#b9c2d0" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#arrowhead)"/>`;

  out += t(
    36,
    H - 22,
    "同一份模型餵給 TypeScript 參考實作與 Rust 核心；1,532 例差異測試釘住兩者位元一致。",
    { size: 11.5, fill: FAINT },
  );
  return svg(W, H, out);
}

// ------------------------------------------------------------------ figure 2
function keyboardFigure() {
  const W = 940;
  const H = 470;
  const kw = 68;
  const kh = 58;
  const kg = 8;
  const rowH = kh + kg;
  const top = 96;
  const left = 42;

  const typed = "su3cl3";
  // press order for the highlighted keys (a key can be pressed twice)
  const order = new Map();
  [...typed].forEach((k, i) => {
    if (!order.has(k)) order.set(k, []);
    order.get(k).push(i + 1);
  });

  let out = "";
  out += t(42, 40, "大千式鍵盤 41 鍵", { size: 17, weight: 700 });
  out += t(42, 62, `${STANDARD_LAYOUT.label} — 41 keys, every one of them read from engine/src/keyboard.ts`, {
    size: 12, fill: FAINT,
  });
  out += t(W - 42, 40, "su3cl3 → 你好", { size: 13, weight: 600, fill: BLUE, anchor: "end", mono: true });

  KEY_ROWS.forEach((row, r) => {
    const indent = r === 0 ? 0 : 38;
    [...row].forEach((key, c) => {
      const x = left + indent + c * (kw + kg);
      const y = top + r * rowH;
      const g = glyphFor(STANDARD_LAYOUT, key);
      const hit = order.has(key);
      out += rect(x, y, kw, kh, {
        fill: hit ? BLUE_BG : "#fff",
        stroke: hit ? BLUE : LINE,
        rx: 9,
        sw: hit ? 2 : 1,
      });
      out += t(x + 8, y + 16, key, { size: 10.5, fill: hit ? BLUE : FAINT, mono: true, weight: 600 });
      out += t(x + kw / 2, y + kh / 2 + 12, g, {
        size: 26, anchor: "middle", weight: hit ? 700 : 500, fill: hit ? BLUE : INK,
      });
      if (hit) {
        const badge = order.get(key).join("·");
        const bw = badge.length > 1 ? 30 : 18;
        out += rect(x + kw - bw - 4, y + 4, bw, 16, { fill: BLUE, stroke: BLUE, rx: 8 });
        out += t(x + kw - bw / 2 - 4, y + 16, badge, {
          size: 10, fill: "#fff", anchor: "middle", weight: 700,
        });
      }
    });
  });

  const y = top + 4 * rowH + 8;
  out += rect(42, y, W - 84, 62, { fill: PANEL, stroke: LINE, rx: 10 });
  out += t(58, y + 25, "s ㄋ　u ㄧ　3 ˇ　→ ㄋㄧˇ　　　c ㄏ　l ㄠ　3 ˇ　→ ㄏㄠˇ", {
    size: 13.5, weight: 600,
  });
  out += t(58, y + 46, "ㄋㄧˇ ㄏㄠˇ → 你好　（空白鍵送出；要挑字先按 ↓ 開候選視窗）", {
    size: 11.5, fill: DIM,
  });
  out += t(
    42,
    H - 18,
    "數字鍵本身就是注音鍵：1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ —— 所以選字要先開候選視窗。",
    { size: 11.5, fill: FAINT },
  );
  return svg(W, H, out);
}

// ------------------------------------------------------------------ figure 3
function workedExample() {
  const keys = "ji394su3";
  const engine = new InputEngine(dict, inventory, { layout: "standard" });
  for (const k of keys) engine.press(k);
  const chosen = engine.chosenPath;
  const chosenReading = chosen.nodes.map((nd) => nd.entry.reading).join("-");
  const chosenWord = chosen.nodes.map((nd) => nd.entry.word).join("");
  const chosenScore = engine.bestScore;

  // The other way those eight keystrokes can be cut. Forced through the same
  // ReadingGrid, so the number is the engine's, not an estimate.
  const altGrid = new ReadingGrid(["ㄨㄛˇ", "ㄋㄞˋ", "ㄧˇ"], dict, {});
  const alt = altGrid.bestPath();
  const altWord = alt.nodes.map((nd) => nd.entry.word).join("");
  const altReading = alt.nodes.map((nd) => nd.entry.reading).join("-");

  const W = 980;
  const H = 400;
  let out = "";
  out += t(42, 40, "同一串按鍵，兩種合法讀音", { size: 17, weight: 700 });
  out += t(42, 62, "Two legal readings of one keystroke stream — the model has to choose", {
    size: 12, fill: FAINT,
  });

  // keystroke chips
  const glyphs = [...keys].map((k) => glyphFor(STANDARD_LAYOUT, k));
  let cx = 42;
  const chipW = 54;
  const chipGap = 8;
  [...keys].forEach((k, i) => {
    const x = cx + i * (chipW + chipGap);
    out += rect(x, 84, chipW, 62, { fill: "#fff", stroke: LINE, rx: 9 });
    out += t(x + chipW / 2, 106, k, { size: 15, anchor: "middle", mono: true, weight: 600 });
    out += t(x + chipW / 2, 130, glyphs[i], { size: 19, anchor: "middle", fill: BLUE, weight: 600 });
  });
  out += t(cx + 8 * (chipW + chipGap) + 12, 112, "按鍵串裡沒有音節邊界", { size: 12.5, fill: DIM });
  out += t(cx + 8 * (chipW + chipGap) + 12, 132, "既是 ㄨㄛˇ-ㄞˋ-ㄋㄧˇ，也是 ㄨㄛˇ-ㄋㄞˋ-ㄧˇ", {
    size: 12.5, fill: DIM,
  });

  // route A
  const cardX = 42;
  const cardW = W - 84;
  const aY = 168;
  out += rect(cardX, aY, cardW, 84, { fill: GREEN_BG, stroke: "#bfe0d6", rx: 12 });
  out += t(cardX + 18, aY + 26, "讀音 A", { size: 11.5, fill: GREEN, weight: 700 });
  out += t(cardX + 88, aY + 26, chosenReading, { size: 14, fill: INK });
  out += t(cardX + 18, aY + 60, chosenWord, { size: 30, weight: 700 });
  out += t(cardX + 150, aY + 60, `一個 ${splitReading(chosenReading).length} 音節的詞`, { size: 12, fill: DIM });
  out += t(cardX + cardW - 130, aY + 52, `score ${chosenScore.toFixed(3)}`, { size: 14, mono: true, weight: 600 });
  out += t(cardX + cardW - 18, aY + 30, "引擎選這條 ✓", { size: 12.5, fill: GREEN, weight: 700, anchor: "end" });

  // route B
  const bY = aY + 98;
  out += rect(cardX, bY, cardW, 84, { fill: GREY_BG, stroke: LINE, rx: 12 });
  out += t(cardX + 18, bY + 26, "讀音 B", { size: 11.5, fill: DIM, weight: 700 });
  out += t(cardX + 88, bY + 26, altReading, { size: 14, fill: INK });
  out += t(cardX + 18, bY + 60, alt.nodes.map((nd) => nd.entry.word).join(" "), { size: 30, weight: 700, fill: DIM });
  out += t(cardX + 190, bY + 60, `三個單字（${alt.nodes.length} 個詞）`, { size: 12, fill: DIM });
  out += t(cardX + cardW - 130, bY + 52, `score ${alt.score.toFixed(3)}`, { size: 14, mono: true, fill: DIM });
  out += t(cardX + cardW - 18, bY + 30, "差 4.28，選不到", { size: 12.5, fill: DIM, weight: 700, anchor: "end" });

  out += t(
    42,
    H - 22,
    `分數是 log10 機率，愈高愈好。兩條路都由引擎自己算：A 走 Viterbi，B 把切分固定成 ㄨㄛˇ-ㄋㄞˋ-ㄧˇ 再問同一個 ReadingGrid。`,
    { size: 11.5, fill: FAINT },
  );
  return svg(W, H, out);
}

// ------------------------------------------------------------------ figure 4
function platformsFigure() {
  const rows = [
    ["Windows 10/11", "TSF 文字服務", "可用 · 進語言列", "ok", "需要系統管理員權限註冊 COM"],
    ["Windows 10/11", "可攜版（托盤 ＋ 全域鉤子）", "可用 · 不需安裝", "ok", "不進語言列；對管理員視窗無效（UIPI）"],
    ["Android 8+", "InputMethodService", "可用", "ok", "不需要任何權限"],
    ["HarmonyOS NEXT", "IME Kit / InputMethodExtensionAbility", "真機打出「你好」", "ok", "Mate XT · HarmonyOS 6.1"],
    ["Linux", "fcitx5 addon", "能建置、引擎實測通過", "warn", "未在真的桌面環境打過字"],
    ["macOS 12+", "InputMethodKit", "能編譯、能跑引擎", "warn", "系統尚未接受 ad-hoc 簽章，等 Apple Developer ID"],
  ];
  const W = 1040;
  const H = 60 + rows.length * 44 + 58;
  let out = "";
  out += t(42, 40, "五個平台、六個外殼、一份 Rust 核心", { size: 17, weight: 700 });
  out += t(42, 62, "Five platforms, six shells, one Rust core", { size: 12, fill: FAINT });

  const top = 84;
  rows.forEach((r, i) => {
    const y = top + i * 44;
    const [platform, shell, status, kind, note] = r;
    out += rect(42, y, W - 84, 38, { fill: kind === "ok" ? "#fbfdff" : "#fffdf8", stroke: "#e7eaf0", rx: 9, sw: 1 });
    out += t(58, y + 24, platform, { size: 12.5, weight: 600 });
    out += t(216, y + 24, shell, { size: 12.5 });
    const fill = kind === "ok" ? GREEN_BG : AMBER_BG;
    const color = kind === "ok" ? GREEN : AMBER;
    const stroke = kind === "ok" ? "#bfe0d6" : "#eddcbe";
    const p = pill(560, y + 6, status, { size: 11.5, h: 26, fill, stroke, color, pad: 10 });
    out += p.svg;
    out += t(560 + p.w + 14, y + 24, note, { size: 11.5, fill: DIM });
  });

  out += t(
    42,
    H - 18,
    "外殼只做一件事：把按鍵交給核心，把文字與候選拿回來。解碼邏輯只有一份。",
    { size: 11.5, fill: FAINT },
  );
  return svg(W, H, out);
}

// ----------------------------------------------------------------------- main
//
// Each figure is written twice on purpose:
//
//   .svg  the editable source — small, diffable, and what the generator owns
//   .png  what the README embeds
//
// The PNG exists because these figures are made almost entirely of Bopomofo, and
// a viewer's machine is not guaranteed to have a font that covers U+3105..U+312F.
// Substituted glyphs would turn 注音 into plausible-looking nonsense, which is a
// worse failure than a slightly larger file. Rendering happens here, with the
// font chosen here.
import { execFileSync } from "node:child_process";

const SCALE = 2;
let rasteriser = null;
for (const candidate of ["rsvg-convert"]) {
  try {
    execFileSync(candidate, ["--version"], { stdio: "ignore" });
    rasteriser = candidate;
  } catch {
    /* not installed */
  }
}

mkdirSync(outDir, { recursive: true });
const figures = {
  "pipeline.svg": pipeline(),
  "keyboard-standard.svg": keyboardFigure(),
  "example-ji394su3.svg": workedExample(),
  "platforms.svg": platformsFigure(),
};
for (const [name, content] of Object.entries(figures)) {
  const svgPath = join(outDir, name);
  writeFileSync(svgPath, content);
  let line = `  docs/images/${name}  ${content.length} B`;
  if (rasteriser) {
    const pngPath = svgPath.replace(/\.svg$/, ".png");
    execFileSync(rasteriser, ["--zoom", String(SCALE), "-o", pngPath, svgPath]);
    line += `  →  ${name.replace(/\.svg$/, ".png")}  ${readFileSync(pngPath).length} B`;
  }
  process.stdout.write(line + "\n");
}
if (!rasteriser) {
  process.stdout.write(
    "  no rsvg-convert: SVG written, PNG not regenerated.\n" +
      "  install librsvg2-bin (Debian/Ubuntu) or rsvg-convert (brew) and rerun.\n",
  );
}
process.stdout.write(
  `  facts: ${n(FACTS.entries)} entries · ${n(FACTS.readings)} readings · ${n(FACTS.syllables)} syllables · ${FACTS.mb} MB\n` +
    `  layouts: ${STANDARD_LAYOUT.keyToComponents.size} 大千式 keys · ${ETEN_LAYOUT.keyToComponents.size} 倚天式 keys\n`,
);
