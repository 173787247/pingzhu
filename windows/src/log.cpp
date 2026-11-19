#include "log.h"

#include <windows.h>

#include <cstdio>
#include <mutex>

namespace pingzhu {
namespace {

std::mutex g_mutex;
std::wstring g_path;
/* 常开的句柄。`fopen("ab")` 在多进程追加下是安全的（每次写都会到文件末尾），
 * 所以不必为了「多个宿主进程共用一份日志」而每行开关一次 —— 那是这段代码最早的做法，
 * 代价是每行一次 `_wfopen` + `fclose`。 */
FILE *g_file = nullptr;

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
    if (g_file != nullptr) {
        std::fclose(g_file);
        g_file = nullptr;
    }
    g_path = dir + L"\\" + name;
}

std::wstring logPath() {
    std::lock_guard<std::mutex> guard(g_mutex);
    return g_path;
}

void log(const std::string &message) {
    std::lock_guard<std::mutex> guard(g_mutex);
    if (g_path.empty()) return;

    /* 句柄常开，每行 flush。
     *
     * 最早是每行 `_wfopen` + `fclose` —— 那样多个宿主进程共用一份日志天然安全，
     * 但每行两次文件操作落在打字的路径上。`fopen("ab")` 的多进程追加本身就安全
     * （每次写都到文件末尾），所以句柄可以留着；`fflush` 保证进程崩掉时不丢行。
     *
     * Binary append，消息本身就是 UTF-8。看着顺眼的 `ccs=UTF-8` 模式是个陷阱 ——
     * 它以**宽字符**打开流，`fprintf` 进去什么都不写，日志恰好在你需要它的时侯是空的。 */
    if (g_file == nullptr) {
        g_file = _wfopen(g_path.c_str(), L"ab");
        if (g_file == nullptr) return;
    }
    std::fprintf(g_file, "%s [pid %lu] %s\n", timestamp().c_str(),
                 static_cast<unsigned long>(GetCurrentProcessId()), message.c_str());
    /* 每行 fflush 而不是 fclose：进程崩掉时这一行也不会丢，但省掉了句柄的开关。 */
    std::fflush(g_file);
}

}  // namespace pingzhu
