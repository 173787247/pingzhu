# PingZhu 平注

**English** ｜ [简体中文](README.md)

An open-source, cross-platform **Bopomofo (注音 / Zhuyin)** input method for Windows,
Android, macOS, HarmonyOS NEXT and Linux.

Named after 平注 (píng zhù) — *plain Zhuyin* — for the same reason 自然輸入法 is named after
natural input: it describes what the thing does, and it is not a trademark anyone else owns.

---

## Download

| Platform | File |
|---|---|
| **Windows 10/11** | **[⬇ pingzhu-0.7.6-setup.exe](https://github.com/173787247/pingzhu/releases/download/v0.8.0/pingzhu-0.7.6-setup.exe)**　·　[portable ZIP](https://github.com/173787247/pingzhu/releases/download/v0.8.0/pingzhu-0.7.6-win-x64.zip) |
| **Android 8+** | **[⬇ pingzhu-0.8.0-android.apk](https://github.com/173787247/pingzhu/releases/download/v0.8.0/pingzhu-0.8.0-android.apk)** |
| **macOS 12+** ⚠️ | **[pingzhu-0.9.0-macos-UNVERIFIED.zip](https://github.com/173787247/pingzhu/releases/download/v0.8.0/pingzhu-0.9.0-macos-UNVERIFIED.zip)** ([needs verifying on a Mac first](macos/TESTING.md)) |

**Windows** installs to `%LOCALAPPDATA%\Programs\PingZhu` with no administrator rights.
`Ctrl+Alt+Z` switches Chinese/English, `Ctrl+Alt+S` switches Traditional/Simplified (or use
the floating button in the corner). Type `su3cl3` and 你好 appears. Details in
[windows/README.md](windows/README.md).

**Android** needs no permissions at all — no network, no storage, no contacts. Enable it
under Settings → System → Languages & input → On-screen keyboard, then select it. Details in
[android/README.md](android/README.md).

Both write `pingzhu.ini`, so the setting is the same on every platform.

---

## Status

**M0–M4c and M6 are done: Windows and Android are usable today.**

| Platform | Framework | Engine | Shell |
|---|---|---|---|
| **Windows 10/11** | **TSF text service (in the language bar)** | ✅ C ABI | ✅ **usable** ([windows/](windows/README.md)) |
| Windows 10/11 | Portable (tray + global hook + injection) | ✅ C ABI | ✅ usable (no admin rights) |
| **Android 8+** | **`InputMethodService`** | ✅ C ABI (JNI) | ✅ **usable** ([android/](android/README.md)) |
| **macOS 12+** | **InputMethodKit (IMK)** | ✅ C ABI | ⚠️ **builds, bundles, and the engine is exercised on macOS in CI** ([macos/](macos/README.md)) · **the IMK layer is not verified on hardware** |
| HarmonyOS NEXT | IME Kit / `InputMethodExtensionAbility` | ✅ C ABI (NAPI) | technically confirmed, commercial process unverified ([docs/03](docs/03-platform-matrix.md)) |
| Linux | fcitx5 / ibus addon | ✅ C ABI | optional |

**All three shells embed the same Rust core.** The same keys give the same words on Windows
and Android — not by intention, but because 1,529 differential cases hold the Rust core to
byte-identical output against the TypeScript reference implementation.

---

## Why this exists

### 0. Bopomofo is slightly less typing — but less than intuition suggests, and it was measured

The interesting claim about Zhuyin is that it is faster than Pinyin. It is, but the honest
number is smaller than the folk number. `tools/zhuyin-vs-pinyin.mjs` computes it over the
language model, weighted by word frequency, and counts two costs separately: **spelling**
the syllable, and **choosing** the right word from the candidates.

| | Zhuyin | Pinyin | Difference |
|---|---|---|---|
| Keys per character (2–4 syllable scope) | 2.94 | 3.02 | |
| **Effective keys per character** (spelling + selection) | **2.95** | **3.07** | **Zhuyin 3.8% fewer** |
| Top-1 accuracy, frequency-weighted | 97.98% | 87.58% | |
| Mean ambiguity | 7.25 | 19.52 | |

Across every entry in the model the gap widens to **5.0%**. The saving splits about 63%
spelling and 37% selection: Pinyin's advantage in spelling (`zhong` is five letters) is
partly repaid by its longer candidate lists.

**3.8–5.0% is an upper bound.** The Pinyin side is a competent-but-not-exceptional
implementation, and real-world IMEs are better than it. The point of the exercise is not
that Zhuyin wins by a lot — it is that **the argument should be made with a number, and the
number is smaller than the one usually quoted.** Full method and limitations in
[docs/09](docs/09-zhuyin-vs-pinyin.md).

### 1. The incumbent has no mobile version, and says so

自然輸入法 (IQ Technology, in the market since 1995) ships only on Windows and macOS. Its own
support centre publishes articles literally titled "not supported" for iPad/iPhone, Linux
and Android tablets.

### 2. The licensing model generates friction

The support burden is overwhelmingly activation, device-transfer and subscription failures
rather than typing questions. That is a business-model artefact, not a technical one.

### 3. The open-source ecosystem has parts, but no product

There are excellent pieces — McBopomofo's MIT-licensed data and decoder, libtabe's `tsi.src`,
OpenCC's conversion tables — and no assembled, cross-platform input method built from them.

---

## Quick start

```bash
cd engine
node --test                    # 66 tests
node cli.ts                    # interactive: type Bopomofo keys, watch it decode
node cli.ts su3cl3 ji394su3    # non-interactive

node bench.mjs 2000            # decode quality, reproducible
node bench-learn.mjs           # personalisation, reproducible
```

Any Node ≥ 22.6 — the sources run directly, with no build step, using Node's own type
stripping.

### As a library

```bash
npm install pingzhu-engine
```

```js
import { InputEngine, LAYOUTS } from "pingzhu-engine";
import { loadDictionary, loadSyllableInventory, loadConverter } from "pingzhu-engine/node";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const data = dirname(require.resolve("pingzhu-engine/data/bopomofo-lm.tsv"));

const engine = new InputEngine(
  loadDictionary(`${data}/bopomofo-lm.tsv`),
  loadSyllableInventory(`${data}/bopomofo-lm.tsv`),
  { layout: LAYOUTS.standard, converter: loadConverter(`${data}/ts-conversion.tsv`) },
);

for (const key of "su3cl3") engine.press(key);
engine.bestSentence;    // 你好
engine.commit();        // 你好
```

`pingzhu-engine` imports no Node builtins, so it loads in a browser; the filesystem helpers
are behind `pingzhu-engine/node`. The split is enforced by a test, not by a comment.

---

## As a library

The engine stands alone, with zero runtime dependencies:

**Option 1 — the tarball on the release page** (no account, no setup; recommended)

```bash
npm install https://github.com/173787247/pingzhu/releases/download/v0.8.0/pingzhu-engine-0.8.0.tgz
```

**Option 2 — GitHub Packages** (needs a GitHub token first)

```bash
npm install @173787247/pingzhu-engine
```

> GitHub Packages **requires authentication even to install public packages** — not
> assumed, verified on this exact package:
> `npm error 401 Unauthorized - authentication token not provided`
>
> To use it, configure once: `echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc`

```js
import { InputEngine, LAYOUTS } from "@173787247/pingzhu-engine";
import { loadDictionary, loadSyllableInventory, loadConverter } from "@173787247/pingzhu-engine/node";
```

The main entry imports **no Node builtins**, so browsers and bundlers can use it;
the filesystem helpers live under `/node`. That split is enforced by a test, not by
a comment.

## Architecture

```
                     data/bopomofo-lm.tsv  (169,604 entries / 131,048 readings)
                     data/ts-conversion.tsv (Traditional → Simplified)
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
     engine/  TypeScript                     core-rs/  Rust
     the reference implementation            byte-identical to it
     66 tests                                26 tests + 1,529 differential cases
              │                                       │
              │                        ┌──────────────┼──────────────┐
              │                        │              │              │
              │                   windows/        android/       (macOS,
              │                   TSF + portable   JNI + Kotlin    HarmonyOS)
              │                        │              │
              └──── same data ─────────┴──────────────┘
```

**The TypeScript engine is the specification.** The Rust core is held to it by 1,529
differential cases and is what every platform shell embeds. One decoder, four platforms —
if a word decodes differently on the phone than on the desktop, that is a bug with a name,
not a port that drifted.

### The reading grid

A syllable is 聲母 + 介音 + 韻母 + 聲調. Keys compose into readings, readings into a lattice,
and segmentation and word selection are scored **jointly** — the decoder does not pick
syllable boundaries first and words second, because those two decisions depend on each
other. Viterbi over the lattice picks the best sentence; the candidate list comes from the
same scores, so the ordering and the default agree by construction.

One rule earns its own name: a dictionary word's score may not fall below the best
decomposition of its own span (`promoteWordsOverDecomposition`). Without it the decoder
prefers three mediocre characters to one good word.

---

## Project status

| Milestone | What | Status |
|---|---|---|
| **M0** | Decoder: keyboard, segmentation, reading-grid Viterbi, candidates | ✅ done |
| **M1** | Data pipeline: compile McBopomofo's open data into a portable model | ✅ done |
| **M2** | Personalisation: user dictionary, learned ordering, paging | ✅ done |
| **M3** | Rust core + C ABI (differential tests against the TS reference) | ✅ done |
| **M4a** | Windows portable shell (tray, hook, candidate window, injection) | ✅ done |
| **M4b** | Windows TSF shell: language bar, composition, display attributes, candidate positioning | ✅ done |
| **M4c** | Simplified output: OpenCC table, hotkey / floating button / config file | ✅ done |
| **M6** | Android `InputMethodService`: self-drawn keyboard, candidate bar, JNI | ✅ done |
| **M5** | macOS IMK shell: IMKInputController, candidate NSPanel, built and engine-tested in CI | ⚠️ the IMK layer is not verified on hardware |
| **M7** | HarmonyOS IME Kit shell | researching |
| **M8** | Symbol table, word association, text shortcuts | to do |

Tests: **66 TypeScript**, **26 Rust** (including 1,529 differential cases), **3 Windows
native suites** (key routing, engine integration, TSF COM contract), **12 Android JVM**
(key routing — no emulator needed).

Scheduling, effort and risk: [docs/05-roadmap.md](docs/05-roadmap.md).

---

## Documentation

| | |
|---|---|
| [docs/01](docs/01-competitive-analysis.md) | Competitive analysis: 35 years of the incumbent, pricing, platform matrix, pain points |
| [docs/02](docs/02-architecture.md) | Architecture decisions: permissive core, native shells, why not Flutter |
| [docs/03](docs/03-platform-matrix.md) | Input method frameworks per platform, signing and store limits, HarmonyOS feasibility |
| [docs/04](docs/04-data-and-licensing.md) | Licence of every usable component, data provenance, the minefield list |
| [docs/05](docs/05-roadmap.md) | MVP → v1: sequence, effort estimates, risks, fallbacks |
| [docs/06](docs/06-engine-design.md) | Engine internals: segmentation, the reading grid, data format, evaluation |
| [docs/07](docs/07-research-tooling.md) | The research toolchain in this repository (reproducible evidence) |
| [docs/08](docs/08-self-built-data.md) | **The data layer can be built from scratch**: Unihan readings, frequency formula, unsupervised new-word discovery |
| [docs/09](docs/09-zhuyin-vs-pinyin.md) | **Zhuyin vs Pinyin, measured**: method, two scopes, self-validation, five explicit limitations |
| [core-rs/](core-rs/README.md) | **Rust core + C ABI**: how a shell connects, how it is verified |
| [windows/](windows/README.md) | **Windows input method**: usage, build, limitations |
| [android/](android/README.md) | **Android input method**: build, design trade-offs, known limitations |
| [macos/](macos/README.md) | **macOS input method**: build, what CI verifies, design and limits |

---

## License

MIT. See [LICENSE](LICENSE).

The language model is derived from [McBopomofo](https://github.com/openvanilla/McBopomofo)
(MIT), whose grammar is built on libtabe's `tsi.src` (BSD). The conversion table is from
[OpenCC](https://github.com/BYVoid/OpenCC) (Apache-2.0). Full attribution in [NOTICE](NOTICE).

**No telemetry, no network calls, no permissions.** The language model ships with the
application; the user dictionary stays in the user's own directory.
