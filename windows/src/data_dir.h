/*
 * Locating the language model, and saying so when we cannot.
 *
 * The engine wants `<dataDir>\bopomofo-lm.tsv`. Getting that path wrong makes
 * every key pass straight through to the application, which looks exactly like
 * "the input method does nothing" — no error, no log, nothing to go on. So the
 * search is explicit, it tries every layout this project ships in, and it
 * records what it chose.
 */
#ifndef PINGZHU_DATA_DIR_H
#define PINGZHU_DATA_DIR_H

#include <string>

namespace pingzhu {

/* Returns the directory that actually contains bopomofo-lm.tsv, searching
 * relative to `moduleDir`:
 *
 *   <dir>\bopomofo-lm.tsv        packaged layout (flat, what the installer makes)
 *   <dir>\data\bopomofo-lm.tsv   repository layout
 *   <dir>\..\..\data\...         running from windows/build
 *   <dir>\..\data\...
 *
 * Falls back to `<dir>\data` so the caller gets a sensible path to report. */
std::wstring resolveDataDir(const std::wstring &moduleDir);

/* UTF-8 conversion for the engine's narrow-string API. */
std::string toUtf8(const std::wstring &wide);
std::wstring fromUtf8(const std::string &utf8);

}  // namespace pingzhu

#endif  // PINGZHU_DATA_DIR_H
