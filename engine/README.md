# pingzhu-engine

A Bopomofo (注音 / Zhuyin) input method engine: reading grid, segmentation,
Viterbi decoding over a lattice, candidate ordering, user dictionary, and
Traditional → Simplified output.

Zero runtime dependencies. Pure TypeScript sources, compiled to ESM for consumers.

```bash
npm install @173787247/pingzhu-engine
```

```js
import { InputEngine, LAYOUTS } from "@173787247/pingzhu-engine";
import { loadDictionary, loadSyllableInventory, loadConverter } from "@173787247/pingzhu-engine/node";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
// The language model ships inside this package.
const data = dirname(require.resolve("@173787247/pingzhu-engine/data/bopomofo-lm.tsv"));

const engine = new InputEngine(
  loadDictionary(`${data}/bopomofo-lm.tsv`),
  loadSyllableInventory(`${data}/bopomofo-lm.tsv`),
  { layout: LAYOUTS.standard, converter: loadConverter(`${data}/ts-conversion.tsv`) },
);

for (const key of "su3cl3") engine.press(key);
engine.bestSentence;      // 你好
engine.candidatePage;     // 你好 妳好 你 妳 擬 …
engine.commit();          // 你好
```

## Two entry points

| Import | Node builtins | Use |
|---|---|---|
| `@173787247/pingzhu-engine` | none | browsers, bundlers, anywhere |
| `@173787247/pingzhu-engine/node` | `node:fs`, `node:path` | loading a model from disk |

The split is enforced by a test, not by a comment: the decoding modules import
no Node builtins, so a browser bundle of `pingzhu-engine` resolves cleanly. The
filesystem helpers are the only thing that needs a filesystem.

## What is in the box

| Export | What it does |
|---|---|
| `InputEngine` | key in, sentence and candidates out |
| `ReadingGrid` | the lattice: segmentation and word selection scored jointly |
| `Dictionary`, `UserDictionary` | the language model and what the user has taught |
| `LAYOUTS` | 大千式 (standard) and 倚天 (eten) keyboards |
| `composeSyllable`, `decomposeSyllable` | 注音 syllable arithmetic |
| `Converter` | longest-match Traditional → Simplified, phrase entries first |

## Data

Both files ship in the package under `data/`:

- `bopomofo-lm.tsv` — 169,604 entries over 131,048 readings
- `ts-conversion.tsv` — the Traditional/Simplified table

The language model is derived from [McBopomofo](https://github.com/openvanilla/McBopomofo)
(MIT), whose grammar is built on libtabe's `tsi.src` (BSD). The conversion table
is from [OpenCC](https://github.com/BYVoid/OpenCC) (Apache-2.0). See the
repository's `NOTICE` for the full attribution.

## The same decoder, four platforms

This package is the reference implementation. A Rust core is held to
byte-identical output against it by 1,529 differential cases, and that core is
what the Windows, macOS, Android and HarmonyOS shells embed — so the same keys
give the same words everywhere.

- Repository: <https://github.com/173787247/pingzhu>
- License: MIT
