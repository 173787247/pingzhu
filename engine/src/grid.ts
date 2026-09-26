/**
 * Reading grid + Viterbi decoding.
 *
 * The classic hard part of a phonetic IME is not "what characters are read like
 * this", it is "which segmentation of the syllable sequence into words is most
 * probable". We lay the syllables out on a grid, put every dictionary word that
 * matches a contiguous span on top of it, and find the highest scoring path.
 *
 * Scores are log10 probabilities straight out of the language model, so a
 * multi-syllable word naturally beats the product of its parts: for 我愛你 the
 * word scores -5.398 while 我 + 愛 + 你 score about -12 together.
 *
 * ## The case where that reasoning breaks
 *
 * "Naturally" is doing a lot of work in that sentence. A *rare* multi-syllable
 * word can still lose to its single-character decomposition, and then the engine
 * outputs something no Taiwanese user would write. Concretely, from the shipped
 * data:
 *
 *     ㄧˊ-ㄔㄣˊ  遺臣 -6.694     ← the only dictionary word for this reading
 *                一 + 陳 -6.56   ← what the model actually picks
 *
 * Two characters that merely happen to be read that way outscore the word that
 * genuinely is read that way. McBopomofo has the same behaviour and patches it
 * with a hand-written list in Source/Data/Postprocess.txt covering a handful of
 * phrases (試試, 字彙, 有事, 市集), with comments like
 * "這個問題目前還不能解決" — this problem cannot be solved yet.
 *
 * Because we control the decoder rather than a data file, we can state the rule
 * generally and measure it: **if a word exists for a span, it should not lose to
 * a decomposition of that same span.** See `promoteWordsOverDecomposition`.
 */
import type { Dictionary, Entry } from "./dictionary.ts";
import type { UserDictionary } from "./userdict.ts";

export interface GridNode {
  /** first syllable index covered by this node */
  start: number;
  /** syllable index one past the last covered syllable */
  end: number;
  entry: Entry;
  /** true when no dictionary word covered this span and we fell back to chars */
  fallback?: boolean;
  /** true when this word exists only because the user taught it */
  userOnly?: boolean;
}

export interface GridPath {
  nodes: GridNode[];
  words: string[];
  score: number;
}

export interface ReadingGridOptions {
  /** learned words, applied as log10 bonuses on top of the language model */
  userDict?: UserDictionary;
  /**
   * Keep a word from losing to a decomposition of the same span.
   *
   * Defaults to true because it was measured, not assumed: on 5,000 sampled
   * readings `node bench.mjs 5000 --compare` reports
   *
   *     fixed by promotion     311
   *     REGRESSED by promotion 0
   *     net                    +311   (top-1 83.22% -> 89.44%)
   *
   * Zero regressions is what makes this safe to default on. Re-run --compare
   * after any change to scoring or data; a future dictionary could behave
   * differently.
   */
  promoteWordsOverDecomposition?: boolean;
  /** margin by which a word must beat its own decomposition (McBopomofo uses 0.001) */
  promotionEpsilon?: number;
  /**
   * How the candidate window is ordered. All three sort by 詞頻; they differ only
   * in whether candidates are grouped first, and every group is frequency-ordered
   * inside. Measured on 5,000 readings (`node bench-learn.mjs 5000 --recall`),
   * counting how often the intended word is reachable for cases the engine got
   * wrong:
   *
   *     order              page 1 (1-0)   page 2   page 3   unreachable
   *     same-span-first        99.8%      99.8%    99.8%        1
   *     longest-first          99.8%      99.8%    99.8%        1
   *     frequency              55.9%      87.3%    95.0%        1
   *
   * `"same-span-first"` (default) puts the words that cover the same syllables as
   * the engine's own choice first — its homophone rivals — then everything else.
   * It keeps the window consistent with the displayed sentence (the auto-selection
   * is always on page 1) and survives long buffers, where grouping by length alone
   * would push a rare whole-sentence word to the front.
   *
   * `"frequency"` is the plain ungrouped 詞頻 order, kept because it is the
   * convention the project owner asked for and because the cost above should stay
   * measurable rather than be assumed away.
   */
  candidateOrder?: CandidateOrder;
}

export type CandidateOrder = "same-span-first" | "longest-first" | "frequency";

export const DEFAULT_CANDIDATE_ORDER: CandidateOrder = "same-span-first";

/** See ReadingGridOptions.promoteWordsOverDecomposition for why this is true. */
export const DEFAULT_PROMOTE_WORDS_OVER_DECOMPOSITION = true;

/** Penalty applied to a character reached only through the single-char table. */
const FALLBACK_PENALTY = 3.0;

export const DEFAULT_PROMOTION_EPSILON = 0.001;

export class ReadingGrid {
  readonly syllables: string[];
  readonly options: ReadingGridOptions;
  private readonly allNodes: GridNode[] = [];
  private readonly nodesByEnd: GridNode[][] = [];
  private readonly nodesByStart: GridNode[][] = [];
  private pathCache?: GridPath;

  constructor(syllables: string[], dict: Dictionary, options: ReadingGridOptions = {}) {
    this.syllables = syllables;
    this.options = options;
    const { userDict } = options;
    const n = syllables.length;
    for (let i = 0; i <= n; i++) {
      this.nodesByEnd.push([]);
      this.nodesByStart.push([]);
    }
    const today = userDict?.options.today() ?? 0;

    for (let start = 0; start < n; start++) {
      for (let len = 1; len <= dict.maxWordSyllables && start + len <= n; len++) {
        const reading = syllables.slice(start, start + len).join("-");
        const seen = new Set<string>();
        for (const entry of dict.lookup(reading)) {
          // User knowledge is a bonus on top of the model, never a replacement
          // for it: a word the user has never touched keeps its model score.
          const bonus = userDict ? userDict.bonusFor(entry.word, reading, today) : 0;
          this.add({
            start,
            end: start + len,
            entry: { ...entry, score: entry.score + bonus },
          });
          seen.add(entry.word);
        }
        // Words the user taught that the language model has never heard of —
        // names, jargon, abbreviations. They get a floor score plus the bonus.
        if (userDict) {
          for (const entry of userDict.entriesFor(reading, today)) {
            if (seen.has(entry.word)) continue;
            const bonus = userDict.bonusFor(entry.word, reading, today);
            this.add({
              start,
              end: start + len,
              entry: {
                word: entry.word,
                reading,
                score: userDict.options.unknownBaseScore + bonus,
                syllables: len,
              },
              userOnly: true,
            });
          }
        }
      }
    }

    // Any syllable the dictionary cannot express at all still needs a node so
    // the path can cross it; mark it as a fallback so callers can flag it.
    for (let i = 0; i < n; i++) {
      if (this.nodesByStart[i].length === 0) {
        this.add({
          start: i,
          end: i + 1,
          entry: { word: syllables[i], score: -99, reading: syllables[i], syllables: 1 },
          fallback: true,
        });
      }
    }

    if (options.promoteWordsOverDecomposition ?? DEFAULT_PROMOTE_WORDS_OVER_DECOMPOSITION) {
      this.applyPromotion();
    }
  }

  private add(node: GridNode): void {
    this.allNodes.push(node);
    this.nodesByEnd[node.end].push(node);
    this.nodesByStart[node.start].push(node);
  }

  /** Score of a node as the Viterbi pass sees it. */
  private static scoreOf(node: GridNode): number {
    return node.entry.score - (node.fallback ? FALLBACK_PENALTY : 0);
  }

  /**
   * Lift every multi-syllable word above the best decomposition of its own span.
   *
   * Bottom-up by span length, so `best[i][j]` is final before longer spans read
   * it. A span's "decomposition" is the best pair of shorter spans that tile it —
   * which is exactly the alternative the Viterbi pass would otherwise prefer.
   */
  private applyPromotion(): void {
    const n = this.syllables.length;
    const eps = this.options.promotionEpsilon ?? DEFAULT_PROMOTION_EPSILON;
    // best[i][j] = best score for covering syllables i..j-1
    const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(n + 1).fill(-Infinity));

    for (let len = 1; len <= n; len++) {
      for (let i = 0; i + len <= n; i++) {
        const j = i + len;
        // best decomposition of this span from strictly shorter pieces
        let decomposed = -Infinity;
        for (let k = i + 1; k < j; k++) {
          const left = best[i][k];
          const right = best[k][j];
          if (left === -Infinity || right === -Infinity) continue;
          if (left + right > decomposed) decomposed = left + right;
        }
        const nodes = this.nodesByEnd[j].filter((nd) => nd.start === i);
        if (len > 1 && decomposed > -Infinity) {
          // A word must be worth at least as much as merely spelling the same
          // sounds with shorter words.
          const floor = decomposed + eps;
          for (const node of nodes) {
            if (node.fallback) continue;
            if (node.entry.score < floor) {
              node.entry = { ...node.entry, score: floor };
            }
          }
        }
        let here = decomposed;
        for (const node of nodes) {
          const s = ReadingGrid.scoreOf(node);
          if (s > here) here = s;
        }
        best[i][j] = here;
      }
    }
  }

  /** Highest scoring path through the whole grid (computed once, cached). */
  bestPath(): GridPath {
    if (!this.pathCache) this.pathCache = this.computeBestPath();
    return this.pathCache;
  }

  private computeBestPath(): GridPath {
    const n = this.syllables.length;
    const best = new Array<number>(n + 1).fill(-Infinity);
    const from = new Array<GridNode | null>(n + 1).fill(null);
    best[0] = 0;
    for (let end = 1; end <= n; end++) {
      for (const node of this.nodesByEnd[end]) {
        const prev = best[node.start];
        if (prev === -Infinity) continue;
        const score = prev + ReadingGrid.scoreOf(node);
        if (score > best[end]) {
          best[end] = score;
          from[end] = node;
        }
      }
    }
    const nodes: GridNode[] = [];
    for (let end = n; end > 0;) {
      const node = from[end];
      if (!node) break;
      nodes.push(node);
      end = node.start;
    }
    nodes.reverse();
    return { nodes, words: nodes.map((x) => x.entry.word), score: best[n] };
  }

  /**
   * Candidate words for the span that starts at `syllableIndex`, best first.
   *
   * Every order sorts by 詞頻; see ReadingGridOptions.candidateOrder for how the
   * three differ and what each one measured.
   */
  candidatesForSpan(syllableIndex: number, limit = 9): Entry[] {
    const order = this.options.candidateOrder ?? DEFAULT_CANDIDATE_ORDER;
    const preferredSpan = (() => {
      const node = this.bestPath().nodes.find((nd) => nd.start === syllableIndex);
      return node ? node.end - node.start : 1;
    })();

    const scored: { entry: Entry; span: number; score: number }[] = [];
    const seen = new Set<string>();
    for (let end = syllableIndex + 1; end <= this.syllables.length; end++) {
      for (const node of this.nodesByEnd[end]) {
        if (node.start !== syllableIndex || node.fallback) continue;
        const key = `${node.entry.word}\t${node.entry.reading}`;
        if (seen.has(key)) continue;
        seen.add(key);
        scored.push({
          entry: node.entry,
          span: node.end - node.start,
          score: node.entry.score,
        });
      }
    }
    const rank = (x: { span: number }) => {
      if (order === "longest-first") return -x.span;
      if (order === "same-span-first") return x.span === preferredSpan ? 0 : 1;
      return 0;
    };
    scored.sort((a, b) => (rank(a) - rank(b)) || (b.score - a.score));
    return scored.slice(0, limit).map((x) => x.entry);
  }

  /** How many candidates exist at this position, for paging UIs. */
  candidateCountForSpan(syllableIndex: number): number {
    return this.candidatesForSpan(syllableIndex, Number.MAX_SAFE_INTEGER).length;
  }

  /** Every node on the grid, for callers that need to inspect the whole lattice. */
  get nodes(): readonly GridNode[] {
    return this.allNodes;
  }
}
