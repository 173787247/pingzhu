/*
 * The C ABI, loaded dynamically.
 *
 * Dynamic loading rather than an import library on purpose: the Rust core is
 * built with the GNU toolchain (from WSL) and this shell with MSVC, and linking
 * two CRTs into one process is a class of bug nobody needs. LoadLibrary +
 * GetProcAddress crosses that boundary cleanly, and it is also how a shell can
 * degrade gracefully when the core is missing or is the wrong ABI version.
 */
#ifndef PINGZHU_ENGINE_API_H
#define PINGZHU_ENGINE_API_H

#include <cstddef>
#include <cstdint>
#include <string>

namespace pingzhu {

struct EngineHandle;

/* Must match core-rs/src/ffi.rs. */
constexpr uint32_t kExpectedAbiVersion = 1;

class Engine {
public:
    Engine() = default;
    ~Engine();
    Engine(const Engine &) = delete;
    Engine &operator=(const Engine &) = delete;

    /* Loads pingzhu_core.dll from next to the executable and creates an engine.
     * `dataDir` must hold bopomofo-lm.tsv. Returns false and sets lastError(). */
    bool load(const std::wstring &dllPath, const std::string &dataDir,
              const char *layout = "standard", const char *candidateOrder = nullptr);
    void destroy();

    bool valid() const { return handle_ != nullptr; }
    const std::string &lastError() const { return error_; }

    /* Learned words live in a plain-text file beside the executable. */
    bool loadUserDictionaryFile(const std::string &path);
    bool saveUserDictionaryFile(const std::string &path);

    bool feedKey(char ch);
    bool backspace();
    void reset();

    std::string composing() const;
    std::string sentence() const;
    /* True when the output is provably read exactly as typed. */
    bool outputIsFaithful() const;

    bool isComposing() const { return isComposing_; }
    bool candidateWindowOpen() const { return candidateOpen_; }
    int candidateCount() const;
    std::string candidateAt(int index) const;
    int pageIndex() const;
    int pageCount() const;

    bool openCandidates();
    void closeCandidates();
    bool nextPage();
    bool prevPage();
    bool moveCursor(int delta);

    /* All of these return the committed text (empty when nothing was committed). */
    std::string selectCandidate(int oneBased);
    std::string commit();

    /* Refresh the cached composing/open state after any engine call. */
    void sync();

private:
    void *module_ = nullptr;
    EngineHandle *handle_ = nullptr;
    std::string error_;
    bool isComposing_ = false;
    bool candidateOpen_ = false;

    /* The function table. */
    uint32_t (*abi_version_)() = nullptr;
    EngineHandle *(*create_)(const char *, const char *, const char *) = nullptr;
    void (*destroy_)(EngineHandle *) = nullptr;
    bool (*loadUserDict_)(EngineHandle *, const char *) = nullptr;
    bool (*saveUserDict_)(EngineHandle *, const char *) = nullptr;
    bool (*feedKey_)(EngineHandle *, const char *) = nullptr;
    bool (*backspace_)(EngineHandle *) = nullptr;
    void (*reset_)(EngineHandle *) = nullptr;
    const char *(*composing_)(EngineHandle *) = nullptr;
    const char *(*bestSentence_)(EngineHandle *) = nullptr;
    bool (*faithful_)(EngineHandle *) = nullptr;
    std::size_t (*syllableCount_)(EngineHandle *) = nullptr;
    std::size_t (*candidateCount_)(EngineHandle *) = nullptr;
    const char *(*candidateAt_)(EngineHandle *, std::size_t) = nullptr;
    uint64_t (*pageInfo_)(EngineHandle *) = nullptr;
    bool (*windowOpen_)(EngineHandle *) = nullptr;
    bool (*openWindow_)(EngineHandle *) = nullptr;
    void (*closeWindow_)(EngineHandle *) = nullptr;
    bool (*nextPage_)(EngineHandle *) = nullptr;
    bool (*prevPage_)(EngineHandle *) = nullptr;
    bool (*moveCursor_)(EngineHandle *, int32_t) = nullptr;
    const char *(*selectCandidate_)(EngineHandle *, std::size_t) = nullptr;
    const char *(*commit_)(EngineHandle *) = nullptr;
};

}  // namespace pingzhu

#endif  // PINGZHU_ENGINE_API_H
