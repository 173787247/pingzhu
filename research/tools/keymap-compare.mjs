#!/usr/bin/env node
/**
 * 比对平注的键盘布局与 libchewing 的同一布局，逐键报告分歧。
 *
 * 为什么要有这个工具：平注的「大千式」键位表原本是**读来的**（调研 04 说
 * 「三方交叉验证过：RIME xlit / libchewing / 维基」）✗ 而「读过」不等于
 * 「跑过比对」✓ —— 键位表抄错一个键，症状是某个字打不出来 ✗
 * 而且不会报错 ✓ 正是这个项目最在意的那种安静的失败。
 *
 * 所以这里不靠眼睛看表 ✓ 而是把两边都解析出来做集合比对 ✓
 *
 * 用法：
 *     node research/tools/keymap-compare.mjs <libchewing 源码路径> [布局名]
 *     node research/tools/keymap-compare.mjs /tmp/libchewing-src standard
 *
 * 取得 libchewing 源码（只需要 zhuyin_layout 一个目录）：
 *     git clone --depth 1 --filter=blob:none --sparse \
 *         https://codeberg.org/chewing/libchewing.git /tmp/libchewing-src
 *     cd /tmp/libchewing-src && git sparse-checkout set src
 *
 * 注意：libchewing 是 LGPL-2.1 ✗ 本工具**只读取**它的源码做比对 ✓
 * 不复制、不改作、不散布 ✓ 平注这边比对的是自己的键位表 ✓
 * （键位对应是可事实性资料，不是可受版权保护的表达。）
 *
 * 离开码：0 = 完全一致；1 = 有分歧或无法解析
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIN = path.resolve(HERE, "..", "..");

const lcSrc = process.argv[2];
const layout = process.argv[3] ?? "standard";
if (!lcSrc) {
  console.error("用法: node research/tools/keymap-compare.mjs <libchewing 源码路径> [布局名]");
  process.exit(1);
}

// ---------------------------------------------------------------- 平注这边

const sylText = fs.readFileSync(path.join(PIN, "engine/src/syllable.ts"), "utf8");
const grabTable = (name) => {
  const m = sylText.match(new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
  if (!m) throw new Error(`syllable.ts 里找不到 ${name}`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
};
const TABLES = {
  consonant: grabTable("CONSONANTS"),
  medial: grabTable("MEDIALS"),
  vowel: grabTable("VOWELS"),
  tone: grabTable("TONES"),
};

const kbText = fs.readFileSync(path.join(PIN, "engine/src/keyboard.ts"), "utf8");
const blockOf = (constName) => {
  const start = kbText.indexOf(`export const ${constName}`);
  if (start < 0) throw new Error(`keyboard.ts 里找不到 ${constName}`);
  const next = kbText.indexOf("export const ", start + 1);
  return kbText.slice(start, next < 0 ? undefined : next);
};

/** 平注的 <LAYOUT>_LAYOUT → Map<key, [[kind, index], …]> */
function parsePingzhu(layoutId) {
  const name = layoutId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const block = blockOf(`${name}_LAYOUT`);
  const out = new Map();
  const push = (k, comps) => {
    if (out.has(k)) out.get(k).push(...comps);
    else out.set(k, [...comps]);
  };

  // 具名索引数组（consonantKeys / medialKeys / vowelKeys），只取本布局用到的
  for (const arrName of ["consonantKeys", "medialKeys", "vowelKeys"]) {
    const kind = arrName.replace("Keys", "");
    if (!block.includes(arrName)) continue;
    const decl = kbText.match(new RegExp(`const ${arrName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
    if (!decl) continue;
    for (const m of decl[1].matchAll(/\["([^"]+)",\s*(\d+)\]/g)) push(m[1], [[kind, Number(m[2])]]);
  }
  // 布局内直接写死的条目
  for (const m of block.matchAll(/\["([^"]+)",\s*\[comp\("(\w+)",\s*(\d+)\)\]\]/g))
    push(m[1], [[m[2], Number(m[3])]]);

  return new Map(
    [...out].map(([k, comps]) => [k, comps.map(([kind, i]) => TABLES[kind][i]).join("")]),
  );
}

// ----------------------------------------------------------- libchewing 这边

const LC_MODULE = {
  standard: "standard.rs",
  eten: "et.rs",
  hsu: "hsu.rs",
  eten26: "et26.rs",
  ibm: "ibm.rs",
  ginyieh: "ginyieh.rs",
};
const file = LC_MODULE[layout];
if (!file) {
  console.error(`未知布局 ${layout}；已知：${Object.keys(LC_MODULE).join(" ")}`);
  process.exit(1);
}
const rsPath = path.join(lcSrc, "src/editor/zhuyin_layout", file);
if (!fs.existsSync(rsPath)) {
  console.error(`找不到 ${rsPath}\n先 clone libchewing（见本文件开头）。`);
  process.exit(1);
}
const rs = fs.readFileSync(rsPath, "utf8");

const body = rs.slice(
  rs.indexOf("let bopomofo = match key.code {"),
  rs.indexOf("_ => return KeyBehavior::KeyError"),
);
const KEYCODE = {
  KEY_MINUS: "-", KEY_SEMICOLON: ";", KEY_COMMA: ",", KEY_DOT: ".", KEY_SLASH: "/",
  KEY_SPACE: " ", KEY_APOSTROPHE: "'", KEY_EQUAL: "=",
};
const lc = new Map();
for (const m of body.matchAll(/KEY_([A-Z0-9_]+)\s*=>\s*Bopomofo::(\w+)/g)) {
  const name = `KEY_${m[1]}`;
  lc.set(KEYCODE[name] ?? m[1].toLowerCase(), m[2]);
  // TONE1 是 libchewing 的「一声」；其余声调名与符号同名
}

/** libchewing 的 Bopomofo 变体名 → 注音符号（或声调标记） */
const NM = {
  B: "ㄅ", P: "ㄆ", M: "ㄇ", F: "ㄈ", D: "ㄉ", T: "ㄊ", N: "ㄋ", L: "ㄌ",
  G: "ㄍ", K: "ㄎ", H: "ㄏ", J: "ㄐ", Q: "ㄑ", X: "ㄒ",
  ZH: "ㄓ", CH: "ㄔ", SH: "ㄕ", R: "ㄖ", Z: "ㄗ", C: "ㄘ", S: "ㄙ",
  I: "ㄧ", U: "ㄨ", IU: "ㄩ",
  A: "ㄚ", O: "ㄛ", E: "ㄜ", EH: "ㄝ", AI: "ㄞ", EI: "ㄟ", AU: "ㄠ", OU: "ㄡ",
  AN: "ㄢ", EN: "ㄣ", ANG: "ㄤ", ENG: "ㄥ", ER: "ㄦ",
  TONE1: "(一聲)", TONE2: "ˊ", TONE3: "ˇ", TONE4: "ˋ", TONE5: "˙",
};

// -------------------------------------------------------------------- 比对

const pin = parsePingzhu(layout);
const keys = [...new Set([...pin.keys(), ...lc.keys()])].sort();
let agree = 0;
const diffs = [];
const rows = [];
for (const k of keys) {
  const p = pin.get(k) ?? null;
  const l = lc.has(k) ? (NM[lc.get(k)] ?? lc.get(k)) : null;
  const both = p !== null && l !== null;
  const ok = p === l;
  if (both) ok ? agree++ : diffs.push({ k, p, l });
  rows.push({ k, p, l, both, ok });
}

console.log(`布局 ${layout}`);
console.log(`平注 ${pin.size} 键 · libchewing ${lc.size} 键 · 并集 ${keys.length}`);
console.log(`两边都有且一致 ${agree} · 分歧 ${diffs.length}\n`);
console.log("键   平注         libchewing");
for (const r of rows) {
  const mark = r.both ? (r.ok ? "✓" : "✗ ← 分歧") : "（单边）";
  console.log(`${JSON.stringify(r.k).padEnd(5)} ${String(r.p ?? "—").padEnd(12)} ${String(r.l ?? "—").padEnd(12)} ${mark}`);
}
if (diffs.length) {
  console.log("\n分歧明细：");
  for (const d of diffs) console.log(`  ${JSON.stringify(d.k)}: 平注 ${d.p} vs libchewing ${d.l}`);
}
process.exit(diffs.length ? 1 : 0);
