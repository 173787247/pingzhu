/*
 * The Markdown splitter in tools/to-simplified.mjs.
 *
 * A regex looked sufficient and was not: `(```(?!mermaid)...)` leaves a mermaid
 * block unprotected, and then that block's *closing* fence matches as the
 * *opening* fence of a plain code block — so everything between the two is
 * silently protected and keeps the wrong script. The failure is invisible:
 * nothing errors, some paragraphs just do not convert.
 *
 * These cases pin the behaviour that a state machine gets right.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { convertDocument } from "../../tools/to-simplified.mjs";

/* Stand-in for the real converter: marks what it was allowed to touch.
 * 傳統 -> 传统 is the real mapping; using anything else would make the test
 * agree with itself rather than with the converter. */
const mark = (text) => text.replaceAll("傳統", "传统");

test("prose is converted", () => {
  assert.equal(convertDocument("這是傳統文字", mark), "這是传统文字");
});

test("mermaid labels are converted", () => {
  const input = "```mermaid\n  a[傳統]\n```\n";
  const output = convertDocument(input, mark);
  assert.match(output, /a\[传统\]/);
  assert.match(output, /```mermaid/);
});

test("prose after a mermaid block is still converted", () => {
  // The case the regex got wrong: the mermaid closing fence was read as the
  // start of the next code block.
  const input = ["```mermaid", "a[x]", "```", "", "傳統段落", "", "```bash", "echo 傳統", "```", ""].join("\n");
  const output = convertDocument(input, mark);
  assert.match(output, /传统段落/, "the paragraph between the blocks must convert");
  assert.match(output, /echo 傳統/, "the shell command must not");
});

test("code blocks are protected byte for byte", () => {
  const input = "```bash\ncp 傳統/a 傳統/b\n```\n";
  assert.equal(convertDocument(input, mark), input);
});

test("inline code inside prose is protected", () => {
  assert.equal(convertDocument("用 `傳統` 這個", mark), "用 `傳統` 這個");
});

test("an unclosed fence does not swallow the document silently", () => {
  const input = "前言\n```bash\n傳統\n";
  const output = convertDocument(input, mark);
  assert.match(output, /前言/);
});
