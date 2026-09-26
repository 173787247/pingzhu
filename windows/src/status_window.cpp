#include "status_window.h"

#include <algorithm>

namespace pingzhu {
namespace {

constexpr wchar_t kClassName[] = L"PingZhuStatusWindow";
constexpr int kSize = 38;
/* How far the pointer may move before a press counts as a drag. Without this a
 * one-pixel wobble while clicking would move the button instead of toggling. */
constexpr int kDragThreshold = 4;

std::wstring widen(const std::string &utf8) {
    if (utf8.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

}  // namespace

StatusWindow::StatusWindow(GetScript getScript, SetScript setScript)
    : getScript_(std::move(getScript)), setScript_(std::move(setScript)) {}

StatusWindow::~StatusWindow() { destroy(); }

bool StatusWindow::create(HINSTANCE instance) {
    WNDCLASSEXW wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = &StatusWindow::windowProc;
    wc.hInstance = instance;
    wc.hCursor = LoadCursor(nullptr, IDC_HAND);
    wc.lpszClassName = kClassName;
    wc.hbrBackground = nullptr;
    if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return false;

    hwnd_ = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, kClassName, L"",
                            WS_POPUP, 0, 0, kSize, kSize, nullptr, nullptr, instance, this);
    if (!hwnd_) return false;

    font_ = CreateFontW(-19, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                        OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH,
                        L"Microsoft JhengHei UI");

    /* Bottom-right by default, above the taskbar. */
    const int screenW = GetSystemMetrics(SM_CXSCREEN);
    const int screenH = GetSystemMetrics(SM_CYSCREEN);
    rect_ = {screenW - kSize - 24, screenH - kSize - 90, screenW - 24, screenH - 90};
    moveTo(rect_.left, rect_.top);
    ShowWindow(hwnd_, SW_SHOWNOACTIVATE);
    return true;
}

void StatusWindow::destroy() {
    if (hwnd_) {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
    }
    if (font_) DeleteObject(font_);
    font_ = nullptr;
}

void StatusWindow::refresh() {
    if (hwnd_) InvalidateRect(hwnd_, nullptr, FALSE);
}

void StatusWindow::setPosition(int x, int y) { moveTo(x, y); }

void StatusWindow::moveTo(int x, int y) {
    rect_ = {x, y, x + kSize, y + kSize};
    if (hwnd_) {
        SetWindowPos(hwnd_, HWND_TOPMOST, x, y, kSize, kSize, SWP_NOACTIVATE);
    }
}

void StatusWindow::paint(HDC target) {
    RECT client = {0};
    GetClientRect(hwnd_, &client);
    const int w = static_cast<int>(client.right);
    const int h = static_cast<int>(client.bottom);

    HDC dc = CreateCompatibleDC(target);
    HBITMAP bitmap = CreateCompatibleBitmap(target, w, h);
    HGDIOBJ oldBitmap = SelectObject(dc, bitmap);

    const bool simplified = getScript_() == "simplified";
    /* Blue for Simplified, amber for Traditional. Colour alone would be a poor
     * signal, so the character is different too — the two agree, and either one
     * is readable on its own. */
    const COLORREF background = simplified ? RGB(0x1B, 0x3A, 0x5C) : RGB(0x5C, 0x3A, 0x1B);
    const COLORREF border = simplified ? RGB(0x4A, 0x8F, 0xD8) : RGB(0xD8, 0x9A, 0x4A);

    HBRUSH fill = CreateSolidBrush(background);
    HGDIOBJ oldBrush = SelectObject(dc, fill);
    HPEN pen = CreatePen(PS_SOLID, 2, border);
    HGDIOBJ oldPen = SelectObject(dc, pen);
    // A rounded square rather than a plain rectangle: it reads as a button.
    RoundRect(dc, 1, 1, w - 1, h - 1, 10, 10);
    SelectObject(dc, oldPen);
    SelectObject(dc, oldBrush);
    DeleteObject(fill);
    DeleteObject(pen);

    SetBkMode(dc, TRANSPARENT);
    SetTextColor(dc, RGB(0xF5, 0xF8, 0xFF));
    SelectObject(dc, font_);
    const wchar_t *label = simplified ? L"简" : L"繁";
    DrawTextW(dc, label, -1, &client, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    BitBlt(target, 0, 0, w, h, dc, 0, 0, SRCCOPY);
    SelectObject(dc, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(dc);
}

LRESULT CALLBACK StatusWindow::windowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    StatusWindow *self = nullptr;
    if (msg == WM_NCCREATE) {
        auto *cs = reinterpret_cast<CREATESTRUCTW *>(lParam);
        self = static_cast<StatusWindow *>(cs->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        self->hwnd_ = hwnd;
    } else {
        self = reinterpret_cast<StatusWindow *>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    }
    if (self) return self->handleMessage(hwnd, msg, wParam, lParam);
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

LRESULT StatusWindow::handleMessage(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC dc = BeginPaint(hwnd, &ps);
            paint(dc);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_MOUSEACTIVATE:
            return MA_NOACTIVATE;

        case WM_LBUTTONDOWN: {
            dragging_ = true;
            moved_ = false;
            pressOrigin_ = {static_cast<int>(LOWORD(lParam)), static_cast<int>(HIWORD(lParam))};
            POINT cursor;
            GetCursorPos(&cursor);
            dragOrigin_ = cursor;
            SetCapture(hwnd);
            return 0;
        }
        case WM_MOUSEMOVE: {
            if (!dragging_) return 0;
            POINT cursor;
            GetCursorPos(&cursor);
            const int dx = cursor.x - dragOrigin_.x;
            const int dy = cursor.y - dragOrigin_.y;
            if (!moved_ &&
                (std::abs(dx) > kDragThreshold || std::abs(dy) > kDragThreshold)) {
                moved_ = true;
            }
            if (moved_) moveTo(rect_.left + dx, rect_.top + dy);
            return 0;
        }
        case WM_LBUTTONUP: {
            if (!dragging_) return 0;
            dragging_ = false;
            ReleaseCapture();
            /* A drag moves the button; a click switches the script. Doing both
             * on the same gesture means the user cannot move it without also
             * changing mode. */
            if (!moved_) {
                const char *next = getScript_() == "simplified" ? "traditional" : "simplified";
                setScript_(next);
                refresh();
            }
            return 0;
        }
        case WM_RBUTTONUP: {
            /* Right click hides it, so there is a way out that does not require
             * finding a menu or killing the process. */
            ShowWindow(hwnd, SW_HIDE);
            return 0;
        }
        default:
            break;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

}  // namespace pingzhu
