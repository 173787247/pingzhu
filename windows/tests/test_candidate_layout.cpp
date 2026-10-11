/*
 * Candidate window geometry.
 *
 * The window draws four lines and used to be sized for three. The painter's line
 * offsets and the layout's sum were written out separately and drifted, so 第 N/M
 * 頁 was drawn 44 px below the candidate row inside a window that stopped at
 * 26 px below it: every multi-page candidate list had its last line cut in half.
 * Nothing here noticed, because no test looked at the window's geometry at all.
 *
 * This one does. It shows the window with the same views the shell builds, reads
 * the rectangle back, and checks that the lowest line it would draw fits inside
 * it — using the offsets shared from candidate_window.h, so the two cannot drift
 * apart again without this failing.
 *
 * It creates a real window, so it needs a desktop; that is why the packaging
 * self-check does not run it.
 */
#include <cstdio>

#include "../src/candidate_window.h"

using namespace pingzhu;

namespace {

int failures = 0;

void check(bool ok, const char *what) {
    std::printf("  %-58s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok) ++failures;
}

/* The height of the small font's line as the window will draw it. Measured here
 * rather than assumed, for the same reason the window measures it: the size is
 * given in points and points become pixels differently on every display. */
int smallLineHeight() {
    HDC dc = GetDC(nullptr);
    HFONT font = CreateFontW(-13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                             DEFAULT_PITCH, L"Microsoft JhengHei UI");
    HGDIOBJ old = SelectObject(dc, font);
    SIZE size = {0};
    const wchar_t *sample = L"第 0/0 頁";
    GetTextExtentPoint32W(dc, sample, static_cast<int>(wcslen(sample)), &size);
    SelectObject(dc, old);
    DeleteObject(font);
    ReleaseDC(nullptr, dc);
    return static_cast<int>(size.cy);
}

CandidateView sampleView(int pageCount) {
    CandidateView view;
    view.composing = "ㄋㄧˇ ㄏㄠˇ";
    view.sentence = "你好";
    view.candidates = {"你好", "妳好", "擬好", "泥好", "尼好", "呢好", "逆好", "溺好", "膩好", "匿好"};
    view.pageIndex = 0;
    view.pageCount = pageCount;
    view.selectionMode = true;
    view.faithful = false;
    return view;
}

}  // namespace

int main() {
    CandidateWindow window;
    if (!window.create(GetModuleHandleW(nullptr))) {
        std::printf("cannot create the candidate window\n");
        return 2;
    }
    const int line = smallLineHeight();
    std::printf("small line height: %d px\n", line);

    /* One page: the lowest line is the preview with the mode. */
    window.show(sampleView(1));
    RECT single = window.rect();
    const int singleHeight = static_cast<int>(single.bottom - single.top);
    const int previewBottom = layout::kPadY + layout::kLine1To2 + layout::kLine2To3 + line;
    std::printf("one page  : %d px tall; its lowest line ends at %d\n", singleHeight, previewBottom);
    check(singleHeight >= previewBottom, "one page is tall enough for the preview line");

    /* More than one page: the page indicator is drawn below that, so the window
     * has to grow — this is the line that used to be cut in half. */
    window.show(sampleView(4));
    RECT paged = window.rect();
    const int pagedHeight = static_cast<int>(paged.bottom - paged.top);
    const int pageBottom = layout::kPadY + layout::kLine1To2 + layout::kLine2ToPage + line;
    std::printf("four pages: %d px tall; its lowest line ends at %d\n", pagedHeight, pageBottom);
    check(pagedHeight >= pageBottom, "four pages are tall enough for the page indicator");
    check(pagedHeight > singleHeight, "a paged window is taller than a single-page one");
    check(pagedHeight <= pageBottom + 2 * layout::kPadY, "and is not padded beyond reason");

    window.hide();
    window.destroy();

    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall candidate-window checks passed\n", failures);
    return failures ? 1 : 0;
}
