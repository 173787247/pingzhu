/**
 * The NAPI surface, as ArkTS sees it.
 *
 * This file and the C++ are two descriptions of the same thing, and nothing
 * keeps them in step automatically — they are the mechanism by which the two can
 * disagree silently. Both are kept short and every function is listed in both.
 */
export const engineLinked: boolean;
export const engineDescription: string;

/** The ABI version the Rust core reports. Proves the static library is really linked. */
export const abiVersion: number;

/**
 * Loads the language model from a directory the caller obtained from the
 * ability context. The native side cannot know where the HAP unpacked things.
 *
 * @returns whether the model could be read
 */
export function create(modelDir: string): boolean;

/**
 * The drawn keyboard, one line per row, each line `key:label|key:label|...`.
 *
 * Comes from the engine, not from a table here: the drawn keys and the
 * understood keys are the same table, so they cannot drift.
 *
 * @param layout - "standard" (大千式) or "eten"; anything else falls back
 */
export function keyboardRows(layout?: string): string;

/** Turns a whole sequence at once. Mostly for tests. */
export function decode(keys: string): string;

/** Feeds one key. The keyboard uses this. */
export function feedKey(key: string): boolean;

/** What is being composed, in Bopomofo. */
export const composing: string;

/** The sentence that would be committed. */
export const bestSentence: string;

/** The current candidates. */
export const candidates: string[];

/** Commits and clears. */
export function commit(): string;

/** Clears without committing. */
export function reset(): void;
