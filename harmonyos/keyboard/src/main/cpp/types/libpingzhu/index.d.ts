/**
 * The NAPI surface, as ArkTS sees it.
 *
 * This file is what the ArkTS compiler type-checks against — the C++ and this
 * declaration are two descriptions of the same thing, and nothing keeps them in
 * step automatically. They are the mechanism by which the two can disagree
 * silently, so both are short and every function is listed in both.
 */
export const engineLinked: boolean;
export const engineDescription: string;

/**
 * Turns a sequence of Bopomofo keystrokes into text.
 *
 * @param keys - the keys as typed, e.g. "su3cl3"
 * @returns the sentence the engine would commit
 */
export function decode(keys: string): string;
