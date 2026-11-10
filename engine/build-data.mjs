// Copies the data files the engine needs into the published package.
//
// They live at the repository root because every platform needs them and they
// are built once, from the same script. Putting them in the npm tarball is what
// makes `npm install pingzhu-engine` a complete install rather than a library
// that cannot decode anything until the user finds the model somewhere else.
//
// The language model is 6.4 MB of TSV, which compresses to well under a third of
// that; npm gzips tarballs, so this is a smaller cost in transit than on disk.

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "data");
const target = join(here, "data");

mkdirSync(target, { recursive: true });

// Every data file the engine reads at run time belongs here. It is a list rather
// than a glob because `../data` also holds build inputs (`vendor/`, `stats.json`)
// that the package has no use for.
//
// This list is a place a file can be forgotten: `shortcuts.tsv` was added to the
// engine in 0.10.9 and stayed out of the npm package for three releases, so an
// npm install could not use phrases at all. When the engine gains a data file,
// it goes here.
for (const name of ["bopomofo-lm.tsv", "ts-conversion.tsv", "shortcuts.tsv"]) {
  copyFileSync(join(source, name), join(target, name));
  console.log(`  ${name}`);
}
