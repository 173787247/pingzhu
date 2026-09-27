/**
 * The NAPI surface, as ArkTS sees it.
 *
 * This file and the C++ are two descriptions of the same thing, and nothing
 * keeps them in step automatically — they are the mechanism by which the two
 * can disagree silently. Both are kept short and every function is listed in
 * both.
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
 * Turns a sequence of Bopomofo keystrokes into text.
 *
 * @param keys - the keys as typed, e.g. "su3cl3"
 * @returns the sentence the engine would commit
 */
export function decode(keys: string): string;
