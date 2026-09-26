/**
 * PingZhu — a cross-platform Bopomofo (注音) input method engine.
 *
 * Reference core implementation. The engine is deliberately written against a
 * plain-text language model and a platform-free API so that the Windows TSF,
 * macOS InputMethodKit, Android InputMethodService and HarmonyOS IME Kit shells
 * can all sit on exactly one decoder.
 */
export {
  InputEngine, CANDIDATE_PAGE_SIZE, CANDIDATE_CAP,
  type EngineOptions, type CandidatePage,
} from "./engine.ts";
export { Dictionary, buildSyllableInventoryFromText, type Entry, type DictionaryOptions } from "./dictionary.ts";
export {
  ReadingGrid, DEFAULT_PROMOTE_WORDS_OVER_DECOMPOSITION, DEFAULT_CANDIDATE_ORDER,
  type GridPath, type GridNode, type ReadingGridOptions, type CandidateOrder,
} from "./grid.ts";
export {
  loadDictionary, loadSyllableInventory, loadUserDictionary, saveUserDictionary,
} from "./node-data.ts";
export {
  UserDictionary, EPOCH_DAY_MS,
  type UserEntry, type UserDictionaryOptions,
} from "./userdict.ts";
export { LAYOUTS, PLANNED_LAYOUTS, STANDARD_LAYOUT, ETEN_LAYOUT, type KeyboardLayout } from "./keyboard.ts";
export {
  CONSONANTS, MEDIALS, VOWELS, TONES,
  composeSyllable, decomposeSyllable, splitReading, joinReading, SyllableInventory,
  type KeyComponent, type ComponentKind,
} from "./syllable.ts";
