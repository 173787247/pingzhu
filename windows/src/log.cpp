#include "log.h"

#include <windows.h>

#include <cstdio>
#include <mutex>

namespace pingzhu {
namespace {

std::mutex g_mutex;
std::wstring g_path;

std::string timestamp() {
    SYSTEMTIME now;
    GetLocalTime(&now);
    char buffer[32];
    std::snprintf(buffer, sizeof(buffer), "%02d:%02d:%02d.%03d", now.wHour, now.wMinute,
                  now.wSecond, now.wMilliseconds);
    return buffer;
}

}  // namespace

void startLog(const std::wstring &dir, const std::wstring &name) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_path = dir + L"\\" + name;
}

std::wstring logPath() {
    std::lock_guard<std::mutex> guard(g_mutex);
    return g_path;
}

void log(const std::string &message) {
    std::lock_guard<std::mutex> guard(g_mutex);
    if (g_path.empty()) return;

    /* Opened and closed every time: several host processes can hold this DLL at
     * once and they all write to the same file.
     *
     * Binary append, and the message is already UTF-8. The obvious-looking
     * `ccs=UTF-8` mode is a trap — it opens the stream for *wide* characters, so
     * fprintf() into it silently writes nothing at all and the log comes out
     * empty exactly when it is needed. */
    FILE *file = _wfopen(g_path.c_str(), L"ab");
    if (!file) return;
    std::fprintf(file, "%s [pid %lu] %s\n", timestamp().c_str(),
                 static_cast<unsigned long>(GetCurrentProcessId()), message.c_str());
    std::fclose(file);
}

}  // namespace pingzhu
