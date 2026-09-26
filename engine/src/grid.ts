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
 */
import type { Dictionary, Entry } from "./dictionary.ts";

export interface GridNode {
  /** first syllable index covered by this node */
  start: number;
  /** syllable index one past the last covered syllable */
  end: number;
  entry: Entry;
  /** true when no dictionary word covered this span and we fell back to chars */
  fallback?: boolean;
}

export interface GridPath {
  nodes: GridNode[];
  words: string[];
  score: number;
}

/** Penalty applied to a character reached only through the single-char table. */
const FALLBACK_PENALTY = 3.0;

export class ReadingGrid {
  readonly syllables: string[];
  private readonly nodesByEnd: GridNode[][] = [];
  private readonly nodesByStart: GridNode[][] = [];

  constructor(syllables: string[], dict: Dictionary) {
    this.syllables = syllables;
    const n = syllables.length;
    for (let i = 0; i <= n; i++) {
      this.nodesByEnd.push([]);
      this.nodesByStart.push([]);
    }
    for (let start = 0; start < n; start++) {
      for (let len = 1; len <= dict.maxWordSyllables && start + len <= n; len++) {
        const reading = syllables.slice(start, start + len).join("-");
        for (const entry of dict.lookup(reading)) {
          const node: GridNode = { start, end: start + len, entry };
          this.nodesByEnd[start + len].push(node);
          this.nodesByStart[start].push(node);
        }
      }
    }
    // Any syllable the dictionary cannot express at all still needs a node so
    // the path can cross it; mark it as a fallback so callers can flag it.
    for (let i = 0; i < n; i++) {
      if (this.nodesByStart[i].length === 0) {
        const node: GridNode = {
          start: i,
          end: i + 1,
          entry: { word: this.syllables[i], score: -99, reading: syllables[i], syllables: 1 },
          fallback: true,
        };
        this.nodesByEnd[i + 1].push(node);
        this.nodesByStart[i].push(node);
      }
    }
  }

  /** Highest scoring path through the whole grid. */
  bestPath(): GridPath {
    const n = this.syllables.length;
    const best = new Array<number>(n + 1).fill(-Infinity);
    const from = new Array<GridNode | null>(n + 1).fill(null);
    best[0] = 0;
    for (let end = 1; end <= n; end++) {
      for (const node of this.nodesByEnd[end]) {
        const prev = best[node.start];
        if (prev === -Infinity) continue;
        const score = prev + node.entry.score - (node.fallback ? FALLBACK_PENALTY : 0);
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

  /** Candidate words for the span that covers `syllableIndex`, best first. */
  candidatesForSpan(syllableIndex: number, limit = 9): Entry[] {
    const out: Entry[] = [];
    const seen = new Set<string>();
    for (let end = syllableIndex + 1; end <= this.syllables.length; end++) {
      for (const node of this.nodesByEnd[end]) {
        if (node.start !== syllableIndex || node.fallback) continue;
        const key = `${node.entry.word}\t${node.entry.reading}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(node.entry);
      }
      if (out.length >= limit * 3) break;
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }
}
