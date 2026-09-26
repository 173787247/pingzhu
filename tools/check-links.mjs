#!/usr/bin/env node
/*
 * Link audit, run after the Simplified conversion.
 *
 * The conversion rewrites Chinese everywhere outside code blocks — including
 * link *text* and heading anchors. Two things therefore need checking that a
 * prose conversion would not:
 *
 *   1. URLs must be byte-identical. A converted URL is a dead link, and it is
 *      the kind of damage that only shows up when someone clicks.
 *   2. `](#anchor)` must still match a heading in the same file. GitHub derives
 *      the anchor from the heading text, so converting one and not the other
 *      breaks the jump while looking perfectly fine in the source.
 *
 * Compares the working tree against a git revision, so it catches changes the
 * conversion made rather than asserting properties of the current text alone.
 *
 *   node tools/check-links.mjs [revision]     (default HEAD)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const revision = process.argv[2] ?? "HEAD";

const files = execFileSync("git", ["ls-files", "*.md", "*.txt"], { cwd: repo, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => existsSync(join(repo, f)));

function before(file) {
  try {
    return execFileSync("git", ["show", `${revision}:${file}`], { cwd: repo, encoding: "utf8" });
  } catch {
    return null;
  }
}

/* Everything that is a URL rather than prose. Inline links, autolinks, and bare
 * http(s) mentions all count. */
function urls(text) {
  const found = new Set();
  for (const m of text.matchAll(/\]\(\s*([^)\s]+)/g)) {
    // A same-file anchor is not a URL. It is checked separately, and comparing
    // it here reports the *correct* case — an anchor rewritten together with its
    // heading — as damage.
    if (m[1].startsWith("#")) continue;
    found.add(m[1]);
  }
  for (const m of text.matchAll(/<((?:https?|mailto):[^>\s]+)>/g)) found.add(m[1]);
  for (const m of text.matchAll(/(?<![(<"'\w])((?:https?):\/\/[^\s<>)"'\]]+)/g)) found.add(m[1]);
  for (const m of text.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/g)) found.add(m[1]);
  for (const m of text.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)) found.add(m[1]);
  return found;
}

/* Anchors this file offers: GitHub lowercases, drops punctuation, turns spaces
 * into hyphens, and keeps letters/numbers — including CJK. */
function slugs(text) {
  const out = new Set();
  const seen = new Map();
  for (const line of text.split("\n")) {
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (!m) continue;
    let slug = m[2]
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    // GitHub disambiguates repeated headings with -1, -2, ...
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    out.add(slug);
  }
  return out;
}

function anchors(text) {
  const out = [];
  for (const m of text.matchAll(/\]\(\s*#([^)\s]+)/g)) out.push(m[1]);
  return out;
}

let problems = 0;
let checkedUrls = 0;
let checkedAnchors = 0;
const changedFiles = [];

for (const file of files) {
  const original = before(file);
  const current = readFileSync(join(repo, file), "utf8");

  // 1. URLs must not have changed.
  if (original !== null) {
    const beforeUrls = urls(original);
    const afterUrls = urls(current);
    const lost = [...beforeUrls].filter((u) => !afterUrls.has(u));
    const gained = [...afterUrls].filter((u) => !beforeUrls.has(u));
    if (lost.length || gained.length) {
      problems++;
      console.log(`URL CHANGED  ${file}`);
      for (const u of lost) console.log(`   - ${u}`);
      for (const u of gained) console.log(`   + ${u}`);
    }
    checkedUrls += beforeUrls.size;
    if (original !== current) changedFiles.push(file);
  }

  // 2. Anchors must resolve to a heading in the same file.
  const available = slugs(current);
  for (const anchor of anchors(current)) {
    checkedAnchors++;
    if (available.has(anchor)) continue;
    problems++;
    console.log(`DANGLING ANCHOR  ${file}  #${anchor}`);
  }

  // 3. Relative link targets must still exist.
  for (const m of current.matchAll(/\]\(([^)\s#][^)\s]*)/g)) {
    const target = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // absolute URL
    const path = target.split("#")[0];
    if (!path) continue;
    if (!existsSync(join(repo, dirname(file), decodeURIComponent(path)))) {
      problems++;
      console.log(`MISSING TARGET  ${file}  -> ${target}`);
    }
  }
}

console.log(`\nfiles scanned      ${files.length}`);
console.log(`files converted    ${changedFiles.length}`);
console.log(`URLs compared      ${checkedUrls}`);
console.log(`anchors resolved   ${checkedAnchors}`);
console.log(problems === 0 ? "\nno link or anchor damage" : `\n${problems} PROBLEM(S)`);
process.exit(problems === 0 ? 0 : 1);
