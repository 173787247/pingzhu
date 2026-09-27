/**
 * The NAPI surface, as ArkTS sees it.
 *
 * **Everything is a function, including the things that look like values.**
 *
 * The C++ registers every entry with a method callback, which on the ArkTS side
 * makes it a function — `pingzhu.composing` is `() => string`, not a string. The
 * first version of this file declared several of them as `const`, so
 * `this.composing = pingzhu.composing` assigned a function to a `@State string`
 * and the component refused to render:
 *
 *   Illegal variable value error with decorated variable @State 'composing':
 *   attempt to assign value type: 'function'
 *
 * That is the sixth time in this project that one thing has had two
 * descriptions and only one of them was right. The declarations here and the
 * descriptors in napi_init.cpp are the two, and nothing keeps them in step
 * automatically — so both are kept short and alphabetical, and every name
 * appears in both.
 */

/** Whether the engine has been created. */
export function engineLinked(): boolean;

/** A sentence describing the engine's state, for the panel to show. */
export function engineDescription(): string;

/** The ABI version the Rust core reports. Proves the static library is linked. */
export function abiVersion(): number;

/**
 * Loads the language model from a directory the caller obtained from the
 * ability context. The native side cannot know where the HAP unpacked things.
 */
export function create(modelDir: string): boolean;

/** What is being composed, in Bopomofo. */
export function composing(): string;

/** The sentence that would be committed. */
export function bestSentence(): string;

/** Picks the n-th (1-based) candidate and returns what was committed. */
export function selectCandidate(oneBased: number): string;

/** Turns to the next page of candidates. Returns whether there was one. */
export function nextPage(): boolean;

/** How many candidates there are in total. */
export function candidateCount(): number;

/** The current candidates. */
export function candidates(): string[];

/** Commits and clears. Returns what was committed. */
export function commit(): string;

/** Clears without committing. */
export function reset(): void;

/** Feeds one key. The keyboard uses this. */
export function feedKey(key: string): boolean;

/** Turns a whole sequence at once. Mostly for tests. */
export function decode(keys: string): string;

/**
 * The drawn keyboard, one line per row, each line `key:label|key:label|...`.
 * Comes from the engine, not from a table here.
 */
export function keyboardRows(layout?: string): string;
