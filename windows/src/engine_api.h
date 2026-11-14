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
#include <vector>

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

    /* Every layout the engine accepts, asked of the DLL rather than kept here.
     * Needs no engine instance: the list is a property of the core, not of one run.
     * Returns an empty vector when the DLL cannot be loaded — the caller should then
     * accept whatever it was going to accept rather than reject a valid name. */
    static std::vector<std::string> layoutIds(const std::wstring &dllPath);
    void destroy();

    bool valid() const { return handle_ != nullptr; }
    const std::string &lastError() const { return error_; }

    /* Learned words live in a plain-text file beside the executable. */
    bool loadUserDictionaryFile(const std::string &path);
    bool saveUserDictionaryFile(const std::string &path);

    /* "traditional" or "simplified". Returns false for an unknown name. */
    bool setOutputScript(const char *script);
    std::string outputScript() const;

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

    /* 接续表：某个词之后最可能接什么。
     *
     * 传 TSV 全文而不是路径 —— 核心不知道文件系统。返回载入的条数，0 表示失败或表为空，
     * 也包含「这个 DLL 太老、没有这个符号」的情况。 */
    std::size_t loadAssociations(const std::string &tsv);

    /* 某个词之后最可能的接续词。没有接续表、或者词不在表里，返回空 vector。 */
    std::vector<std::string> suggestAfter(const std::string &word, int limit = 5);

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
    bool (*setOutputScript_)(EngineHandle *, const char *) = nullptr;
    const char *(*outputScript_)(EngineHandle *) = nullptr;
    /* 这三个是可选的：老版 pingzhu_core.dll 没有它们，绑定失败就是「没有联想」。 */
    std::size_t (*loadAssociations_)(EngineHandle *, const char *) = nullptr;
    char *(*suggestAfter_)(EngineHandle *, const char *, int32_t) = nullptr;
    void (*suggestAfterFree_)(char *) = nullptr;
};

}  // namespace pingzhu

#endif  // PINGZHU_ENGINE_API_H
