#pragma once

#include <windows.h>

#include <string>
#include <vector>

/* 联想窗 —— 送出一个词之后，在光标下面提示「接下来大概会写什么」。
 *
 * 为什么它是一个独立的窗口，而不是候选窗里多画一行：候选窗是「组字时的临时窗口」，
 * `ShowCandidates` 的第一句就是「不在组字就隐藏」。而联想正好发生在送出之后、组字结束
 * 之时 —— 两者时间上不重叠，塞进同一个窗口就永远看不见。
 *
 * 它比候选窗简单得多：
 *   - 只显示一行字
 *   - 不接收鼠标、不接收键盘（WS_EX_NOACTIVATE + WM_MOUSEACTIVATE 返回 MA_NOACTIVATE）
 *   - 没有锚点或没有内容就不显示
 *
 * 生命周期：TextService 在送出词之后 show()，下一次按键或焦点变化时 hide()。它不做任何
 * 判断，判断在调用方 —— 这一层只负责把一行字画在正确的位置上。
 */
class AssociationWindow {
public:
    bool create(HINSTANCE instance);
    void destroy();

    /* 显示这些词。空列表等于 hide() —— 「没有联想」和「联想窗不该出现」是同一种状态。 */
    void show(const std::vector<std::string> &words, POINT anchor);

    void hide();
    bool visible() const { return visible_; }

    /* Screen rectangle, for tests and for positioning. */
    RECT rect() const { return rect_; }

private:
    static LRESULT CALLBACK windowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    LRESULT handleMessage(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    void paint(HDC dc);
    void reposition();

    HWND hwnd_ = nullptr;
    std::vector<std::string> words_;
    POINT anchor_ = {0, 0};
    RECT rect_ = {0, 0, 0, 0};
    bool visible_ = false;
    HFONT font_ = nullptr;
};
