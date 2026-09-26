/*
 * The language bar button.
 *
 * Without this the input method is registered and selectable but has no visible
 * presence of its own in the language bar — no icon, no state, no menu. Every
 * real IME has one, and it is also the natural home for the 繁/簡 switch, which
 * otherwise means editing a file.
 *
 * `TF_CreateLangBarItemMgr` is a free function exported by msctf.dll, and this
 * SDK ships no msctf.lib. Rather than link against a library that does not
 * exist, the manager is obtained through COM (CLSID_TF_LangBarItemMgr), which
 * is the same object by a different door.
 */
#ifndef PINGZHU_TSF_LANG_BAR_H
#define PINGZHU_TSF_LANG_BAR_H

#include <windows.h>
#include <ctfutb.h>

#include <functional>
#include <string>

namespace pingzhu::tsf {

/* Menu command ids. */
constexpr UINT kMenuTraditional = 1;
constexpr UINT kMenuSimplified = 2;

class LangBarButton : public ITfLangBarItemButton {
public:
    /* The button reports and changes the output script through these, so it
     * does not need to know what a TextService is. */
    using GetScript = std::function<std::string()>;
    using SetScript = std::function<void(const std::string &)>;

    LangBarButton(GetScript getScript, SetScript setScript);
    ~LangBarButton();

    /* IUnknown */
    STDMETHOD(QueryInterface)(REFIID riid, void **ppv) override;
    STDMETHOD_(ULONG, AddRef)() override;
    STDMETHOD_(ULONG, Release)() override;

    /* ITfLangBarItem */
    STDMETHOD(GetInfo)(TF_LANGBARITEMINFO *info) override;
    STDMETHOD(GetStatus)(DWORD *status) override;
    STDMETHOD(Show)(BOOL show) override;
    STDMETHOD(GetTooltipString)(BSTR *tooltip) override;

    /* ITfLangBarItemButton */
    STDMETHOD(OnClick)(TfLBIClick click, POINT pt, const RECT *area) override;
    STDMETHOD(InitMenu)(ITfMenu *menu) override;
    STDMETHOD(OnMenuSelect)(UINT id) override;
    STDMETHOD(GetIcon)(HICON *icon) override;
    STDMETHOD(GetText)(BSTR *text) override;

    /* Add to and remove from the calling thread's language bar. */
    bool add();
    void remove();

private:
    LONG refCount_ = 1;
    GetScript getScript_;
    SetScript setScript_;
    bool added_ = false;
    /* Built once and reused: the language bar asks for the icon on every repaint
     * and leaking one per call is the classic way an IME grows without bound. */
    HICON icon_ = nullptr;

    HICON buildIcon() const;
    std::wstring label() const;
};

}  // namespace pingzhu::tsf

#endif  // PINGZHU_TSF_LANG_BAR_H
