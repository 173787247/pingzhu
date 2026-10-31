# PingZhu 平注

**English** ｜ [简体中文](README.zh-CN.md)

[![release](https://img.shields.io/github/v/release/173787247/pingzhu?include_prereleases&label=release&color=orange)](https://github.com/173787247/pingzhu/releases) [![engine tests](https://img.shields.io/badge/engine%20tests-68%2F68-brightgreen)](#quick-start) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![data](https://img.shields.io/badge/data-MIT%20%2B%20BSD-lightgrey)](NOTICE)

An open-source, cross-platform **Bopomofo (注音 / Zhuyin)** input method for
Windows, Android, macOS, HarmonyOS NEXT and Linux.

Named after 平注 (píng zhù) — *plain Zhuyin* — for the same reason 自然输入法 is named
after natural input: it describes what the thing does, and it is not a trademark
anyone else owns.

**[▶ Try it in a browser](https://173787247.github.io/pingzhu/)** — nothing to install.
Type `su3cl3` and watch the engine decode it, using the same modules the test suite
runs against.

![The browser demo, with su3cl3 typed: the composition line reads ㄋㄧˇ ㄏㄠˇ, the sentence line reads 你好, and the candidate strip lists 你好 妳好 你 妳 擬 昵 旎 薿 禰 抳](docs/images/demo-su3cl3.png)

*The demo, running the real engine, with `su3cl3` typed but not yet committed.
Top to bottom: the composition line holds the reading the keys spelled
(ㄋㄧˇ ㄏㄠˇ); the sentence line is what the decoder would commit (你好), green
because it is also the best candidate; the candidate strip is the whole first
page — 31 candidates over 4 pages for this reading, ordered by the same scores
that picked the sentence. The badge says 打字模式（數字是注音鍵）, *typing mode —
the digits are Bopomofo keys*: on a 大千式 keyboard `3` is ˇ and `6` is ˊ, so
digits only select candidates once the candidate window is open. The status line
reports what was loaded: 170,145 entries, 1,413 legal syllables.*

---

## Download

| Platform | File |
|---|---|
| **Windows 10/11** | **[⬇ pingzhu-0.10.6-setup.exe](https://github.com/173787247/pingzhu/releases/download/v0.10.6/pingzhu-0.10.6-setup.exe)**　·　[portable ZIP](https://github.com/173787247/pingzhu/releases/download/v0.10.6/pingzhu-0.10.6-win-x64.zip) |
| **Android 8+** | **[⬇ pingzhu-0.10.6-android.apk](https://github.com/173787247/pingzhu/releases/download/v0.10.6/pingzhu-0.10.6-android.apk)** |
| **macOS 12+** ⚠️ | **[pingzhu-0.9.0-macos-UNVERIFIED.zip](https://github.com/173787247/pingzhu/releases/download/v0.8.0/pingzhu-0.9.0-macos-UNVERIFIED.zip)** ([needs verifying on a Mac first](macos/TESTING.md))<br>**0.10.6 ships no macOS build** — the input method needs an Apple-issued Developer ID to register with the system, and that enrolment is still pending. |

**HarmonyOS** ships no installer — it produces a project, built from source.
**Linux** ships two packages, or the same addon for anyone building from source:

| Platform | What to take | How to install |
|---|---|---|
| **HarmonyOS NEXT** | **[pingzhu-0.10.6-harmonyos-project.zip](https://github.com/173787247/pingzhu/releases/download/v0.10.6/pingzhu-0.10.6-harmonyos-project.zip)** | Open `harmonyos/` in DevEco, sign, Run ([steps](harmonyos/README.md)) |
| **Linux** | **[fcitx5-pingzhu_0.10.6_amd64.deb](https://github.com/173787247/pingzhu/releases/download/v0.10.6/fcitx5-pingzhu_0.10.6_amd64.deb)**　·　[fcitx5-pingzhu-0.10.6-1.x86_64.rpm](https://github.com/173787247/pingzhu/releases/download/v0.10.6/fcitx5-pingzhu-0.10.6-1.x86_64.rpm) | Debian-based: `sudo dpkg -i …`　·　RPM-based: `sudo rpm -ivh …` ([linux/](linux/README.md)) |

**Windows** installs to `%LOCALAPPDATA%\Programs\PingZhu` with no administrator rights.
`Ctrl+Alt+Z` switches Chinese/English, `Ctrl+Alt+S` switches Traditional/Simplified (or use
the floating button in the corner). Type `su3cl3` and 你好 appears. Details in
[windows/README.md](windows/README.md).

![The portable Windows shell in a real window: the composition reads ㄋㄧˇ ㄏㄠˇ and the candidate window lists 你好 妳好 你 妳 擬 昵 旎 薿 禰 抳 under a → 你好 line](docs/images/windows-candidate.png)

*The portable shell (`pingzhu-ime.exe`) running in a real window on Windows 11, with
`su3cl3` typed and `↓` pressed. The composition line is ㄋㄧˇ ㄏㄠˇ — the keys never
reached the application, because `s` and the rest are Bopomofo keys, not text. The
candidate window shows the first of four pages (31 candidates) with `→ 你好` as what
空格 would commit. Digits select only here, in 選字模式: with the window closed they
are Bopomofo keys again (1 ㄅ 2 ㄉ 3 ˇ 4 ˋ 5 ㄓ 6 ˊ 7 ˙ 8 ㄚ 9 ㄞ 0 ㄢ). The picture
predates a fix: the status line below 選字模式 used to be drawn taller than the window
holding it, so its lower half was cut off. The line offsets now live once, in
`candidate_window.h` under `layout::`, shared by the painter and the layout, and
`pingzhu-candidate-test.exe` holds them there.*

**Android** needs no permissions at all — no network, no storage, no contacts. Enable it
under Settings → System → Languages & input → On-screen keyboard, then select it. Details in
[android/README.md](android/README.md).

![PingZhu on an Android 13 emulator: a candidate row above the keyboard showing the composition ㄋㄧˇ, the sentence 你, and numbered candidates 1 你 2 妳 3 擬 4 昵 5 旋…](docs/images/android-candidates.png)

*Running on an Android 13 (API 33) emulator — a Pixel-5-sized x86_64 image under KVM inside
WSL, with the APK installed and the input method selected; `su3` was typed, 空白 opened the
list and ▼ paged twice. The band above the keyboard is the candidate row: the composition
being typed, the word 空白 would commit, and the numbered candidates a digit key picks from.
▼ is the browsing key — the only one a phone board has, where the desktop shells have ↓. The keyboard is not a
hand-drawn asset: `Engine.keyboardRows()` derives every key from the same table the decoder
reads, and a test (`the_drawn_keyboard_matches_the_decoder`) holds the two together. Note the
digit row — `1` is ㄅ, `3` is ˇ, `6` is ˊ. Those are Bopomofo keys, and they only select while
the candidate row is open, exactly as on the desktop.*

Every shell writes the same `pingzhu.ini`, so a setting means the same thing on every platform.

---

## How a keystroke becomes a character

![The decode pipeline: keystrokes → KeyboardLayout → segmentation → ReadingGrid + Viterbi → 你好 plus candidates, with bopomofo-lm.tsv feeding the grid](docs/images/pipeline.png)

*One decode, left to right. **KeyboardLayout** turns a key into a phonetic component
(聲母 consonant, 介音 medial, 韻母 vowel, 聲調 tone) — `s` is ㄋ, `u` is ㄧ, `3` is ˇ.
**Segmentation** enumerates every legal way those components could be cut into
syllables, including the half-typed states a person passes through on the way.
**ReadingGrid + Viterbi** lays every dictionary word that fits each span onto a grid
and scores segmentation and word choice **together**, in one pass, then keeps the
highest-scoring path. The output is a sentence plus the candidate list, which comes
from the same scores — so the ordering and the default cannot disagree.
The figure is generated by [`tools/render-figures.mjs`](tools/render-figures.mjs)
from the same `data/bopomofo-lm.tsv` the engine loads, so its numbers cannot drift
from the engine's.*

One rule earns its own name: a dictionary word's score may not fall below the best
decomposition of its own span (`promoteWordsOverDecomposition`). Without it the decoder
prefers three mediocre characters to one good word.

**The TypeScript engine is the specification.** The Rust core is held to it by 1,532
recorded keystroke strings and is what every platform shell embeds. One decoder, five
platforms — if a word decodes differently on the phone than on the desktop, that is a bug
with a name, not a port that drifted.

---

## Status

![Five platforms and six shells: Windows TSF, Windows portable, Android and HarmonyOS are usable; Linux and macOS build and run the engine but have not been accepted by a desktop or by the system](docs/images/platforms.png)

**Five platforms, six shells, one Rust core.**

| Platform | Framework | Engine | Shell |
|---|---|---|---|
| **Windows 10/11** | **TSF text service (in the language bar)** | ✅ C ABI | ✅ **usable** ([windows/](windows/README.md)) |
| Windows 10/11 | Portable (tray + global hook + injection) | ✅ C ABI | ✅ usable (no admin rights) |
| **Android 8+** | **`InputMethodService`** | ✅ C ABI (JNI) | ✅ **usable** ([android/](android/README.md)) |
| **HarmonyOS NEXT** | **IME Kit / `InputMethodExtensionAbility`** | ✅ C ABI (NAPI, statically linked) | ✅ **typed 你好 on real hardware (Mate XT · HarmonyOS 6.1)** ([harmonyos/](harmonyos/README.md)) |
| **Linux** | **fcitx5 addon** | ✅ C ABI (statically linked) | ⚠️ **builds; the engine is exercised against the installed data** ([linux/](linux/README.md)) · **not typed on a real desktop** |
| **macOS 12+** | **InputMethodKit (IMK)** | ✅ C ABI | ⚠️ **builds, bundles and runs on real hardware** · **the system does not accept it yet** ([macos/](macos/README.md)) |

The same keys give the same words on Windows and Android — not by intention, but because
the differential harness replays 1,532 keystroke strings through both implementations and
compares composing text, chosen sentence, score, path words and first candidate page.

### The two that are not ticked yet

**macOS**: it compiles, bundles, signs and runs its engine on real hardware, and the input
menu never lists it. **"It is a macOS 26 problem" is not what the evidence says** —
[`.github/workflows/macos-signing-probe.yml`](.github/workflows/macos-signing-probe.yml) was run
on three GitHub runners in 2026-10 (`spctl -a` returns `rejected` for every one of them):

| macOS | ad-hoc | self-signed, trusted locally |
|---|---|---|
| 14.8.9 | ✗ not listed | ✗ not listed |
| 15.7.9 | ✗ not listed | ✗ not listed |
| 26.6.2 | ✗ not listed | ✗ not listed |

**CI has always been green, but not because the system accepted it** — `macos/Tests/Install/main.swift`
prints "the system does not list it" as a `note` and exits 0, because that is a *finding*, not a
defect. Its own comment already says the mechanism is unknown; this table settles the part that
can be settled: changing the signing identity does not help, on any of the three versions.

So the one candidate left untried is an Apple-issued Developer ID — the experiment matrix and the
enrolment requirements are in [macos/README.md](macos/README.md).

**Linux**: the engine passes the same three phrases in CI, and fcitx5 really does load the
addon and start the engine; **typing on a desktop has not been made to work**, because WSLg
does not forward input methods — see [linux/README.md](linux/README.md).

---

## Why the keystrokes decide nothing on their own

![The keystroke stream j i 3 9 4 s u 3 with ㄨ ㄛ ˇ ㄞ ˋ ㄋ ㄧ ˇ under it, then two readings: ㄨㄛˇ-ㄞˋ-ㄋㄧˇ → 我愛你, score -5.398, chosen; ㄨㄛˇ-ㄋㄞˋ-ㄧˇ → 我 耐 以, score -9.678, not chosen](docs/images/example-ji394su3.png)

*`ji394su3` is the classic case, and both rows are the engine's own arithmetic.
The keyboard gives ㄨㄛˇ-ㄞˋ-ㄋㄧˇ (我愛你, "I love you") — one word spanning three
syllables, −5.398. But the same eight keys also give ㄨㄛˇ-ㄋㄞˋ-ㄧˇ, which is
three perfectly ordinary characters: 我 耐 以, −9.678. Nothing in the keystroke
stream marks where a syllable ended, so both readings are legal; the scores are
log₁₀ probabilities, the higher the better, and the gap is 4.28. That gap is the
entire reason syllable segmentation and word selection are scored in one pass
instead of two: a decoder that segmented first would have had to commit before it
knew which word it was choosing. The figure runs `ReadingGrid` twice — once via
`press()` on the whole stream, once with the alternative cut forced — so both
numbers are reproducible with `node tools/render-figures.mjs`.*

---

## The keyboard

![The 大千式 keyboard: 41 keys, each showing its Latin key and its Bopomofo symbol, with the s u 3 c l keys highlighted in press order for su3cl3](docs/images/keyboard-standard.png)

*The 大千式 layout — the one Taiwanese users mean by 注音鍵盤 — all 41 keys,
read from the engine's own layout table rather than transcribed by hand.
Highlighted are the six presses of `su3cl3`: s ㄋ → u ㄧ → 3 ˇ gives ㄋㄧˇ, and
c ㄏ → l ㄠ → 3 ˇ gives ㄏㄠˇ. Note what the digit row is: `1` is ㄅ, `3` is ˇ,
`6` is ˊ, `0` is ㄢ. Digits are Bopomofo keys, which is why the candidate window
has an explicit open state — with the window closed, `1` types ㄅ and only a
`↓` or a space makes it select the first candidate. **Six more** layouts sit
alongside it (ETen, Hsu, ETen 26-key, IBM, GinYieh, Mitac): their tables are
generated from the reference implementation by
`research/tools/import-mcbopomofo-layouts.mjs`, and the TypeScript and Rust
copies are compared case by case in `core-rs/tests/fixture-layouts.tsv`. The demo
page has a layout picker above the keyboard.*

---

## Why this exists

### 0. Bopomofo is slightly less typing — but less than intuition suggests, and it was measured

The interesting claim about Zhuyin is that it is faster than Pinyin. It is, but the honest
number is smaller than the folk number. [`tools/zhuyin-vs-pinyin.mjs`](tools/zhuyin-vs-pinyin.mjs)
computes it over the whole language model, not a sample, and counts two costs separately:
**spelling** the syllable, and **choosing** the right word from the candidates. Measured
2026-10-11 on 139,158 entries of 2–4 syllables, each one syllable:

| | Zhuyin | Pinyin | Difference |
|---|---|---|---|
| Keys per character, spelling only (frequency-weighted) | 2.94 | 3.02 | |
| **Effective keys per character** (spelling + selection) | **2.95** | **3.07** | **Zhuyin 3.8% fewer** |
| Top-1 accuracy, frequency-weighted | 97.98% | 87.58% | |
| Top-1 accuracy, every entry weighted equally | 90.68% | 71.26% | |
| Mean ambiguity, equal weight | 1.23 | 2.28 | |

Across every entry in the model, including single characters, the gap widens to **5.0%**
(3.00 vs 3.16 effective keys, weighted). The saving splits about 63% spelling and 37%
selection on the word scope: Pinyin's advantage in spelling (`zhong` is five letters) is
partly repaid by its longer candidate lists.

**3.8–5.0% is an upper bound.** The Pinyin side is a competent-but-not-exceptional
implementation, and real-world IMEs are better than it. The point of the exercise is not
that Zhuyin wins by a lot — it is that **the argument should be made with a number, and the
number is smaller than the one usually quoted.** Full method and limitations in
[docs/09](docs/09-zhuyin-vs-pinyin.md).

### 1. The incumbent has no mobile version, and says so

自然输入法 (IQ Technology, in the market since 1995) ships only on Windows and macOS. Its own
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

Any Node ≥ 22.6 — the sources run directly, with no build step, using Node's own type
stripping.

```bash
git clone <this-repo> && cd pingzhu

# interactive: type Bopomofo keys, watch it decode
node engine/cli.ts

# non-interactive
node engine/cli.ts su3cl3 ji394su3 w96j0
node engine/cli.ts --layout eten ne3        # 倚天式 layout

# tests and measurements
(cd engine && node --test)                  # 68 tests
node engine/bench.mjs 5000                  # decode quality, reproducible (seed 20260926)
node engine/bench.mjs 5000 --compare        # promotion on vs off, case by case
node engine/bench-learn.mjs 5000            # personalisation: what teaching buys
node engine/bench-learn.mjs 5000 --recall   # how reachable the right candidate is

# the figures in this README
node tools/render-figures.mjs               # needs rsvg-convert for the PNG step
```

```console
$ node engine/cli.ts su3cl3 ji394su3

> su3cl3
  按鍵      su3cl3
  注音      ㄋㄧˇ ㄏㄠˇ
  → 中文    你好   (score -5.09)
  斷詞      你好
  候選      1.你好  2.妳好  3.你  4.妳  5.擬  6.昵  7.旎  8.薿  9.禰  0.抳
            第 1/4 頁（空白鍵下一頁）　打字模式（空白送出；數字是注音鍵；↓ 開啟選字）　游標在第 1 音節

> ji394su3
  注音      ㄨㄛˇ ㄞˋ ㄋㄧˇ
  → 中文    我愛你   (score -5.40)
  斷詞      我愛你
```

| Keys | Output | Why it is here |
|---|---|---|
| `su3cl3` | 你好 | the basic case |
| `ji394su3` | 我愛你 | ambiguous segmentation — see the figure above |
| `w96j0` | 台灣 | the second syllable needs no tone key |
| `rupwu0` | 今天 | 一聲 takes no key at all |
| `g4` | 是 | ㄕ standing alone as its own syllable |
| `j0420` | 萬丹 | a tone mark must not leak into the next syllable |

In the interactive CLI: `空格` commits (or pages the candidate window when it is open),
`↓` opens it, `1`–`9`/`0` select, `←`/`→` move the cursor along the composition buffer.

---

## As a library

The engine stands alone, with zero runtime dependencies:

**Option 1 — the tarball on the release page** (no account, no setup; recommended)

```bash
npm install https://github.com/173787247/pingzhu/releases/download/v0.10.6/pingzhu-engine-0.10.6.tgz
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

The main entry imports **no Node builtins**, so browsers and bundlers can use it; the
filesystem helpers live under `/node`. That split is enforced by a test, not by a comment.

---

## Architecture

```
                     data/bopomofo-lm.tsv  (170,145 entries / 131,048 readings)
                     data/ts-conversion.tsv (Traditional → Simplified)
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
     engine/  TypeScript                     core-rs/  Rust
     the reference implementation            byte-identical to it
     68 tests                                26 tests + 1,532 differential cases
              │                                       │
              │                        ┌──────────────┼──────────────┐
              │                        │              │              │
              │                   windows/        android/       harmonyos/
              │                   TSF + portable   JNI + Kotlin    NAPI + ArkTS
              │                        │              │              │
              └──── same data ─────────┴──────────────┴──────────────┘
                                    (also macOS, Linux)
```

The layering is not decoration: it is what lets a platform shell stay thin. TSF, IMK,
`InputMethodService`, `InputMethodExtensionAbility` and an fcitx5 addon all want the same two
things — give me a key, give me back text plus candidates — so the core never touches a
window, a UI toolkit or a platform API.

### The reading grid

A syllable is 声母 + 介音 + 韵母 + 声调. Keys compose into readings, readings into a lattice,
and segmentation and word selection are scored **jointly** — the decoder does not pick
syllable boundaries first and words second, because those two decisions depend on each
other. Viterbi over the lattice picks the best sentence; the candidate list comes from the
same scores, so the ordering and the default agree by construction.

---

## Performance

Measured 2026-10-11 on the development machine, Node 24.13, single thread, over the same
ten keystroke strings [`core-rs/examples/bench.rs`](core-rs/examples/bench.rs) uses, so the
two columns are comparable:

| | TypeScript reference | Rust core |
|---|---|---|
| Model load (6.4 MB) | 249 ms | **104 ms** |
| Per keystroke decode | **13.2 µs** | 14.6 µs |
| Throughput | 76,033 keys/s | 68,714 keys/s |

Both are the same order of magnitude, because the time goes into the same algorithm —
a reading grid is rebuilt for every segmentation. Rust is not here to be faster; it is
here to be **embeddable**: a Windows TSF text service is an in-proc DLL with nowhere to
put a VM, and a macOS input method pays its startup cost on the first character of every
text field.

Decoding sits three orders of magnitude below the 10 ms that an input method can afford,
so **latency is not this project's risk**. That is a deliberate decision, not an oversight:
no `Rc<str>`, no async API, no premature optimisation.

---

## Decoding quality

```console
$ node engine/bench.mjs 5000

  top-1 accuracy    78.82%   (3941/5000)  exact word match
  reading accuracy  100.00%   (5000/5000)  output reads as typed
    homophone ties        1059   (another real word, same reading — needs context)
    lost to decomposition 0   (a word existed and lost to single characters)
  KSPC              2.889 keys per character
  decode time       109.2 µs per case
  top-1 by span
    1 syllable       5.38%   (41/762)
    2–4 syllables   92.02%   (3900/4238)
```

**Read the two rows at the bottom before the top one.** A single-syllable reading is
dozens of homophones with nothing to choose between them — ㄕˋ is 是, 事, 市, 式 and
eighty more — so 5.38% is not a defect, it is the shape of the problem: without context
there is no right answer, and a user typing one character is browsing the candidate list
anyway. Where the model actually decides — words of 2–4 syllables, 4,238 of the 5,000
samples — it is right **92.02%** of the time.

**Of the 1,059 misses, all but none are homophone ties**: the output reads exactly as
typed, and another real word with the same reading won. 5,000 samples produced **zero
real decode failures** — the output always reads back as what you typed.

> ⚠️ The sample is drawn from the language model itself, so this is **self-consistency**
> (an upper bound) and a regression guard, not a head-to-head number against another input
> method. A real comparison needs real typing corpora, which do not exist here. See
> [docs/06](docs/06-engine-design.md).

### Personalisation: teach it once

```console
$ node engine/bench-learn.mjs 5000

  words taught              788
  not in candidate window   272   (the user could not have corrected these)
  fixed by learning         268
  regressed by learning     268
    unavoidable collisions      267   (the same reading was sampled wanting
                                            two different words — a user cannot
                                            have both, so one must lose)
    genuine regressions         1   <- must stay 0
        ㄅㄚ-ㄈㄣ-ㄓ-ㄨˇ  want 八分之五
```

The harness decodes every reading cold, then plays user: for everything the engine got
wrong, it opens the candidate window and picks the right word — the same `chooseAt()` a real
candidate window calls — and decodes everything again.

The honest reading of 268 fixed against 268 broken is in the breakdown, not the totals. The
sample draws many words from the *same* reading (ㄕˋ wants 是, 事, 市 … all in one run), and
a user cannot have all of them; **267 of the 268 regressions are that collision**, which is
a property of the sample rather than of the mechanism. **One genuine regression remains**,
ㄅㄚ-ㄈㄣ-ㄓ-ㄨˇ 八分之五, and the harness prints it every run precisely so it cannot be
quietly forgotten. 272 misses were never offered within the first 20 candidates, so a user
could not have corrected those at all.

How far a correction has to reach:

```console
$ node engine/bench-learn.mjs 5000 --recall

  order            wrong    #1     ≤10     ≤20     ≤30   unreachable
  same-span-first  1059    0.0%   57.3%   74.4%   80.6%           0
```

**Nothing is unreachable.** 57.3% of the misses are on the first page — one keystroke — and
80.6% within three pages. The rest are the single-syllable cases above, where the wanted
word sits deep in a list of dozens and the user is browsing anyway.

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
| **M5** | macOS IMK shell: IMKInputController, candidate NSPanel, built and engine-tested in CI | ⚠️ **compiles and runs on hardware; the system does not accept it yet** — see [macos/](macos/README.md) |
| **M6** | Android `InputMethodService`: self-drawn keyboard, candidate bar, JNI | ✅ done |
| **M7** | HarmonyOS IME Kit shell: ArkTS, NAPI, Rust core, keyboard UI, panel, editor connection | ✅ **verified on a device: `su3cl3` → 你好** |
| **M8** | ~~Symbol table~~ (done), word association, text shortcuts | to do |

Tests, as of 2026-10-11:

| Suite | Command | What it covers |
|---|---|---|
| **68 TypeScript** | `cd engine && node --test` | decoder, dictionary, personalisation, keyboard layouts, routing |
| **26 Rust unit tests** | `cd core-rs && cargo test --release` | the port, module by module |
| **1,532 differential cases** | same command | recorded keystroke strings replayed through both implementations; composing text, sentence, score, path words and page 1 must match exactly |
| **207 interaction scenarios** | same command | selection, paging, cursor movement, mode switches |
| **4 Windows native suites** | [`windows/`](windows/README.md) | key routing, engine integration, TSF COM contract, candidate-window geometry |
| **17 Android JVM tests** | [`android/`](android/README.md) | key routing — no emulator needed |

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
| [docs/RELEASING](docs/RELEASING.md) | **Release checklist**: where the version number lives, when the TSF DLL's name must change, how each artifact is built, what to verify before publishing |
| [demo/](demo/index.html) | **Browser demo**: nothing to install, open it and type Bopomofo (same engine the tests run against) |
| [core-rs/](core-rs/README.md) | **Rust core + C ABI**: how a shell connects, how it is verified |
| [windows/](windows/README.md) | **Windows input method**: usage, build, limitations |
| [android/](android/README.md) | **Android input method**: build, design trade-offs, known limitations |
| [harmonyos/](harmonyos/README.md) | **HarmonyOS input method**: structure, CI build, what hurt |
| [linux/](linux/README.md) | **Linux fcitx5 addon**: install, build, what has not been tested |
| [macos/](macos/README.md) | **macOS input method**: build, what CI verifies, design and limits |
| [tools/](tools/) | Scripts behind every number here: the Pinyin comparison, the demo build, the figures |

---

## License

MIT. See [LICENSE](LICENSE).

The language model is derived from [McBopomofo](https://github.com/openvanilla/McBopomofo)
(MIT), whose grammar is built on libtabe's `tsi.src` (BSD). The conversion table is from
[OpenCC](https://github.com/BYVoid/OpenCC) (Apache-2.0). Full attribution in [NOTICE](NOTICE).

**No telemetry, no network calls, no permissions.** The language model ships with the
application; the user dictionary stays in the user's own directory.
