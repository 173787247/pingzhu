/**
 * Bopomofo syllable model.
 *
 * A syllable is built from up to four components, in this order:
 *   consonant (聲母) · medial (介音) · vowel (韻母) · tone (聲調)
 * Any of the first three may be absent (ㄦ, ㄢ, ㄩㄥˋ ...), the tone defaults
 * to 一聲 when unmarked.
 */

export const CONSONANTS = ["", "ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ", "ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ",
  "ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"] as const;

export const MEDIALS = ["", "ㄧ", "ㄨ", "ㄩ"] as const;

export const VOWELS = ["", "ㄚ", "ㄛ", "ㄜ", "ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ"] as const;

/** index 0 = 一聲 (unmarked), then ˊ ˇ ˋ ˙ */
export const TONES = ["", "ˊ", "ˇ", "ˋ", "˙"] as const;

export type ComponentKind = "consonant" | "medial" | "vowel" | "tone";

export interface KeyComponent {
  kind: ComponentKind;
  /** index into CONSONANTS / MEDIALS / VOWELS / TONES */
  index: number;
  /** keyboard key that produced it, for echo/undo */
  key: string;
}

export function componentChar(c: KeyComponent): string {
  switch (c.kind) {
    case "consonant": return CONSONANTS[c.index];
    case "medial": return MEDIALS[c.index];
    case "vowel": return VOWELS[c.index];
    case "tone": return TONES[c.index];
  }
}

/** Merge a chunk of components into one syllable string, e.g. ㄋ+ㄧ+ˇ -> "ㄋㄧˇ". */
export function composeSyllable(chunk: KeyComponent[]): string | null {
  let consonant = 0, medial = 0, vowel = 0, tone = 0;
  const seen = new Set<ComponentKind>();
  for (const c of chunk) {
    if (seen.has(c.kind)) return null; // two of the same class cannot share a syllable
    seen.add(c.kind);
    if (c.kind === "consonant") consonant = c.index;
    else if (c.kind === "medial") medial = c.index;
    else if (c.kind === "vowel") vowel = c.index;
    else tone = c.index;
  }
  const s = CONSONANTS[consonant] + MEDIALS[medial] + VOWELS[vowel] + TONES[tone];
  return s === "" ? null : s;
}

/** "ㄋㄧˇ" -> ["ㄋ","ㄧ","ˇ"]; returns null on anything that is not pure bopomofo. */
export function decomposeSyllable(syllable: string): KeyComponent[] | null {
  const out: KeyComponent[] = [];
  for (const ch of syllable) {
    if (ch === " ") continue;
    let hit = false;
    for (const [kind, table] of [
      ["consonant", CONSONANTS], ["medial", MEDIALS], ["vowel", VOWELS], ["tone", TONES],
    ] as const) {
      const idx = (table as readonly string[]).indexOf(ch);
      if (idx > 0) { out.push({ kind, index: idx, key: "" }); hit = true; break; }
    }
    if (!hit) return null;
  }
  return out;
}

/** Indices of ㄓㄔㄕㄖㄗㄘㄙ — the only consonants that stand alone as syllables. */
const SYLLABIC_CONSONANTS = new Set([15, 16, 17, 18, 19, 20, 21]);

/**
 * Is this run of components a syllable a speaker of Mandarin would recognise as
 * finished?
 *
 * This is what stops the composer from spitting out a character the moment you
 * press one key. Typing "su3c" leaves ㄏ dangling: ㄏ cannot be a syllable on its
 * own, so it stays in the pending slot instead of turning into the ㄏ symbol.
 *
 * The test is therefore about *shape*, not about tones. ㄓㄔㄕㄖㄗㄘㄙ genuinely
 * are whole syllables without any vowel — 吃 is just ㄔ, 詩 is just ㄕ, 思 is just
 * ㄙ — and they are extremely common, so they must pass even with no tone key
 * pressed. Everything else needs a vowel or a medial.
 *
 * Data also contains standalone bopomofo *symbols* (ㄅ, ㄏ, ˇ) so users can type
 * the letters themselves; those readings deliberately fail this test and are
 * reachable only through an explicit tone or space.
 */
export function isWellFormedComponents(chunk: KeyComponent[]): boolean {
  let consonant = 0, medial = 0, vowel = 0;
  for (const c of chunk) {
    if (c.kind === "consonant") consonant = c.index;
    else if (c.kind === "medial") medial = c.index;
    else if (c.kind === "vowel") vowel = c.index;
  }
  if (vowel) return true;   // ㄚ ㄛ ㄜ ... and everything built on them
  if (medial) return true;  // ㄧ ㄨ ㄩ alone (yi/wu/yu) or ㄏㄨ style, checked against the inventory
  return SYLLABIC_CONSONANTS.has(consonant);
}

/** Split "ㄋㄧˇ-ㄏㄠˇ" into syllables. */
export function splitReading(reading: string): string[] {
  return reading.split("-").filter((s) => s.length > 0);
}

/** Join syllables into a reading key. */
export function joinReading(syllables: string[]): string {
  return syllables.join("-");
}

/**
 * A syllable is *legal* if at least one Chinese character in the language model
 * is pronounced that way. The legal set is therefore derived from the data
 * rather than hand-written, which keeps it honest across tone variants.
 */
export class SyllableInventory {
  private readonly valid: Set<string>;

  constructor(readings: Iterable<string>) {
    this.valid = new Set(readings);
  }

  has(syllable: string): boolean {
    return this.valid.has(syllable);
  }

  get size(): number {
    return this.valid.size;
  }

  /** Same reading with the tone dropped, used for 近音表 (near-homophone) lookups. */
  static toneless(syllable: string): string {
    return syllable.replace(/[ˊˇˋ˙]/g, "");
  }
}
