#!/usr/bin/env node
/*
 * Convert the repository's GitHub-side text to Simplified: the About
 * description and every release title and body.
 *
 * These live on GitHub, not in the repository, so the normal tooling does not
 * reach them — but they are the first thing anyone reads, and mixing scripts
 * between the README and the release page looks careless.
 *
 * Two safety rules, both learned from the document conversion:
 *
 *   - code blocks are left alone. Release notes are full of `commands` and
 *     paths, and "translating" those breaks them.
 *   - every URL is compared before and after. A converted URL is a dead link
 *     that only shows up when someone clicks it.
 *
 *   node tools/simplify-github.mjs --check     report only
 *   node tools/simplify-github.mjs             apply
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Converter } from "../engine/src/converter.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apply = !process.argv.includes("--check");
const converter = Converter.fromFile(join(repo, "data", "ts-conversion.tsv"));

const gh = (...args) =>
  execFileSync("gh", args, { cwd: repo, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

/* Fenced blocks and inline spans are code, not prose. */
const CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
const convertMarkdown = (text) =>
  text
    .split(CODE)
    .map((part, i) => (i % 2 === 1 ? part : converter.toSimplified(part)))
    .join("");

function urls(text) {
  const found = new Set();
  for (const m of text.matchAll(/\]\(\s*([^)\s]+)/g)) if (!m[1].startsWith("#")) found.add(m[1]);
  for (const m of text.matchAll(/<((?:https?|mailto):[^>\s]+)>/g)) found.add(m[1]);
  for (const m of text.matchAll(/(?<![(<"'\w])((?:https?):\/\/[^\s<>)"'\]]+)/g)) found.add(m[1]);
  return found;
}

function urlDiff(before, after) {
  const b = urls(before);
  const a = urls(after);
  return {
    lost: [...b].filter((u) => !a.has(u)),
    gained: [...a].filter((u) => !b.has(u)),
    count: b.size,
  };
}

let problems = 0;
let changed = 0;

// ------------------------------------------------------------------ About
const about = gh("repo", "view", "--json", "description", "--jq", ".description").trim();
const aboutNew = converter.toSimplified(about);
if (aboutNew !== about) {
  changed++;
  console.log("About description");
  console.log(`  - ${about}`);
  console.log(`  + ${aboutNew}`);
  if (apply) gh("repo", "edit", "--description", aboutNew);
} else {
  console.log("About description  unchanged");
}

// --------------------------------------------------------------- releases
const releases = JSON.parse(
  gh("api", "repos/173787247/pingzhu/releases", "--jq", "[.[] | {tag: .tag_name, name: .name, body: .body}]"),
);

const staging = mkdtempSync(join(tmpdir(), "pingzhu-releases-"));
let totalUrls = 0;

for (const release of releases) {
  const title = release.name ?? "";
  const body = release.body ?? "";
  const titleNew = converter.toSimplified(title);
  const bodyNew = convertMarkdown(body);

  const diff = urlDiff(body, bodyNew);
  totalUrls += diff.count;
  if (diff.lost.length || diff.gained.length) {
    problems++;
    console.log(`\nURL CHANGED  ${release.tag}`);
    for (const u of diff.lost) console.log(`   - ${u}`);
    for (const u of diff.gained) console.log(`   + ${u}`);
    continue;
  }

  if (titleNew === title && bodyNew === body) {
    console.log(`${release.tag}  unchanged`);
    continue;
  }
  changed++;
  console.log(`${release.tag}  converting`);
  console.log(`   title: ${title}`);
  console.log(`      ->  ${titleNew}`);

  if (apply) {
    const notes = join(staging, `${release.tag}.md`);
    writeFileSync(notes, bodyNew, "utf8");
    gh("release", "edit", release.tag, "--title", titleNew, "--notes-file", notes);
  }
}

console.log(`\nreleases           ${releases.length}`);
console.log(`items converted    ${changed}`);
console.log(`URLs compared      ${totalUrls}`);
console.log(problems ? `\n${problems} PROBLEM(S) — nothing further was applied` : apply ? "\napplied" : "\n(dry run)");
process.exit(problems === 0 ? 0 : 1);
