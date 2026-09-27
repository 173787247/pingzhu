#include "pingzhuengine.h"

#include <fcitx/candidatelist.h>
#include <fcitx/inputpanel.h>
#include <fcitx/text.h>
#include <fcitx-utils/log.h>
#include <fcitx-utils/utf8.h>

#include "pingzhu.h"

#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace pingzhu {

namespace {

/// Where the language model lives.
///
/// fcitx5 addons have no bundle to unpack, so the data is installed alongside
/// the addon and found through the standard data directories. PINGZHU_DATA_DIR
/// overrides it, which is what the tests use.
std::string dataDir() {
    if (const char *override = std::getenv("PINGZHU_DATA_DIR")) {
        return override;
    }
    // Installed by CMake to <prefix>/share/pingzhu. The compile-time default is
    // a fallback for running from a build tree; fcitx5's own path lookup would
    // be better but this addon has exactly one data directory.
    return PINGZHU_DATA_DIR_DEFAULT;
}

} // namespace

Engine::Engine() {
    const std::string dir = dataDir();
    handle_ = engine_create(dir.c_str(), "standard", "frequency");
    if (handle_ == nullptr) {
        // Loud, not silent. An input method with no dictionary types nothing,
        // and looks exactly like one that is working until someone tries.
        FCITX_ERROR() << "PingZhu: could not read the language model at " << dir;
    } else {
        FCITX_INFO() << "PingZhu: engine ready, ABI " << engine_abi_version()
                     << ", data " << dir;
    }
}

Engine::~Engine() {
    if (handle_ != nullptr) {
        engine_destroy(handle_);
        handle_ = nullptr;
    }
}

bool Engine::feedKey(char key) {
    if (handle_ == nullptr) return false;
    const char text[2] = {key, '\0'};
    return engine_feed_key(handle_, text);
}

void Engine::reset() {
    if (handle_ != nullptr) engine_reset(handle_);
}

void Engine::backspace() {
    if (handle_ != nullptr) engine_backspace(handle_);
}

std::string Engine::composing() const {
    if (handle_ == nullptr) return {};
    const char *text = engine_composing(handle_);
    return text == nullptr ? std::string() : std::string(text);
}

std::string Engine::sentence() const {
    if (handle_ == nullptr) return {};
    const char *text = engine_best_sentence(handle_);
    return text == nullptr ? std::string() : std::string(text);
}

bool Engine::outputIsFaithful() const {
    return handle_ != nullptr && engine_output_is_faithful(handle_);
}

int Engine::syllableCount() const {
    return handle_ == nullptr ? 0 : static_cast<int>(engine_syllable_count(handle_));
}

std::vector<std::string> Engine::candidates() const {
    std::vector<std::string> result;
    if (handle_ == nullptr) return result;
    const size_t count = engine_candidate_count(handle_);
    result.reserve(count);
    for (size_t i = 0; i < count; ++i) {
        const char *text = engine_candidate_at(handle_, i);
        result.emplace_back(text == nullptr ? "" : text);
    }
    return result;
}

bool Engine::candidateWindowOpen() const {
    return handle_ != nullptr && engine_candidate_window_open(handle_);
}

void Engine::openCandidateWindow() {
    if (handle_ != nullptr) engine_open_candidate_window(handle_);
}

void Engine::closeCandidateWindow() {
    if (handle_ != nullptr) engine_close_candidate_window(handle_);
}

bool Engine::nextPage() {
    return handle_ != nullptr && engine_next_candidate_page(handle_);
}

bool Engine::previousPage() {
    return handle_ != nullptr && engine_prev_candidate_page(handle_);
}

std::string Engine::selectCandidate(int oneBased) {
    if (handle_ == nullptr || oneBased < 1) return {};
    const char *text = engine_select_candidate(handle_, static_cast<size_t>(oneBased));
    return text == nullptr ? std::string() : std::string(text);
}

std::string Engine::commit() {
    if (handle_ == nullptr) return {};
    const char *text = engine_commit(handle_);
    return text == nullptr ? std::string() : std::string(text);
}

// ---------------------------------------------------------------- the addon

std::vector<fcitx::InputMethodEntry> PingZhuEngine::listInputMethods() {
    // Constructed in place, and the vector reserved first.
    //
    // InputMethodEntry's copy constructor is deleted, and declaring it — even as
    // deleted — suppresses the implicit move constructor. So the vector can
    // neither copy nor move its elements: reserve(1) means emplace_back never
    // reallocates, and returning by name lets the compiler construct the vector
    // straight into the return slot.
    //
    // The obvious `return {InputMethodEntry(...)}` compiles in fcitx5's own code
    // only because that one is a constant.
    std::vector<fcitx::InputMethodEntry> methods;
    methods.reserve(1);
    // The fourth argument is the addon this input method belongs to, and it has
    // to be the addon's name — which is its config file's name. It said
    // "bopomofo" at first, which matched nothing.
    methods.emplace_back("pingzhu", "PingZhu", "zh_TW", "pingzhu");
    methods.back().setLabel("平注");
    methods.back().setIcon("pingzhu");
    return methods;
}

void PingZhuEngine::activate(const fcitx::InputMethodEntry &,
                             fcitx::InputContextEvent &event) {
    if (engine_ == nullptr) {
        engine_ = std::make_unique<Engine>();
    } else {
        engine_->reset();
    }
    cursor_ = 0;
    refresh(*event.inputContext());
}

void PingZhuEngine::deactivate(const fcitx::InputMethodEntry &,
                               fcitx::InputContextEvent &) {
    // The engine is kept: creating it reads a 6 MB language model, and input
    // methods are switched constantly.
    if (engine_ != nullptr) engine_->reset();
    cursor_ = 0;
}

void PingZhuEngine::reset(const fcitx::InputMethodEntry &,
                          fcitx::InputContextEvent &event) {
    if (engine_ != nullptr) engine_->reset();
    cursor_ = 0;
    refresh(*event.inputContext());
}

void PingZhuEngine::refresh(fcitx::InputContext &ic) {
    if (engine_ == nullptr) return;

    const std::string composing = engine_->composing();
    const std::string sentence = engine_->sentence();

    if (composing.empty()) {
        ic.inputPanel().reset();
        ic.updatePreedit();
        ic.updateUserInterface(fcitx::UserInterfaceComponent::InputPanel);
        return;
    }

    // What is being composed, shown as the preedit. The decoded sentence is
    // what the user actually recognises — watching "su3cl3" appear and turn into
    // 你好 is worse than watching 你好 appear and being able to fix it.
    // The preedit goes on the panel and updatePreedit() (no arguments) tells
    // the UI about it. There is no updatePreedit(text, ...) — found by the
    // compiler in one second, which is the point of building here.
    fcitx::Text preedit(sentence);
    // A guessed reading is marked, so the user knows when to look at the list
    // rather than trusting what is in front of them.
    if (!engine_->outputIsFaithful()) {
        preedit.setCursor(0);
    }
    ic.inputPanel().setPreedit(preedit);
    ic.updatePreedit();
    ic.updateUserInterface(fcitx::UserInterfaceComponent::InputPanel);

    if (!engine_->candidateWindowOpen()) {
        ic.inputPanel().setCandidateList(nullptr);
        return;
    }

    auto candidates = engine_->candidates();
    if (candidates.empty()) {
        ic.inputPanel().setCandidateList(nullptr);
        return;
    }

    auto list = std::make_unique<fcitx::CommonCandidateList>();
    list->setLayoutHint(fcitx::CandidateLayoutHint::NotSet);
    list->setPageSize(9);
    for (const auto &text : candidates) {
        list->append<fcitx::DisplayOnlyCandidateWord>(fcitx::Text(text));
    }
    if (cursor_ < 0 || cursor_ >= static_cast<int>(candidates.size())) {
        cursor_ = 0;
    }
    list->setGlobalCursorIndex(cursor_);
    ic.inputPanel().setCandidateList(std::move(list));
}

void PingZhuEngine::commitAndClear(fcitx::InputContext &ic) {
    if (engine_ == nullptr) return;
    const std::string text = engine_->commit();
    cursor_ = 0;
    if (!text.empty()) {
        ic.commitString(text);
    }
    refresh(ic);
}

void PingZhuEngine::keyEvent(const fcitx::InputMethodEntry &,
                             fcitx::KeyEvent &keyEvent) {
    if (engine_ == nullptr) return;

    const fcitx::Key key = keyEvent.key();
    const bool composing = !engine_->composing().empty();
    const bool listOpen = engine_->candidateWindowOpen();

    // Digits are Bopomofo keys (1=ㄅ 2=ㄉ 5=ㄓ 8=ㄚ 9=ㄞ 0=ㄢ). They select a
    // candidate only while the list is open, which is the rule every shell
    // follows and the one that v0.6.0 got wrong: 倒 and every word beginning
    // with ㄅㄉㄓㄚㄞㄢ stopped typing.
    if (listOpen && key.isDigit()) {
        const int index = key.digit() == 0 ? 10 : key.digit();
        const std::string text = engine_->selectCandidate(index);
        cursor_ = 0;
        if (!text.empty()) {
            keyEvent.inputContext()->commitString(text);
        }
        refresh(*keyEvent.inputContext());
        keyEvent.filterAndAccept();
        return;
    }

    if (key.check(FcitxKey_space)) {
        if (!composing) {
            return; // let the space through when nothing is being composed
        }
        if (listOpen && engine_->nextPage()) {
            refresh(*keyEvent.inputContext());
        } else {
            commitAndClear(*keyEvent.inputContext());
        }
        keyEvent.filterAndAccept();
        return;
    }

    if (key.check(FcitxKey_Return) || key.check(FcitxKey_KP_Enter)) {
        if (composing) {
            commitAndClear(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
        }
        return;
    }

    if (key.check(FcitxKey_BackSpace)) {
        if (composing) {
            engine_->backspace();
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
        }
        return;
    }

    if (key.check(FcitxKey_Escape)) {
        if (composing) {
            engine_->reset();
            cursor_ = 0;
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
        }
        return;
    }

    if (listOpen) {
        if (key.check(FcitxKey_Down)) {
            cursor_ = std::min(cursor_ + 1, static_cast<int>(engine_->candidates().size()) - 1);
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;
        }
        if (key.check(FcitxKey_Up)) {
            cursor_ = std::max(cursor_ - 1, 0);
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;
        }
    }

    // Everything else: hand it to the engine if the engine's layout knows it.
    const std::string keyUtf8 = fcitx::Key::keySymToUTF8(key.sym());
    if (keyUtf8.size() == 1 && engine_->feedKey(keyUtf8[0])) {
        refresh(*keyEvent.inputContext());
        keyEvent.filterAndAccept();
    }
}

fcitx::AddonInstance *PingZhuEngineFactory::create(fcitx::AddonManager *) {
    return new PingZhuEngine();
}

} // namespace pingzhu

FCITX_ADDON_FACTORY(pingzhu::PingZhuEngineFactory);
