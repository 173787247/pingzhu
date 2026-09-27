#!/usr/bin/env node
/*
 * Convert a Markdown document's prose to Simplified.
 *
 * Uses the project's own converter and table, which is the point: if this
 * mangles a document nobody would write in, the converter is wrong.
 *
 * Code is left alone. Fenced blocks and inline code spans keep their bytes
 * exactly — a path, an identifier or a command is not prose, and "translating"
 * it would break it. Only Chinese *outside* code changes.
 *
 *   node tools/to-simplified.mjs README.md [more.md ...]
 *   node tools/to-simplified.mjs --check README.md      (report, do not write)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConverter } from "../engine/src/node-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const table = join(here, "..", "data", "ts-conversion.tsv");

export { convertDocument };

/* Only run the CLI when invoked directly, so a test can import the splitter. */
const invokedDirectly = process.argv[1] && import.meta.url.endsWith(
  process.argv[1].replace(/\\/g, "/").split("/").pop(),
);

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const files = args.filter((a) => a !== "--check");
if (invokedDirectly && files.length === 0) {
  console.error("usage: node tools/to-simplified.mjs [--check] <file.md> [...]");
  process.exit(2);
}

const converter = loadConverter(table);
if (converter.size === 0) {
  console.error(`conversion table is empty: ${table}`);
  process.exit(1);
}

/*
 * Split the document into convertible and protected text.
 *
 * A regex cannot do this correctly. `(```(?!mermaid)...)` looks like it excludes
 * diagram blocks, but the *closing* fence of a mermaid block then matches as the
 * *opening* fence of a plain one, and everything between the two is wrongly
 * protected — silently leaving whole paragraphs in the wrong script.
 *
 * So: a line-based state machine, which is what a Markdown renderer does.
 *
 *   prose    converted
 *   mermaid  converted — a diagram is markup, and its labels are read by a
 *            person. Its syntax is ASCII, so converting cannot break it.
 *   code     protected — paths, identifiers and commands must survive byte for
 *            byte. Translating a command is not translation, it is corruption.
 *
 * Inline `code spans` inside prose are protected separately.
 */
function convertDocument(text, convert) {
  const lines = text.split("\n");
  const out = [];
  let buffer = [];
  let inside = null; // null | "mermaid" | "code"
  let fenceChar = "";

  const flush = () => {
    if (buffer.length === 0) return;
    const joined = buffer.join("\n");
    if (inside === "code") {
      out.push(joined); // byte for byte
    } else if (inside === "mermaid") {
      /* Converted whole, with no inline-span pass. That pass uses
       * /(`+[^`]*`+)/, which happily matches from the opening fence to the
       * closing one and protects the entire diagram as if it were one inline
       * code span — which is exactly what it did. */
      out.push(convert(joined));
    } else {
      out.push(convertInline(joined, convert));
    }
    buffer = [];
  };

  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (inside === null) {
      if (fence) {
        flush();
        inside = fence[2].trim().toLowerCase().startsWith("mermaid") ? "mermaid" : "code";
        fenceChar = fence[1][0];
      }
      buffer.push(line);
    } else {
      buffer.push(line);
      // A closing fence is the same character, at least as long, with no info string.
      if (fence && fence[1][0] === fenceChar && fence[1].length >= 3 && fence[2].trim() === "") {
        flush();
        inside = null;
        fenceChar = "";
      }
    }
  }
  flush();
  return out.join("\n");
}

/* Inline spans inside prose. Odd indices are the spans. */
const INLINE = /(`+[^`]*`+)/g;
function convertInline(text, convert) {
  return text
    .split(INLINE)
    .map((part, index) => (index % 2 === 1 ? part : convert(part)))
    .join("");
}

let changed = 0;
if (invokedDirectly) for (const file of files) {
  const path = resolve(file);
  const original = readFileSync(path, "utf8");
  const converted = convertDocument(original, (t) => converter.toSimplified(t));

  if (converted === original) {
    console.log(`  unchanged  ${file}`);
    continue;
  }
  const before = [...original].length;
  const after = [...converted].length;
  console.log(`  converted  ${file}   (${before} -> ${after} characters)`);
  changed++;
  if (!checkOnly) writeFileSync(path, converted, "utf8");
}

if (invokedDirectly) {
  console.log(checkOnly ? `\n${changed} file(s) would change` : `\n${changed} file(s) written`);
}
