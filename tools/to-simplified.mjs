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
import { Converter } from "../engine/src/converter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const table = join(here, "..", "data", "ts-conversion.tsv");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const files = args.filter((a) => a !== "--check");
if (files.length === 0) {
  console.error("usage: node tools/to-simplified.mjs [--check] <file.md> [...]");
  process.exit(2);
}

const converter = Converter.fromFile(table);
if (converter.size === 0) {
  console.error(`conversion table is empty: ${table}`);
  process.exit(1);
}

/* Odd indices are code: fenced blocks first (so a fence containing backticks is
 * not split again), then inline spans. Protecting them by splitting is more
 * reliable than trying to convert around them. */
const CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

let changed = 0;
for (const file of files) {
  const path = resolve(file);
  const original = readFileSync(path, "utf8");
  const parts = original.split(CODE);
  const converted = parts
    .map((part, index) => (index % 2 === 1 ? part : converter.toSimplified(part)))
    .join("");

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

console.log(checkOnly ? `\n${changed} file(s) would change` : `\n${changed} file(s) written`);
