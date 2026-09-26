#!/usr/bin/env node
/*
 * Build the Traditional -> Simplified table used by the 簡體輸出 mode.
 *
 * Source: OpenCC's TSCharacters.txt and TSPhrases.txt (Apache-2.0). OpenCC is
 * the reference implementation for this conversion; hand-rolling a table would
 * mean re-deriving a decade of accumulated corrections.
 *
 *   data/vendor/opencc/TSCharacters.txt
 *   data/vendor/opencc/TSPhrases.txt
 *     -> data/ts-conversion.tsv
 *
 * Output format: one `traditional<TAB>simplified` pair per line, sorted longest
 * key first so the runtime can do a simple longest-match without carrying its
 * own length index.
 *
 * Note on the entries OpenCC lists with several possible values: the first one
 * is its default, and the alternatives exist for phrase-level overrides. We take
 * the first and let TSPhrases supply the exceptions — which is exactly how
 * OpenCC itself resolves them.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, "vendor", "opencc");

function parse(file) {
  if (!existsSync(file)) {
    console.error(`missing ${file}`);
    console.error("run: bash data/fetch-source.sh   (fetches the OpenCC tables)");
    process.exit(1);
  }
  const out = new Map();
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const key = line.slice(0, tab);
    const value = line.slice(tab + 1).split(/\s+/)[0];
    if (!key || !value) continue;
    out.set(key, value);
  }
  return out;
}

/* Phrases first, then characters, so a phrase never silently loses to a
 * single-character rule that happens to be read later. */
const phrases = parse(join(vendor, "TSPhrases.txt"));
const characters = parse(join(vendor, "TSCharacters.txt"));

const merged = new Map();
for (const [k, v] of characters) if (k !== v) merged.set(k, v);
for (const [k, v] of phrases) merged.set(k, v); // phrases win

const entries = [...merged.entries()];
/* Longest first: the runtime walks the table top to bottom and stops at the
 * first prefix match, so ordering here *is* the matching policy. */
entries.sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : 1));

const lines = entries.map(([k, v]) => `${k}\t${v}`);
const tsv = lines.join("\n") + "\n";
writeFileSync(join(here, "ts-conversion.tsv"), tsv, "utf8");

const multi = entries.filter(([k]) => [...k].length > 1).length;
const longest = entries.reduce((n, [k]) => Math.max(n, [...k].length), 0);
const bytes = Buffer.byteLength(tsv, "utf8");

console.log(`data/ts-conversion.tsv`);
console.log(`  entries       ${entries.length}`);
console.log(`  phrases       ${multi}`);
console.log(`  longest key   ${longest} characters`);
console.log(`  size          ${bytes} bytes`);
console.log(`  hash          ${JSON.stringify(tsv).length}`);
