/**
 * Filesystem entry points.
 *
 * Deliberately separate from `dictionary.ts` and `userdict.ts`: those two are
 * pure and therefore run anywhere — Node, a browser page, a test harness. Only
 * this module touches `node:fs`, and only the platforms that *have* a filesystem
 * need to care.
 *
 * A platform shell does the same job with its own API: TSF with `CreateFile`,
 * IMK with `NSData`, Android with `AssetManager`/`Context.getFilesDir()`,
 * HarmonyOS with `@ohos.file.fs`. The data format never changes.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Dictionary, buildSyllableInventoryFromText, type DictionaryOptions } from "./dictionary.ts";
import { UserDictionary, type UserDictionaryOptions } from "./userdict.ts";

/** Load the compiled language model from disk. */
export function loadDictionary(path: string | URL, options: DictionaryOptions = {}): Dictionary {
  return Dictionary.fromText(readFileSync(path, "utf8"), String(path), options);
}

/** The legal-syllable set, read from the same file. */
export function loadSyllableInventory(path: string | URL): Set<string> {
  return buildSyllableInventoryFromText(readFileSync(path, "utf8"));
}

export function loadUserDictionary(
  path: string,
  options: UserDictionaryOptions = {},
): UserDictionary {
  return UserDictionary.fromText(readFileSync(path, "utf8"), options);
}

export function saveUserDictionary(dict: UserDictionary, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, dict.toText());
}
