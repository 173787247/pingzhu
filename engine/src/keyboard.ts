/**
 * Keyboard layouts.
 *
 * The component indices match syllable.ts: consonant 1..21, medial 1..3,
 * vowel 1..13, tone 0..4 (tone 1 = 一聲, produced by space or the layout's own key).
 *
 * "standard" is the 大千式 layout, the one Taiwanese users mean by 注音鍵盤.
 * Tables transcribed from McBopomofo's BopomofoKeyboardLayout.ts (MIT), which
 * carries a test suite for each layout, and cross-checked against the mapping
 * Taiwanese IMEs are expected to honour (e.g. su3cl3 -> 你好, ji394su3 -> 我愛你).
 */
import type { KeyComponent } from "./syllable.ts";

export interface KeyboardLayout {
  id: string;
  label: string;
  /** key -> components it can produce (some keys are overloaded) */
  keyToComponents: Map<string, Omit<KeyComponent, "key">[]>;
  /** true when the layout spells 一聲 with an explicit key */
  tone1Keys: string[];
}

function comp(kind: KeyComponent["kind"], index: number): Omit<KeyComponent, "key"> {
  return { kind, index };
}

function layout(id: string, label: string, entries: [string, Omit<KeyComponent, "key">[]][], tone1Keys: string[] = []): KeyboardLayout {
  return { id, label, keyToComponents: new Map(entries), tone1Keys };
}

const consonantKeys: [string, number][] = [
  ["1", 1], ["q", 2], ["a", 3], ["z", 4],
  ["2", 5], ["w", 6], ["s", 7], ["x", 8],
  ["e", 9], ["d", 10], ["c", 11],
  ["r", 12], ["f", 13], ["v", 14],
  ["5", 15], ["t", 16], ["g", 17], ["b", 18],
  ["y", 19], ["h", 20], ["n", 21],
];
const medialKeys: [string, number][] = [["u", 1], ["j", 2], ["m", 3]];
const vowelKeys: [string, number][] = [
  ["8", 1], ["i", 2], ["k", 3], [",", 4],
  ["9", 5], ["o", 6], ["l", 7], [".", 8],
  ["0", 9], ["p", 10], [";", 11], ["/", 12], ["-", 13],
];

export const STANDARD_LAYOUT = layout(
  "standard",
  "標準 (大千式)",
  [
    ...consonantKeys.map(([k, i]) => [k, [comp("consonant", i)]] as [string, Omit<KeyComponent, "key">[]]),
    ...medialKeys.map(([k, i]) => [k, [comp("medial", i)]] as [string, Omit<KeyComponent, "key">[]]),
    ...vowelKeys.map(([k, i]) => [k, [comp("vowel", i)]] as [string, Omit<KeyComponent, "key">[]]),
    ["3", [comp("tone", 2)]],
    ["4", [comp("tone", 3)]],
    ["6", [comp("tone", 1)]],
    ["7", [comp("tone", 4)]],
    // "1" stays ㄅ: on a 大千 keyboard 一聲 is the absence of a tone mark.
    // Space is deliberately NOT a composing key — it pages the candidate window,
    // following 自然輸入法. 一聲 needs no key at all: a syllable is closed by the
    // next syllable's first key or by a tone key, and ㄓㄔㄕㄖㄗㄘㄙ stand alone.
  ],
  [],
);

export const ETEN_LAYOUT = layout(
  "eten",
  "倚天式",
  [
    ["b", [comp("consonant", 1)]], ["p", [comp("consonant", 2)]], ["m", [comp("consonant", 3)]],
    ["f", [comp("consonant", 4)]], ["d", [comp("consonant", 5)]], ["t", [comp("consonant", 6)]],
    ["n", [comp("consonant", 7)]], ["l", [comp("consonant", 8)]], ["v", [comp("consonant", 9)]],
    ["k", [comp("consonant", 10)]], ["h", [comp("consonant", 11)]], ["g", [comp("consonant", 12)]],
    ["7", [comp("consonant", 13)]], ["c", [comp("consonant", 14)]], [",", [comp("consonant", 15)]],
    [".", [comp("consonant", 16)]], ["/", [comp("consonant", 17)]], ["j", [comp("consonant", 18)]],
    [";", [comp("consonant", 19)]], ["'", [comp("consonant", 20)]], ["s", [comp("consonant", 21)]],
    ["e", [comp("medial", 1)]], ["x", [comp("medial", 2)]], ["u", [comp("medial", 3)]],
    ["a", [comp("vowel", 1)]], ["o", [comp("vowel", 2)]], ["r", [comp("vowel", 3)]],
    ["w", [comp("vowel", 4)]], ["i", [comp("vowel", 5)]], ["q", [comp("vowel", 6)]],
    ["z", [comp("vowel", 7)]], ["y", [comp("vowel", 8)]], ["8", [comp("vowel", 9)]],
    ["9", [comp("vowel", 10)]], ["0", [comp("vowel", 11)]], ["-", [comp("vowel", 12)]],
    ["=", [comp("vowel", 13)]],
    ["2", [comp("tone", 1)]], ["3", [comp("tone", 2)]],
    ["4", [comp("tone", 3)]], ["1", [comp("tone", 4)]],
    // space pages the candidate window; see the Standard layout note
  ],
  [],
);

export const LAYOUTS: Record<string, KeyboardLayout> = {
  standard: STANDARD_LAYOUT,
  eten: ETEN_LAYOUT,
};

/**
 * Hsu (許氏) layout is deliberately absent: it rearranges keys by phonetic
 * grouping rather than by the 大千 grid, and transcribing it from memory would
 * guarantee silent errors. Port it from a source with tests (McBopomofo's
 * CreateHsuLayout_) before claiming support.
 */
export const PLANNED_LAYOUTS = ["hsu", "eten26", "ibm", "ginyieh", "mitac"] as const;
