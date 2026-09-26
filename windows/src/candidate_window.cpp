#include "candidate_window.h"

#include <algorithm>

namespace pingzhu {

namespace {

constexpr wchar_t kClassName[] = L"PingZhuCandidateWindow";
constexpr int kPadX = 10;
constexpr int kPadY = 8;
constexpr int kLabelW = 18;   /* room for "10" */
constexpr int kItemGap = 14;

std::wstring widen(const std::string &utf8) {
    if (utf8.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

/* Where to put the window: just under the caret of whatever is being typed into. */
POINT caretAnchor() {
    POINT pt = {0, 0};
    HWND foreground = GetForegroundWindow();
    if (foreground) {
        DWORD threadId = GetWindowThreadProcessId(foreground, nullptr);
        GUITHREADINFO info = {0};
        info.cbSize = sizeof(info);
        if (threadId && GetGUIThreadInfo(threadId, &info)) {
            HWND caret = info.hwndCaret ? info.hwndCaret : foreground;
            if (info.hwndCaret) {
                pt.x = info.rcCaret.left;
                pt.y = info.rcCaret.bottom;
                /* rcCaret is in client coordinates of hwndCaret. */
                POINT screen = pt;
                if (ClientToScreen(caret, &screen)) return screen;
            }
            RECT r = {0};
            if (GetWindowRect(foreground, &r)) {
                pt.x = r.left + 40;
                pt.y = r.top + 60;
                return pt;
            }
        }
    }
    GetCursorPos(&pt);
    return pt;
}

}  // namespace

bool CandidateWindow::create(HINSTANCE instance) {
    WNDCLASSEXW wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = &CandidateWindow::windowProc;
    wc.hInstance = instance;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.lpszClassName = kClassName;
    /* A NULL background brush: the window paints every pixel itself, and a class
     * brush would flicker on resize. */
    wc.hbrBackground = nullptr;
    if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
        return false;
    }

    hwnd_ = CreateWindowExW(
        WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, kClassName, L"", WS_POPUP, 0, 0,
        10, 10, nullptr, nullptr, instance, this);
    if (!hwnd_) return false;

    fontCandidates_ = CreateFontW(-20, 0, 0, 0, FW_MEDIUM, FALSE, FALSE, FALSE,
                                  DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                                  CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Microsoft JhengHei UI");
    fontComposing_ = CreateFontW(-17, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                 DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                                 CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Microsoft JhengHei UI");
    fontSmall_ = CreateFontW(-13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                             DEFAULT_PITCH, L"Microsoft JhengHei UI");
    return true;
}

void CandidateWindow::destroy() {
    if (hwnd_) {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
    }
    if (fontCandidates_) DeleteObject(fontCandidates_);
    if (fontComposing_) DeleteObject(fontComposing_);
    if (fontSmall_) DeleteObject(fontSmall_);
    fontCandidates_ = fontComposing_ = fontSmall_ = nullptr;
}

void CandidateWindow::show(const CandidateView &view) {
    if (!hwnd_) return;
    view_ = view;
    reposition();
    ShowWindow(hwnd_, SW_SHOWNOACTIVATE);
    InvalidateRect(hwnd_, nullptr, FALSE);
    UpdateWindow(hwnd_);
    visible_ = true;
}

void CandidateWindow::hide() {
    if (!hwnd_) return;
    ShowWindow(hwnd_, SW_HIDE);
    visible_ = false;
}

void CandidateWindow::reposition() {
    HDC dc = GetDC(hwnd_);
    HGDIOBJ old = SelectObject(dc, fontCandidates_);

    int width = kPadX * 2;
    int maxItemH = 0;
    for (size_t i = 0; i < view_.candidates.size(); ++i) {
        std::wstring label = std::to_wstring(i + 1 == 10 ? 0 : static_cast<int>(i + 1));
        std::wstring word = widen(view_.candidates[i]);
        SIZE sWord = {0}, sLabel = {0};
        GetTextExtentPoint32W(dc, word.c_str(), static_cast<int>(word.size()), &sWord);
        GetTextExtentPoint32W(dc, label.c_str(), static_cast<int>(label.size()), &sLabel);
        width += kLabelW + sWord.cx + kItemGap;
        maxItemH = std::max<int>(maxItemH, static_cast<int>(sWord.cy));
    }
    SelectObject(dc, fontComposing_);
    std::wstring composing = widen(view_.composing);
    SIZE sComposing = {0};
    if (!composing.empty()) {
        GetTextExtentPoint32W(dc, composing.c_str(), static_cast<int>(composing.size()), &sComposing);
    }
    SelectObject(dc, old);
    ReleaseDC(hwnd_, dc);

    width = std::max<int>(width, static_cast<int>(sComposing.cx) + kPadX * 2 + 120);
    width = std::min<int>(width, 1000);
    /* composing line + candidate line + a thin status line */
    int height = kPadY * 2 + sComposing.cy + maxItemH + 18;

    POINT at = view_.hasAnchor ? view_.anchor : caretAnchor();
    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    if (at.x + width > screenW) at.x = std::max<LONG>(0, screenW - width - 8);
    if (at.y + height + 24 > screenH) at.y = std::max<LONG>(0, at.y - height - 40);

    rect_ = {at.x, at.y, at.x + width, at.y + height};
    SetWindowPos(hwnd_, HWND_TOPMOST, rect_.left, rect_.top, width, height,
                 SWP_NOACTIVATE | SWP_SHOWWINDOW);
}

void CandidateWindow::paint(HDC target) {
    RECT client = {0};
    GetClientRect(hwnd_, &client);
    int w = static_cast<int>(client.right), h = static_cast<int>(client.bottom);

    /* Double buffer: the window repaints on every keystroke and flicker is
     * immediately visible on a popup that follows the caret. */
    HDC dc = CreateCompatibleDC(target);
    HBITMAP bitmap = CreateCompatibleBitmap(target, w, h);
    HGDIOBJ oldBitmap = SelectObject(dc, bitmap);

    HBRUSH bg = CreateSolidBrush(RGB(28, 31, 38));
    FillRect(dc, &client, bg);
    DeleteObject(bg);
    HPEN border = CreatePen(PS_SOLID, 1, RGB(70, 78, 96));
    HGDIOBJ oldPen = SelectObject(dc, border);
    HGDIOBJ oldBrush = SelectObject(dc, GetStockObject(NULL_BRUSH));
    Rectangle(dc, 0, 0, w, h);
    SelectObject(dc, oldPen);
    SelectObject(dc, oldBrush);
    DeleteObject(border);

    SetBkMode(dc, TRANSPARENT);
    int y = kPadY;

    /* line 1: the bopomofo being composed */
    std::wstring composing = widen(view_.composing);
    if (!composing.empty()) {
        SelectObject(dc, fontComposing_);
        SetTextColor(dc, RGB(200, 206, 218));
        TextOutW(dc, kPadX, y, composing.c_str(), static_cast<int>(composing.size()));
    }

    /* line 2: the candidates, numbered the way the keys are */
    SelectObject(dc, fontCandidates_);
    int x = kPadX;
    int y2 = y + 22;
    for (size_t i = 0; i < view_.candidates.size(); ++i) {
        wchar_t label[4];
        int shown = (i == 9) ? 0 : static_cast<int>(i + 1);
        wsprintfW(label, L"%d", shown);
        SetTextColor(dc, view_.selectionMode ? RGB(110, 168, 254) : RGB(120, 128, 145));
        TextOutW(dc, x, y2, label, static_cast<int>(wcslen(label)));
        x += kLabelW;
        std::wstring word = widen(view_.candidates[i]);
        SetTextColor(dc, view_.selectionMode ? RGB(240, 244, 250) : RGB(214, 220, 232));
        TextOutW(dc, x, y2, word.c_str(), static_cast<int>(word.size()));
        SIZE s = {0};
        GetTextExtentPoint32W(dc, word.c_str(), static_cast<int>(word.size()), &s);
        x += s.cx + kItemGap;
        if (x > w - 40) break;
    }

    /* line 3: what it would commit, and the mode */
    SelectObject(dc, fontSmall_);
    SetTextColor(dc, view_.faithful ? RGB(78, 201, 160) : RGB(224, 164, 88));
    std::wstring preview = L"→ " + widen(view_.sentence);
    TextOutW(dc, kPadX, y2 + 26, preview.c_str(), static_cast<int>(preview.size()));

    /* The script comes first in the status line, and in colour: it changes what
     * every character on screen will become, so it is the most important thing
     * the window has to say. */
    const wchar_t *script = view_.simplified ? L"簡體" : L"繁體";
    std::wstring hint = view_.selectionMode ? L"選字模式（1-9,0 選字，空白換頁）"
                                            : L"打字模式（空白送出，↓ 開啟選字）";
    SIZE sScript = {0};
    GetTextExtentPoint32W(dc, script, static_cast<int>(wcslen(script)), &sScript);
    SIZE sHint = {0};
    GetTextExtentPoint32W(dc, hint.c_str(), static_cast<int>(hint.size()), &sHint);
    const int right = std::max<int>(kPadX, static_cast<int>(w - sHint.cx - sScript.cx - 14) - kPadX);
    SetTextColor(dc, view_.simplified ? RGB(120, 200, 255) : RGB(255, 190, 120));
    TextOutW(dc, right, y2 + 26, script, static_cast<int>(wcslen(script)));
    SetTextColor(dc, RGB(120, 128, 145));
    TextOutW(dc, std::max<int>(kPadX, static_cast<int>(w - sHint.cx) - kPadX), y2 + 26, hint.c_str(),
             static_cast<int>(hint.size()));

    if (view_.pageCount > 1) {
        wchar_t page[64];
        wsprintfW(page, L"第 %d/%d 頁　空白鍵下一頁", view_.pageIndex + 1, view_.pageCount);
        SetTextColor(dc, RGB(120, 128, 145));
        TextOutW(dc, kPadX, y2 + 44, page, static_cast<int>(wcslen(page)));
    }

    BitBlt(target, 0, 0, w, h, dc, 0, 0, SRCCOPY);
    SelectObject(dc, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(dc);
}

LRESULT CALLBACK CandidateWindow::windowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    CandidateWindow *self = nullptr;
    if (msg == WM_NCCREATE) {
        auto *cs = reinterpret_cast<CREATESTRUCTW *>(lParam);
        self = static_cast<CandidateWindow *>(cs->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        self->hwnd_ = hwnd;
    } else {
        self = reinterpret_cast<CandidateWindow *>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    }
    if (self) return self->handleMessage(hwnd, msg, wParam, lParam);
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

LRESULT CandidateWindow::handleMessage(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_ERASEBKGND:
            return 1;  /* paint() covers everything */
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC dc = BeginPaint(hwnd, &ps);
            paint(dc);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_MOUSEACTIVATE:
            return MA_NOACTIVATE;  /* never steal focus */
        case WM_NCHITTEST:
            return HTTRANSPARENT;  /* clicks go through to the app */
        default:
            break;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

}  // namespace pingzhu
