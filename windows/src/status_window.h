/*
 * A floating 繁／簡 button.
 *
 * The Windows language bar was the obvious home for this and it does not work:
 * `ITfLangBarItemMgr::AddItem` returns E_FAIL on this machine, with the manager
 * obtained through the documented call, with the item's category registered, and
 * with the language bar switched on. Whatever the reason, an input method cannot
 * depend on it.
 *
 * 自然輸入法 does not either — the small 簡 button in its UI is its own window,
 * not a language bar item. This is the same idea: a window we own, showing the
 * current output script, that switches when clicked.
 *
 * Owned by the portable shell rather than the text service, because the text
 * service lives inside every application that uses it: one button per process
 * would be a row of them on screen. The portable shell is a single process, so
 * there is exactly one.
 */
#ifndef PINGZHU_STATUS_WINDOW_H
#define PINGZHU_STATUS_WINDOW_H

#include <windows.h>

#include <functional>
#include <string>

namespace pingzhu {

class StatusWindow {
public:
    using GetScript = std::function<std::string()>;
    using SetScript = std::function<void(const std::string &)>;

    StatusWindow(GetScript getScript, SetScript setScript);
    ~StatusWindow();

    bool create(HINSTANCE instance);
    void destroy();
    void refresh();

    /* Remembered across runs: a button that jumps back to a default corner every
     * time is worse than no button, because the user has to find it again. */
    void setPosition(int x, int y);
    RECT rect() const { return rect_; }

private:
    static LRESULT CALLBACK windowProc(HWND, UINT, WPARAM, LPARAM);
    LRESULT handleMessage(HWND, UINT, WPARAM, LPARAM);
    void paint(HDC dc);
    void moveTo(int x, int y);

    HWND hwnd_ = nullptr;
    GetScript getScript_;
    SetScript setScript_;
    RECT rect_ = {0, 0, 0, 0};
    HFONT font_ = nullptr;
    /* Set between a left-button press and release; if the pointer moved in
     * between it was a drag, not a click, and the script must not toggle. */
    bool dragging_ = false;
    POINT dragOrigin_ = {0, 0};
    POINT pressOrigin_ = {0, 0};
    bool moved_ = false;
};

}  // namespace pingzhu

#endif  // PINGZHU_STATUS_WINDOW_H
