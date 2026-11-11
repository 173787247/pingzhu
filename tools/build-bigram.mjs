#!/usr/bin/env node
/**
 * 从语料算「词 → 下一个词」的频次表。
 *
 * 联想词要学的就是这个：打了「知识」之后，「产权」比「分子」更可能。
 *
 * ## 分词为什么不用引擎的词典
 *
 * 试过，不行。引擎的词典是**注音输入法的词表** —— 「知识产权」「不断」「传统知识」
 * 全都不在里面（实测查过），因为那些不是「有人会单独打出来的词」。拿它做最大匹配，
 * 语料会被切成一地单字，「不 → 断」这种接续就进了表，联想出来的词是半截的。
 *
 * 所以词表**从语料本身学**：统计所有 2–4 字的连续片段，出现够多次的才算词。这是无监督
 * 分词的经典做法，不需要外部词典，也不需要引入第三方分词器 —— 而引入第三方分词器的
 * 代价是这个项目要多一个依赖，且它的切分约定和引擎未必一致。
 *
 * 词表与接续表都从语料来，与引擎词典无关：语料是语料，词典是词典。
 *
 * 用法：
 *   node tools/build-bigram.mjs              # 只报统计
 *   node tools/build-bigram.mjs --write      # 写 data/bigram.tsv
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CORPUS = join(ROOT, "data", "corpus");
const OUT = join(ROOT, "data", "bigram.tsv");

/** 一个片段至少要出现这么多次，才算词。 */
const MIN_WORD_COUNT = 3;
/** 只考虑 2–4 字的片段。单字不入词表（切分时单字是兜底）。 */
const MIN_WORD_LEN = 2;
const MAX_WORD_LEN = 4;
/** 接续对至少要出现这么多次才进表。 */
const MIN_PAIR_COUNT = 2;
/** 每个词最多留几个接续词。 */
const KEEP_PER_WORD = 8;

const write = process.argv.includes("--write");

// ---------------------------------------------------------------- 读语料
const files = existsSync(CORPUS)
  ? readdirSync(CORPUS).filter((f) => f.endsWith(".txt")).sort()
  : [];
if (files.length === 0) {
  console.error(`  ${CORPUS} 里没有 .txt。先跑 tools/fetch-corpus.mjs --write`);
  process.exit(1);
}

/** 只保留汉字，其余一律当分隔符 —— 标点、空格、编号都不该进词。 */
const docs = files.map((name) => {
  const raw = readFileSync(join(CORPUS, name), "utf8");
  return raw
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .join("\n")
    .replace(/[^\u4e00-\u9fff]+/g, " ");
});

const chars = docs.reduce((n, d) => n + (d.match(/[\u4e00-\u9fff]/g) || []).length, 0);

// ---------------------------------------------------------------- 学词表
// 第一步：数所有 2–4 字片段的出现次数。跨空白的不算。
const freq = new Map();
for (const doc of docs) {
  for (const chunk of doc.split(" ")) {
    for (let len = MIN_WORD_LEN; len <= MAX_WORD_LEN; len += 1) {
      for (let i = 0; i + len <= chunk.length; i += 1) {
        const piece = chunk.slice(i, i + len);
        freq.set(piece, (freq.get(piece) ?? 0) + 1);
      }
    }
  }
}

/**
 * 第二步：留下当词的片段 —— 用左右邻字熵。
 *
 * 只看频次是不够的：「国务院关」「务院关于」「院关于印」都出现了好几次，因为它们都是
 * 同一句话的滑窗。区别在于，真词的**左边能接什么字**和**右边能接什么字**都很杂，
 * 而片段只在固定的一两个字旁边出现。
 *
 * 「国务院」左边可能是「据」「经」「由」「在」……，右边可能是「决定」「办公厅」「关于」……
 * 而「务院关于」左边几乎总是「国」。所以：数左侧与右侧各出现了多少种**不同的**字，
 * 熵太低的就不是词。
 *
 * 这个判据不需要外部词典，在只有几千字的语料上也有效。
 */
const leftChars = new Map();   // piece -> Set(左邻字)
const rightChars = new Map();  // piece -> Set(右邻字)
for (const doc of docs) {
  for (const chunk of doc.split(" ")) {
    for (let len = MIN_WORD_LEN; len <= MAX_WORD_LEN; len += 1) {
      for (let i = 0; i + len <= chunk.length; i += 1) {
        const piece = chunk.slice(i, i + len);
        if (i > 0) {
          if (!leftChars.has(piece)) leftChars.set(piece, new Set());
          leftChars.get(piece).add(chunk[i - 1]);
        }
        if (i + len < chunk.length) {
          if (!rightChars.has(piece)) rightChars.set(piece, new Set());
          rightChars.get(piece).add(chunk[i + len]);
        }
      }
    }
  }
}

/** 一个片段至少要能接这么多种不同的邻字，才算词。 */
const MIN_NEIGHBOURS = 3;

const vocab = new Set();
for (const [piece, count] of freq) {
  if (count < MIN_WORD_COUNT) continue;
  const left = leftChars.get(piece)?.size ?? 0;
  const right = rightChars.get(piece)?.size ?? 0;
  // **至少一侧**够杂就是词。
  //
  // 一开始要求两侧都 ≥3，结果「不断」「一步」被排除 —— 它们右邻有六七种，左邻只有一种，
  // 因为中文的词本来就可以只在一侧自由：分句开头就是词的左边，那里没有字。
  // 要求两侧都自由，等于要求每个词都出现在句子中间，那是不对的。
  if (left >= MIN_NEIGHBOURS || right >= MIN_NEIGHBOURS) vocab.add(piece);
}

// ---------------------------------------------------------------- 分词
const maxLen = Math.max(...[...vocab].map((w) => w.length), 1);

function segment(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (!/[\u4e00-\u9fff]/.test(ch)) {
      i += 1;
      continue;
    }
    let matched = null;
    for (let len = Math.min(maxLen, text.length - i); len >= 1; len -= 1) {
      const piece = text.slice(i, i + len);
      if (len === 1 || (vocab.has(piece) && /^[\u4e00-\u9fff]+$/.test(piece))) {
        matched = piece;
        break;
      }
    }
    tokens.push(matched || ch);
    i += (matched || ch).length;
  }
  return tokens;
}

// ---------------------------------------------------------------- 统计接续
const bigrams = new Map();
let tokens = 0;

for (const doc of docs) {
  for (const chunk of doc.split(" ")) {
    const seq = segment(chunk);
    tokens += seq.length;
    for (let i = 0; i + 1 < seq.length; i += 1) {
      const key = `${seq[i]}\t${seq[i + 1]}`;
      bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
    }
  }
}

const byWord = new Map();
for (const [key, count] of bigrams) {
  if (count < MIN_PAIR_COUNT) continue;
  const [a, b] = key.split("\t");
  if (!byWord.has(a)) byWord.set(a, []);
  byWord.get(a).push([b, count]);
}

const lines = [];
for (const word of [...byWord.keys()].sort()) {
  for (const [next, count] of byWord.get(word).sort((x, y) => y[1] - x[1]).slice(0, KEEP_PER_WORD)) {
    lines.push(`${word}\t${next}\t${count}`);
  }
}

console.log(`  语料         ${files.length} 篇，${chars.toLocaleString()} 汉字`);
console.log(`  候选片段     ${freq.size.toLocaleString()} 种（2–4 字，全部）`);
console.log(`  学到的词     ${vocab.size.toLocaleString()} 个`);
console.log(`  切出         ${tokens.toLocaleString()} 个词`);
console.log(`  词对          ${bigrams.size.toLocaleString()} 种（全部）`);
console.log(`  进表          ${lines.length.toLocaleString()} 行（频次≥${MIN_PAIR_COUNT}，每词≤${KEEP_PER_WORD}）`);

const words = [...vocab].slice(0, 10);
console.log(`  词表示例:    ${words.join("、")}`);

if (lines.length) {
  console.log("  接续示例:");
  for (const l of lines.slice(0, 6)) console.log(`    ${l.replace(/\t/g, " → ")}`);
}

if (write) {
  const header =
    "# 词\t接续词\t频次 —— 由 tools/build-bigram.mjs 从 data/corpus/ 生成\n" +
    "# 语料授权见 docs/12-corpus-sources.md。这个文件是派生物，不单独授权。\n";
  writeFileSync(OUT, header + lines.join("\n") + "\n");
  console.log(`  已写入 ${OUT}`);
} else {
  console.log("  加 --write 才会写盘。");
}
