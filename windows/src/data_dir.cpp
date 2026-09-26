#include "data_dir.h"

#include <windows.h>

namespace pingzhu {

std::wstring resolveDataDir(const std::wstring &moduleDir) {
    const std::wstring candidates[] = {
        moduleDir,
        moduleDir + L"\\data",
        moduleDir + L"\\..\\..\\data",
        moduleDir + L"\\..\\data",
    };
    for (const std::wstring &dir : candidates) {
        std::wstring probe = dir + L"\\bopomofo-lm.tsv";
        if (GetFileAttributesW(probe.c_str()) != INVALID_FILE_ATTRIBUTES) return dir;
    }
    return moduleDir + L"\\data";
}

std::string toUtf8(const std::wstring &wide) {
    if (wide.empty()) return "";
    int need = WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), static_cast<int>(wide.size()),
                                   nullptr, 0, nullptr, nullptr);
    std::string out(static_cast<size_t>(need), '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), static_cast<int>(wide.size()), out.data(), need,
                        nullptr, nullptr);
    return out;
}

std::wstring fromUtf8(const std::string &utf8) {
    if (utf8.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

}  // namespace pingzhu
