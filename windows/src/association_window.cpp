#include "association_window.h"

#include <algorithm>

namespace {

constexpr wchar_t kClassName[] = L"PingZhuAssociationWindow";

/* 与候选窗同一套配色，看起来才像同一个输入法画出来的。 */
constexpr COLORREF kBackground = RGB(28, 31, 38);
constexpr COLORREF kBorder = RGB(70, 78, 92);
constexpr COLORREF kText = RGB(150, 190, 255);

constexpr int kPadX = 10;
constexpr int kPadY = 6;

std::wstring widen(const std::string &utf8) {
    if (utf8.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

}  // namespace

bool AssociationWindow::create(HINSTANCE instance) {
    WNDCLASSEXW wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = &AssociationWindow::windowProc;
    wc.hInstance = instance;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.lpszClassName = kClassName;
    /* NULL 背景刷：窗口自己画每一个像素，类刷会在重画时闪。 */
    wc.hbrBackground = nullptr;
    if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
        return false;
    }

    hwnd_ = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, kClassName, L"",
                            WS_POPUP, 0, 0, 10, 10, nullptr, nullptr, instance, this);
    if (!hwnd_) return false;

    font_ = CreateFontW(-16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                        OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                        DEFAULT_PITCH | FF_DONTCARE, L"Microsoft JhengHei UI");
    return true;
}

void AssociationWindow::destroy() {
    if (font_) {
        DeleteObject(font_);
        font_ = nullptr;
    }
    if (hwnd_) {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
    }
}

void AssociationWindow::show(const std::vector<std::string> &words, POINT anchor) {
    if (!hwnd_) return;
    /* 空列表等于隐藏：「没有联想」和「这扇窗不该出现」是同一种状态，
     * 让调用方少写一个判断。 */
    if (words.empty()) {
        hide();
        return;
    }
    words_ = words;
    anchor_ = anchor;
    reposition();
    ShowWindow(hwnd_, SW_SHOWNOACTIVATE);
    InvalidateRect(hwnd_, nullptr, FALSE);
    UpdateWindow(hwnd_);
    visible_ = true;
}

void AssociationWindow::hide() {
    if (!hwnd_) return;
    ShowWindow(hwnd_, SW_HIDE);
    visible_ = false;
    words_.clear();
}

void AssociationWindow::reposition() {
    HDC dc = GetDC(hwnd_);
    HGDIOBJ old = SelectObject(dc, font_);

    std::wstring line = L"接下：";
    for (size_t i = 0; i < words_.size(); ++i) {
        if (i > 0) line += L"  ";
        line += widen(words_[i]);
    }
    SIZE size = {0};
    GetTextExtentPoint32W(dc, line.c_str(), static_cast<int>(line.size()), &size);
    SelectObject(dc, old);
    ReleaseDC(hwnd_, dc);

    int width = size.cx + kPadX * 2;
    int height = size.cy + kPadY * 2;
    width = std::min<int>(width, 700);

    POINT at = anchor_;
    const int screenW = GetSystemMetrics(SM_CXSCREEN);
    const int screenH = GetSystemMetrics(SM_CYSCREEN);
    if (at.x + width > screenW) at.x = std::max<LONG>(0, screenW - width - 8);
    /* 光标贴屏幕底部时往上翻，否则这一行会跑到屏幕外。 */
    if (at.y + height + 8 > screenH) at.y = std::max<LONG>(0, at.y - height - 28);

    rect_ = {at.x, at.y, at.x + width, at.y + height};
    SetWindowPos(hwnd_, HWND_TOPMOST, rect_.left, rect_.top, width, height,
                 SWP_NOACTIVATE | SWP_SHOWWINDOW);
}

void AssociationWindow::paint(HDC target) {
    if (!hwnd_) return;
    RECT client = {0, 0, 0, 0};
    GetClientRect(hwnd_, &client);
    const int w = client.right;
    const int h = client.bottom;
    if (w <= 0 || h <= 0) return;

    /* 双缓冲：直接画到窗口上会在每次重定位时闪。 */
    HDC dc = CreateCompatibleDC(target);
    HBITMAP bitmap = CreateCompatibleBitmap(target, w, h);
    HGDIOBJ oldBitmap = SelectObject(dc, bitmap);

    HBRUSH bg = CreateSolidBrush(kBackground);
    RECT all = {0, 0, w, h};
    FillRect(dc, &all, bg);
    DeleteObject(bg);

    HPEN border = CreatePen(PS_SOLID, 1, kBorder);
    HGDIOBJ oldPen = SelectObject(dc, border);
    HGDIOBJ oldBrush = SelectObject(dc, GetStockObject(NULL_BRUSH));
    Rectangle(dc, 0, 0, w, h);
    SelectObject(dc, oldPen);
    SelectObject(dc, oldBrush);
    DeleteObject(border);

    SetBkMode(dc, TRANSPARENT);
    SelectObject(dc, font_);
    SetTextColor(dc, kText);

    std::wstring line = L"接下：";
    for (size_t i = 0; i < words_.size(); ++i) {
        if (i > 0) line += L"  ";
        line += widen(words_[i]);
    }
    TextOutW(dc, kPadX, kPadY, line.c_str(), static_cast<int>(line.size()));

    BitBlt(target, 0, 0, w, h, dc, 0, 0, SRCCOPY);
    SelectObject(dc, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(dc);
}

LRESULT CALLBACK AssociationWindow::windowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    AssociationWindow *self = nullptr;
    if (msg == WM_NCCREATE) {
        auto *cs = reinterpret_cast<CREATESTRUCTW *>(lParam);
        self = static_cast<AssociationWindow *>(cs->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        self->hwnd_ = hwnd;
    } else {
        self = reinterpret_cast<AssociationWindow *>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    }
    if (self) return self->handleMessage(hwnd, msg, wParam, lParam);
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

LRESULT AssociationWindow::handleMessage(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_ERASEBKGND:
            /* paint() 铺满每一个像素，让系统擦一遍只会闪。 */
            return 1;
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC dc = BeginPaint(hwnd, &ps);
            paint(dc);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_MOUSEACTIVATE:
            /* 这是提示，不是可以点的东西。点它不该把焦点从正在打的字上拿走。 */
            return MA_NOACTIVATE;
        default:
            return DefWindowProcW(hwnd, msg, wParam, lParam);
    }
}
