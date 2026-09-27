/*
 * Traditional -> Simplified output conversion.
 *
 * The engine works in Traditional throughout: the readings, the language model
 * and the user dictionary are all keyed on Traditional words. Conversion is an
 * *output* transform applied at the boundary, which keeps two things true:
 *
 *   - a user who switches back to Traditional gets their learned words back,
 *     because nothing was ever rewritten
 *   - the conversion table is the only thing that has to be right, instead of
 *     a second converted copy of a 170k-entry model that could drift from it
 *
 * The table comes from OpenCC (see data/build-ts.mjs). Matching is longest-first
 * over the file order, so phrase entries beat single characters exactly as
 * OpenCC intends.
 */
export type OutputScript = "traditional" | "simplified";

export function isOutputScript(value: string): value is OutputScript {
  return value === "traditional" || value === "simplified";
}

export class Converter {
  /** Keys of two or more characters (phrases and the odd multi-character rule). */
  private readonly phrases = new Map<string, string>();
  /** Single-character rules, which is the overwhelming majority of the table. */
  private readonly characters = new Map<string, string>();
  private readonly maxPhraseLength: number;

  private constructor(entries: Iterable<[string, string]>) {
    let longest = 0;
    for (const [key, value] of entries) {
      // Count code points, not UTF-16 units: a rare CJK ideograph outside the
      // BMP is one character but two units, and mixing the two would slice a
      // surrogate pair in half.
      const length = [...key].length;
      if (length > 1) {
        this.phrases.set(key, value);
        if (length > longest) longest = length;
      } else {
        this.characters.set(key, value);
      }
    }
    this.maxPhraseLength = longest;
  }

  static fromText(text: string): Converter {
    const entries: Array<[string, string]> = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const key = line.slice(0, tab);
      const value = line.slice(tab + 1);
      /* A single-character identity entry is a no-op and is dropped. A
       * *phrase* identity entry is the opposite: `乾坤 -> 乾坤` exists precisely
       * to stop the character rule `乾 -> 干` from applying, and 124 of OpenCC's
       * phrase entries are exactly that. Dropping them silently corrupts the
       * output in the cases the table was built to protect. */
      const length = [...key].length;
      if (!key || !value) continue;
      if (key === value && length === 1) continue;
      entries.push([key, value]);
    }
    return new Converter(entries);
  }

  /** An empty converter passes text through unchanged. */
  static readonly identity = new Converter([]);

  get size(): number {
    return this.phrases.size + this.characters.size;
  }

  toSimplified(text: string): string {
    if (this.size === 0 || !text) return text;
    const characters = [...text];
    let out = "";
    let i = 0;
    while (i < characters.length) {
      /* Phrases first. The loop only runs when the table actually has phrases,
       * so the common case of pure character substitution costs one lookup. */
      if (this.maxPhraseLength > 1) {
        const limit = Math.min(this.maxPhraseLength, characters.length - i);
        let matched = false;
        for (let length = limit; length >= 2; length--) {
          const candidate = characters.slice(i, i + length).join("");
          const replacement = this.phrases.get(candidate);
          if (replacement !== undefined) {
            out += replacement;
            i += length;
            matched = true;
            break;
          }
        }
        if (matched) continue;
      }
      const current = characters[i];
      const replacement = this.characters.get(current);
      out += replacement !== undefined ? replacement : current;
      i++;
    }
    return out;
  }

  /** Convenience for the common "convert unless Traditional" call site. */
  apply(text: string, script: OutputScript): string {
    return script === "simplified" ? this.toSimplified(text) : text;
  }
}
