/*
 * Bopomofo -> Hanyu Pinyin.
 *
 * Needed to compare the two input methods on the same data: every entry in the
 * language model already carries a Bopomofo reading, so deriving the Pinyin it
 * would be typed as gives an apples-to-apples measurement instead of quoting
 * numbers from different sources.
 *
 * The mapping is systematic — it is a transliteration, not a lookup table — but
 * it is not concatenation. Written Pinyin contracts and rewrites finals
 * depending on the initial:
 *
 *   ㄌㄧㄡˊ  -> liu      not "liou"
 *   ㄍㄨㄟ  -> gui      not "guei"
 *   ㄒㄩㄥ  -> xiong    not "xüong"
 *   ㄐㄩㄣ  -> jun      ü is written u after j q x
 *   ㄋㄩˇ   -> nü       but most IMEs accept "nv", which is what people type
 *   ㄓ     -> zhi      the empty rime is written i
 *
 * Tones are dropped: typing full tone marks in Pinyin is rare, and the whole
 * point of the comparison is that Bopomofo requires them and Pinyin does not.
 */
import {
  CONSONANTS,
  MEDIALS,
  VOWELS,
  TONES,
  decomposeSyllable,
  type ComponentKind,
} from "./syllable.ts";

type Parts = { consonant: string; medial: string; vowel: string; tone: string };

/* decomposeSyllable returns the components in the order they were typed, so they
 * are looked up by kind rather than by position: ˙ㄇㄚ (neutral tone first) is a
 * legal syllable and would otherwise be read as consonant=tone. */
function split(syllable: string): Parts | null {
  const components = decomposeSyllable(syllable);
  if (!components) return null;
  const table = (kind: ComponentKind): readonly string[] =>
    kind === "consonant" ? CONSONANTS : kind === "medial" ? MEDIALS : kind === "vowel" ? VOWELS : TONES;
  const pick = (kind: ComponentKind): string => {
    const found = components.find((c) => c.kind === kind);
    return found ? table(kind)[found.index] ?? "" : "";
  };
  return {
    consonant: pick("consonant"),
    medial: pick("medial"),
    vowel: pick("vowel"),
    tone: pick("tone"),
  };
}

const INITIAL_PINYIN: Record<string, string> = {
  "": "",
  ㄅ: "b", ㄆ: "p", ㄇ: "m", ㄈ: "f",
  ㄉ: "d", ㄊ: "t", ㄋ: "n", ㄌ: "l",
  ㄍ: "g", ㄎ: "k", ㄏ: "h",
  ㄐ: "j", ㄑ: "q", ㄒ: "x",
  ㄓ: "zh", ㄔ: "ch", ㄕ: "sh", ㄖ: "r",
  ㄗ: "z", ㄘ: "c", ㄙ: "s",
};

/* Initials after which ü is written u (ju, qu, xu — never jü). */
const JQX = new Set(["ㄐ", "ㄑ", "ㄒ"]);
/* Initials that take the empty rime, written i (zhi, chi, shi, ri, zi, ci, si). */
const SIBILANTS = new Set(["ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"]);
/* After n and l, ü is a real ü — typed as v by every IME in practice. */
const N_L = new Set(["ㄋ", "ㄌ"]);

/* Final spelling, indexed by medial then vowel. Two columns because a syllable
 * with no initial prefixes the medial (yi, wu, yu) and one with an initial does
 * not (i, u, ü). A dash means the combination does not occur. */
const FINALS: Record<string, Record<string, [string, string]>> = {
  "": {
    "": ["", ""], // the empty rime, handled separately
    ㄚ: ["a", "a"], ㄛ: ["o", "o"], ㄜ: ["e", "e"], ㄝ: ["ê", "ê"],
    ㄞ: ["ai", "ai"], ㄟ: ["ei", "ei"], ㄠ: ["ao", "ao"], ㄡ: ["ou", "ou"],
    ㄢ: ["an", "an"], ㄣ: ["en", "en"], ㄤ: ["ang", "ang"], ㄥ: ["eng", "eng"],
    ㄦ: ["er", "er"],
  },
  ㄧ: {
    "": ["i", "yi"], ㄚ: ["ia", "ya"], ㄛ: ["io", "yo"], ㄜ: ["ie", "ye"],
    ㄝ: ["ie", "ye"], ㄞ: ["iai", "yai"], ㄟ: ["-", "-"], ㄠ: ["iao", "yao"],
    ㄡ: ["iu", "you"], ㄢ: ["ian", "yan"], ㄣ: ["in", "yin"], ㄤ: ["iang", "yang"],
    ㄥ: ["ing", "ying"], ㄦ: ["-", "-"],
  },
  ㄨ: {
    "": ["u", "wu"], ㄚ: ["ua", "wa"], ㄛ: ["uo", "wo"], ㄜ: ["-", "-"],
    ㄝ: ["-", "-"], ㄞ: ["uai", "wai"], ㄟ: ["ui", "wei"], ㄠ: ["-", "-"],
    ㄡ: ["-", "-"], ㄢ: ["uan", "wan"], ㄣ: ["un", "wen"], ㄤ: ["uang", "wang"],
    ㄥ: ["ong", "weng"], ㄦ: ["-", "-"],
  },
  ㄩ: {
    "": ["ü", "yu"], ㄚ: ["-", "-"], ㄛ: ["-", "-"], ㄜ: ["üe", "yue"],
    ㄝ: ["üe", "yue"], ㄞ: ["-", "-"], ㄟ: ["-", "-"], ㄠ: ["-", "-"],
    ㄡ: ["-", "-"], ㄢ: ["üan", "yuan"], ㄣ: ["ün", "yun"], ㄤ: ["-", "-"],
    ㄥ: ["iong", "yong"], ㄦ: ["-", "-"],
  },
};

/**
 * Pinyin for one syllable, without tone. Returns null for a combination the
 * table does not cover, so a caller can count the gaps instead of silently
 * producing something wrong.
 */
export function syllableToPinyin(syllable: string): string | null {
  const parts = split(syllable);
  if (!parts) return null;
  const { consonant, medial, vowel } = parts;

  // ㄓㄔㄕㄖㄗㄘㄙ standing alone is the empty rime: zhi, chi, shi, ri, zi, ci, si.
  if (medial === "" && vowel === "") {
    if (SIBILANTS.has(consonant)) return INITIAL_PINYIN[consonant] + "i";
    return null;
  }

  const entry = FINALS[medial]?.[vowel];
  if (!entry) return null;
  const [withInitial, alone] = entry;
  if (withInitial === "-") return null;

  const initial = INITIAL_PINYIN[consonant];
  if (initial === undefined) return null;

  let final = consonant === "" ? alone : withInitial;
  if (final.includes("ü")) {
    // Written u after j q x; typed v after n l; ü elsewhere (and alone -> yu).
    if (consonant === "") final = alone;
    else if (JQX.has(consonant)) final = final.replace("ü", "u");
    else if (N_L.has(consonant)) final = final.replace("ü", "v");
    else final = final.replace("ü", "ü");
  }
  return initial + final;
}

/** Pinyin for a whole multi-syllable reading, as it would be typed: no spaces. */
export function readingToPinyin(reading: string): string | null {
  const syllables = reading.split("-");
  let out = "";
  for (const syllable of syllables) {
    const pinyin = syllableToPinyin(syllable);
    if (pinyin === null) return null;
    out += pinyin;
  }
  return out;
}

/**
 * Keystrokes to type one syllable on a bopomofo keyboard.
 *
 * One key per component, plus one for the tone unless it is 一聲 — which is
 * written unmarked and therefore costs nothing. That asymmetry is the whole
 * reason tones are cheap in Bopomofo and are simply skipped in Pinyin.
 */
export function bopomofoKeys(syllable: string): number | null {
  const parts = split(syllable);
  if (!parts) return null;
  let keys = 0;
  if (parts.consonant) keys++;
  if (parts.medial) keys++;
  if (parts.vowel) keys++;
  // A bare syllabic consonant (ㄓ alone) is still one key.
  if (keys === 0 && parts.consonant) keys = 1;
  if (parts.tone !== "" && parts.tone !== TONES[0]) keys++;
  return keys;
}

/** Keystrokes to type a whole reading. */
export function readingKeys(reading: string): number | null {
  let keys = 0;
  for (const syllable of reading.split("-")) {
    const n = bopomofoKeys(syllable);
    if (n === null) return null;
    keys += n;
  }
  return keys;
}

export const tables = { CONSONANTS, MEDIALS, VOWELS, TONES };
