#include "engine_api.h"

#include <windows.h>

namespace pingzhu {

namespace {

/* Copy a string the engine owns. The buffer stays valid only until the next call
 * on the same thread, so every accessor copies immediately. */
std::string copyOut(const char *s) {
    return s ? std::string(s) : std::string();
}

template <typename T>
bool bind(void *module, const char *name, T &slot) {
    slot = reinterpret_cast<T>(GetProcAddress(static_cast<HMODULE>(module), name));
    return slot != nullptr;
}

}  // namespace

Engine::~Engine() { destroy(); }

bool Engine::load(const std::wstring &dllPath, const std::string &dataDir, const char *layout,
                  const char *candidateOrder) {
    destroy();
    HMODULE module = LoadLibraryW(dllPath.c_str());
    if (!module) {
        error_ = "LoadLibrary failed for pingzhu_core.dll (error " +
                 std::to_string(GetLastError()) + ")";
        return false;
    }
    module_ = module;

    bool ok = bind(module, "engine_abi_version", abi_version_) &&
              bind(module, "engine_create", create_) &&
              bind(module, "engine_destroy", destroy_) &&
              bind(module, "engine_load_user_dictionary", loadUserDict_) &&
              bind(module, "engine_save_user_dictionary", saveUserDict_) &&
              bind(module, "engine_feed_key", feedKey_) &&
              bind(module, "engine_backspace", backspace_) &&
              bind(module, "engine_reset", reset_) &&
              bind(module, "engine_composing", composing_) &&
              bind(module, "engine_best_sentence", bestSentence_) &&
              bind(module, "engine_output_is_faithful", faithful_) &&
              bind(module, "engine_syllable_count", syllableCount_) &&
              bind(module, "engine_candidate_count", candidateCount_) &&
              bind(module, "engine_candidate_at", candidateAt_) &&
              bind(module, "engine_candidate_page_info", pageInfo_) &&
              bind(module, "engine_candidate_window_open", windowOpen_) &&
              bind(module, "engine_open_candidate_window", openWindow_) &&
              bind(module, "engine_close_candidate_window", closeWindow_) &&
              bind(module, "engine_next_candidate_page", nextPage_) &&
              bind(module, "engine_prev_candidate_page", prevPage_) &&
              bind(module, "engine_move_candidate_cursor", moveCursor_) &&
              bind(module, "engine_select_candidate", selectCandidate_) &&
              bind(module, "engine_commit", commit_);
    if (!ok) {
        error_ = "pingzhu_core.dll is missing one or more ABI entry points";
        destroy();
        return false;
    }

    /* Refuse a mismatched library rather than call through a wrong signature. */
    uint32_t version = abi_version_();
    if (version != kExpectedAbiVersion) {
        error_ = "pingzhu_core.dll reports ABI version " + std::to_string(version) +
                 ", this shell needs " + std::to_string(kExpectedAbiVersion);
        destroy();
        return false;
    }

    handle_ = create_(dataDir.c_str(), layout, candidateOrder);
    if (!handle_) {
        error_ = "engine_create failed; is bopomofo-lm.tsv in " + dataDir + "?";
        destroy();
        return false;
    }
    return true;
}

void Engine::destroy() {
    if (handle_ && destroy_) {
        destroy_(handle_);
    }
    handle_ = nullptr;
    if (module_) {
        FreeLibrary(static_cast<HMODULE>(module_));
        module_ = nullptr;
    }
}

void Engine::sync() {
    if (!handle_) return;
    isComposing_ = syllableCount_ && syllableCount_(handle_) > 0;
    candidateOpen_ = windowOpen_ && windowOpen_(handle_);
    if (!isComposing_) {
        /* An empty buffer is the one case where "composing" is ambiguous, so ask
         * the engine for its own view rather than guessing from the syllable
         * count: a half-typed syllable has no syllables yet. */
        isComposing_ = composing_ && composing_(handle_)[0] != '\0';
    }
}

bool Engine::loadUserDictionaryFile(const std::string &path) {
    if (!handle_ || !loadUserDict_) return false;
    bool ok = loadUserDict_(handle_, path.c_str());
    sync();
    return ok;
}

bool Engine::saveUserDictionaryFile(const std::string &path) {
    if (!handle_ || !saveUserDict_) return false;
    return saveUserDict_(handle_, path.c_str());
}

bool Engine::feedKey(char ch) {
    if (!handle_) return false;
    char buf[2] = {ch, 0};
    bool consumed = feedKey_(handle_, buf);
    sync();
    return consumed;
}

bool Engine::backspace() {
    if (!handle_) return false;
    bool consumed = backspace_(handle_);
    sync();
    return consumed;
}

void Engine::reset() {
    if (!handle_) return;
    reset_(handle_);
    sync();
}

std::string Engine::composing() const { return handle_ ? copyOut(composing_(handle_)) : ""; }
std::string Engine::sentence() const { return handle_ ? copyOut(bestSentence_(handle_)) : ""; }
bool Engine::outputIsFaithful() const { return handle_ && faithful_(handle_); }

int Engine::candidateCount() const {
    return handle_ ? static_cast<int>(candidateCount_(handle_)) : 0;
}
std::string Engine::candidateAt(int index) const {
    return handle_ ? copyOut(candidateAt_(handle_, static_cast<std::size_t>(index))) : "";
}
int Engine::pageIndex() const {
    return handle_ ? static_cast<int>(pageInfo_(handle_) & 0xffffffffu) : 0;
}
int Engine::pageCount() const {
    return handle_ ? static_cast<int>(pageInfo_(handle_) >> 32) : 1;
}

bool Engine::openCandidates() {
    if (!handle_) return false;
    bool ok = openWindow_(handle_);
    sync();
    return ok;
}
void Engine::closeCandidates() {
    if (!handle_) return;
    closeWindow_(handle_);
    sync();
}
bool Engine::nextPage() {
    if (!handle_) return false;
    bool ok = nextPage_(handle_);
    sync();
    return ok;
}
bool Engine::prevPage() {
    if (!handle_) return false;
    bool ok = prevPage_(handle_);
    sync();
    return ok;
}
bool Engine::moveCursor(int delta) {
    if (!handle_) return false;
    bool ok = moveCursor_(handle_, delta);
    sync();
    return ok;
}

std::string Engine::selectCandidate(int oneBased) {
    if (!handle_) return "";
    std::string out = copyOut(selectCandidate_(handle_, static_cast<std::size_t>(oneBased)));
    sync();
    return out;
}

std::string Engine::commit() {
    if (!handle_) return "";
    std::string out = copyOut(commit_(handle_));
    sync();
    return out;
}

}  // namespace pingzhu
