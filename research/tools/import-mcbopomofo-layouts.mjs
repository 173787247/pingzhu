#!/usr/bin/env node
/*
 * Transcribes the reference implementation's keyboard layouts into the engine's
 * component indices.
 *
 * `data/vendor/` holds McBopomofo (MIT) verbatim and is deliberately gitignored —
 * it is a reference, not a dependency, and 8 MB of someone else's source does not
 * belong in this repository. So this runs on a machine that has the vendor drop,
 * and its *output* is what gets committed, in engine/src/keyboard.ts and
 * core-rs/src/keyboard.rs.
 *
 * Why a generator rather than hand transcription: the engine's own note said the
 * 許氏 layout must be "ported from a source with tests", and a table typed by hand
 * from memory is exactly the kind of thing that is wrong in one cell and silent
 * about it. This reads the table the reference actually uses.
 *
 * usage: node research/tools/import-mcbopomofo-layouts.mjs [--json]
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The vendor drop is verbatim MIT source and stays that way. Two things stop Node
 * from importing it directly: its relative imports have no file extension, and it
 * uses a TypeScript parameter property, which `--experimental-strip-types` refuses
 * ("strip-only mode"). Compiling it with the engine's own TypeScript — to CommonJS,
 * so the extensionless requires resolve — is the least invasive way in.
 */
function loadReference() {
  const engine = join(here, "../../engine");
  const outDir = mkdtempSync(join(tmpdir(), "mcbopomofo-"));
  try {
    // tsc exits 2 on the type error below even though it emits; the emit is what
    // this needs.
    execFileSync(
      join(engine, "node_modules/.bin/tsc"),
      ["--module", "commonjs", "--target", "es2022", "--skipLibCheck",
       "--outDir", outDir,
       join(here, "../../data/vendor/BopomofoSyllable.ts"),
       join(here, "../../data/vendor/BopomofoKeyboardLayout.ts")],
      { stdio: "pipe" },
    );
  } catch {
    // expected: the vendor drop has no BopomofoCharacterMap.ts
  }
  // The vendor drop omits BopomofoCharacterMap, which the compiled syllable
  // module requires at load time. The layout tables never consult it — it is the
  // character<->component half of the reference — but the require is eager, so a
  // stub is what makes the module loadable. If a table ever needed it, this
  // script would fail loudly at the call, not silently.
  writeFileSync(
    join(outDir, "BopomofoCharacterMap.js"),
    "class BopomofoCharacterMap {\n" +
      "  constructor() { this.characterToComponent = new Map(); this.componentToCharacter = new Map(); }\n" +
      "}\n" +
      "BopomofoCharacterMap.sharedInstance = new BopomofoCharacterMap();\n" +
      "module.exports = { BopomofoCharacterMap };\n",
  );
  const require = createRequire(import.meta.url);
  return require(join(outDir, "BopomofoKeyboardLayout.js"));
}

const { BopomofoKeyboardLayout } = loadReference();

/**
 * The reference stores components as bit flags. Every one of them maps 1:1 onto
 * the engine's (kind, index) pairs, because the engine's indices were taken from
 * the same ordering — see the header of engine/src/keyboard.ts.
 */
function classify(component) {
  if (component >= 0x0001 && component <= 0x0015) return { kind: "consonant", index: component };
  if (component === 0x0020) return { kind: "medial", index: 1 };
  if (component === 0x0040) return { kind: "medial", index: 2 };
  if (component === 0x0060) return { kind: "medial", index: 3 };
  if (component >= 0x0080 && component <= 0x0680 && component % 0x0080 === 0) {
    return { kind: "vowel", index: component / 0x0080 };
  }
  if (component === 0x0000) return { kind: "tone", index: 0 };
  if (component >= 0x0800 && component <= 0x2000 && component % 0x0800 === 0) {
    return { kind: "tone", index: component / 0x0800 };
  }
  throw new Error(`unknown component flag 0x${component.toString(16)}`);
}

const KEYS = "1234567890qwertyuiopasdfghjkl;zxcvbnm,./-".split("");

const LAYOUTS = [
  ["hsu", "許氏", BopomofoKeyboardLayout.HsuLayout],
  ["eten26", "倚天 26 鍵", BopomofoKeyboardLayout.ETen26Layout],
  ["ibm", "IBM", BopomofoKeyboardLayout.IBMLayout],
  ["ginyieh", "精業", BopomofoKeyboardLayout.GinYiehLayout],
  ["mitac", "神通", BopomofoKeyboardLayout.MitacLayout],
];

const json = process.argv.includes("--json");
const wantTs = process.argv.includes("--ts");
const wantRust = process.argv.includes("--rust");
const out = {};

for (const [id, label, layout] of LAYOUTS) {
  const entries = [];
  for (const key of KEYS) {
    const components = layout.keyToComponents(key);
    if (components.length === 0) continue;
    entries.push([key, components.map(classify)]);
  }
  // The reference has no tone-1 key in these layouts (space does that job), but
  // ask rather than assume: a layout that grows one should not need an edit here.
  const tone1 = layout.componentToKey(0x0000) ?? "";
  out[id] = { label, tone1Keys: tone1 ? [tone1] : [], entries };
}

function emitTs() {
  const lines = [];
  for (const [id, { label, tone1Keys, entries }] of Object.entries(out)) {
    const fn = id.toUpperCase().replace(/[^A-Z0-9]/g, "") + "_LAYOUT";
    lines.push(`export const ${fn} = layout(`);
    lines.push(`  "${id}",`);
    lines.push(`  "${label}",`);
    lines.push(`  [`);
    // Keep the engine's presentation: one key per line, alphabetical, so a diff
    // against the generated table is readable.
    for (const [key, components] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const text = components.map((c) => `comp("${c.kind}", ${c.index})`).join(", ");
      lines.push(`    ["${key}", [${text}]],`);
    }
    lines.push(`  ],`);
    lines.push(`  ${JSON.stringify(tone1Keys)},`);
    lines.push(`);`);
    lines.push("");
  }
  return lines.join("\n");
}

function emitRust() {
  const lines = [];
  for (const [id, { entries }] of Object.entries(out)) {
    const fn = `${id}_components`;
    const statics = [];
    const arms = [];
    for (const [key, components] of entries) {
      if (components.length === 1) {
        const [c] = components;
        const name = { consonant: "CONS", medial: "MEDS", vowel: "VOWS", tone: "TONES" }[c.kind];
        arms.push(`        '${key}' => &${name}[${c.index}..${c.index} + 1],`);
      } else {
        const staticName = `${id.toUpperCase()}_${key.toUpperCase()}`.replace(/[^A-Z0-9_]/g, "_");
        const items = components
          .map((c) => `${({ consonant: "cons", medial: "med", vowel: "vow", tone: "tone" })[c.kind]}(${c.index})`)
          .join(", ");
        statics.push(`static ${staticName}: [Component; ${components.length}] = [${items}];`);
        arms.push(`        '${key}' => &${staticName},`);
      }
    }
    lines.push(`fn ${fn}(key: char) -> &'static [Component] {`);
    lines.push(`    match key {`);
    lines.push(...arms);
    lines.push(`        _ => &[],`);
    lines.push(`    }`);
    lines.push(`}`);
    if (statics.length) {
      lines.push("");
      lines.push(...statics);
    }
    lines.push("");
  }
  return lines.join("\n");
}

if (wantTs) {
  process.stdout.write(emitTs());
} else if (wantRust) {
  process.stdout.write(emitRust());
} else if (json) {
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
} else {
  for (const [id, { label, tone1Keys, entries }] of Object.entries(out)) {
    console.log(`\n// ${id} — ${label}`);
    console.log(`// tone1Keys: ${tone1Keys.length ? JSON.stringify(tone1Keys) : "[] (space)"}`);
    for (const [key, components] of entries) {
      const text = components
        .map((c) => `${c.kind.slice(0, 1)}${c.index}`)
        .join(" ");
      console.log(`  ["${key}", [${components.map((c) => `comp("${c.kind}", ${c.index})`).join(", ")}]],  // ${text}`);
    }
  }
}
