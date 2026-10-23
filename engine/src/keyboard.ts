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
import { componentChar, type KeyComponent } from "./syllable.ts";

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

// The five layouts below are generated, not typed: research/tools/
// import-mcbopomofo-layouts.mjs reads the reference implementation's tables and
// prints both the TypeScript and the Rust (see `--ts` / `--rust`). A table typed
// by hand from memory is wrong in one cell and silent about it.
//
// Their dotted-syllable ordering follows the reference's component flags 1:1 —
// note that its names are not the obvious ones: ER is ㄜ, E is ㄝ, ERR is ㄦ.

export const HSU_LAYOUT = layout(
  "hsu",
  "許氏",
  [
    ["a", [comp("consonant", 20), comp("vowel", 6)]],
    ["b", [comp("consonant", 1)]],
    ["c", [comp("consonant", 14), comp("consonant", 17)]],
    ["d", [comp("consonant", 5), comp("tone", 1)]],
    ["e", [comp("medial", 1), comp("vowel", 4)]],
    ["f", [comp("consonant", 4), comp("tone", 2)]],
    ["g", [comp("consonant", 9), comp("vowel", 3)]],
    ["h", [comp("consonant", 11), comp("vowel", 2)]],
    ["i", [comp("vowel", 5)]],
    ["j", [comp("consonant", 12), comp("consonant", 15), comp("tone", 3)]],
    ["k", [comp("consonant", 10), comp("vowel", 11)]],
    ["l", [comp("consonant", 8), comp("vowel", 12), comp("vowel", 13)]],
    ["m", [comp("consonant", 3), comp("vowel", 9)]],
    ["n", [comp("consonant", 7), comp("vowel", 10)]],
    ["o", [comp("vowel", 8)]],
    ["p", [comp("consonant", 2)]],
    ["r", [comp("consonant", 18)]],
    ["s", [comp("consonant", 21), comp("tone", 4)]],
    ["t", [comp("consonant", 6)]],
    ["u", [comp("medial", 3)]],
    ["v", [comp("consonant", 13), comp("consonant", 16)]],
    ["w", [comp("vowel", 7)]],
    ["x", [comp("medial", 2)]],
    ["y", [comp("vowel", 1)]],
    ["z", [comp("consonant", 19)]],
  ],
  [],
);

export const ETEN26_LAYOUT = layout(
  "eten26",
  "倚天 26 鍵",
  [
    ["a", [comp("vowel", 1)]],
    ["b", [comp("consonant", 1)]],
    ["c", [comp("consonant", 17), comp("consonant", 14)]],
    ["d", [comp("consonant", 5), comp("tone", 4)]],
    ["e", [comp("medial", 1)]],
    ["f", [comp("consonant", 4), comp("tone", 1)]],
    ["g", [comp("consonant", 15), comp("consonant", 12)]],
    ["h", [comp("consonant", 11), comp("vowel", 13)]],
    ["i", [comp("vowel", 5)]],
    ["j", [comp("consonant", 18), comp("tone", 2)]],
    ["k", [comp("consonant", 10), comp("tone", 3)]],
    ["l", [comp("consonant", 8), comp("vowel", 12)]],
    ["m", [comp("consonant", 3), comp("vowel", 9)]],
    ["n", [comp("consonant", 7), comp("vowel", 10)]],
    ["o", [comp("vowel", 2)]],
    ["p", [comp("consonant", 2), comp("vowel", 8)]],
    ["q", [comp("consonant", 19), comp("vowel", 6)]],
    ["r", [comp("vowel", 3)]],
    ["s", [comp("consonant", 21)]],
    ["t", [comp("consonant", 6), comp("vowel", 11)]],
    ["u", [comp("medial", 3)]],
    ["v", [comp("consonant", 9), comp("consonant", 13)]],
    ["w", [comp("consonant", 20), comp("vowel", 4)]],
    ["x", [comp("medial", 2)]],
    ["y", [comp("consonant", 16)]],
    ["z", [comp("vowel", 7)]],
  ],
  [],
);

export const IBM_LAYOUT = layout(
  "ibm",
  "IBM",
  [
    [",", [comp("tone", 2)]],
    ["-", [comp("consonant", 11)]],
    [".", [comp("tone", 3)]],
    ["/", [comp("tone", 4)]],
    ["0", [comp("consonant", 10)]],
    ["1", [comp("consonant", 1)]],
    ["2", [comp("consonant", 2)]],
    ["3", [comp("consonant", 3)]],
    ["4", [comp("consonant", 4)]],
    ["5", [comp("consonant", 5)]],
    ["6", [comp("consonant", 6)]],
    ["7", [comp("consonant", 7)]],
    ["8", [comp("consonant", 8)]],
    ["9", [comp("consonant", 9)]],
    [";", [comp("vowel", 7)]],
    ["a", [comp("medial", 1)]],
    ["b", [comp("vowel", 12)]],
    ["c", [comp("vowel", 10)]],
    ["d", [comp("medial", 3)]],
    ["e", [comp("consonant", 14)]],
    ["f", [comp("vowel", 1)]],
    ["g", [comp("vowel", 2)]],
    ["h", [comp("vowel", 3)]],
    ["i", [comp("consonant", 19)]],
    ["j", [comp("vowel", 4)]],
    ["k", [comp("vowel", 5)]],
    ["l", [comp("vowel", 6)]],
    ["m", [comp("tone", 1)]],
    ["n", [comp("vowel", 13)]],
    ["o", [comp("consonant", 20)]],
    ["p", [comp("consonant", 21)]],
    ["q", [comp("consonant", 12)]],
    ["r", [comp("consonant", 15)]],
    ["s", [comp("medial", 2)]],
    ["t", [comp("consonant", 16)]],
    ["u", [comp("consonant", 18)]],
    ["v", [comp("vowel", 11)]],
    ["w", [comp("consonant", 13)]],
    ["x", [comp("vowel", 9)]],
    ["y", [comp("consonant", 17)]],
    ["z", [comp("vowel", 8)]],
  ],
  [],
);

export const GINYIEH_LAYOUT = layout(
  "ginyieh",
  "精業",
  [
    [",", [comp("vowel", 4)]],
    ["-", [comp("medial", 1)]],
    [".", [comp("vowel", 8)]],
    ["/", [comp("vowel", 12)]],
    ["0", [comp("vowel", 9)]],
    ["1", [comp("tone", 4)]],
    ["2", [comp("consonant", 1)]],
    ["3", [comp("consonant", 5)]],
    ["6", [comp("consonant", 15)]],
    ["8", [comp("vowel", 1)]],
    ["9", [comp("vowel", 5)]],
    [";", [comp("vowel", 11)]],
    ["a", [comp("tone", 2)]],
    ["b", [comp("consonant", 14)]],
    ["c", [comp("consonant", 8)]],
    ["d", [comp("consonant", 7)]],
    ["e", [comp("consonant", 6)]],
    ["f", [comp("consonant", 10)]],
    ["g", [comp("consonant", 13)]],
    ["h", [comp("consonant", 17)]],
    ["i", [comp("vowel", 2)]],
    ["j", [comp("consonant", 20)]],
    ["k", [comp("vowel", 3)]],
    ["l", [comp("vowel", 7)]],
    ["m", [comp("consonant", 21)]],
    ["n", [comp("consonant", 18)]],
    ["o", [comp("vowel", 6)]],
    ["p", [comp("vowel", 10)]],
    ["q", [comp("tone", 1)]],
    ["r", [comp("consonant", 9)]],
    ["s", [comp("consonant", 3)]],
    ["t", [comp("consonant", 12)]],
    ["u", [comp("consonant", 19)]],
    ["v", [comp("consonant", 11)]],
    ["w", [comp("consonant", 2)]],
    ["x", [comp("consonant", 4)]],
    ["y", [comp("consonant", 16)]],
    ["z", [comp("tone", 3)]],
  ],
  [],
);

export const MITAC_LAYOUT = layout(
  "mitac",
  "神通",
  [
    [",", [comp("consonant", 15)]],
    ["-", [comp("vowel", 3)]],
    [".", [comp("consonant", 16)]],
    ["/", [comp("consonant", 17)]],
    ["0", [comp("vowel", 12)]],
    ["1", [comp("tone", 4)]],
    ["2", [comp("tone", 1)]],
    ["3", [comp("tone", 2)]],
    ["4", [comp("tone", 3)]],
    ["5", [comp("vowel", 5)]],
    ["6", [comp("vowel", 7)]],
    ["7", [comp("vowel", 9)]],
    ["8", [comp("vowel", 10)]],
    ["9", [comp("vowel", 11)]],
    [";", [comp("vowel", 6)]],
    ["a", [comp("vowel", 1)]],
    ["b", [comp("consonant", 1)]],
    ["c", [comp("consonant", 20)]],
    ["d", [comp("consonant", 5)]],
    ["e", [comp("vowel", 3)]],
    ["f", [comp("consonant", 4)]],
    ["g", [comp("consonant", 9)]],
    ["h", [comp("consonant", 11)]],
    ["i", [comp("vowel", 6)]],
    ["j", [comp("consonant", 12)]],
    ["k", [comp("consonant", 10)]],
    ["l", [comp("consonant", 8)]],
    ["m", [comp("consonant", 3)]],
    ["n", [comp("consonant", 7)]],
    ["o", [comp("vowel", 2)]],
    ["p", [comp("consonant", 2)]],
    ["q", [comp("consonant", 13)]],
    ["r", [comp("consonant", 18)]],
    ["s", [comp("consonant", 21)]],
    ["t", [comp("consonant", 6)]],
    ["u", [comp("vowel", 8)]],
    ["v", [comp("medial", 3)]],
    ["w", [comp("medial", 2)]],
    ["x", [comp("consonant", 14)]],
    ["y", [comp("medial", 1)]],
    ["z", [comp("consonant", 19)]],
  ],
  [],
);
export const LAYOUTS: Record<string, KeyboardLayout> = {
  standard: STANDARD_LAYOUT,
  eten: ETEN_LAYOUT,
  hsu: HSU_LAYOUT,
  eten26: ETEN26_LAYOUT,
  ibm: IBM_LAYOUT,
  ginyieh: GINYIEH_LAYOUT,
  mitac: MITAC_LAYOUT,
};

/** The four rows of a layout, as the shell draws them: `(key, label)` per cell. */
export function keyboardRows(layout: KeyboardLayout | string): { key: string; label: string }[][] {
  const table = typeof layout === "string" ? LAYOUTS[layout] : layout;
  if (!table) throw new Error(`unknown layout: ${layout}`);
  const ROWS = ["1234567890-", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
  return ROWS.map((row) =>
    row.split("").map((key) => ({
      key,
      label: table.keyToComponents.get(key)?.[0] ? componentChar(table.keyToComponents.get(key)![0]) : "",
    })),
  );
}

/**
 * Layouts the reference implementation has and this engine does not.
 *
 * The five that used to be here are now supported (above), so this is empty;
 * it stays because the next person to look will ask "what else does McBopomofo
 * have" and the honest answer is "one more, and it is not a Bopomofo layout".
 *
 * The remaining one is HanyuPinyin — a Pinyin input layout, not 注音, and out of
 * scope for a Bopomofo input method.
 */
export const PLANNED_LAYOUTS: readonly string[] = [];
