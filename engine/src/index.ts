/**
 * PingZhu — a cross-platform Bopomofo (注音) input method engine.
 *
 * Reference core implementation. The engine is deliberately written against a
 * plain-text language model and a platform-free API so that the Windows TSF,
 * macOS InputMethodKit, Android InputMethodService and HarmonyOS IME Kit shells
 * can all sit on exactly one decoder.
 */
export { InputEngine, type EngineOptions } from "./engine.ts";
export { Dictionary, buildSyllableInventory, type Entry } from "./dictionary.ts";
export { ReadingGrid, type GridPath, type GridNode } from "./grid.ts";
export { LAYOUTS, PLANNED_LAYOUTS, STANDARD_LAYOUT, ETEN_LAYOUT, type KeyboardLayout } from "./keyboard.ts";
export {
  CONSONANTS, MEDIALS, VOWELS, TONES,
  composeSyllable, decomposeSyllable, splitReading, joinReading, SyllableInventory,
  type KeyComponent, type ComponentKind,
} from "./syllable.ts";
