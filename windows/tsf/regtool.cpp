/*
 * regtool — register or unregister the PingZhu TSF text service.
 *
 * A separate executable rather than regsvr32, for two reasons: it can report
 * *what* failed in a way that ends up in an install log, and it registers the
 * CTF language profile, which regsvr32 has no idea about. A COM server that is
 * registered but has no language profile never appears in the language bar —
 * which is exactly the failure mode this tool exists to make visible.
 *
 * Both operations write HKLM and therefore require elevation.
 *
 *   regtool install    register the COM server and the language profile
 *   regtool uninstall  remove both
 *   regtool status     report state; no elevation needed, exit code 0/1
 */
#include <windows.h>
#include <msctf.h>

#include <clocale>
#include <cstdio>
#include <string>

#include "register.h"
#include "guids.h"

namespace {

void print(const wchar_t *format, ...) {
    va_list args;
    va_start(args, format);
    wchar_t buffer[1024];
    _vsnwprintf_s(buffer, _countof(buffer), _TRUNCATE, format, args);
    va_end(args);
    wprintf(L"%s\n", buffer);
}

bool elevated() {
    HANDLE token = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) return false;
    TOKEN_ELEVATION elevation = {0};
    DWORD size = sizeof(elevation);
    bool result = false;
    if (GetTokenInformation(token, TokenElevation, &elevation, size, &size)) {
        result = elevation.TokenIsElevated != 0;
    }
    CloseHandle(token);
    return result;
}

}  // namespace

int wmain(int argc, wchar_t **argv) {
    /* Without this the CRT converts wide output through the "C" locale, which is
     * ASCII-only: every Chinese character in this tool's output becomes '?' and
     * the install log is useless exactly when someone needs to read it. */
    setlocale(LC_ALL, "");

    const std::wstring action = (argc > 1) ? argv[1] : L"status";

    HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
        print(L"CoInitializeEx 失敗：%s", pingzhu::tsf::describe(hr).c_str());
        return 2;
    }

    if (action == L"status") {
        bool registered = pingzhu::tsf::isRegistered();
        bool inLanguageList = pingzhu::tsf::isInLanguageList();
        print(L"語言設定檔：%s", registered ? L"已註冊" : L"未註冊");
        print(L"語言列輸入法：%s", inLanguageList ? L"已加入" : L"未加入");
        print(L"權限：%s", elevated() ? L"系統管理員" : L"一般使用者");
        CoUninitialize();
        return registered ? 0 : 1;
    }

    if (!elevated()) {
        print(L"需要系統管理員權限：輸入法必須註冊在 HKLM，才能被其他使用者權限的");
        print(L"行程載入。請以「系統管理員身分執行」再試一次。");
        CoUninitialize();
        return 3;
    }

    if (action == L"install") {
        /* The DLL to register is normally the one sitting next to this tool, but
         * an explicit path is accepted because the file name carries a version:
         * a new build registers a new name. */
        wchar_t selfPath[MAX_PATH] = {0};
        GetModuleFileNameW(nullptr, selfPath, MAX_PATH);
        std::wstring directory(selfPath);
        size_t slash = directory.find_last_of(L"\\/");
        directory = (slash == std::wstring::npos) ? L"." : directory.substr(0, slash);

        std::wstring path;
        if (argc > 2 && argv[2][0]) {
            path = argv[2];
        } else {
            /* Newest pingzhu-tsf*.dll wins, so an upgrade needs no extra flag. */
            WIN32_FIND_DATAW found;
            HANDLE search = FindFirstFileW((directory + L"\\pingzhu-tsf*.dll").c_str(), &found);
            if (search != INVALID_HANDLE_VALUE) {
                FILETIME newest = {0, 0};
                do {
                    if (CompareFileTime(&found.ftLastWriteTime, &newest) > 0) {
                        newest = found.ftLastWriteTime;
                        path = directory + L"\\" + found.cFileName;
                    }
                } while (FindNextFileW(search, &found));
                FindClose(search);
            }
            if (path.empty()) path = directory + L"\\pingzhu-tsf.dll";
        }

        print(L"COM 伺服器：%s", path.c_str());
        hr = pingzhu::tsf::registerComServer(path);
        if (FAILED(hr)) {
            print(L"  失敗：%s", pingzhu::tsf::describe(hr).c_str());
            CoUninitialize();
            return 4;
        }
        print(L"  完成");

        hr = pingzhu::tsf::registerProfiles();
        if (FAILED(hr)) {
            print(L"語言設定檔註冊失敗：%s", pingzhu::tsf::describe(hr).c_str());
            CoUninitialize();
            return 5;
        }
        print(L"語言設定檔（zh-TW 注音）已註冊");

        /* Available is not the same as present. This is the step that puts it in
         * the language bar. */
        hr = pingzhu::tsf::installLayoutOrTip(true);
        if (FAILED(hr)) {
            print(L"加入輸入法清單失敗：%s", pingzhu::tsf::describe(hr).c_str());
            print(L"仍可在「設定 → 時間與語言 → 語言與地區 → 中文(繁體，台灣) →");
            print(L"語言選項 → 鍵盤 → 新增鍵盤」手動加入。");
        } else {
            print(L"已加入使用者輸入法清單（語言列）");
        }
    } else if (action == L"uninstall") {
        hr = pingzhu::tsf::installLayoutOrTip(false);
        print(L"從輸入法清單移除：%s", SUCCEEDED(hr) ? L"完成" : pingzhu::tsf::describe(hr).c_str());
        hr = pingzhu::tsf::unregisterProfiles();
        print(L"語言設定檔移除：%s", SUCCEEDED(hr) ? L"完成" : pingzhu::tsf::describe(hr).c_str());
        hr = pingzhu::tsf::unregisterComServer();
        print(L"COM 註冊移除：%s", SUCCEEDED(hr) ? L"完成" : pingzhu::tsf::describe(hr).c_str());
    } else {
        print(L"用法：regtool [install|uninstall|status]");
        CoUninitialize();
        return 2;
    }

    CoUninitialize();
    return 0;
}
