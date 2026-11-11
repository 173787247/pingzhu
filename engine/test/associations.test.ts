/**
 * 接续表：打了某个词之后，下一个词最可能是什么。
 *
 * 设计见 engine/src/associations.ts。这里守三件事：表能读进来、查得到、以及**没有表时
 * 功能缺席但不报错** —— 最后一条决定了这个功能能不能安全地加到已有安装上。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { Associations } from "../src/associations.ts";
import { InputEngine } from "../src/engine.ts";
import { loadDictionary, loadSyllableInventory } from "../src/node-data.ts";

const LM = fileURLToPath(new URL("../../data/bopomofo-lm.tsv", import.meta.url));
const BIGRAM = fileURLToPath(new URL("../../data/bigram.tsv", import.meta.url));

const table = Associations.fromText(readFileSync(BIGRAM, "utf8"), "bigram.tsv");

test("the shipped table loads and answers for a word in the corpus", () => {
  assert.ok(table.size > 1000, `table looks truncated: ${table.size} rows`);
  assert.ok(table.words > 100, `too few words with continuations: ${table.words}`);

  // 「不断」在一批国务院公文里出现很多次，接续都是真的。
  const after = table.suggestions("不断", 5);
  assert.ok(after.length > 0, "不断 has no continuations");
  // 至少一个接续是真的在语料里紧跟在它后面 —— 具体是哪个会随语料变，所以不写死。
  assert.ok(after.every((w) => typeof w === "string" && w.length > 0), `bad suggestions: ${after}`);
});

test("lookup returns counts, sorted best first", () => {
  const list = table.lookup("不断");
  if (list.length >= 2) {
    assert.ok(list[0].count >= list[1].count, `not sorted: ${JSON.stringify(list.slice(0, 3))}`);
  }
  for (const a of list) {
    assert.ok(a.count >= 1 && Number.isInteger(a.count), `bad count: ${a.count}`);
    assert.ok(!a.next.includes("\t"), "a tab leaked into a word");
  }
});

test("an unknown word has no suggestions, and that is not an error", () => {
  assert.deepEqual(table.suggestions("这个词不存在于语料"), []);
});

test("the engine exposes suggestions when given the table", () => {
  const dict = loadDictionary(LM);
  const inventory = loadSyllableInventory(LM);
  const engine = new InputEngine(dict, inventory, { layout: "standard", associations: table });
  const after = engine.suggestAfter("不断", 3);
  assert.ok(after.length > 0, "engine.suggestAfter returned nothing for a word the table knows");
});

test("without the table the engine still works and says nothing", () => {
  const dict = loadDictionary(LM);
  const inventory = loadSyllableInventory(LM);
  const engine = new InputEngine(dict, inventory, { layout: "standard" });
  // 功能缺席不报错 —— 这是它能安全加到已有安装上的前提。
  assert.deepEqual(engine.suggestAfter("不断"), []);
  // 而且解码照旧。
  for (const k of "su3cl3") engine.press(k);
  assert.equal(engine.bestSentence, "你好");
});

test("malformed rows are skipped, not fatal", () => {
  const text = [
    "# comment",
    "好\t嗎\t3",
    "",
    "只有一列",
    "好\t\t2",           // 空接续词
    "好\t呀\t不是数字",   // 频次不是数字
    "好\t的\t1",
  ].join("\n");
  const small = Associations.fromText(text, "<test>");
  assert.deepEqual(small.suggestions("好"), ["嗎", "的"]);
});
