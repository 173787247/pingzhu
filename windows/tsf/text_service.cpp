#include "text_service.h"

#include <functional>
#include <new>

#include "../src/config.h"
#include "../src/data_dir.h"
#include "../src/log.h"
#include "../src/router.h"
#include "class_factory.h"
#include "guids.h"

using namespace pingzhu;

namespace pingzhu::tsf {
namespace {

/* ---------------------------------------------------------------- edit session
 * TSF will not let a text service touch a document directly. Every read or write
 * happens inside an ITfEditSession, which the application grants through
 * RequestEditSession — that is the mechanism which keeps an IME from, say,
 * editing a document that is busy or read-only.
 *
 * We ask for TF_ES_SYNC deliberately: a key handler must finish updating the
 * composition before it returns, or the next keystroke races the previous one
 * and the composing text ends up interleaved.
 */
class EditSession : public ITfEditSession {
public:
    using Fn = std::function<HRESULT(TfEditCookie)>;

    explicit EditSession(Fn fn) : fn_(std::move(fn)) {}

    STDMETHOD(QueryInterface)(REFIID riid, void **ppv) override {
        if (!ppv) return E_INVALIDARG;
        *ppv = nullptr;
        if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, IID_ITfEditSession)) {
            *ppv = static_cast<ITfEditSession *>(this);
            AddRef();
            return S_OK;
        }
        return E_NOINTERFACE;
    }
    STDMETHOD_(ULONG, AddRef)() override { return InterlockedIncrement(&refCount_); }
    STDMETHOD_(ULONG, Release)() override {
        LONG remaining = InterlockedDecrement(&refCount_);
        if (remaining == 0) delete this;
        return remaining;
    }
    STDMETHOD(DoEditSession)(TfEditCookie ec) override { return fn_(ec); }

private:
    ~EditSession() = default;
    LONG refCount_ = 1;
    Fn fn_;
};

HRESULT RunEditSession(ITfContext *context, TfClientId clientId, EditSession::Fn fn,
                       DWORD flags = TF_ES_SYNC | TF_ES_READWRITE) {
    if (!context) return E_INVALIDARG;
    auto *session = new (std::nothrow) EditSession(std::move(fn));
    if (!session) return E_OUTOFMEMORY;
    HRESULT sessionResult = S_OK;
    HRESULT hr = context->RequestEditSession(clientId, session, flags, &sessionResult);
    session->Release();
    if (FAILED(hr)) return hr;
    return sessionResult;
}

/* ------------------------------------------------------------------- keys
 * Same classification the portable shell uses; kept identical on purpose so both
 * versions of the IME behave the same way to the same fingers.
 */
KeyKind classify(WPARAM vkey, char &ch) {
    ch = 0;
    if (vkey >= 'A' && vkey <= 'Z') {
        ch = static_cast<char>('a' + (vkey - 'A'));
        return KeyKind::Letter;
    }
    if (vkey >= '0' && vkey <= '9') {
        ch = static_cast<char>('0' + (vkey - '0'));
        return KeyKind::Digit;
    }
    switch (vkey) {
        case VK_OEM_MINUS: ch = '-'; return KeyKind::Symbol;
        case VK_OEM_1: ch = ';'; return KeyKind::Symbol;
        case VK_OEM_2: ch = '/'; return KeyKind::Symbol;
        case VK_OEM_COMMA: ch = ','; return KeyKind::Symbol;
        case VK_OEM_PERIOD: ch = '.'; return KeyKind::Symbol;
        case VK_OEM_PLUS: ch = '='; return KeyKind::Symbol;
        case VK_OEM_4: ch = '['; return KeyKind::Symbol;
        case VK_OEM_5: ch = '\\'; return KeyKind::Symbol;
        case VK_OEM_6: ch = ']'; return KeyKind::Symbol;
        case VK_OEM_7: ch = '\''; return KeyKind::Symbol;
        case VK_OEM_3: ch = '`'; return KeyKind::Symbol;
        case VK_SPACE: return KeyKind::Space;
        case VK_BACK: return KeyKind::Backspace;
        case VK_RETURN: return KeyKind::Enter;
        case VK_ESCAPE: return KeyKind::Escape;
        case VK_LEFT: return KeyKind::ArrowLeft;
        case VK_RIGHT: return KeyKind::ArrowRight;
        case VK_UP: return KeyKind::ArrowUp;
        case VK_DOWN: return KeyKind::ArrowDown;
        default: return KeyKind::Other;
    }
}

bool ctrlDown() { return (GetKeyState(VK_CONTROL) & 0x8000) != 0; }
bool altDown() { return (GetKeyState(VK_MENU) & 0x8000) != 0; }
bool shiftDown() { return (GetKeyState(VK_SHIFT) & 0x8000) != 0; }

std::wstring widen(const std::string &utf8) {
    if (utf8.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), out.data(), need);
    return out;
}

/* The DLL's own directory. An IME is loaded into other people's processes, so
 * the working directory means nothing here — everything is resolved from where
 * the DLL actually sits. */
/* Which application are we inside? A text service is loaded into other people's
 * processes, and "it works here but not there" is the normal shape of a TSF bug.
 * Without the host's name the log says a service activated but not where. */
std::string hostName() {
    wchar_t path[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, path, MAX_PATH);
    std::wstring name(path);
    size_t slash = name.find_last_of(L"\\/");
    if (slash != std::wstring::npos) name = name.substr(slash + 1);
    return toUtf8(name);
}

std::wstring moduleDir() {
    std::wstring path = modulePath();
    size_t slash = path.find_last_of(L"\\/");
    return slash == std::wstring::npos ? L"." : path.substr(0, slash);
}

}  // namespace

/* ================================================================= TextService */

TextService::TextService() { objectCreated(); }

TextService::~TextService() {
    if (langBar_) {
        langBar_->remove();
        langBar_->Release();
        langBar_ = nullptr;
    }
    if (candidates_.visible()) candidates_.hide();
    candidates_.destroy();
    engine_.destroy();
    objectDestroyed();
}

STDMETHODIMP TextService::QueryInterface(REFIID riid, void **ppv) {
    if (!ppv) return E_INVALIDARG;
    *ppv = nullptr;
    if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, IID_ITfTextInputProcessor) ||
        IsEqualIID(riid, IID_ITfTextInputProcessorEx)) {
        *ppv = static_cast<ITfTextInputProcessorEx *>(this);
    } else if (IsEqualIID(riid, IID_ITfThreadMgrEventSink)) {
        *ppv = static_cast<ITfThreadMgrEventSink *>(this);
    } else if (IsEqualIID(riid, IID_ITfKeyEventSink)) {
        *ppv = static_cast<ITfKeyEventSink *>(this);
    } else if (IsEqualIID(riid, IID_ITfCompositionSink)) {
        *ppv = static_cast<ITfCompositionSink *>(this);
    } else if (IsEqualIID(riid, IID_ITfDisplayAttributeProvider)) {
        *ppv = static_cast<ITfDisplayAttributeProvider *>(this);
    } else {
        return E_NOINTERFACE;
    }
    AddRef();
    return S_OK;
}

STDMETHODIMP_(ULONG) TextService::AddRef() { return InterlockedIncrement(&refCount_); }

STDMETHODIMP_(ULONG) TextService::Release() {
    LONG remaining = InterlockedDecrement(&refCount_);
    if (remaining == 0) delete this;
    return remaining;
}

/* ------------------------------------------------------------- activation */

STDMETHODIMP TextService::Activate(ITfThreadMgr *threadMgr, TfClientId clientId) {
    return ActivateEx(threadMgr, clientId, 0);
}

STDMETHODIMP TextService::ActivateEx(ITfThreadMgr *threadMgr, TfClientId clientId, DWORD) {
    if (!threadMgr) return E_INVALIDARG;
    startLog(moduleDir(), L"pingzhu-tsf.log");
    /* The DLL's own file name at the end of this line is the only reliable way
     * to tell which build is running. Windows keeps a loaded DLL for the
     * lifetime of the process and COM reuses it without re-reading the registry,
     * so an application that has been open for a while is running whatever was
     * registered when it started — and nothing on screen says so.
     *
     * (Notepad on Windows 11 is a single process with tabs, so "opening
     * Notepad" does not give a fresh one. That is exactly how a two-hour-old
     * build ended up being tested against a brand new setting.) */
    {
        std::wstring path = modulePath();
        size_t slash = path.find_last_of(L"\\/");
        log("--- activated in " + hostName() + " [" +
            toUtf8(slash == std::wstring::npos ? path : path.substr(slash + 1)) + "] ---");
    }
    threadMgr_ = threadMgr;
    threadMgr_->AddRef();
    clientId_ = clientId;

    /* Focus changes: without this the service keeps a stale context and writes
     * into the wrong document after an Alt+Tab. */
    ITfSource *source = nullptr;
    if (SUCCEEDED(threadMgr_->QueryInterface(IID_ITfSource, reinterpret_cast<void **>(&source)))) {
        source->AdviseSink(IID_ITfThreadMgrEventSink,
                           static_cast<ITfThreadMgrEventSink *>(this), &threadMgrCookie_);
        source->Release();
    }

    ITfKeystrokeMgr *keystrokeMgr = nullptr;
    if (SUCCEEDED(threadMgr_->QueryInterface(IID_ITfKeystrokeMgr,
                                             reinterpret_cast<void **>(&keystrokeMgr)))) {
        /* TRUE: we want keys before the application does. */
        keystrokeMgr->AdviseKeyEventSink(clientId_, static_cast<ITfKeyEventSink *>(this), TRUE);
        keySinkAdvised_ = true;
        keystrokeMgr->Release();
    }

    EnsureEngineLoaded();
    /* After the engine exists, and on every activation: see ApplySettings. */
    ApplySettings();

    /* The language bar button is created once per object and left in place; it
     * is the user's handle on the input method, so it must not flicker away
     * every time focus moves. */
    if (engineReady_ && !langBar_) {
        langBar_ = new (std::nothrow) LangBarButton(
            [this]() { return engine_.outputScript(); },
            [this](const std::string &script) {
                if (!engine_.setOutputScript(script.c_str())) return;
                /* Written back so the choice survives a restart and stays in
                 * step with the portable shell, which reads the same file. */
                saveOutputScript(moduleDir(), script);
                log("output script = " + engine_.outputScript() + " (from the language bar)");
            });
        if (langBar_) {
            /* Logged by outcome, not by attempt. The first version printed
             * "language bar button added" unconditionally, so the log claimed
             * success while AddItem was refusing — and a test that checked for
             * that line passed. A log line that is always true carries no
             * information and hides the failure it was written to expose. */
            if (langBar_->add()) {
                log("language bar button added");
            } else {
                log("language bar button NOT added");
            }
        }
    }
    return S_OK;
}

STDMETHODIMP TextService::Deactivate() {
    if (composition_) {
        ITfContext *context = nullptr;
        if (threadMgr_ && SUCCEEDED(FocusedContext(&context)) && context) {
            /* Commit rather than throw away: the user switched input method with
             * something half-typed, and losing it silently is worse than an
             * unexpected character. */
            EndComposition(context, widen(engine_.sentence()));
            context->Release();
        } else {
            composition_->Release();
            composition_ = nullptr;
        }
    }
    HideCandidates();
    if (langBar_) {
        langBar_->remove();
        langBar_->Release();
        langBar_ = nullptr;
    }
    if (engineReady_) {
        engine_.saveUserDictionaryFile(toUtf8(dataDir_ + L"\\pingzhu-userdict.txt"));
    }

    if (keySinkAdvised_ && threadMgr_) {
        ITfKeystrokeMgr *keystrokeMgr = nullptr;
        if (SUCCEEDED(threadMgr_->QueryInterface(IID_ITfKeystrokeMgr,
                                                 reinterpret_cast<void **>(&keystrokeMgr)))) {
            keystrokeMgr->UnadviseKeyEventSink(clientId_);
            keystrokeMgr->Release();
        }
        keySinkAdvised_ = false;
    }
    if (threadMgrCookie_ != TF_INVALID_COOKIE && threadMgr_) {
        ITfSource *source = nullptr;
        if (SUCCEEDED(threadMgr_->QueryInterface(IID_ITfSource,
                                                 reinterpret_cast<void **>(&source)))) {
            source->UnadviseSink(threadMgrCookie_);
            source->Release();
        }
        threadMgrCookie_ = TF_INVALID_COOKIE;
    }
    if (threadMgr_) {
        threadMgr_->Release();
        threadMgr_ = nullptr;
    }
    clientId_ = TF_CLIENTID_NULL;
    return S_OK;
}

/* ------------------------------------------------------- thread manager sink */

STDMETHODIMP TextService::OnInitDocumentMgr(ITfDocumentMgr *) { return S_OK; }
STDMETHODIMP TextService::OnUninitDocumentMgr(ITfDocumentMgr *) { return S_OK; }

STDMETHODIMP TextService::OnSetFocus(ITfDocumentMgr *, ITfDocumentMgr *) {
    /* Focus moved to another document: whatever was being composed belongs to
     * the old one, so drop it. TSF has already terminated the composition for
     * us in that case, which OnCompositionTerminated records. */
    composition_ = nullptr;
    HideCandidates();
    return S_OK;
}

STDMETHODIMP TextService::OnPushContext(ITfContext *) { return S_OK; }
STDMETHODIMP TextService::OnPopContext(ITfContext *) { return S_OK; }

/* ---------------------------------------------------------------- key sink */

STDMETHODIMP TextService::OnSetFocus(BOOL) { return S_OK; }

STDMETHODIMP TextService::OnTestKeyDown(ITfContext *, WPARAM vkey, LPARAM, BOOL *eaten) {
    if (!eaten) return E_INVALIDARG;
    *eaten = FALSE;
    /* Must agree with OnKeyDown exactly. Answering "yes, I want this key" here
     * and then "no" in OnKeyDown is a contract violation, and an input method
     * that cannot load its engine has no business claiming any key at all. */
    if (!engineReady_) return S_OK;

    /* Decide without side effects: TSF calls this to find out whether the key
     * would be consumed, and the answer must match what OnKeyDown will do. */
    char ch = 0;
    KeyEvent key;
    key.kind = classify(vkey, ch);
    key.ch = ch;
    key.ctrl = ctrlDown();
    key.alt = altDown();
    key.shift = shiftDown();

    EngineState state;
    state.composing = engine_.isComposing();
    state.candidateWindowOpen = engine_.candidateWindowOpen();
    state.hasCandidates = engine_.candidateCount() > 0;

    /* In TSF the 中/英 choice is the operating system's: the user picked us in
     * the language bar, so we are always "on" here. That is the whole point of
     * doing this properly instead of hooking the keyboard. */
    Decision decision = route(key, state, true);
    *eaten = (decision.action != Action::Pass) ? TRUE : FALSE;
    if (!reportedTestKey_) {
        reportedTestKey_ = true;
        /* Whether any key reaches the sink at all is the first thing to know,
         * and it is the difference between "the IME is not selected" and "the
         * IME is selected but refusing the key". The key itself is not recorded. */
        log(std::string("first test-key: eaten=") + (*eaten ? "yes" : "no"));
    }
    return S_OK;
}

STDMETHODIMP TextService::OnTestKeyUp(ITfContext *, WPARAM, LPARAM, BOOL *eaten) {
    if (!eaten) return E_INVALIDARG;
    *eaten = FALSE;
    return S_OK;
}

STDMETHODIMP TextService::OnKeyDown(ITfContext *context, WPARAM vkey, LPARAM, BOOL *eaten) {
    if (!eaten) return E_INVALIDARG;
    bool consumed = false;
    HandleKey(context, vkey, &consumed);
    *eaten = consumed ? TRUE : FALSE;
    return S_OK;
}

STDMETHODIMP TextService::OnKeyUp(ITfContext *, WPARAM, LPARAM, BOOL *eaten) {
    if (!eaten) return E_INVALIDARG;
    *eaten = FALSE;
    return S_OK;
}

STDMETHODIMP TextService::OnPreservedKey(ITfContext *, REFGUID, BOOL *eaten) {
    if (!eaten) return E_INVALIDARG;
    *eaten = FALSE;
    return S_OK;
}

/* ITfThreadMgr::GetFocus hands back a document manager, not a context — the
 * context is its top. Getting this wrong is an easy mistake and the compiler
 * catches it only because the types differ. */
HRESULT TextService::FocusedContext(ITfContext **out) {
    if (!out) return E_INVALIDARG;
    *out = nullptr;
    if (!threadMgr_) return E_FAIL;
    ITfDocumentMgr *documentMgr = nullptr;
    HRESULT hr = threadMgr_->GetFocus(&documentMgr);
    if (FAILED(hr) || !documentMgr) return FAILED(hr) ? hr : E_FAIL;
    hr = documentMgr->GetTop(out);
    documentMgr->Release();
    return hr;
}

bool TextService::HandleKey(ITfContext *context, WPARAM vkey, bool *eaten) {
    *eaten = false;
    if (!engineReady_) {
        if (!reportedNotReady_) {
            reportedNotReady_ = true;
            log("key pressed but the engine is not ready; passing it through");
        }
        return false;
    }
    if (!context) return false;

    char ch = 0;
    KeyEvent key;
    key.kind = classify(vkey, ch);
    key.ch = ch;
    key.ctrl = ctrlDown();
    key.alt = altDown();
    key.shift = shiftDown();

    EngineState state;
    state.composing = engine_.isComposing();
    state.candidateWindowOpen = engine_.candidateWindowOpen();
    state.hasCandidates = engine_.candidateCount() > 0;

    Decision decision = route(key, state, true);
    if (decision.action == Action::Pass) return false;
    *eaten = true;
    if (!sawFirstKey_) {
        /* Recorded once, without the character: enough to prove the key path is
         * alive without turning the log into a record of what was typed. */
        sawFirstKey_ = true;
        log("first key handled");
    }

    switch (decision.action) {
        case Action::Compose:
            /* Once per composition, not per keystroke: the button cannot be
             * clicked while the user is mid-word, and a stat() on every key
             * would be paying for nothing. */
            if (!engine_.isComposing()) ApplySettingsIfChanged();
            engine_.feedKey(key.ch);
            UpdateComposition(context, widen(engine_.composing()));
            ShowCandidates();
            break;

        case Action::SelectCandidate: {
            std::string out = engine_.selectCandidate(decision.arg);
            if (!out.empty()) {
                EndComposition(context, widen(out));
                HideCandidates();
            } else {
                ShowCandidates();
            }
            break;
        }

        case Action::NextPage:
        case Action::OpenCandidates:
            engine_.nextPage();
            ShowCandidates();
            break;

        case Action::CloseCandidates:
            engine_.closeCandidates();
            ShowCandidates();
            break;

        case Action::MoveCursor:
            engine_.moveCursor(decision.arg);
            ShowCandidates();
            break;

        case Action::Backspace:
            engine_.backspace();
            UpdateComposition(context, widen(engine_.composing()));
            ShowCandidates();
            break;

        case Action::Commit: {
            std::string out = engine_.commit();
            EndComposition(context, widen(out));
            HideCandidates();
            break;
        }

        case Action::Cancel:
            engine_.reset();
            AbortComposition(context);
            HideCandidates();
            break;

        case Action::ToggleScript: {
            const char *next =
                engine_.outputScript() == "simplified" ? "traditional" : "simplified";
            if (engine_.setOutputScript(next)) {
                saveOutputScript(moduleDir(), next);
                log("output script = " + engine_.outputScript() + " (Ctrl+Alt+S)");
                /* The preview inside the candidate window carries the script, so
                 * refresh it if the user is mid-composition. */
                ShowCandidates();
            }
            break;
        }

        case Action::Pass:
        default:
            *eaten = false;
            break;
    }
    return *eaten;
}

/* --------------------------------------------------------- composition sink */

STDMETHODIMP TextService::OnCompositionTerminated(TfEditCookie, ITfComposition *) {
    /* The application ended the composition — the user clicked elsewhere, the
     * document closed, the app refused the edit. Drop our reference; the edit
     * session must not try to end it again. */
    composition_ = nullptr;
    engine_.reset();
    HideCandidates();
    return S_OK;
}

/* --------------------------------------------------------------- composition */

void TextService::UpdateComposition(ITfContext *context, const std::wstring &text) {
    if (!context) return;
    if (text.empty()) {
        AbortComposition(context);
        return;
    }
    RunEditSession(context, clientId_, [this, context, text](TfEditCookie ec) -> HRESULT {
        if (!composition_) {
            ITfContextComposition *contextComposition = nullptr;
            HRESULT hr = context->QueryInterface(
                IID_ITfContextComposition, reinterpret_cast<void **>(&contextComposition));
            if (FAILED(hr)) return hr;

            /* StartComposition needs the range it will own, which is the current
             * selection: the composition replaces what the caret is sitting on. */
            TF_SELECTION selection;
            ULONG fetched = 0;
            hr = context->GetSelection(ec, TF_DEFAULT_SELECTION, 1, &selection, &fetched);
            if (FAILED(hr) || fetched != 1) {
                contextComposition->Release();
                return FAILED(hr) ? hr : E_FAIL;
            }
            hr = contextComposition->StartComposition(
                ec, selection.range, static_cast<ITfCompositionSink *>(this), &composition_);
            selection.range->Release();
            contextComposition->Release();
            if (FAILED(hr)) return hr;
            SetDisplayAttribute(ec, context);
        }
        ITfRange *range = nullptr;
        HRESULT hr = composition_->GetRange(&range);
        if (FAILED(hr)) return hr;
        hr = range->SetText(ec, 0, text.c_str(), static_cast<LONG>(text.size()));
        range->Release();
        return hr;
    });
}

/*
 * Mark the composition range with our display attribute, so the application draws
 * the bopomofo as composing text (our dotted underline) rather than as ordinary
 * committed text. Without this, Enter comes as a surprise: the characters look
 * like they are already in the document.
 *
 * The value travels as a VT_UNKNOWN VARIANT holding an ITfDisplayAttributeInfo,
 * which is why the object has to outlive the call.
 *
 * Failures are ignored on purpose: a missing underline is a cosmetic problem,
 * while refusing the keystroke over it would make the IME unusable.
 */
void TextService::SetDisplayAttribute(TfEditCookie ec, ITfContext *context) {
    if (!composition_ || !displayAttribute_ || !context) return;
    ITfProperty *property = nullptr;
    if (FAILED(context->GetProperty(GUID_PROP_ATTRIBUTE, &property)) || !property) return;
    ITfRange *range = nullptr;
    if (SUCCEEDED(composition_->GetRange(&range))) {
        VARIANT value;
        VariantInit(&value);
        value.vt = VT_UNKNOWN;
        value.punkVal = static_cast<IUnknown *>(displayAttribute_);
        displayAttribute_->AddRef();
        property->SetValue(ec, range, &value);
        VariantClear(&value);
        range->Release();
    }
    property->Release();
}

void TextService::EndComposition(ITfContext *context, const std::wstring &finalText) {
    if (!context || !composition_) return;
    ITfComposition *composition = composition_;
    composition->AddRef();
    composition_ = nullptr;  /* OnCompositionTerminated will fire; do not re-enter */

    RunEditSession(context, clientId_, [composition, finalText](TfEditCookie ec) -> HRESULT {
        ITfRange *range = nullptr;
        HRESULT hr = composition->GetRange(&range);
        if (FAILED(hr)) {
            composition->EndComposition(ec);
            return hr;
        }
        /* End first, then write: after EndComposition the range is ordinary
         * document text, which is exactly what the committed characters should
         * be. Writing before ending would leave them inside a composition. */
        composition->EndComposition(ec);
        hr = range->SetText(ec, 0, finalText.c_str(), static_cast<LONG>(finalText.size()));
        range->Release();
        return hr;
    });
    composition->Release();
}

void TextService::AbortComposition(ITfContext *context) {
    if (!context || !composition_) return;
    ITfComposition *composition = composition_;
    composition->AddRef();
    composition_ = nullptr;
    RunEditSession(context, clientId_, [composition](TfEditCookie ec) -> HRESULT {
        ITfRange *range = nullptr;
        HRESULT hr = composition->GetRange(&range);
        if (SUCCEEDED(hr)) {
            composition->EndComposition(ec);
            hr = range->SetText(ec, 0, L"", 0);  /* remove the composing text */
            range->Release();
        } else {
            composition->EndComposition(ec);
        }
        return hr;
    });
    composition->Release();
}

/* ------------------------------------------------------- candidate window */

bool TextService::CaretRect(ITfContext *context, RECT *out) {
    if (!context || !out) return false;
    bool found = false;
    RunEditSession(
        context, clientId_,
        [context, out, &found](TfEditCookie ec) -> HRESULT {
            ITfContextView *view = nullptr;
            if (FAILED(context->GetActiveView(&view)) || !view) return S_OK;
            ITfRange *range = nullptr;
            TF_SELECTION selection;
            ULONG fetched = 0;
            if (SUCCEEDED(context->GetSelection(ec, TF_DEFAULT_SELECTION, 1, &selection,
                                                &fetched)) &&
                fetched == 1) {
                range = selection.range;
                BOOL clipped = FALSE;
                if (view->GetTextExt(ec, range, out, &clipped) == S_OK) found = true;
                if (range) range->Release();
            }
            view->Release();
            return S_OK;
        },
        TF_ES_SYNC | TF_ES_READ);
    return found;
}

void TextService::ShowCandidates() {
    if (!engine_.isComposing()) {
        HideCandidates();
        return;
    }
    /* Ask the application where its caret is rather than guessing from the
     * foreground window: inside a browser the caret belongs to a child window
     * the foreground thread does not describe. */
    ITfContext *context = nullptr;
    if (SUCCEEDED(FocusedContext(&context)) && context) {
        RECT caret = {0, 0, 0, 0};
        if (CaretRect(context, &caret)) {
            pendingAnchor_.x = caret.left;
            pendingAnchor_.y = caret.bottom;
            hasPendingAnchor_ = true;
        }
        context->Release();
    }
    CandidateView view;
    view.composing = engine_.composing();
    view.sentence = engine_.sentence();
    view.selectionMode = engine_.candidateWindowOpen();
    view.faithful = engine_.outputIsFaithful();
    view.simplified = engine_.outputScript() == "simplified";
    view.pageIndex = engine_.pageIndex();
    view.pageCount = engine_.pageCount();
    const int count = engine_.candidateCount();
    for (int i = 0; i < count; ++i) view.candidates.push_back(engine_.candidateAt(i));
    if (hasPendingAnchor_) {
        view.hasAnchor = true;
        view.anchor = pendingAnchor_;
    }
    candidates_.show(view);
}

void TextService::HideCandidates() { candidates_.hide(); }

/* ------------------------------------------------------------ engine load */

/*
 * Settings are re-read on every activation, not once when the engine loads.
 *
 * A text service has no window and no tray icon, so `pingzhu.ini` is the only
 * place for a switch. Reading it once and caching the result means the user
 * edits the file, switches input methods, and sees no change — with nothing
 * anywhere to explain why. TSF does not promise a fresh object per activation,
 * so the read has to happen where the activation does.
 */
void TextService::ApplySettings() {
    if (!engineReady_) return;
    const std::wstring moduleDirectory = moduleDir();
    writeDefaultConfigIfMissing(moduleDirectory);
    const Config config = loadConfig(moduleDirectory);
    if (config.output == engine_.outputScript()) return;

    if (engine_.setOutputScript(config.output.c_str())) {
        log("output script = " + engine_.outputScript());
    } else {
        log("output script not accepted: " + config.output);
    }
    /* Record the stamp here too, so the per-composition check below does not
     * redo this work on the very next keystroke. */
    WIN32_FILE_ATTRIBUTE_DATA attributes;
    if (GetFileAttributesExW((moduleDirectory + L"\\pingzhu.ini").c_str(),
                             GetFileExInfoStandard, &attributes)) {
        ULARGE_INTEGER stamp;
        stamp.LowPart = attributes.ftLastWriteTime.dwLowDateTime;
        stamp.HighPart = attributes.ftLastWriteTime.dwHighDateTime;
        settingsStamp_ = stamp.QuadPart;
    }
}

void TextService::ApplySettingsIfChanged() {
    if (!engineReady_) return;
    WIN32_FILE_ATTRIBUTE_DATA attributes;
    const std::wstring path = moduleDir() + L"\\pingzhu.ini";
    if (!GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &attributes)) return;
    ULARGE_INTEGER stamp;
    stamp.LowPart = attributes.ftLastWriteTime.dwLowDateTime;
    stamp.HighPart = attributes.ftLastWriteTime.dwHighDateTime;
    if (stamp.QuadPart == settingsStamp_) return;

    const std::string before = engine_.outputScript();
    ApplySettings();
    if (engine_.outputScript() != before) {
        log("output script = " + engine_.outputScript() + " (settings file changed)");
    }
    settingsStamp_ = stamp.QuadPart;
}

void TextService::EnsureEngineLoaded() {
    if (engineTried_) return;
    engineTried_ = true;

    /* Resolve the data directory by looking for the file, not by assuming a
     * layout. Assuming is how this shipped broken: the engine wants
     * <dir>\bopomofo-lm.tsv, this passed the DLL's directory while the model sat
     * in <dir>\data, and every key then passed silently through to the
     * application with nothing anywhere to say why. */
    dataDir_ = resolveDataDir(moduleDir());
    log("activate: dll dir = " + toUtf8(moduleDir()));
    log("activate: data dir = " + toUtf8(dataDir_));
    {
        std::wstring model = dataDir_ + L"\\bopomofo-lm.tsv";
        bool present = GetFileAttributesW(model.c_str()) != INVALID_FILE_ATTRIBUTES;
        log(std::string("activate: bopomofo-lm.tsv ") + (present ? "found" : "MISSING") + " at " +
            toUtf8(model));
    }

    /* A missing candidate window is worth reporting but not worth refusing to
     * type over: the engine is the part that matters. */
    if (!candidates_.create(moduleHandle())) {
        log("candidate window creation failed; typing will work without it");
    }
    displayAttribute_ = new (std::nothrow) DisplayAttributeInfo();

    std::wstring coreDll = moduleDir() + L"\\pingzhu_core.dll";
    if (!engine_.load(coreDll, toUtf8(dataDir_), "standard", nullptr)) {
        log("ENGINE LOAD FAILED: " + engine_.lastError());
        return;
    }
    engine_.loadUserDictionaryFile(toUtf8(dataDir_ + L"\\pingzhu-userdict.txt"));

    engineReady_ = true;
    log("engine ready");
}

/* -------------------------------------------------- display attribute provider */

STDMETHODIMP TextService::EnumDisplayAttributeInfo(IEnumTfDisplayAttributeInfo **enumInfo) {
    if (!enumInfo) return E_INVALIDARG;
    *enumInfo = nullptr;
    return E_NOTIMPL;  /* one attribute; GetDisplayAttributeInfo is enough */
}

STDMETHODIMP TextService::GetDisplayAttributeInfo(REFGUID guid,
                                                  ITfDisplayAttributeInfo **info) {
    if (!info) return E_INVALIDARG;
    *info = nullptr;
    if (!IsEqualGUID(guid, GUID_PingZhuDisplayAttribute)) return E_INVALIDARG;
    auto *attribute = new (std::nothrow) DisplayAttributeInfo();
    if (!attribute) return E_OUTOFMEMORY;
    *info = attribute;
    return S_OK;
}

/* ---------------------------------------------------------- display attribute */

DisplayAttributeInfo::DisplayAttributeInfo() = default;
DisplayAttributeInfo::~DisplayAttributeInfo() = default;

STDMETHODIMP DisplayAttributeInfo::QueryInterface(REFIID riid, void **ppv) {
    if (!ppv) return E_INVALIDARG;
    *ppv = nullptr;
    if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, IID_ITfDisplayAttributeInfo)) {
        *ppv = static_cast<ITfDisplayAttributeInfo *>(this);
        AddRef();
        return S_OK;
    }
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) DisplayAttributeInfo::AddRef() { return InterlockedIncrement(&refCount_); }

STDMETHODIMP_(ULONG) DisplayAttributeInfo::Release() {
    LONG remaining = InterlockedDecrement(&refCount_);
    if (remaining == 0) delete this;
    return remaining;
}

STDMETHODIMP DisplayAttributeInfo::GetGUID(GUID *guid) {
    if (!guid) return E_INVALIDARG;
    *guid = GUID_PingZhuDisplayAttribute;
    return S_OK;
}

STDMETHODIMP DisplayAttributeInfo::GetDescription(BSTR *description) {
    if (!description) return E_INVALIDARG;
    *description = SysAllocString(L"平注組字中");
    return *description ? S_OK : E_OUTOFMEMORY;
}

namespace {
/* TF_DA_COLOR is a tagged union, not a COLORREF: setting only the colour leaves
 * `type` at zero (TF_DA_COLOR_NORMAL) and the line is drawn in the default
 * colour regardless of what was asked for. */
void setColor(TF_DA_COLOR &color, COLORREF rgb) {
    color.type = TF_CT_COLORREF;
    color.cr = rgb;
}
}  // namespace

STDMETHODIMP DisplayAttributeInfo::GetAttributeInfo(TF_DISPLAYATTRIBUTE *attribute) {
    if (!attribute) return E_INVALIDARG;
    /* Dotted underline in the accent colour, text left alone. */
    attribute->crText.type = TF_CT_NONE;
    attribute->crBk.type = TF_CT_NONE;
    attribute->lsStyle = TF_LS_DOT;
    attribute->fBoldLine = FALSE;
    setColor(attribute->crLine, RGB(0x6E, 0xA8, 0xFE));
    attribute->bAttr = TF_ATTR_INPUT;
    return S_OK;
}

STDMETHODIMP DisplayAttributeInfo::SetAttributeInfo(const TF_DISPLAYATTRIBUTE *) {
    return E_NOTIMPL;  /* read-only attribute */
}

STDMETHODIMP DisplayAttributeInfo::Reset() { return S_OK; }

}  // namespace pingzhu::tsf
