/**
 * The Node entry point: everything in the main module, plus the filesystem
 * helpers.
 *
 * Separate so that `import ... from "pingzhu-engine"` stays loadable in a
 * browser. A single entry point that re-exported `node:fs` would mean every
 * browser bundle of this engine fails to resolve — for functions the browser was
 * never going to call.
 */
export * from "./index.ts";
export {
  loadConverter,
  loadDictionary,
  loadSyllableInventory,
  loadUserDictionary,
  saveUserDictionary,
} from "./node-data.ts";
