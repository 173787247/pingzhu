/*
 * 平注 PingZhu — 可攜版 Windows 注音輸入法
 *
 * A tray-resident IME built on a global keyboard hook. It is not a TSF text
 * service: it does not appear in the language bar and it cannot serve elevated
 * windows. What it does do is run anywhere without COM registration or
 * administrator rights, which makes it the version that can actually be handed
 * to someone today. The TSF shell shares the same core and the same candidate
 * window and is the next step.
 *
 *   Ctrl+Alt+Z   中文 / 英文
 *   左鍵點托盤   同上
 *   右鍵點托盤   選單
 *
 * While 中文 is on, bopomofo keys are taken from the application, decoded, and
 * the result is typed back in. Space opens the candidate window and pages it;
 * digits then select, exactly as they do everywhere else in this project.
 */
#include <windows.h>
#include <shellapi.h>

#include <memory>
#include <string>
#include <vector>

#include "candidate_window.h"
#include "config.h"
#include "status_window.h"
#include "data_dir.h"
#include "engine_api.h"
#include "inject.h"
#include "router.h"

namespace {

constexpr wchar_t kAppName[] = L"平注 PingZhu";
constexpr UINT kTrayMessage = WM_APP + 1;
constexpr UINT kDecisionMessage = WM_APP + 2;
constexpr UINT_PTR kTrayId = 1;
constexpr int kHotkeyId = 1;
constexpr int kMenuToggle = 100;
constexpr int kMenuExit = 101;
constexpr int kMenuTraditional = 110;
constexpr int kMenuSimplified = 111;
constexpr int kMenuShowStatus = 120;

HWND g_window = nullptr;
HHOOK g_hook = nullptr;
bool g_chineseMode = true;
HICON g_iconOn = nullptr;
HICON g_iconOff = nullptr;
pingzhu::Engine g_engine;
pingzhu::CandidateWindow g_candidates;

pingzhu::Config g_config;
/* The floating 繁／簡 button. Owned here rather than by the text service: the
 * text service runs inside every application, and one button per process would
 * put a row of them on screen. This process is the only one. */
std::unique_ptr<pingzhu::StatusWindow> g_status;
bool g_indicatorOnly = false;

std::wstring executableDir() {
    wchar_t path[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, path, MAX_PATH);
    std::wstring s(path);
    size_t slash = s.find_last_of(L"\\/");
    return slash == std::wstring::npos ? L"." : s.substr(0, slash);
}

std::string toUtf8(const std::wstring &wide) { return pingzhu::toUtf8(wide); }

/* Both shells resolve the data directory through the same function on purpose:
 * two copies of this logic already diverged once, and the TSF service silently
 * failed to load its engine because of it. */
std::string resolveDataDir() { return pingzhu::toUtf8(pingzhu::resolveDataDir(executableDir())); }

std::string userDictPath() { return toUtf8(executableDir() + L"\\pingzhu-userdict.txt"); }

void updateTray() {
    NOTIFYICONDATAW nid = {0};
    nid.cbSize = sizeof(nid);
    nid.hWnd = g_window;
    nid.uID = kTrayId;
    nid.uFlags = NIF_ICON | NIF_TIP;
    nid.hIcon = g_chineseMode ? g_iconOn : g_iconOff;
    wcscpy_s(nid.szTip, g_chineseMode ? L"平注 PingZhu — 中文（Ctrl+Alt+Z 切換）"
                                      : L"平注 PingZhu — 英文（Ctrl+Alt+Z 切換）");
    Shell_NotifyIconW(NIM_MODIFY, &nid);
}

void refreshCandidateWindow() {
    if (!g_engine.isComposing()) {
        g_candidates.hide();
        return;
    }
    pingzhu::CandidateView view;
    view.composing = g_engine.composing();
    view.sentence = g_engine.sentence();
    view.selectionMode = g_engine.candidateWindowOpen();
    view.faithful = g_engine.outputIsFaithful();
    view.simplified = g_config.output == "simplified";
    view.pageIndex = g_engine.pageIndex();
    view.pageCount = g_engine.pageCount();
    view.cursor = 0;
    int count = g_engine.candidateCount();
    for (int i = 0; i < count; ++i) view.candidates.push_back(g_engine.candidateAt(i));
    g_candidates.show(view);
}

/* Applies a script choice from anywhere — tray menu, hotkey, floating button —
 * and writes it back so every other reader agrees. */
void applyOutputScript(const char *script) {
    if (!g_engine.setOutputScript(script)) return;
    g_config.output = script;
    pingzhu::saveOutputScript(executableDir(), script);
    refreshCandidateWindow();
    if (g_status) g_status->refresh();
}

void commitAndInject(const std::string &text) {
    if (!text.empty()) pingzhu::injectUtf8(text);
    refreshCandidateWindow();
}

void setChineseMode(bool on) {
    if (g_chineseMode == on) return;
    /* Switching away from Chinese with something half-typed commits it, which is
     * what every IME does and what stops the user silently losing characters. */
    if (!on && g_engine.isComposing()) commitAndInject(g_engine.commit());
    g_chineseMode = on;
    g_candidates.hide();
    updateTray();
}

void performAction(pingzhu::Action action, int arg, char ch) {
    using pingzhu::Action;
    switch (action) {
        case Action::Compose:
            g_engine.feedKey(ch);
            refreshCandidateWindow();
            break;
        case Action::SelectCandidate: {
            std::string out = g_engine.selectCandidate(arg);
            if (!out.empty()) commitAndInject(out);
            else refreshCandidateWindow();
            break;
        }
        case Action::NextPage:
            g_engine.nextPage();
            refreshCandidateWindow();
            break;
        case Action::OpenCandidates:
            g_engine.openCandidates();
            refreshCandidateWindow();
            break;
        case Action::CloseCandidates:
            g_engine.closeCandidates();
            refreshCandidateWindow();
            break;
        case Action::MoveCursor:
            g_engine.moveCursor(arg);
            refreshCandidateWindow();
            break;
        case Action::Backspace:
            g_engine.backspace();
            refreshCandidateWindow();
            break;
        case Action::Commit: {
            std::string out = g_engine.commit();
            commitAndInject(out);
            break;
        }
        case Action::Cancel:
            g_engine.reset();
            refreshCandidateWindow();
            break;
        case Action::ToggleScript:
            applyOutputScript(g_config.output == "simplified" ? "traditional" : "simplified");
            break;
        case Action::Pass:
        default:
            break;
    }
}

pingzhu::KeyKind classify(DWORD vk, char &ch) {
    ch = 0;
    if (vk >= 'A' && vk <= 'Z') {
        ch = static_cast<char>('a' + (vk - 'A'));
        return pingzhu::KeyKind::Letter;
    }
    if (vk >= '0' && vk <= '9') {
        ch = static_cast<char>('0' + (vk - '0'));
        return pingzhu::KeyKind::Digit;
    }
    switch (vk) {
        case VK_OEM_MINUS:  ch = '-'; return pingzhu::KeyKind::Symbol;
        case VK_OEM_1:      ch = ';'; return pingzhu::KeyKind::Symbol;
        case VK_OEM_2:      ch = '/'; return pingzhu::KeyKind::Symbol;
        case VK_OEM_COMMA:  ch = ','; return pingzhu::KeyKind::Symbol;
        case VK_OEM_PERIOD: ch = '.'; return pingzhu::KeyKind::Symbol;
        case VK_OEM_PLUS:   ch = '='; return pingzhu::KeyKind::Symbol;
        case VK_OEM_4:      ch = '['; return pingzhu::KeyKind::Symbol;
        case VK_OEM_5:      ch = '\\'; return pingzhu::KeyKind::Symbol;
        case VK_OEM_6:      ch = ']'; return pingzhu::KeyKind::Symbol;
        case VK_OEM_7:      ch = '\''; return pingzhu::KeyKind::Symbol;
        case VK_OEM_3:      ch = '`'; return pingzhu::KeyKind::Symbol;
        case VK_SPACE:      return pingzhu::KeyKind::Space;
        case VK_BACK:       return pingzhu::KeyKind::Backspace;
        case VK_RETURN:     return pingzhu::KeyKind::Enter;
        case VK_ESCAPE:     return pingzhu::KeyKind::Escape;
        case VK_LEFT:       return pingzhu::KeyKind::ArrowLeft;
        case VK_RIGHT:      return pingzhu::KeyKind::ArrowRight;
        case VK_UP:         return pingzhu::KeyKind::ArrowUp;
        case VK_DOWN:       return pingzhu::KeyKind::ArrowDown;
        default:            return pingzhu::KeyKind::Other;
    }
}

LRESULT CALLBACK keyboardHook(int code, WPARAM wParam, LPARAM lParam) {
    if (code != HC_ACTION) return CallNextHookEx(g_hook, code, wParam, lParam);
    /* Ignore keys we injected ourselves, or the IME would eat its own output. */
    auto *info = reinterpret_cast<KBDLLHOOKSTRUCT *>(lParam);
    if (info->flags & LLKHF_INJECTED) return CallNextHookEx(g_hook, code, wParam, lParam);
    if (wParam != WM_KEYDOWN && wParam != WM_SYSKEYDOWN) {
        return CallNextHookEx(g_hook, code, wParam, lParam);
    }

    char ch = 0;
    pingzhu::KeyEvent key;
    key.kind = classify(info->vkCode, ch);
    key.ch = ch;
    key.ctrl = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
    key.alt = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;
    key.shift = (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0;

    pingzhu::EngineState state;
    state.composing = g_engine.isComposing();
    state.candidateWindowOpen = g_engine.candidateWindowOpen();
    state.hasCandidates = g_engine.candidateCount() > 0;

    pingzhu::Decision decision = pingzhu::route(key, state, g_chineseMode);
    if (decision.action == pingzhu::Action::Pass) {
        return CallNextHookEx(g_hook, code, wParam, lParam);
    }
    /* Do the work on the message loop, not inside the hook: injecting input from
     * a low-level hook callback is re-entrant and can deadlock. */
    PostMessageW(g_window, kDecisionMessage, static_cast<WPARAM>(decision.action),
                 MAKELPARAM(static_cast<BYTE>(decision.arg), static_cast<BYTE>(ch)));
    return 1;  /* consumed: the application never sees this key */
}

LRESULT CALLBACK windowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case kDecisionMessage:
            performAction(static_cast<pingzhu::Action>(wParam),
                          static_cast<signed char>(LOWORD(lParam)),
                          static_cast<char>(HIWORD(lParam)));
            return 0;

        case WM_HOTKEY:
            if (wParam == kHotkeyId) setChineseMode(!g_chineseMode);
            return 0;

        case kTrayMessage:
            if (LOWORD(lParam) == WM_LBUTTONUP) {
                setChineseMode(!g_chineseMode);
            } else if (LOWORD(lParam) == WM_RBUTTONUP) {
                POINT pt;
                GetCursorPos(&pt);
                HMENU menu = CreatePopupMenu();
                AppendMenuW(menu, MF_STRING, kMenuToggle,
                            g_chineseMode ? L"切換為英文" : L"切換為中文");
                AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
                HMENU output = CreatePopupMenu();
                AppendMenuW(output, MF_STRING, kMenuTraditional, L"繁體輸出");
                AppendMenuW(output, MF_STRING, kMenuSimplified, L"簡體輸出");
                CheckMenuRadioItem(output, kMenuTraditional, kMenuSimplified,
                                   g_config.output == "simplified" ? kMenuSimplified
                                                                   : kMenuTraditional,
                                   MF_BYCOMMAND);
                AppendMenuW(menu, MF_POPUP, reinterpret_cast<UINT_PTR>(output), L"輸出字形");
                AppendMenuW(menu, MF_STRING, kMenuShowStatus, L"顯示狀態按鈕");
                AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
                AppendMenuW(menu, MF_STRING, kMenuExit, L"結束");
                SetForegroundWindow(hwnd);
                TrackPopupMenu(menu, TPM_RIGHTBUTTON, pt.x, pt.y, 0, hwnd, nullptr);
                DestroyMenu(menu);
            }
            return 0;

        case WM_COMMAND:
            if (LOWORD(wParam) == kMenuToggle) setChineseMode(!g_chineseMode);
            if (LOWORD(wParam) == kMenuTraditional || LOWORD(wParam) == kMenuSimplified) {
                applyOutputScript(LOWORD(wParam) == kMenuSimplified ? "simplified" : "traditional");
            }
            if (LOWORD(wParam) == kMenuShowStatus && g_status) {
                /* Right-clicking the button hides it, so this is how it comes
                 * back without hunting for the config file. */
                g_status->setPosition(g_status->rect().left, g_status->rect().top);
                ShowWindow(FindWindowW(L"PingZhuStatusWindow", nullptr), SW_SHOWNOACTIVATE);
            }
            if (LOWORD(wParam) == kMenuExit) PostQuitMessage(0);
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            break;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
    /* `--indicator` runs only the floating button: no keyboard hook, so it can
     * sit alongside the TSF text service, which is the version most people will
     * actually type with. Two input paths at once would fight over every key. */
    for (int i = 1; i < __argc; ++i) {
        if (__wargv[i] && wcscmp(__wargv[i], L"--indicator") == 0) g_indicatorOnly = true;
    }
    /* One IME per session; a second copy would fight over the hook. */
    HANDLE mutex = CreateMutexW(nullptr, TRUE, L"PingZhuIME.SingleInstance");
    if (mutex && GetLastError() == ERROR_ALREADY_EXISTS) {
        MessageBoxW(nullptr, L"平注 PingZhu 已經在執行中（請看系統匣）。", kAppName,
                    MB_OK | MB_ICONINFORMATION);
        return 0;
    }

    std::wstring exeDir = executableDir();
    /* Settings first: the file is created with commented defaults when missing,
     * so the 繁/簡 switch is discoverable rather than a secret. */
    pingzhu::writeDefaultConfigIfMissing(exeDir);
    g_config = pingzhu::loadConfig(exeDir);
    std::string error;
    if (!g_engine.load(exeDir + L"\\pingzhu_core.dll", resolveDataDir(), "standard", nullptr)) {
        error = g_engine.lastError();
    }

    if (!g_candidates.create(instance)) {
        MessageBoxW(nullptr, L"無法建立候選視窗。", kAppName, MB_OK | MB_ICONERROR);
        return 1;
    }

    WNDCLASSEXW wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = windowProc;
    wc.hInstance = instance;
    wc.lpszClassName = L"PingZhuIMEHost";
    RegisterClassExW(&wc);
    g_window = CreateWindowExW(0, L"PingZhuIMEHost", kAppName, 0, 0, 0, 0, 0, HWND_MESSAGE,
                               nullptr, instance, nullptr);
    if (!g_window) return 1;

    g_iconOn = LoadIconW(nullptr, IDI_APPLICATION);
    g_iconOff = LoadIconW(nullptr, IDI_WARNING);

    NOTIFYICONDATAW nid = {0};
    nid.cbSize = sizeof(nid);
    nid.hWnd = g_window;
    nid.uID = kTrayId;
    nid.uFlags = NIF_ICON | NIF_TIP | NIF_MESSAGE;
    nid.uCallbackMessage = kTrayMessage;
    nid.hIcon = g_iconOn;
    wcscpy_s(nid.szTip, L"平注 PingZhu — 中文（Ctrl+Alt+Z 切換）");
    Shell_NotifyIconW(NIM_ADD, &nid);

    RegisterHotKey(g_window, kHotkeyId, MOD_CONTROL | MOD_ALT, 'Z');
    if (!g_indicatorOnly) {
        g_hook = SetWindowsHookExW(WH_KEYBOARD_LL, keyboardHook, instance, 0);
    }

    /* The floating button is created in both modes: in normal mode it is the
     * visible state indicator the language bar failed to provide, and in
     * indicator mode it is the whole point. */
    if (g_engine.valid()) {
        g_status = std::make_unique<pingzhu::StatusWindow>(
            []() { return g_config.output; },
            [](const std::string &script) {
                applyOutputScript(script.c_str());
                pingzhu::saveStatusPosition(executableDir(),
                                            g_status ? g_status->rect().left : 0,
                                            g_status ? g_status->rect().top : 0);
            });
        if (g_status->create(instance)) {
            if (g_config.statusX != INT_MIN && g_config.statusY != INT_MIN) {
                g_status->setPosition(g_config.statusX, g_config.statusY);
            }
        } else {
            g_status.reset();
        }
    }

    if (!g_engine.valid()) {
        std::wstring message = L"引擎載入失敗，將只顯示提示。\n\n" +
                               std::wstring(error.begin(), error.end());
        MessageBoxW(nullptr, message.c_str(), kAppName, MB_OK | MB_ICONERROR);
    } else {
        g_engine.loadUserDictionaryFile(userDictPath());
        if (!g_engine.setOutputScript(g_config.output.c_str())) {
            g_config.output = g_engine.outputScript();
        }
        /* The balloon describes what this mode can actually do. In indicator
         * mode there is no keyboard hook, so advertising Ctrl+Alt+Z would be
         * telling the user about a key that does nothing. */
        std::wstring message;
        if (g_indicatorOnly) {
            message =
                L"平注 PingZhu 狀態按鈕已在執行。\n\n"
                L"　左鍵點按鈕　　切換繁體／簡體\n"
                L"　拖曳按鈕　　　移到順手的位置\n"
                L"　右鍵點按鈕　　隱藏（托盤選單可叫回）\n"
                L"　Ctrl+Alt+S　　切換繁體／簡體（打字時）";
        } else {
            message =
                L"平注 PingZhu 已在系統匣執行。\n\n"
                L"　Ctrl+Alt+Z　切換中文／英文\n"
                L"　Ctrl+Alt+S　切換繁體／簡體\n"
                L"　托盤左鍵　　切換中英\n"
                L"　托盤右鍵　　選單\n\n"
                L"打 su3cl3 再按空白，會出現「你好」。";
        }
        NOTIFYICONDATAW balloon = nid;
        balloon.uFlags = NIF_INFO;
        balloon.dwInfoFlags = NIIF_INFO;
        wcscpy_s(balloon.szInfoTitle, kAppName);
        wcscpy_s(balloon.szInfo, message.c_str());
        Shell_NotifyIconW(NIM_MODIFY, &balloon);
    }

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_engine.valid() && g_engine.isComposing()) {
        std::string pending = g_engine.commit();
        (void)pending;
    }
    g_engine.saveUserDictionaryFile(userDictPath());
    if (g_hook) UnhookWindowsHookEx(g_hook);
    Shell_NotifyIconW(NIM_DELETE, &nid);
    g_candidates.destroy();
    g_engine.destroy();
    if (mutex) CloseHandle(mutex);
    return 0;
}
