/**
 * The input engine: keystrokes in, Chinese out.
 *
 * Pipeline per keystroke (the whole buffer is re-decoded, which is cheap because
 * a composing buffer is short — and it makes backspace and mid-string edits free):
 *
 *   keys -> component options -> syllable segmentations -> reading grid Viterbi
 *        -> best sentence + candidate list
 *
 * Segmenting keys into syllables is genuinely ambiguous. Typing ji394su3 for
 * 我愛你 produces the component stream ㄨ ㄛ ˇ ㄞ ˋ ㄋ ㄧ ˇ, which can legally be
 * read as ㄨㄛˇ-ㄞˋ-ㄋㄧˇ (我愛你) or as ㄨㄛˇ-ㄋㄞˋ-ㄧˇ. Only the language model
 * can tell them apart, so segmentation and decoding are scored together rather
 * than decided in two independent passes.
 */
import { LAYOUTS, STANDARD_LAYOUT, type KeyboardLayout } from "./keyboard.ts";
import {
  composeSyllable, componentChar, isWellFormedComponents, type KeyComponent,
} from "./syllable.ts";
import { Dictionary } from "./dictionary.ts";
import { ReadingGrid, type Entry, type GridPath } from "./grid.ts";

export interface EngineOptions {
  layout?: string | KeyboardLayout;
  /** cap on segmentations explored per keystroke */
  maxSegmentations?: number;
}

interface Segmentation {
  syllables: string[];
  consumedKeys: number;
}

function resolveLayout(layout: string | KeyboardLayout | undefined): KeyboardLayout {
  if (!layout) return STANDARD_LAYOUT;
  if (typeof layout !== "string") return layout;
  const found = LAYOUTS[layout];
  if (!found) throw new Error(`unknown layout: ${layout} (have ${Object.keys(LAYOUTS).join(", ")})`);
  return found;
}

export class InputEngine {
  private readonly dict: Dictionary;
  private readonly inventory: Set<string>;
  private readonly layout: KeyboardLayout;
  private readonly maxSegmentations: number;

  private keys: string[] = [];
  private syllables: string[] = [];
  private pendingKeys: string[] = [];
  private path: GridPath | null = null;
  private bestCandidates: Entry[] = [];

  constructor(dict: Dictionary, inventory: Set<string>, options: EngineOptions = {}) {
    this.dict = dict;
    this.inventory = inventory;
    this.layout = resolveLayout(options.layout);
    this.maxSegmentations = options.maxSegmentations ?? 4000;
    this.decode();
  }

  // ---------------------------------------------------------------- input

  /** Feed one printable key. Returns true if it was consumed by the composer. */
  press(key: string): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (!this.layout.keyToComponents.has(k)) return false;
    this.keys.push(k);
    this.decode();
    return true;
  }

  backspace(): boolean {
    if (this.keys.length === 0) return false;
    this.keys.pop();
    this.decode();
    return true;
  }

  reset(): void {
    this.keys = [];
    this.decode();
  }

  // --------------------------------------------------------------- output

  /** What the user typed, as bopomofo, with unfinished keys in [brackets]. */
  get composing(): string {
    const done = this.syllables.join(" ");
    const pending = this.pendingKeys.length ? `[${this.pendingKeys.join("")}]` : "";
    return [done, pending].filter(Boolean).join(" ");
  }

  get rawKeys(): string {
    return this.keys.join("");
  }

  /** The auto-selected sentence for the whole buffer. */
  get bestSentence(): string {
    return this.path ? this.path.words.join("") : "";
  }

  get bestScore(): number {
    return this.path ? this.path.score : 0;
  }

  /** Candidate words for the last complete syllable, best first. */
  get candidates(): Entry[] {
    return this.bestCandidates;
  }

  get syllableCount(): number {
    return this.syllables.length;
  }

  isComposing(): boolean {
    return this.keys.length > 0;
  }

  /** The segmentation chosen for the current buffer (exposed for tests/debug). */
  currentSegmentation: Segmentation | null = null;

  /** Accept the auto-selected sentence and clear the buffer. */
  commit(): string {
    const out = this.bestSentence;
    this.reset();
    return out;
  }

  /** Accept candidate `index` for the last syllable, keeping the rest. */
  choose(index: number): string {
    const entry = this.bestCandidates[index];
    if (!entry) return "";
    const n = entry.syllables;
    const headSyllables = this.syllables.slice(0, this.syllables.length - n);
    const head = headSyllables.length
      ? new ReadingGrid(headSyllables, this.dict).bestPath().words.join("")
      : "";
    const out = head + entry.word;
    this.reset();
    return out;
  }

  // ------------------------------------------------------------- decoding

  private decode(): void {
    this.syllables = [];
    this.pendingKeys = [];
    this.path = null;
    this.bestCandidates = [];
    this.currentSegmentation = null;
    if (this.keys.length === 0) return;

    const segs = this.enumerateSegmentations();
    if (segs.length === 0) {
      this.pendingKeys = [...this.keys];
      return;
    }

    // Prefer segmentations that consume the whole buffer. If none does — the
    // user is mid-syllable — fall back to those that consume the most keys, so
    // "su3c" still shows 你 while ㄏ sits in the pending slot.
    const complete = segs.filter((s) => s.consumedKeys === this.keys.length && s.syllables.length);
    let pool = complete;
    if (pool.length === 0) {
      let maxConsumed = 0;
      for (const s of segs) maxConsumed = Math.max(maxConsumed, s.consumedKeys);
      pool = segs.filter((s) => s.consumedKeys === maxConsumed && s.syllables.length > 0);
    }
    if (pool.length === 0) {
      this.pendingKeys = [...this.keys];
      return;
    }

    let best: { seg: Segmentation; grid: ReadingGrid; path: GridPath } | null = null;
    for (const seg of pool) {
      const grid = new ReadingGrid(seg.syllables, this.dict);
      const path = grid.bestPath();
      if (!best || path.score > best.path.score) best = { seg, grid, path };
    }
    const winner = best!;
    this.currentSegmentation = winner.seg;
    this.syllables = winner.seg.syllables;
    this.pendingKeys = this.keys.slice(winner.seg.consumedKeys);
    this.path = winner.path;
    this.bestCandidates = winner.grid.candidatesForSpan(this.syllables.length - 1, 9);
  }

  /**
   * All ways to cut the keystroke buffer into legal syllables.
   *
   * A chunk may hold at most four keys (consonant, medial, vowel, tone) and may
   * not contain two components of the same class; a key with several possible
   * components (Hsu-style overloaded keys) branches the search.
   *
   * A run that runs out of legal continuations is still emitted, marked by the
   * number of keys it consumed, so the caller can show a half-typed syllable
   * rather than throwing the whole buffer away.
   */
  private enumerateSegmentations(): Segmentation[] {
    const keys = this.keys;
    const out: Segmentation[] = [];
    const syllables: string[] = [];

    const walk = (pos: number): void => {
      if (out.length >= this.maxSegmentations) return;
      if (pos === keys.length) {
        out.push({ syllables: [...syllables], consumedKeys: pos });
        return;
      }
      let advanced = false;
      for (let len = 1; len <= 4 && pos + len <= keys.length; len++) {
        for (const chunk of this.chunkOptions(pos, len)) {
          const syllable = composeSyllable(chunk);
          if (!syllable || !this.inventory.has(syllable)) continue;
          if (!isWellFormedComponents(chunk)) continue; // still being typed
          advanced = true;
          syllables.push(syllable);
          walk(pos + len);
          syllables.pop();
        }
      }
      if (!advanced && pos > 0) {
        out.push({ syllables: [...syllables], consumedKeys: pos });
      }
    };
    walk(0);
    return out;
  }

  /** Every component combination a run of `len` keys can stand for. */
  private chunkOptions(pos: number, len: number): KeyComponent[][] {
    let combos: KeyComponent[][] = [[]];
    for (let i = pos; i < pos + len; i++) {
      const key = this.keys[i];
      const options = this.layout.keyToComponents.get(key);
      if (!options || options.length === 0) return [];
      const next: KeyComponent[][] = [];
      for (const combo of combos) {
        for (const option of options) {
          next.push([...combo, { ...option, key }]);
        }
      }
      combos = next;
    }
    // Reject combinations that would put two components of one class in a
    // syllable only after composing, so keep them: composeSyllable().null does
    // the check and returns null.
    return combos.filter((c) => composeSyllable(c) !== null);
  }

  /** Human readable dump of one component, for the CLI's key echo. */
  static describe(component: KeyComponent): string {
    return componentChar(component);
  }
}
