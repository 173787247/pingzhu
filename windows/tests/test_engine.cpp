/*
 * Engine integration test — runs on Windows, through the real DLL.
 *
 * The Linux-side tests prove the Rust core matches the TypeScript reference.
 * This proves something different and just as necessary: that the shell's own
 * loading code finds pingzhu_core.dll, that the ABI version matches, and that
 * characters come out of a Windows process. Run it next to the executable:
 *
 *   pingzhu-engine-test.exe [data-dir]
 */
#include <cstdio>
#include <string>

#include "../src/engine_api.h"

static int failures = 0;

static void expect(const char *what, const std::string &got, const std::string &want) {
    if (got != want) {
        std::printf("  FAIL %-34s got \"%s\", want \"%s\"\n", what, got.c_str(), want.c_str());
        failures++;
    } else {
        std::printf("  ok   %-34s \"%s\"\n", what, got.c_str());
    }
}

int main(int argc, char **argv) {
    const char *dataDir = (argc > 1) ? argv[1] : "data";

    pingzhu::Engine engine;
    if (!engine.load(L"pingzhu_core.dll", dataDir, "standard", nullptr)) {
        std::printf("FAIL: %s\n", engine.lastError().c_str());
        return 1;
    }
    std::printf("loaded pingzhu_core.dll, ABI %u\n", pingzhu::kExpectedAbiVersion);

    /* su3cl3 = ㄋㄧˇ ㄏㄠˇ */
    for (const char *k = "su3cl3"; *k; ++k) engine.feedKey(*k);
    expect("composing", engine.composing(), "ㄋㄧˇ ㄏㄠˇ");
    expect("sentence", engine.sentence(), "你好");
    expect("candidate 1", engine.candidateAt(0), "你好");
    expect("commit", engine.commit(), "你好");

    /* ji394su3 — the segmentation that is only resolvable with a language model */
    for (const char *k = "ji394su3"; *k; ++k) engine.feedKey(*k);
    expect("ambiguous sentence", engine.sentence(), "我愛你");
    if (!engine.outputIsFaithful()) {
        std::printf("  FAIL output should be provably read as typed\n");
        failures++;
    } else {
        std::printf("  ok   output is provably read as typed\n");
    }
    engine.reset();

    /* j0420 — a tone key must not migrate to the next syllable */
    for (const char *k = "j0420"; *k; ++k) engine.feedKey(*k);
    expect("tone migration: composing", engine.composing(), "ㄨㄢˋ ㄉㄢ");
    expect("tone migration: sentence", engine.sentence(), "萬丹");
    engine.reset();

    /* digits compose until the candidate window is open */
    for (const char *k = "su3"; *k; ++k) engine.feedKey(*k);
    expect("before opening: sentence", engine.sentence(), "你");
    if (engine.selectCandidate(1) != "") {
        std::printf("  FAIL a digit selected while the window was closed\n");
        failures++;
    } else {
        std::printf("  ok   digits do not select while composing\n");
    }
    engine.openCandidates();
    expect("after opening: candidate 1", engine.candidateAt(0), "你");
    expect("select 1 commits", engine.selectCandidate(1), "你");
    engine.reset();

    /* learning: teach 畜牲 over the model's 畜生, then re-type */
    for (const char *k = "tj4g/"; *k; ++k) engine.feedKey(*k);
    expect("before teaching", engine.sentence(), "畜生");
    {
        int index = -1;
        for (int i = 0; i < engine.candidateCount(); ++i) {
            if (engine.candidateAt(i) == "畜牲") { index = i; break; }
        }
        if (index < 0) {
            std::printf("  FAIL 畜牲 not offered in the candidate window\n");
            failures++;
        } else {
            engine.openCandidates();
            std::string committed = engine.selectCandidate(index + 1);
            std::printf("  ok   taught 畜牲 (committed \"%s\")\n", committed.c_str());
        }
    }
    for (const char *k = "tj4g/"; *k; ++k) engine.feedKey(*k);
    expect("after teaching", engine.sentence(), "畜牲");
    engine.reset();

    engine.destroy();
    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall engine checks passed\n", failures);
    return failures ? 1 : 0;
}
