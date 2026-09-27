/*
 * Converter tests.
 *
 * Two kinds of case here, and the second kind is the reason the file exists:
 *
 *   - plain character substitution, which is most of the table
 *   - the phrase entries that must *not* convert, because a character rule
 *     inside them would be wrong (乾坤 is not 干坤)
 *
 * The second kind is easy to break without noticing: dropping an entry whose
 * key equals its value looks like removing a no-op, and silently disables the
 * only thing protecting those words.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Converter, isOutputScript } from "../src/converter.ts"
import { loadConverter } from "../src/node-data.ts";

const sample = Converter.fromText(
  [
    "乾坤\t乾坤", // phrase identity: must block 乾 -> 干
    "乾\t干",
    "個\t个",
    "同\t同", // single-character identity: a genuine no-op, dropped
    "旋轉乾坤\t旋转乾坤",
  ].join("\n"),
);

test("substitutes single characters", () => {
  assert.equal(sample.toSimplified("個個"), "个个");
});

test("a phrase identity entry blocks the character rule", () => {
  assert.equal(sample.toSimplified("乾坤"), "乾坤");
  assert.equal(sample.toSimplified("乾杯"), "干杯");
});

test("longest match wins", () => {
  assert.equal(sample.toSimplified("旋轉乾坤"), "旋转乾坤");
});

test("single-character identity entries are dropped", () => {
  // 乾, 個, 乾坤, 旋轉乾坤 — 同 carries no information.
  assert.equal(sample.size, 4);
  assert.equal(sample.toSimplified("同"), "同");
});

test("traditional is returned untouched", () => {
  assert.equal(sample.apply("個乾", "traditional"), "個乾");
  assert.equal(sample.apply("個乾", "simplified"), "个干");
});

test("an empty converter passes text through", () => {
  assert.equal(Converter.identity.toSimplified("繁體字"), "繁體字");
  assert.equal(Converter.identity.size, 0);
});

test("code points outside the BMP are not sliced in half", () => {
  // 𠀀 is one character and two UTF-16 units. Counting units would split it.
  const converter = Converter.fromText("𠀀\t𠀁\n");
  assert.equal(converter.toSimplified("𠀀𠀀"), "𠀁𠀁");
});

test("script names are validated", () => {
  assert.ok(isOutputScript("traditional"));
  assert.ok(isOutputScript("simplified"));
  assert.ok(!isOutputScript("klingon"));
});

test("the real table converts the cases that matter", () => {
  const converter = loadConverter("../data/ts-conversion.tsv");
  assert.ok(converter.size > 3000, `table looks empty: ${converter.size}`);
  assert.equal(converter.toSimplified("我愛你"), "我爱你");
  assert.equal(converter.toSimplified("萬丹"), "万丹");
  assert.equal(converter.toSimplified("頭髮"), "头发");
  assert.equal(converter.toSimplified("裡面"), "里面");
  // The phrase overrides, which are the whole reason the table carries them.
  assert.equal(converter.toSimplified("乾坤"), "乾坤");
  assert.equal(converter.toSimplified("旋轉乾坤"), "旋转乾坤");
  assert.equal(converter.toSimplified("乾淨"), "干净");
});

/**
 * The invariant `node-data.ts` claims in its header comment.
 *
 * It said "only this module touches node:fs" while `converter.ts` imported it
 * for one convenience method — so every browser that wanted the conversion table
 * got a module it could not load. A comment is not a constraint; this is.
 */
test("the platform-free modules import no node builtins", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const pure = [
    "syllable.ts",
    "keyboard.ts",
    "grid.ts",
    "dictionary.ts",
    "userdict.ts",
    "converter.ts",
    "engine.ts",
    "pinyin.ts",
  ];
  const present = new Set(readdirSync(new URL("../src", import.meta.url)));
  for (const file of pure) {
    if (!present.has(file)) continue;
    const text = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    const match = text.match(/from\s+"(node:[^"]+)"/);
    assert.equal(
      match,
      null,
      `${file} imports ${match?.[1]} — it must stay platform-free so a browser can use it`,
    );
  }
});
