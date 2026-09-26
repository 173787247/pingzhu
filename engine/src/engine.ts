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
  composeSyllable, componentChar, isCanonicalComponentOrder, isWellFormedComponents,
  type KeyComponent,
} from "./syllable.ts";
import { Dictionary } from "./dictionary.ts";
import {
  ReadingGrid, type CandidateOrder, type Entry, type GridPath, type ReadingGridOptions,
} from "./grid.ts";
import type { UserDictionary } from "./userdict.ts";
import { Converter, type OutputScript } from "./converter.ts";

export interface EngineOptions {
  layout?: string | KeyboardLayout;
  /** cap on segmentations explored per keystroke */
  maxSegmentations?: number;
  /** learned words, applied as log10 bonuses on top of the language model */
  userDictionary?: UserDictionary;
  /** see ReadingGridOptions.promoteWordsOverDecomposition — measure before changing */
  promoteWordsOverDecomposition?: boolean;
  /** margin by which a word must beat its own decomposition */
  promotionEpsilon?: number;
  /** candidate window ordering; see ReadingGridOptions.candidateOrder */
  candidateOrder?: CandidateOrder;
  /**
   * Traditional -> Simplified table. Injected rather than loaded here so the
   * engine keeps knowing nothing about the filesystem — the browser demo has no
   * files to read, and it still gets the feature.
   */
  converter?: Converter;
  /** Which script leaves the engine. Input is always Traditional. */
  outputScript?: OutputScript;
  /**
   * Whether committing the auto-selected sentence counts as teaching.
   *
   * Default false, and that is a deliberate choice rather than an oversight:
   * when the user accepts an auto-selected homophone they may be endorsing it,
   * or they may simply not have noticed. Learning from that would entrench
   * exactly the mistakes the user is least likely to catch. Explicit selection
   * (choose()/chooseAt()) is unambiguous evidence and is always learned from.
   *
   * A future version with real typing data should test whether the added
   * coverage of commit-learning outweighs the risk of entrenching errors.
   */
  learnFromCommit?: boolean;
}

interface Segmentation {
  syllables: string[];
  consumedKeys: number;
}

/**
 * Ten, because that is how many a keyboard can address with 1234567890 — the
 * convention Taiwanese IMEs have used for decades, 自然輸入法 included.
 */
export const CANDIDATE_PAGE_SIZE = 10;

/** Upper bound on candidates kept per position; the data caps a reading at 100. */
export const CANDIDATE_CAP = 200;

export interface CandidatePage {
  /** the words on this page, longest span first */
  entries: Entry[];
  /** syllable index the window is anchored to */
  cursor: number;
  /** index of the first entry on this page within the full list */
  offset: number;
  pageIndex: number;
  pageCount: number;
  total: number;
  hasMore: boolean;
  hasPrevious: boolean;
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
  private readonly userDict?: UserDictionary;
  private readonly learnFromCommit: boolean;
  private readonly promote: boolean | undefined;
  private readonly promotionEpsilon?: number;
  private readonly candidateOrder?: CandidateOrder;
  /* Not readonly: setOutputScript() and setConverter() change them at runtime,
   * which is how a shell exposes the 繁/簡 switch without rebuilding. */
  private converter: Converter;
  private outputScript: OutputScript;

  private keys: string[] = [];
  private syllables: string[] = [];
  private pendingKeys: string[] = [];
  private path: GridPath | null = null;
  private allCandidates: Entry[] = [];
  private currentGrid: ReadingGrid | null = null;
  private cursorIndex = 0;
  private candidateOffset = 0;
  private candidatesOpen = false;

  constructor(dict: Dictionary, inventory: Set<string>, options: EngineOptions = {}) {
    this.dict = dict;
    this.inventory = inventory;
    this.layout = resolveLayout(options.layout);
    this.maxSegmentations = options.maxSegmentations ?? 4000;
    this.userDict = options.userDictionary;
    this.learnFromCommit = options.learnFromCommit ?? false;
    // left undefined on purpose: ReadingGrid owns the default (see its options type)
    this.promote = options.promoteWordsOverDecomposition;
    this.promotionEpsilon = options.promotionEpsilon;
    this.candidateOrder = options.candidateOrder;
    this.converter = options.converter ?? Converter.identity;
    this.outputScript = options.outputScript ?? "traditional";
    this.decode();
  }

  /**
   * Which script the engine emits. Set at construction or later; the input side
   * is unaffected either way, because readings and the language model are
   * Traditional no matter what the user wants to read.
   */
  setOutputScript(script: OutputScript): void {
    this.outputScript = script;
  }

  getOutputScript(): OutputScript {
    return this.outputScript;
  }

  setConverter(converter: Converter): void {
    this.converter = converter;
  }

  /** The single place output crosses from Traditional to the user's script. */
  private out(text: string): string {
    return this.converter.apply(text, this.outputScript);
  }

  // ---------------------------------------------------------------- input

  /** Feed one printable key. Returns true if it was consumed by the composer. */
  press(key: string): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (!this.layout.keyToComponents.has(k)) return false;
    this.candidatesOpen = false; // typing resumes composing
    this.keys.push(k);
    this.decode();
    return true;
  }

  backspace(): boolean {
    if (this.keys.length === 0) return false;
    if (this.candidatesOpen) {
      this.closeCandidateWindow();
      return true;
    }
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

  /** The auto-selected sentence for the whole buffer, in the output script. */
  get bestSentence(): string {
    return this.path ? this.out(this.path.words.join("")) : "";
  }

  get bestScore(): number {
    return this.path ? this.path.score : 0;
  }

  /**
   * True when some syllable in the chosen path had no dictionary word at all and
   * had to be passed through as raw bopomofo.
   *
   * When this is false the output is *provably* read exactly as typed: every
   * node on the path is a dictionary entry whose reading matches the syllables
   * it covers. That makes it the honest way for a caller (or a benchmark) to ask
   * "did the engine actually understand this input", rather than comparing
   * against a specific expected word.
   */
  get usedFallback(): boolean {
    return this.path ? this.path.nodes.some((n) => n.fallback) : false;
  }

  /** The chosen path, for callers that want to render per-word state. */
  get chosenPath(): GridPath | null {
    return this.path;
  }

  /**
   * Every candidate for the syllable the candidate window is sitting on,
   * longest span first. Use candidatePage for what the user actually sees.
   */
  get candidates(): Entry[] {
    return this.allCandidates;
  }

  /** Syllable index the candidate window is anchored to. */
  get candidateCursor(): number {
    return this.cursorIndex;
  }

  /**
   * The ten candidates the user is looking at right now.
   *
   * Ten because that is how many a keyboard can address with 1234567890, which is
   * the convention Taiwanese IMEs have used for decades — 自然輸入法 included.
   * Paging is what makes explicit selection a complete answer to homophones: the
   * user does not need the engine to guess right, only to offer the right word
   * within a keystroke or two.
   */
  get candidatePage(): CandidatePage {
    const total = this.allCandidates.length;
    const pageCount = Math.max(1, Math.ceil(total / CANDIDATE_PAGE_SIZE));
    const pageIndex = Math.floor(this.candidateOffset / CANDIDATE_PAGE_SIZE);
    return {
      entries: this.allCandidates
        .slice(this.candidateOffset, this.candidateOffset + CANDIDATE_PAGE_SIZE)
        .map((entry) => ({ ...entry, word: this.out(entry.word) })),
      cursor: this.cursorIndex,
      offset: this.candidateOffset,
      pageIndex,
      pageCount,
      total,
      hasMore: this.candidateOffset + CANDIDATE_PAGE_SIZE < total,
      hasPrevious: this.candidateOffset > 0,
    };
  }

  /**
   * Is the candidate window open for selection?
   *
   * This is not a UI detail — it decides what the number keys mean. On a 大千
   * keyboard `1234567890` *are* bopomofo keys (1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ),
   * so if a digit selected a candidate while composing, `su3cl3` would be
   * untypeable: the `3` would pick a candidate instead of adding ˇ.
   *
   * Every Taiwanese IME resolves this the same way: the digits compose, and
   * selection happens only once the list is open. ↓ or space opens it (space
   * also pages, which is why 自然輸入法 users describe it as "space for the next
   * ten"). Typing anything else closes it again.
   */
  get candidateWindowOpen(): boolean {
    return this.candidatesOpen;
  }

  /** ↓ — open the list without changing the page. */
  openCandidateWindow(): boolean {
    if (this.allCandidates.length === 0) return false;
    this.candidatesOpen = true;
    return true;
  }

  /** ↑ or Esc — back to composing. */
  closeCandidateWindow(): void {
    this.candidatesOpen = false;
    this.candidateOffset = 0;
  }

  /** Space. Opens the window if it is closed; otherwise moves on ten. */
  nextCandidatePage(): boolean {
    if (this.allCandidates.length === 0) return false;
    if (!this.candidatesOpen) {
      this.candidatesOpen = true;
      return true;
    }
    if (this.candidateOffset + CANDIDATE_PAGE_SIZE >= this.allCandidates.length) return false;
    this.candidateOffset += CANDIDATE_PAGE_SIZE;
    return true;
  }

  prevCandidatePage(): boolean {
    if (!this.candidatesOpen || this.candidateOffset === 0) return false;
    this.candidateOffset = Math.max(0, this.candidateOffset - CANDIDATE_PAGE_SIZE);
    return true;
  }

  /**
   * Move the candidate window along the composing buffer, the way arrow keys do.
   * Defaults to the start of the last word the engine chose, because that is the
   * word still under the cursor.
   */
  moveCandidateCursor(delta: number): boolean {
    if (this.allCandidates.length === 0) return false;
    const wasOpen = this.candidatesOpen;
    this.candidatesOpen = true;
    const next = Math.min(Math.max(this.cursorIndex + delta, 0), this.syllables.length - 1);
    if (next === this.cursorIndex) return !wasOpen; // opened, but nowhere to move
    this.cursorIndex = next;
    this.refreshCandidates();
    this.candidatesOpen = true;
    return true;
  }

  /**
   * Pick candidate `oneBased` (1..10) from the visible page. This is the path the
   * 1234567890 keys take, and — because a deliberate pick is evidence of intent —
   * the path that teaches the user dictionary.
   */
  selectCandidate(oneBased: number): string {
    if (!this.candidatesOpen) return ""; // digits are composing keys until the list is open
    if (oneBased < 1 || oneBased > CANDIDATE_PAGE_SIZE) return "";
    return this.chooseAt(this.cursorIndex, this.candidateOffset + oneBased - 1);
  }

  get syllableCount(): number {
    return this.syllables.length;
  }

  isComposing(): boolean {
    return this.keys.length > 0;
  }

  /** Grid settings shared by every decode in this engine instance. */
  private get gridOptions(): ReadingGridOptions {
    return {
      userDict: this.userDict,
      promoteWordsOverDecomposition: this.promote,
      promotionEpsilon: this.promotionEpsilon,
      candidateOrder: this.candidateOrder,
    };
  }

  /** Recompute the visible candidate list for the current cursor position. */
  private refreshCandidates(): void {
    this.candidateOffset = 0;
    if (!this.currentGrid) {
      this.allCandidates = [];
      return;
    }
    this.allCandidates = this.currentGrid.candidatesForSpan(this.cursorIndex, CANDIDATE_CAP);
  }

  /** The segmentation chosen for the current buffer (exposed for tests/debug). */
  currentSegmentation: Segmentation | null = null;

  /** Accept the auto-selected sentence and clear the buffer. */
  commit(): string {
    const out = this.bestSentence;
    if (this.learnFromCommit && this.userDict && this.path) {
      for (const node of this.path.nodes) {
        if (node.fallback) continue;
        this.userDict.record(node.entry.word, node.entry.reading);
      }
    }
    this.reset();
    return out;
  }

  /** Candidate words for the last syllable, indexed for choose(). */
  choose(index: number): string {
    return this.chooseAt(this.syllables.length - 1, index);
  }

  /** Candidate words attached to the span that starts at `syllableIndex`. */
  candidatesAt(syllableIndex: number, limit = 9): Entry[] {
    if (syllableIndex < 0 || syllableIndex >= this.syllables.length) return [];
    // The live grid already has the user dictionary and promotion applied; reuse
    // it when the cursor has not moved so the list matches what the user sees.
    const grid = this.currentGrid && syllableIndex === this.cursorIndex
      ? this.currentGrid
      : new ReadingGrid(this.syllables, this.dict, this.gridOptions);
    return grid
      .candidatesForSpan(syllableIndex, limit)
      .map((entry) => ({ ...entry, word: this.out(entry.word) }));
  }

  /**
   * Pick candidate `index` for the span starting at `syllableIndex`, decode
   * whatever surrounds it, and commit the result.
   *
   * This is the path a cursor-positioned candidate window takes in a real IME,
   * and it is also the only place learning happens: a deliberate selection is
   * evidence of intent, an auto-selected homophone is not.
   */
  chooseAt(syllableIndex: number, index: number): string {
    if (!this.path || syllableIndex < 0 || syllableIndex >= this.syllables.length) return "";
    const grid = this.currentGrid && syllableIndex === this.cursorIndex
      ? this.currentGrid
      : new ReadingGrid(this.syllables, this.dict, this.gridOptions);
    const entry = grid.candidatesForSpan(syllableIndex, CANDIDATE_CAP)[index];
    if (!entry) return "";

    const start = syllableIndex;
    const end = Math.min(start + entry.syllables, this.syllables.length);
    const before = this.syllables.slice(0, start);
    const after = this.syllables.slice(end);
    const head = before.length
      ? new ReadingGrid(before, this.dict, this.gridOptions).bestPath().words.join("")
      : "";
    const tail = after.length
      ? new ReadingGrid(after, this.dict, this.gridOptions).bestPath().words.join("")
      : "";

    /* The user dictionary keeps the Traditional word even when the user reads
     * Simplified: the key is the Traditional word, and storing the converted
     * form would teach a word the model can never match against. */
    this.userDict?.record(entry.word, entry.reading);
    this.reset();
    return this.out(head + entry.word + tail);
  }

  // ------------------------------------------------------------- decoding

  private decode(): void {
    this.syllables = [];
    this.pendingKeys = [];
    this.path = null;
    this.allCandidates = [];
    this.currentGrid = null;
    this.cursorIndex = 0;
    this.candidateOffset = 0;
    this.candidatesOpen = false;
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
      const grid = new ReadingGrid(seg.syllables, this.dict, this.gridOptions);
      const path = grid.bestPath();
      if (!best || path.score > best.path.score) best = { seg, grid, path };
    }
    const winner = best!;
    this.currentSegmentation = winner.seg;
    this.syllables = winner.seg.syllables;
    this.pendingKeys = this.keys.slice(winner.seg.consumedKeys);
    this.path = winner.path;
    this.currentGrid = winner.grid;
    // The candidate window sits on the word the engine is least done with: the
    // last one, which is still under the cursor.
    const lastNode = winner.path.nodes[winner.path.nodes.length - 1];
    this.cursorIndex = lastNode ? lastNode.start : 0;
    this.refreshCandidates();
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
          if (!isCanonicalComponentOrder(chunk)) continue; // keys out of order
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
