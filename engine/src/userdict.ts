/**
 * User dictionary — the part of an IME that makes it *yours*.
 *
 * The benchmark in bench.mjs shows the hard ceiling of a context-free decoder:
 * 遺臣 and 一陳 are read identically, and no amount of dictionary coverage
 * separates them. What *can* separate them is knowing that this particular user
 * types one of them. That is this file's entire job.
 *
 * ## Why the numbers look the way they do
 *
 * The language model scores are log10 probabilities (negative, e.g. 我愛你 is
 * -5.398). libchewing stores user frequencies as large integers with +10/+5/+1
 * recency bumps. Mixing the two units directly would be meaningless, so user
 * knowledge is expressed as a **log10 bonus** added on top of whatever the
 * language model already said:
 *
 *     final = lmScore + userBonus
 *
 * Each +1.0 therefore means "treat this as ten times more likely than the model
 * thought". A word the user has explicitly chosen has to beat the model's
 * preference for a homophone, and the model's spreads are usually under 3.0, so
 * the bonuses below are deliberately in that range.
 *
 * **These constants are a design choice, not a derivation.** They are exposed in
 * UserDictionaryOptions so bench-learn.mjs can measure them and a future version
 * can tune them against real typing data instead of my intuition.
 */

export interface UserEntry {
  word: string;
  reading: string;
  /** how many times the user has produced this word */
  count: number;
  /** epoch day of the most recent use */
  lastUsed: number;
  /** epoch day of first learning */
  firstSeen: number;
}

export interface UserDictionaryOptions {
  /** injectable clock, in epoch days; tests pass a fixed value */
  today?: () => number;
  /** bonus for a word taught for the first time */
  bonusNew?: number;
  /** bonus for a word used within recentDays */
  bonusRecent?: number;
  /** bonus for a word used within midDays */
  bonusMid?: number;
  /** bonus for anything older */
  bonusOld?: number;
  recentDays?: number;
  midDays?: number;
  /** added per extra use beyond the first, up to reinforcementCap */
  reinforcementPerUse?: number;
  reinforcementCap?: number;
  /** hard ceiling on the total bonus */
  bonusCap?: number;
  /** base score given to a user word the language model has never seen */
  unknownBaseScore?: number;
}

const DEFAULTS: Required<Omit<UserDictionaryOptions, "today">> = {
  bonusNew: 4.0,
  bonusRecent: 3.0,
  bonusMid: 2.0,
  bonusOld: 1.5,
  recentDays: 7,
  midDays: 30,
  reinforcementPerUse: 0.25,
  reinforcementCap: 2.0,
  bonusCap: 6.0,
  unknownBaseScore: -6.0,
};

export const EPOCH_DAY_MS = 86_400_000;

function defaultToday(): number {
  return Math.floor(Date.now() / EPOCH_DAY_MS);
}

export class UserDictionary {
  private readonly byReading = new Map<string, Map<string, UserEntry>>();
  private readonly opts: Required<UserDictionaryOptions>;

  constructor(options: UserDictionaryOptions = {}) {
    const today = options.today ?? defaultToday;
    const { today: _ignored, ...rest } = options;
    this.opts = { ...DEFAULTS, ...rest, today } as Required<UserDictionaryOptions>;
  }

  get options(): Readonly<Required<UserDictionaryOptions>> {
    return this.opts;
  }

  /** Number of distinct learned words. */
  get size(): number {
    let n = 0;
    for (const m of this.byReading.values()) n += m.size;
    return n;
  }

  /** Teach one word. Repeated calls reinforce rather than duplicate. */
  record(word: string, reading: string, today = this.opts.today()): UserEntry {
    if (!word || !reading) throw new Error("record() needs both word and reading");
    let m = this.byReading.get(reading);
    if (!m) {
      m = new Map();
      this.byReading.set(reading, m);
    }
    let entry = m.get(word);
    if (entry) {
      entry.count += 1;
      entry.lastUsed = today;
    } else {
      entry = { word, reading, count: 1, lastUsed: today, firstSeen: today };
      m.set(word, entry);
    }
    return entry;
  }

  forget(word: string, reading: string): boolean {
    const m = this.byReading.get(reading);
    if (!m) return false;
    const removed = m.delete(word);
    if (m.size === 0) this.byReading.delete(reading);
    return removed;
  }

  clear(): void {
    this.byReading.clear();
  }

  get(word: string, reading: string): UserEntry | undefined {
    return this.byReading.get(reading)?.get(word);
  }

  /**
   * log10 bonus for a candidate, or 0 if the user has never taught it.
   *
   * Two things stack:
   *
   * 1. **A floor that does not decay to nothing.** Every tier stays above 1.5,
   *    because a word the user deliberately chose should keep winning over the
   *    model's default for that reading. libchewing takes the same position —
   *    its user frequencies are stored in the millions precisely so that
   *    `max(builtin, user)` always resolves to the user's word. A bonus that
   *    decayed to ~0 would mean "we forget your correction after a month",
   *    which is not what teaching a word means.
   * 2. **A recency tier on top**, so that when the user has taught several words
   *    for the same reading, the one they reach for most recently wins.
   *
   * The `firstSeen` window matters: a word taught today keeps the top tier for
   * `recentDays` even if it is not used again immediately, so a correction made
   * once does not quietly fall behind a week later.
   */
  bonusFor(word: string, reading: string, today = this.opts.today()): number {
    const entry = this.byReading.get(reading)?.get(word);
    if (!entry) return 0;
    const age = Math.max(0, today - entry.lastUsed);
    const learnedAge = Math.max(0, today - entry.firstSeen);

    let base = age <= this.opts.recentDays
      ? this.opts.bonusRecent
      : age <= this.opts.midDays
        ? this.opts.bonusMid
        : this.opts.bonusOld;
    if (learnedAge <= this.opts.recentDays) base = Math.max(base, this.opts.bonusNew);

    const reinforcement = Math.min(
      (entry.count - 1) * this.opts.reinforcementPerUse,
      this.opts.reinforcementCap,
    );
    return Math.min(base + reinforcement, this.opts.bonusCap);
  }

  /** All learned words for one reading, strongest first. */
  entriesFor(reading: string, today = this.opts.today()): UserEntry[] {
    const m = this.byReading.get(reading);
    if (!m) return [];
    return [...m.values()].sort(
      (a, b) => this.bonusFor(b.word, reading, today) - this.bonusFor(a.word, reading, today),
    );
  }

  get readings(): string[] {
    return [...this.byReading.keys()];
  }

  // ------------------------------------------------------------ persistence

  /**
   * Plain text, tab separated, one entry per line. Same philosophy as the
   * language model: the user's own data must be greppable, diffable and
   * editable by hand — and must survive this project being abandoned.
   */
  toText(): string {
    const lines = [
      "# PingZhu user dictionary v1",
      "# word<TAB>reading<TAB>count<TAB>lastUsedEpochDay<TAB>firstSeenEpochDay",
    ];
    for (const reading of [...this.byReading.keys()].sort()) {
      const entries = [...this.byReading.get(reading)!.values()].sort((a, b) =>
        a.word < b.word ? -1 : 1,
      );
      for (const e of entries) {
        lines.push([e.word, e.reading, e.count, e.lastUsed, e.firstSeen].join("\t"));
      }
    }
    return lines.join("\n") + "\n";
  }

  static fromText(text: string, options: UserDictionaryOptions = {}): UserDictionary {
    const d = new UserDictionary(options);
    for (const line of text.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const p = line.split("\t");
      if (p.length < 5) continue;
      const [word, reading, count, lastUsed, firstSeen] = p;
      const n = Number.parseInt(count, 10);
      if (!word || !reading || !Number.isFinite(n) || n < 1) continue;
      d.record(word, reading, Number.parseInt(lastUsed, 10));
      const entry = d.get(word, reading)!;
      entry.count = n;
      entry.firstSeen = Number.parseInt(firstSeen, 10);
    }
    return d;
  }

}
