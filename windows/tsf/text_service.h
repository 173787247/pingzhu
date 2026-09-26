/*
 * The text service itself.
 *
 * This is the object Windows creates when the user picks 平注 in the language
 * bar. It implements five interfaces, each answering one question:
 *
 *   ITfTextInputProcessorEx   when am I active, and on which thread?
 *   ITfThreadMgrEventSink     which document has focus?
 *   ITfKeyEventSink           do I want this keystroke, and what does it mean?
 *   ITfCompositionSink        did the application cancel my composition?
 *   ITfDisplayAttributeProvider  how should the composing text be drawn?
 *
 * Note the two OnSetFocus methods. ITfThreadMgrEventSink::OnSetFocus takes two
 * document managers (focus changed), ITfKeyEventSink::OnSetFocus takes a BOOL
 * (the thread came to the foreground). They are overloads here, and the compiler
 * picks the right one per vtable.
 */
#ifndef PINGZHU_TSF_TEXT_SERVICE_H
#define PINGZHU_TSF_TEXT_SERVICE_H

#include <windows.h>
#include <msctf.h>

#include <string>

#include "../src/candidate_window.h"
#include "../src/engine_api.h"

namespace pingzhu::tsf {

class TextService : public ITfTextInputProcessorEx,
                    public ITfThreadMgrEventSink,
                    public ITfKeyEventSink,
                    public ITfCompositionSink,
                    public ITfDisplayAttributeProvider {
public:
    TextService();

    /* IUnknown */
    STDMETHOD(QueryInterface)(REFIID riid, void **ppv) override;
    STDMETHOD_(ULONG, AddRef)() override;
    STDMETHOD_(ULONG, Release)() override;

    /* ITfTextInputProcessor / ITfTextInputProcessorEx */
    STDMETHOD(Activate)(ITfThreadMgr *threadMgr, TfClientId clientId) override;
    STDMETHOD(Deactivate)() override;
    STDMETHOD(ActivateEx)(ITfThreadMgr *threadMgr, TfClientId clientId, DWORD flags) override;

    /* ITfThreadMgrEventSink */
    STDMETHOD(OnInitDocumentMgr)(ITfDocumentMgr *docMgr) override;
    STDMETHOD(OnUninitDocumentMgr)(ITfDocumentMgr *docMgr) override;
    STDMETHOD(OnSetFocus)(ITfDocumentMgr *focus, ITfDocumentMgr *previous) override;
    STDMETHOD(OnPushContext)(ITfContext *context) override;
    STDMETHOD(OnPopContext)(ITfContext *context) override;

    /* ITfKeyEventSink */
    STDMETHOD(OnSetFocus)(BOOL foreground) override;
    STDMETHOD(OnTestKeyDown)(ITfContext *context, WPARAM wParam, LPARAM lParam,
                             BOOL *eaten) override;
    STDMETHOD(OnTestKeyUp)(ITfContext *context, WPARAM wParam, LPARAM lParam,
                           BOOL *eaten) override;
    STDMETHOD(OnKeyDown)(ITfContext *context, WPARAM wParam, LPARAM lParam,
                         BOOL *eaten) override;
    STDMETHOD(OnKeyUp)(ITfContext *context, WPARAM wParam, LPARAM lParam, BOOL *eaten) override;
    STDMETHOD(OnPreservedKey)(ITfContext *context, REFGUID guid, BOOL *eaten) override;

    /* ITfCompositionSink */
    STDMETHOD(OnCompositionTerminated)(TfEditCookie ecWrite,
                                       ITfComposition *composition) override;

    /* ITfDisplayAttributeProvider */
    STDMETHOD(EnumDisplayAttributeInfo)(IEnumTfDisplayAttributeInfo **enumInfo) override;
    STDMETHOD(GetDisplayAttributeInfo)(REFGUID guid, ITfDisplayAttributeInfo **info) override;

private:
    ~TextService();

    /* Key handling. Returns true when the key was consumed. */
    bool HandleKey(ITfContext *context, WPARAM vkey, bool *eaten);

    /* Replace the composition's text with `text`, or end the composition when it
     * is empty. Runs inside an edit session. */
    void UpdateComposition(ITfContext *context, const std::wstring &text);
    void EndComposition(ITfContext *context, const std::wstring &finalText);
    void AbortComposition(ITfContext *context);

    /* Screen position of the caret, for the candidate window. */
    bool CaretRect(ITfContext *context, RECT *out);

    HRESULT FocusedContext(ITfContext **out);
    void SetDisplayAttribute(TfEditCookie ec, ITfContext *context);
    void EnsureEngineLoaded();
    void ShowCandidates();
    void HideCandidates();

    LONG refCount_ = 1;
    ITfThreadMgr *threadMgr_ = nullptr;
    TfClientId clientId_ = TF_CLIENTID_NULL;
    DWORD threadMgrCookie_ = TF_INVALID_COOKIE;
    ITfComposition *composition_ = nullptr;
    bool keySinkAdvised_ = false;

    Engine engine_;
    CandidateWindow candidates_;
    /* Held for as long as a composition carries this display attribute: the
     * property stores a pointer to it. */
    class DisplayAttributeInfo *displayAttribute_ = nullptr;
    POINT pendingAnchor_ = {0, 0};
    bool hasPendingAnchor_ = false;
    bool engineTried_ = false;
    bool engineReady_ = false;
    bool sawFirstKey_ = false;
    bool reportedTestKey_ = false;
    bool reportedNotReady_ = false;
    std::wstring dataDir_;
};

/* One display attribute: a dotted underline under the bopomofo being composed. */
class DisplayAttributeInfo : public ITfDisplayAttributeInfo {
public:
    DisplayAttributeInfo();

    STDMETHOD(QueryInterface)(REFIID riid, void **ppv) override;
    STDMETHOD_(ULONG, AddRef)() override;
    STDMETHOD_(ULONG, Release)() override;

    STDMETHOD(GetGUID)(GUID *guid) override;
    STDMETHOD(GetDescription)(BSTR *description) override;
    /* Named GetAttributeInfo, not GetAttribute: the interface uses the *Info
     * suffix, and a wrong name here silently fails to override and makes the
     * class abstract. */
    STDMETHOD(GetAttributeInfo)(TF_DISPLAYATTRIBUTE *attribute) override;
    STDMETHOD(SetAttributeInfo)(const TF_DISPLAYATTRIBUTE *attribute) override;
    STDMETHOD(Reset)() override;

private:
    ~DisplayAttributeInfo();
    LONG refCount_ = 1;
};

}  // namespace pingzhu::tsf

#endif  // PINGZHU_TSF_TEXT_SERVICE_H
