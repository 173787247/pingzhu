#include "pingzhuengine.h"

#include <fcitx/candidatelist.h>
#include <fcitx/inputpanel.h>
#include <fcitx/text.h>
#include <fcitx-utils/log.h>
#include <fcitx-utils/utf8.h>

#include "pingzhu.h"
#include "router.h"

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
    refresh(*event.inputContext());
}

void PingZhuEngine::deactivate(const fcitx::InputMethodEntry &,
                               fcitx::InputContextEvent &) {
    // The engine is kept: creating it reads a 6 MB language model, and input
    // methods are switched constantly.
    if (engine_ != nullptr) engine_->reset();
}

void PingZhuEngine::reset(const fcitx::InputMethodEntry &,
                          fcitx::InputContextEvent &event) {
    if (engine_ != nullptr) engine_->reset();
    refresh(*event.inputContext());
}

/// A candidate the user can click.
///
/// fcitx5 calls select() when the panel entry is clicked; DisplayOnlyCandidateWord
/// — what this list used to hold — implements that as an empty function, so the
/// digit keys were the only way to choose.
class PingZhuCandidateWord : public fcitx::CandidateWord {
public:
    PingZhuCandidateWord(fcitx::Text text, PingZhuEngine *engine, int oneBased)
        : fcitx::CandidateWord(std::move(text)), engine_(engine), oneBased_(oneBased) {}

    void select(fcitx::InputContext *inputContext) const override {
        engine_->pickCandidate(*inputContext, oneBased_);
    }

private:
    PingZhuEngine *engine_;
    int oneBased_;
};

void PingZhuEngine::pickCandidate(fcitx::InputContext &ic, int oneBased) {
    if (engine_ == nullptr) return;
    const std::string text = engine_->selectCandidate(oneBased);
    if (!text.empty()) {
        ic.commitString(text);
    }
    refresh(ic);
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
    // Ten, which is what the engine puts on a page. Nine meant the tenth
    // candidate of every page sat alone on a second page of fcitx5's own making:
    // reachable by paging, but the digit that selects it — 0 — was not on screen
    // next to it.
    list->setPageSize(10);
    for (size_t index = 0; index < candidates.size(); ++index) {
        // Clickable, not DisplayOnly: fcitx5 calls select() when a panel entry is
        // clicked, and DisplayOnly's select() does nothing — which left the digit
        // keys as the only way to pick anything, and made the highlight that ↑↓
        // used to move look like a way of choosing when it was not.
        list->append<PingZhuCandidateWord>(fcitx::Text(candidates[index]), this,
                                           static_cast<int>(index) + 1);
    }
    ic.inputPanel().setCandidateList(std::move(list));
}

void PingZhuEngine::commitAndClear(fcitx::InputContext &ic) {
    if (engine_ == nullptr) return;
    const std::string text = engine_->commit();
    if (!text.empty()) {
        ic.commitString(text);
    }
    refresh(ic);
}

namespace {

/// Maps an fcitx key to the router's vocabulary. The router itself knows nothing
/// about fcitx5, which is what makes `tests/router_vectors` a compiler and a
/// text file rather than a desktop.
KeyEvent keyOf(const fcitx::Key &key) {
    if (key.check(FcitxKey_space)) return {KeyKind::Space, 0};
    if (key.check(FcitxKey_BackSpace)) return {KeyKind::Backspace, 0};
    if (key.check(FcitxKey_Return) || key.check(FcitxKey_KP_Enter)) return {KeyKind::Enter, 0};
    if (key.check(FcitxKey_Escape)) return {KeyKind::Escape, 0};
    if (key.check(FcitxKey_Up)) return {KeyKind::ArrowUp, 0};
    if (key.check(FcitxKey_Down)) return {KeyKind::ArrowDown, 0};
    if (key.check(FcitxKey_Page_Up)) return {KeyKind::PageUp, 0};
    if (key.check(FcitxKey_Page_Down)) return {KeyKind::PageDown, 0};
    const std::string utf8 = fcitx::Key::keySymToUTF8(key.sym());
    if (utf8.size() == 1) return {KeyKind::Character, utf8[0]};
    return {KeyKind::Other, 0};
}

} // namespace

void PingZhuEngine::keyEvent(const fcitx::InputMethodEntry &,
                             fcitx::KeyEvent &keyEvent) {
    if (engine_ == nullptr) return;

    const fcitx::Key key = keyEvent.key();
    const EngineState state{
        !engine_->composing().empty(),
        engine_->candidateWindowOpen(),
        !engine_->candidates().empty(),
    };

    // What a key means is decided in src/router.cpp — one table, checked against
    // tools/routing-vectors.tsv by tests/router_vectors. This function only
    // carries the answer out, which is the whole point of splitting them: the
    // rules used to live here, where nothing could reach them, and three of them
    // had drifted from the other shells.
    const Decision decision = route(keyOf(key), state);

    switch (decision.action) {
        case Action::Pass:
            return; // the application gets it

        case Action::Compose: {
            const std::string utf8 = fcitx::Key::keySymToUTF8(key.sym());
            // The layout has the last word: a character it does not know is not
            // ours to swallow.
            if (utf8.size() != 1 || !engine_->feedKey(utf8[0])) return;
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;
        }

        case Action::SelectCandidate:
            // The same path a click on the panel takes.
            pickCandidate(*keyEvent.inputContext(), decision.arg);
            keyEvent.filterAndAccept();
            return;

        case Action::OpenCandidates:
            engine_->openCandidateWindow();
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;

        case Action::CloseCandidates:
            engine_->closeCandidateWindow();
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;

        case Action::NextPage:
        case Action::PrevPage: {
            const bool moved = decision.action == Action::NextPage ? engine_->nextPage()
                                                                   : engine_->previousPage();
            if (moved) refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;
        }

        case Action::Backspace:
            engine_->backspace();
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;

        case Action::Commit:
            commitAndClear(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;

        case Action::Cancel:
            engine_->reset();
            refresh(*keyEvent.inputContext());
            keyEvent.filterAndAccept();
            return;
    }
}

fcitx::AddonInstance *PingZhuEngineFactory::create(fcitx::AddonManager *) {
    return new PingZhuEngine();
}

} // namespace pingzhu

FCITX_ADDON_FACTORY(pingzhu::PingZhuEngineFactory);
