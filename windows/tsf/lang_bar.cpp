#include "lang_bar.h"

#include <msctf.h>
#include <new>

#include "../src/config.h"
#include "../src/log.h"
#include "guids.h"

namespace pingzhu::tsf {
namespace {

std::wstring widen(const std::string &utf8) {
    if (utf8.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

/* A small icon drawn at run time rather than shipped as a resource: it keeps the
 * build to source files and the icon follows the accent colour instead of being
 * a binary blob nobody can edit. 16x16 is what the language bar asks for. */
constexpr int kIconSize = 16;

}  // namespace

LangBarButton::LangBarButton(GetScript getScript, SetScript setScript)
    : getScript_(std::move(getScript)), setScript_(std::move(setScript)) {
    icon_ = buildIcon();
}

LangBarButton::~LangBarButton() {
    if (icon_) DestroyIcon(icon_);
}

STDMETHODIMP LangBarButton::QueryInterface(REFIID riid, void **ppv) {
    if (!ppv) return E_INVALIDARG;
    *ppv = nullptr;
    if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, IID_ITfLangBarItem)) {
        *ppv = static_cast<ITfLangBarItem *>(this);
    } else if (IsEqualIID(riid, IID_ITfLangBarItemButton)) {
        *ppv = static_cast<ITfLangBarItemButton *>(this);
    } else {
        return E_NOINTERFACE;
    }
    AddRef();
    return S_OK;
}

STDMETHODIMP_(ULONG) LangBarButton::AddRef() { return InterlockedIncrement(&refCount_); }

STDMETHODIMP_(ULONG) LangBarButton::Release() {
    LONG remaining = InterlockedDecrement(&refCount_);
    if (remaining == 0) delete this;
    return remaining;
}

STDMETHODIMP LangBarButton::GetInfo(TF_LANGBARITEMINFO *info) {
    if (!info) return E_INVALIDARG;
    info->clsidService = CLSID_PingZhuTextService;
    info->guidItem = GUID_PingZhuLangBarItem;
    /* A menu button that lives in the language bar. TF_LBI_STYLE_BTN_MENU is what
     * makes InitMenu/OnMenuSelect get called at all. */
    info->dwStyle = TF_LBI_STYLE_BTN_MENU | TF_LBI_STYLE_SHOWNINTRAY;
    info->ulSort = 0;
    wcsncpy_s(info->szDescription, PINGZHU_DESCRIPTION, _TRUNCATE);
    return S_OK;
}

STDMETHODIMP LangBarButton::GetStatus(DWORD *status) {
    if (!status) return E_INVALIDARG;
    /* No TF_LBI_STATUS_BTN_TOGGLED: this is a menu button, not a toggle. The
     * current script is shown in the button's text instead, so the state is
     * readable without hovering. */
    *status = 0;
    return S_OK;
}

STDMETHODIMP LangBarButton::Show(BOOL) { return S_OK; }

STDMETHODIMP LangBarButton::GetTooltipString(BSTR *tooltip) {
    if (!tooltip) return E_INVALIDARG;
    const std::wstring text =
        std::wstring(PINGZHU_DESCRIPTION) + L" — 目前輸出：" +
        (getScript_() == "simplified" ? L"簡體" : L"繁體") + L"（右鍵切換）";
    *tooltip = SysAllocString(text.c_str());
    return *tooltip ? S_OK : E_OUTOFMEMORY;
}

STDMETHODIMP LangBarButton::OnClick(TfLBIClick click, POINT, const RECT *) {
    /* Left click switches the script; right click opens the menu, which the
     * language bar handles by calling InitMenu/OnMenuSelect itself. */
    if (click == TF_LBI_CLK_LEFT) {
        const char *next = getScript_() == "simplified" ? "traditional" : "simplified";
        setScript_(next);
        return S_OK;
    }
    return S_OK;
}

STDMETHODIMP LangBarButton::InitMenu(ITfMenu *menu) {
    if (!menu) return E_INVALIDARG;
    const bool simplified = getScript_() == "simplified";
    const DWORD radio = TF_LBMENUF_RADIOCHECKED;

    struct Item {
        UINT id;
        const wchar_t *label;
        bool checked;
    };
    const Item items[] = {
        {kMenuTraditional, L"繁體輸出", !simplified},
        {kMenuSimplified, L"簡體輸出", simplified},
    };
    for (const Item &item : items) {
        const DWORD flags = item.checked ? radio : 0;
        menu->AddMenuItem(item.id, flags, nullptr, nullptr, item.label,
                          static_cast<ULONG>(wcslen(item.label)), nullptr);
    }
    return S_OK;
}

STDMETHODIMP LangBarButton::OnMenuSelect(UINT id) {
    switch (id) {
        case kMenuTraditional: setScript_("traditional"); return S_OK;
        case kMenuSimplified: setScript_("simplified"); return S_OK;
        default: return S_OK;
    }
}

STDMETHODIMP LangBarButton::GetIcon(HICON *icon) {
    if (!icon) return E_INVALIDARG;
    /* Returning a copy rather than the member: the language bar owns what it is
     * given, and handing it the same handle twice would double-destroy it. */
    *icon = icon_ ? CopyIcon(icon_) : nullptr;
    return S_OK;
}

STDMETHODIMP LangBarButton::GetText(BSTR *text) {
    if (!text) return E_INVALIDARG;
    *text = SysAllocString(label().c_str());
    return *text ? S_OK : E_OUTOFMEMORY;
}

std::wstring LangBarButton::label() const {
    /* The script is in the label because a language bar button with an icon and
     * no text makes the user hover to find out which mode they are in. */
    return std::wstring(L"平注 ") + (getScript_() == "simplified" ? L"简" : L"繁");
}

HICON LangBarButton::buildIcon() const {
    HDC screen = GetDC(nullptr);
    if (!screen) return nullptr;
    HDC dc = CreateCompatibleDC(screen);
    HBITMAP colour = CreateCompatibleBitmap(screen, kIconSize, kIconSize);
    ReleaseDC(nullptr, screen);
    if (!dc || !colour) {
        if (dc) DeleteDC(dc);
        if (colour) DeleteObject(colour);
        return nullptr;
    }

    HGDIOBJ oldBitmap = SelectObject(dc, colour);
    RECT full = {0, 0, kIconSize, kIconSize};
    HBRUSH background = CreateSolidBrush(RGB(0x2B, 0x39, 0x6B));
    FillRect(dc, &full, background);
    DeleteObject(background);

    /* Two bars of different lengths: a plain mark that reads as "text lines" at
     * 16 pixels, where any glyph would turn to mud. */
    HBRUSH ink = CreateSolidBrush(RGB(0xF2, 0xF5, 0xFF));
    RECT line1 = {3, 4, 13, 7};
    RECT line2 = {3, 9, 10, 12};
    FillRect(dc, &line1, ink);
    FillRect(dc, &line2, ink);
    DeleteObject(ink);
    SelectObject(dc, oldBitmap);

    HBITMAP mask = CreateBitmap(kIconSize, kIconSize, 1, 1, nullptr);
    ICONINFO info = {0};
    info.fIcon = TRUE;
    info.hbmColor = colour;
    info.hbmMask = mask;
    HICON icon = CreateIconIndirect(&info);
    DeleteObject(colour);
    DeleteObject(mask);
    DeleteDC(dc);
    return icon;
}

bool LangBarButton::add() {
    ITfLangBarItemMgr *manager = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_TF_LangBarItemMgr, nullptr, CLSCTX_INPROC_SERVER,
                                  IID_ITfLangBarItemMgr,
                                  reinterpret_cast<void **>(&manager));
    if (FAILED(hr) || !manager) {
        log("language bar item manager unavailable");
        return false;
    }
    hr = manager->AddItem(static_cast<ITfLangBarItemButton *>(this));
    manager->Release();
    if (FAILED(hr)) {
        log("AddItem refused by the language bar");
        return false;
    }
    added_ = true;
    return true;
}

void LangBarButton::remove() {
    if (!added_) return;
    added_ = false;
    ITfLangBarItemMgr *manager = nullptr;
    if (SUCCEEDED(CoCreateInstance(CLSID_TF_LangBarItemMgr, nullptr, CLSCTX_INPROC_SERVER,
                                   IID_ITfLangBarItemMgr,
                                   reinterpret_cast<void **>(&manager))) &&
        manager) {
        manager->RemoveItem(static_cast<ITfLangBarItem *>(this));
        manager->Release();
    }
}

}  // namespace pingzhu::tsf
