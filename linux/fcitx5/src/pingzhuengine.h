/*
 * PingZhu for fcitx5.
 *
 * The decoding is not here. Every key goes to the shared Rust core through the
 * C ABI in core-rs/, the same one Windows, Android, macOS and HarmonyOS use, so
 * the same keys give the same words everywhere.
 *
 * This file is the glue fcitx5 requires: an InputMethodEngine, an input method
 * entry, and the two calls that put text on screen — updatePreedit for what is
 * being composed and commitString for what is finished.
 */
#ifndef PINGZHU_ENGINE_H
#define PINGZHU_ENGINE_H

#include <fcitx/inputmethodengine.h>
#include <fcitx/inputcontext.h>
#include <fcitx/event.h>
#include <fcitx/addonfactory.h>
#include <fcitx/addonmanager.h>

#include <memory>
#include <string>
#include <vector>

// The C ABI handle. Named here rather than void* so the compiler checks every
// call site — which it did, on the first build.
struct EngineHandle;

namespace pingzhu {

/// Owns one engine handle. Constructed on activate, destroyed on deactivate.
///
/// A thin RAII wrapper rather than calling the C ABI from everywhere: the handle
/// has to be freed exactly once, and `engine_destroy` on a stale pointer is the
/// kind of bug that only shows up after a hundred input method switches.
class Engine {
public:
    Engine();
    ~Engine();

    Engine(const Engine &) = delete;
    Engine &operator=(const Engine &) = delete;

    /// True when the language model was found and read.
    bool valid() const { return handle_ != nullptr; }

    /// Feeds one key. Returns false when the key is not part of this layout.
    bool feedKey(char key);

    void reset();
    void backspace();

    std::string composing() const;
    std::string sentence() const;
    bool outputIsFaithful() const;
    int syllableCount() const;

    std::vector<std::string> candidates() const;
    bool candidateWindowOpen() const;
    void openCandidateWindow();
    void closeCandidateWindow();
    bool nextPage();
    bool previousPage();
    std::string selectCandidate(int oneBased);

    std::string commit();

    /// Loads the words learned in earlier sessions. Creates the dictionary when
    /// the file is not there yet; false means the file was there and unreadable.
    bool loadUserDictionary(const std::string &path);
    /// Writes the words learned so far. False when the path cannot be written.
    bool saveUserDictionary(const std::string &path);

private:
    EngineHandle *handle_ = nullptr;
};

class PingZhuEngine : public fcitx::InputMethodEngine {
public:
    /// Picks a candidate by its one-based index within the page and commits it.
    /// Shared by the digit keys and by a click on the panel.
    void pickCandidate(fcitx::InputContext &ic, int oneBased);

    void keyEvent(const fcitx::InputMethodEntry &entry,
                  fcitx::KeyEvent &keyEvent) override;
    // The real signatures take an InputContextEvent, not an InputContext.
    //
    // Written from memory as InputContext& first, and the compiler said so in
    // one second: "'activate' marked 'override', but does not override". That is
    // the whole advantage of building where the headers are.
    void activate(const fcitx::InputMethodEntry &entry,
                  fcitx::InputContextEvent &event) override;
    void deactivate(const fcitx::InputMethodEntry &entry,
                    fcitx::InputContextEvent &event) override;
    void reset(const fcitx::InputMethodEntry &entry,
               fcitx::InputContextEvent &event) override;
    std::vector<fcitx::InputMethodEntry> listInputMethods() override;

private:
    std::unique_ptr<Engine> engine_;

    void refresh(fcitx::InputContext &ic);
    void commitAndClear(fcitx::InputContext &ic);

    /// Writes what the user has taught the engine (a chosen candidate, or a
    /// committed sentence) so the next session starts with it. Called after the
    /// two places that learn.
    void persistLearning();
};

class PingZhuEngineFactory : public fcitx::AddonFactory {
public:
    fcitx::AddonInstance *create(fcitx::AddonManager *manager) override;
};

} // namespace pingzhu

#endif // PINGZHU_ENGINE_H
