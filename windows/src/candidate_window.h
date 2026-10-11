/*
 * The candidate window.
 *
 * A borderless topmost popup that never takes focus (WS_EX_NOACTIVATE), because
 * stealing focus from the application being typed into is the classic way a
 * home-grown IME becomes unusable. It is positioned from the caret rectangle
 * reported by the foreground thread, falling back to the mouse position when the
 * application does not publish one.
 */
#ifndef PINGZHU_CANDIDATE_WINDOW_H
#define PINGZHU_CANDIDATE_WINDOW_H

#include <windows.h>

#include <string>
#include <vector>

namespace pingzhu {

/* The window's geometry, shared by the painter, the layout, and the test that
 * holds the two together.
 *
 * These numbers used to live inside the .cpp twice: once as line offsets in the
 * painter and once as a sum in the layout. They drifted, and the page indicator
 * — drawn 44 below the candidate row, inside a window sized for the 26-below
 * line — had its lower half cut off on every screen it ever appeared on.
 * Anything that needs them reads them from here. */
namespace layout {
constexpr int kPadX = 10;
constexpr int kPadY = 8;
constexpr int kLabelW = 18; /* room for "10" */
constexpr int kItemGap = 14;
/* Vertical offsets between the lines, top to bottom: the bopomofo being
 * composed, the candidate row, → the preview with the mode, and 第 N/M 頁 —
 * that last one only when there is more than one page. */
constexpr int kLine1To2 = 22;
constexpr int kLine2To3 = 26;
constexpr int kLine2ToPage = 44;
}  // namespace layout

struct CandidateView {
    std::string composing;   /* the bopomofo being typed */
    std::string sentence;    /* what it would commit as */
    std::vector<std::string> candidates;
    int pageIndex = 0;
    int pageCount = 1;
    int cursor = 0;        /* which syllable the window is anchored to */
    bool selectionMode = false;
    bool faithful = true;  /* false => the output is a guess, show it differently */
    /* Shown in the status line. "What is displayed is what will be output" is
     * the whole point of a script indicator: a mode you cannot see is a mode you
     * forget you are in. */
    bool simplified = false;
    /* When the caller knows where the caret is — a TSF text service does, via
     * ITfContextView::GetTextExt — it says so here instead of letting the window
     * guess from the foreground thread. */
    bool hasAnchor = false;
    POINT anchor = {0, 0};
};

class CandidateWindow {
public:
    bool create(HINSTANCE instance);
    void destroy();

    void show(const CandidateView &view);
    void hide();
    bool visible() const { return visible_; }

    /* Screen rectangle of the window, for tests and for positioning. */
    RECT rect() const { return rect_; }

private:
    static LRESULT CALLBACK windowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    LRESULT handleMessage(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    void paint(HDC dc);
    void reposition();

    HWND hwnd_ = nullptr;
    CandidateView view_;
    RECT rect_ = {0, 0, 0, 0};
    bool visible_ = false;
    HFONT fontCandidates_ = nullptr;
    HFONT fontComposing_ = nullptr;
    HFONT fontSmall_ = nullptr;
};

}  // namespace pingzhu

#endif  // PINGZHU_CANDIDATE_WINDOW_H
