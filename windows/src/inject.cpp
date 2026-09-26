#include "inject.h"

#include <windows.h>

#include <vector>

namespace pingzhu {

namespace {

std::vector<wchar_t> widen(const std::string &utf8) {
    if (utf8.empty()) return {};
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::vector<wchar_t> out(static_cast<size_t>(need));
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

}  // namespace

int injectUtf8(const std::string &utf8) {
    std::vector<wchar_t> units = widen(utf8);
    if (units.empty()) return 0;

    std::vector<INPUT> inputs;
    inputs.reserve(units.size() * 2);
    for (wchar_t unit : units) {
        INPUT down = {0};
        down.type = INPUT_KEYBOARD;
        down.ki.wVk = 0;
        down.ki.wScan = unit;
        down.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs.push_back(down);

        INPUT up = down;
        up.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        inputs.push_back(up);
    }

    /* Send in chunks: SendInput takes a UINT count and some applications cannot
     * keep up with a very large burst in one call. */
    constexpr size_t kChunk = 64;
    int sent = 0;
    for (size_t i = 0; i < inputs.size(); i += kChunk) {
        size_t n = (inputs.size() - i < kChunk) ? (inputs.size() - i) : kChunk;
        if (SendInput(static_cast<UINT>(n), inputs.data() + i, sizeof(INPUT)) == n) {
            sent += static_cast<int>(n / 2);
        }
    }
    return sent;
}

void injectEnter() {
    INPUT inputs[2] = {0};
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = VK_RETURN;
    inputs[1] = inputs[0];
    inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;
    SendInput(2, inputs, sizeof(INPUT));
}

}  // namespace pingzhu
