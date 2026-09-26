/*
 * A log file, because a TSF text service fails invisibly.
 *
 * The service runs inside other people's processes. When it cannot load the
 * engine it does the only safe thing — lets every key through — and the user
 * sees an input method that does nothing at all, with no error anywhere. That is
 * how a wrong data path shipped in the first place, and no amount of reading the
 * code would have shown it.
 *
 * What is logged: lifecycle and failures only.
 * What is never logged: keystrokes, composing text, or committed characters.
 * A log that records what someone typed is a keylogger, whatever the intent.
 */
#ifndef PINGZHU_LOG_H
#define PINGZHU_LOG_H

#include <string>

namespace pingzhu {

/* Enable logging to `<dir>\<name>`. Called once at activation; the service stays
 * silent until this is called, so an unconfigured build writes nothing. */
void startLog(const std::wstring &dir, const std::wstring &name);

/* Append one line, with a timestamp and the process id. Does nothing when the
 * log was never started. Failures are ignored: a log must never be the reason an
 * input method stops working. */
void log(const std::string &message);

/* Where the log is, for an error message. Empty when not started. */
std::wstring logPath();

}  // namespace pingzhu

#endif  // PINGZHU_LOG_H
