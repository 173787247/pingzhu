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

private:
    EngineHandle *handle_ = nullptr;
};

class PingZhuEngine : public fcitx::InputMethodEngine {
public:
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

    /// Which candidate the arrow keys have moved to, if any.
    int cursor_ = 0;

    void refresh(fcitx::InputContext &ic);
    void commitAndClear(fcitx::InputContext &ic);
};

class PingZhuEngineFactory : public fcitx::AddonFactory {
public:
    fcitx::AddonInstance *create(fcitx::AddonManager *manager) override;
};

} // namespace pingzhu

#endif // PINGZHU_ENGINE_H
