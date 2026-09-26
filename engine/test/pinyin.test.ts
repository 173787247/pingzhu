/*
 * Bopomofo -> Pinyin tests.
 *
 * The mapping is a transliteration with several context-dependent rewrites, and
 * the whole cross-encoding measurement rests on it. A wrong rule here would
 * quietly change the conclusion of docs/09 rather than fail anything.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { syllableToPinyin, readingToPinyin, readingKeys } from "../src/pinyin.ts";

test("plain syllables", () => {
  assert.equal(syllableToPinyin("ㄋㄧˇ"), "ni");
  assert.equal(syllableToPinyin("ㄏㄠˇ"), "hao");
  assert.equal(syllableToPinyin("ㄉㄢ"), "dan");
});

test("initials that need two letters", () => {
  assert.equal(syllableToPinyin("ㄓㄨㄥ"), "zhong");
  assert.equal(syllableToPinyin("ㄕㄨ"), "shu");
  assert.equal(syllableToPinyin("ㄔ"), "chi");
});

test("the empty rime is written i", () => {
  // ㄓㄔㄕㄖㄗㄘㄙ standing alone are syllables, not just initials.
  for (const [bopomofo, pinyin] of [
    ["ㄓ", "zhi"], ["ㄔ", "chi"], ["ㄕ", "shi"],
    ["ㄖ", "ri"], ["ㄗ", "zi"], ["ㄘ", "ci"], ["ㄙ", "si"],
  ]) {
    assert.equal(syllableToPinyin(bopomofo), pinyin);
  }
});

test("finals contract after an initial", () => {
  assert.equal(syllableToPinyin("ㄌㄧㄡˊ"), "liu");   // not liou
  assert.equal(syllableToPinyin("ㄍㄨㄟ"), "gui");    // not guei
  assert.equal(syllableToPinyin("ㄌㄨㄣˊ"), "lun");   // not luen
  assert.equal(syllableToPinyin("ㄒㄧㄣ"), "xin");    // not xien
});

test("medials are prefixed only when there is no initial", () => {
  assert.equal(syllableToPinyin("ㄧ"), "yi");
  assert.equal(syllableToPinyin("ㄨ"), "wu");
  assert.equal(syllableToPinyin("ㄩ"), "yu");
  assert.equal(syllableToPinyin("ㄒㄧ"), "xi");       // not xyi
  assert.equal(syllableToPinyin("ㄉㄨ"), "du");
});

test("ü is written u after j q x, v after n l", () => {
  assert.equal(syllableToPinyin("ㄐㄩㄣ"), "jun");
  assert.equal(syllableToPinyin("ㄑㄩ"), "qu");
  assert.equal(syllableToPinyin("ㄒㄩㄝˊ"), "xue");
  assert.equal(syllableToPinyin("ㄋㄩˇ"), "nv");      // what an IME accepts
  assert.equal(syllableToPinyin("ㄌㄩˋ"), "lv");
  assert.equal(syllableToPinyin("ㄩㄥˇ"), "yong");
  assert.equal(syllableToPinyin("ㄒㄩㄥ"), "xiong");
});

test("keystroke counts follow the 大千 layout", () => {
  assert.equal(readingKeys("ㄋㄧˇ-ㄏㄠˇ"), 6);   // n i ˇ + h a o ˇ
  assert.equal(readingKeys("ㄉㄢ"), 2);          // d a, 一聲 is unmarked
  assert.equal(readingKeys("ㄕˋ"), 2);           // sh + ˋ
});

test("a whole reading concatenates without separators", () => {
  assert.equal(readingToPinyin("ㄋㄧˇ-ㄏㄠˇ"), "nihao");
  assert.equal(readingToPinyin("ㄓㄨㄥ-ㄨㄣˊ"), "zhongwen");
});

test("an unrepresentable combination returns null, not a guess", () => {
  // ㄧㄟ is not a syllable in Mandarin; producing "iei" would corrupt the data.
  assert.equal(syllableToPinyin("ㄧㄟ"), null);
  assert.equal(readingToPinyin("ㄋㄧˇ-ㄧㄟ"), null);
});

test("every reading in the model maps", () => {
  const lines = readFileSync(new URL("../../data/bopomofo-lm.tsv", import.meta.url), "utf8").split("\n");
  let total = 0, gaps = 0;
  for (const line of lines) {
    const reading = line.split("\t")[0];
    if (!reading) continue;
    total++;
    if (readingToPinyin(reading) === null) gaps++;
  }
  assert.ok(total > 100000, `model looks empty: ${total}`);
  // 17 known gaps out of ~170k; a regression here would move the numbers in docs/09.
  assert.ok(gaps / total < 0.001, `too many unmapped readings: ${gaps}/${total}`);
});
