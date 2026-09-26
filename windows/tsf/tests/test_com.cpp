/*
 * COM plumbing test for the TSF text service.
 *
 * Deliberately does NOT go through the registry. It loads the DLL, calls
 * DllGetClassObject by hand and asks the resulting object for each interface it
 * claims to implement. That means the whole COM contract can be checked without
 * administrator rights and without installing anything — which matters, because
 * the interesting failures (a missing vtable entry, a QueryInterface that lies,
 * an object that never unloads) are all invisible until something tries to use
 * the text service inside a real application.
 *
 *   pingzhu-tsf-test.exe [path-to-pingzhu-tsf.dll]
 */
#include <windows.h>
#include <msctf.h>
#include <objbase.h>
#include <cstring>

#include <cstdio>

#include "../../src/data_dir.h"
#include "../../src/engine_api.h"
#include "../guids.h"

namespace {

int failures = 0;

void check(const char *what, bool ok, const char *detail = "") {
    if (ok) {
        std::printf("  ok   %-44s %s\n", what, detail);
    } else {
        std::printf("  FAIL %-44s %s\n", what, detail);
        failures++;
    }
}

/* A CLSID that is certainly not ours. */
const CLSID kBogusClsid = {0x00000000, 0x0000, 0x0000, {0, 0, 0, 0, 0, 0, 0, 0xff}};

/* Where the service keeps its files: beside the *registered* DLL, not beside
 * this executable. The two coincide in the build tree and differ everywhere
 * else, so resolving it in one place and sharing it is the only way to stop
 * getting it wrong twice — which is exactly what happened. */
std::wstring serviceDirectory() {
    HKEY key = nullptr;
    if (RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            L"SOFTWARE\\Classes\\CLSID\\{C2A55EB0-4391-4204-ABCF-4631BEA80A8F}\\InprocServer32",
            0, KEY_READ | KEY_WOW64_64KEY, &key) == ERROR_SUCCESS) {
        wchar_t dllPath[MAX_PATH] = {0};
        DWORD size = sizeof(dllPath);
        DWORD type = 0;
        if (RegQueryValueExW(key, nullptr, nullptr, &type,
                             reinterpret_cast<BYTE *>(dllPath), &size) == ERROR_SUCCESS &&
            type == REG_SZ) {
            RegCloseKey(key);
            std::wstring path(dllPath);
            return path.substr(0, path.find_last_of(L"\\/"));
        }
        RegCloseKey(key);
    }
    wchar_t exePath[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::wstring path(exePath);
    return path.substr(0, path.find_last_of(L"\\/"));
}

std::string readWholeFile(const std::wstring &path) {
    FILE *f = _wfopen(path.c_str(), L"rb");
    if (!f) return std::string();
    std::string out;
    char buf[4096];
    size_t n;
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0) out.append(buf, n);
    fclose(f);
    return out;
}

using DllGetClassObjectFn = HRESULT(WINAPI *)(REFCLSID, REFIID, void **);
using DllCanUnloadNowFn = HRESULT(WINAPI *)();

}  // namespace

int main(int argc, char **argv) {
    /* Initialised once for the whole run: a CoUninitialize between the sections
     * leaves later CoCreateInstance calls failing with CO_E_NOTINITIALIZED,
     * which looks exactly like a broken registration. */
    HRESULT comInit = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    /* Default to the versioned build. The text service DLL carries a version in
     * its name (Windows locks a loaded DLL), so a fixed default silently tests
     * a stale file and reports on code that is not the code being developed. */
    const char *path = (argc > 1) ? argv[1] : "pingzhu-tsf-0.7.4.dll";

    HMODULE module = LoadLibraryA(path);
    if (!module) {
        std::printf("FAIL: LoadLibrary(%s) error %lu\n", path, GetLastError());
        return 1;
    }
    std::printf("loaded %s\n\n", path);

    auto getClassObject =
        reinterpret_cast<DllGetClassObjectFn>(GetProcAddress(module, "DllGetClassObject"));
    auto canUnloadNow =
        reinterpret_cast<DllCanUnloadNowFn>(GetProcAddress(module, "DllCanUnloadNow"));
    /* Several sections below go through CoCreateInstance, which reads the
     * registry — so they exercise whatever DLL is *registered*, not the one
     * named on the command line. When those differ the test silently reports on
     * old code, which has already caused two confusing failures here. Say it out
     * loud instead. */
    {
        HKEY key = nullptr;
        std::string registered;
        if (RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                L"SOFTWARE\\Classes\\CLSID\\{C2A55EB0-4391-4204-ABCF-4631BEA80A8F}\\InprocServer32",
                0, KEY_READ | KEY_WOW64_64KEY, &key) == ERROR_SUCCESS) {
            wchar_t value[MAX_PATH] = {0};
            DWORD size = sizeof(value);
            if (RegQueryValueExW(key, nullptr, nullptr, nullptr,
                                 reinterpret_cast<BYTE *>(value), &size) == ERROR_SUCCESS) {
                char utf8[MAX_PATH * 2] = {0};
                WideCharToMultiByte(CP_UTF8, 0, value, -1, utf8, sizeof(utf8), nullptr, nullptr);
                registered = utf8;
            }
            RegCloseKey(key);
        }
        const char *slash = strrchr(registered.c_str(), '\\');
        const std::string registeredName = slash ? slash + 1 : registered;
        const bool matches = registeredName == path;
        std::printf("  registered DLL: %s\n", registeredName.empty() ? "(none)" : registeredName.c_str());
        std::printf("  testing DLL:    %s\n", path);
        if (!matches) {
            std::printf("  NOTE: the registry-based sections below test the REGISTERED dll.\n"
                        "        Re-run regtool install to point it at this build.\n\n");
        }
    }

    check("DllGetClassObject is exported", getClassObject != nullptr);
    check("DllCanUnloadNow is exported", canUnloadNow != nullptr);
    if (!getClassObject || !canUnloadNow) return 1;

    /* An unknown CLSID must be refused, not crash: COM asks for classes that are
     * not ours whenever anything in the process calls CoCreateInstance. */
    IClassFactory *bogus = nullptr;
    HRESULT hr = getClassObject(kBogusClsid, IID_IClassFactory,
                                reinterpret_cast<void **>(&bogus));
    check("unknown CLSID -> CLASS_E_CLASSNOTAVAILABLE", hr == CLASS_E_CLASSNOTAVAILABLE);

    IClassFactory *factory = nullptr;
    hr = getClassObject(CLSID_PingZhuTextService, IID_IClassFactory,
                        reinterpret_cast<void **>(&factory));
    check("our CLSID -> IClassFactory", SUCCEEDED(hr) && factory != nullptr);
    if (!factory) return 1;

    hr = factory->LockServer(TRUE);
    check("LockServer(TRUE)", SUCCEEDED(hr));
    check("DllCanUnloadNow says no while locked", canUnloadNow() == S_FALSE);
    factory->LockServer(FALSE);

    /* Aggregation is refused explicitly; accepting it silently would give the
     * outer object an IUnknown that does not control the inner lifetime. */
    IUnknown *aggregated = nullptr;
    hr = factory->CreateInstance(reinterpret_cast<IUnknown *>(factory), IID_IUnknown,
                                 reinterpret_cast<void **>(&aggregated));
    check("aggregation -> CLASS_E_NOAGGREGATION", hr == CLASS_E_NOAGGREGATION);

    ITfTextInputProcessorEx *service = nullptr;
    hr = factory->CreateInstance(nullptr, IID_ITfTextInputProcessorEx,
                                 reinterpret_cast<void **>(&service));
    check("CreateInstance -> ITfTextInputProcessorEx", SUCCEEDED(hr) && service != nullptr);
    if (!service) return 1;

    struct { REFIID iid; const char *name; } interfaces[] = {
        {IID_IUnknown, "IUnknown"},
        {IID_ITfTextInputProcessor, "ITfTextInputProcessor"},
        {IID_ITfTextInputProcessorEx, "ITfTextInputProcessorEx"},
        {IID_ITfThreadMgrEventSink, "ITfThreadMgrEventSink"},
        {IID_ITfKeyEventSink, "ITfKeyEventSink"},
        {IID_ITfCompositionSink, "ITfCompositionSink"},
        {IID_ITfDisplayAttributeProvider, "ITfDisplayAttributeProvider"},
    };
    for (auto &entry : interfaces) {
        void *ptr = nullptr;
        hr = service->QueryInterface(entry.iid, &ptr);
        check(entry.name, SUCCEEDED(hr) && ptr != nullptr);
        if (ptr) static_cast<IUnknown *>(ptr)->Release();
    }

    /* A lying QueryInterface is worse than a missing one: the host would call a
     * vtable slot that holds a different method. */
    void *unrelated = nullptr;
    hr = service->QueryInterface(IID_ITfRange, &unrelated);
    check("unrelated IID -> E_NOINTERFACE", hr == E_NOINTERFACE && unrelated == nullptr);

    ITfDisplayAttributeProvider *provider = nullptr;
    if (SUCCEEDED(service->QueryInterface(IID_ITfDisplayAttributeProvider,
                                          reinterpret_cast<void **>(&provider)))) {
        ITfDisplayAttributeInfo *info = nullptr;
        hr = provider->GetDisplayAttributeInfo(GUID_PingZhuDisplayAttribute, &info);
        check("display attribute is served", SUCCEEDED(hr) && info != nullptr);
        if (info) {
            GUID got = {0};
            /* Not `= {0}`: the first member is itself a struct. */
            TF_DISPLAYATTRIBUTE attribute;
            ZeroMemory(&attribute, sizeof(attribute));
            check("attribute GUID round-trips",
                  SUCCEEDED(info->GetGUID(&got)) && IsEqualGUID(got, GUID_PingZhuDisplayAttribute));
            check("attribute is a dotted underline",
                  SUCCEEDED(info->GetAttributeInfo(&attribute)) && attribute.lsStyle == TF_LS_DOT);
            info->Release();
        }
        ITfDisplayAttributeInfo *wrong = nullptr;
        hr = provider->GetDisplayAttributeInfo(kBogusClsid, &wrong);
        check("unknown attribute GUID -> E_INVALIDARG",
              hr == E_INVALIDARG && wrong == nullptr);
        provider->Release();
    }

    check("DllCanUnloadNow says no while alive", canUnloadNow() == S_FALSE);
    service->Release();
    factory->Release();
    check("DllCanUnloadNow says yes once released", canUnloadNow() == S_OK);

    FreeLibrary(module);

    /* ---------------------------------------------------------------- engine
     * The text service resolves its data directory from the DLL's own location.
     * Get that wrong and every key passes silently through to the application —
     * the input method appears to do nothing at all, with no error anywhere.
     * That is exactly what happened once, so it is checked here rather than
     * trusted.
     */
    std::printf("\nengine resolution (the same path the text service takes)\n");
    {
        std::wstring dllDir = pingzhu::resolveDataDir(L".");
        /* Resolve relative to this executable's directory, which is where the
         * test runs from — the same relationship the service has to its DLL. */
        wchar_t exePath[MAX_PATH] = {0};
        GetModuleFileNameW(nullptr, exePath, MAX_PATH);
        std::wstring exeDir(exePath);
        exeDir = exeDir.substr(0, exeDir.find_last_of(L"\\/"));
        dllDir = pingzhu::resolveDataDir(exeDir);
        std::string narrow = pingzhu::toUtf8(dllDir);
        check("data directory resolves", !narrow.empty(), narrow.c_str());

        std::wstring model = dllDir + L"\\bopomofo-lm.tsv";
        check("bopomofo-lm.tsv is there",
              GetFileAttributesW(model.c_str()) != INVALID_FILE_ATTRIBUTES);

        pingzhu::Engine engine;
        bool loaded = engine.load(exeDir + L"\\pingzhu_core.dll", narrow, "standard", nullptr);
        check("engine loads from the resolved directory", loaded,
              loaded ? "" : engine.lastError().c_str());
        if (loaded) {
            for (const char *k = "su3cl3"; *k; ++k) engine.feedKey(*k);
            check("and decodes su3cl3 -> 你好", engine.sentence() == "你好", engine.sentence().c_str());
        }
    }

    /* ------------------------------------------------------- registry path
     * Everything above bypassed the registry on purpose. This last part does not:
     * it asks COM to create the object the way Windows will, which is the only
     * way to catch a registration that is present but unusable — the failure the
     * user sees as "input method not found".
     */
    std::printf("\nregistry-based creation (what the language bar does)\n");
    {
        ITfTextInputProcessorEx *fromRegistry = nullptr;
        HRESULT hr = CoCreateInstance(CLSID_PingZhuTextService, nullptr, CLSCTX_INPROC_SERVER,
                                      IID_ITfTextInputProcessorEx,
                                      reinterpret_cast<void **>(&fromRegistry));
        char detail[128];
        std::snprintf(detail, sizeof(detail), "hr=0x%08lX", static_cast<unsigned long>(hr));
        check("CoCreateInstance finds the text service", SUCCEEDED(hr) && fromRegistry != nullptr,
              detail);
        if (fromRegistry) fromRegistry->Release();
    }

    /* ---------------------------------------------------- real activation
     * The closest this can get to what Windows does when the user picks the
     * input method: a genuine TSF thread manager, a genuine client id, and the
     * service's own Activate. Everything that can only be exercised on the real
     * path — sink registration, engine loading, logging — happens here.
     */
    std::printf("\nreal activation (the path Windows takes)\n");
    {
        ITfThreadMgr *threadMgr = nullptr;
        HRESULT hr = CoCreateInstance(CLSID_TF_ThreadMgr, nullptr, CLSCTX_INPROC_SERVER,
                                      IID_ITfThreadMgr,
                                      reinterpret_cast<void **>(&threadMgr));
        char detail[128];
        std::snprintf(detail, sizeof(detail), "hr=0x%08lX", static_cast<unsigned long>(hr));
        check("TSF thread manager is available", SUCCEEDED(hr) && threadMgr != nullptr, detail);
        if (threadMgr) {
            TfClientId clientId = TF_CLIENTID_NULL;
            hr = threadMgr->Activate(&clientId);
            check("thread manager activates", SUCCEEDED(hr));

            ITfTextInputProcessorEx *service = nullptr;
            hr = CoCreateInstance(CLSID_PingZhuTextService, nullptr, CLSCTX_INPROC_SERVER,
                                  IID_ITfTextInputProcessorEx,
                                  reinterpret_cast<void **>(&service));
            if (SUCCEEDED(hr) && service) {
                hr = service->ActivateEx(threadMgr, clientId, 0);
                std::snprintf(detail, sizeof(detail), "hr=0x%08lX",
                              static_cast<unsigned long>(hr));
                check("text service activates", SUCCEEDED(hr), detail);
                hr = service->Deactivate();
                check("text service deactivates", SUCCEEDED(hr));
                service->Release();
            } else {
                check("text service created for activation", false);
            }
            threadMgr->Deactivate();
            threadMgr->Release();
        }
    }

    /* -------------------------------------------------- language bar button
     * Verified through the service's own log rather than by reaching into the
     * object: what matters is that AddItem was accepted by the language bar, and
     * that is exactly what the service records. A button that fails to register
     * is invisible — no error, just no button — so it has to be asserted.
     */
    std::printf("\nlanguage bar button\n");
    {
        const std::wstring dir = serviceDirectory();

        ITfThreadMgr *threadMgr = nullptr;
        ITfTextInputProcessorEx *service = nullptr;
        TfClientId clientId = TF_CLIENTID_NULL;
        if (SUCCEEDED(CoCreateInstance(CLSID_TF_ThreadMgr, nullptr, CLSCTX_INPROC_SERVER,
                                       IID_ITfThreadMgr,
                                       reinterpret_cast<void **>(&threadMgr))) &&
            threadMgr && SUCCEEDED(threadMgr->Activate(&clientId)) &&
            SUCCEEDED(CoCreateInstance(CLSID_PingZhuTextService, nullptr, CLSCTX_INPROC_SERVER,
                                       IID_ITfTextInputProcessorEx,
                                       reinterpret_cast<void **>(&service))) &&
            service) {
            service->ActivateEx(threadMgr, clientId, 0);
            service->Deactivate();
            service->Release();
            threadMgr->Deactivate();
            threadMgr->Release();
        }

        const std::wstring logPath = dir + L"\\pingzhu-tsf.log";
        const std::string logText = readWholeFile(logPath);
        std::printf("  log: %ls (%zu bytes)\n", logPath.c_str(), logText.size());
        /* Only the attempt can be asserted here. A console process has no
         * language bar of its own, so AddItem legitimately refuses — asserting
         * success would fail for the right reason in the wrong place. Whether
         * the button actually appears is checked in a real application.
         *
         * What IS asserted: the attempt was made, and the log reports the
         * outcome rather than claiming success either way. */
        const bool attempted = logText.find("language bar button added") != std::string::npos ||
                               logText.find("language bar button NOT added") != std::string::npos;
        check("the button registration was attempted", attempted);
        check("the item manager was reachable",
              logText.find("language bar item manager unavailable") == std::string::npos);
        std::printf("  note: %s\n",
                    logText.find("language bar button added") != std::string::npos
                        ? "AddItem was accepted (a language bar exists here)"
                        : "AddItem was refused — expected in a console process");
    }

    /* ------------------------------------------------- settings are re-read
     * The failure this guards against is invisible from the outside: the user
     * edits pingzhu.ini, switches input methods, and nothing changes — with no
     * error anywhere. Settings used to be read once, when the engine loaded,
     * so that is exactly what happened.
     *
     * The check is done through the log, because that is where the service
     * records the script it actually applied. The user's own settings file is
     * saved and restored: a test that leaves someone's configuration altered is
     * worse than no test.
     */
    std::printf("\nsettings are re-read on every activation\n");
    {
        const std::wstring dir = serviceDirectory();
        std::printf("  (settings file directory: %ls)\n", dir.c_str());
        std::wstring iniPath = dir + L"\\pingzhu.ini";

        auto readFile = readWholeFile;
        auto writeFile = [](const std::wstring &path, const std::string &text) {
            FILE *f = _wfopen(path.c_str(), L"wb");
            if (!f) return false;
            fwrite(text.data(), 1, text.size(), f);
            fclose(f);
            return true;
        };

        const std::string original = readFile(iniPath);
        if (original.empty()) {
            std::printf("  skip  no pingzhu.ini to exercise\n");
        } else {
            const bool hadTraditional = original.find("output = traditional") != std::string::npos;
            const std::string first = hadTraditional
                ? "output = traditional\r\n"
                : "output = simplified\r\n";
            const std::string second = hadTraditional
                ? "output = simplified\r\n"
                : "output = traditional\r\n";

            ITfThreadMgr *threadMgr = nullptr;
            ITfTextInputProcessorEx *service = nullptr;
            TfClientId clientId = TF_CLIENTID_NULL;
            if (SUCCEEDED(CoCreateInstance(CLSID_TF_ThreadMgr, nullptr, CLSCTX_INPROC_SERVER,
                                           IID_ITfThreadMgr,
                                           reinterpret_cast<void **>(&threadMgr))) &&
                threadMgr && SUCCEEDED(threadMgr->Activate(&clientId)) &&
                SUCCEEDED(CoCreateInstance(CLSID_PingZhuTextService, nullptr, CLSCTX_INPROC_SERVER,
                                           IID_ITfTextInputProcessorEx,
                                           reinterpret_cast<void **>(&service))) &&
                service) {
                writeFile(iniPath, first);
                service->ActivateEx(threadMgr, clientId, 0);
                service->Deactivate();

                /* Same object, different settings file: a second activation on
                 * the same instance is what TSF does, and it is where the old
                 * code stopped re-reading. */
                writeFile(iniPath, second);
                service->ActivateEx(threadMgr, clientId, 0);
                service->Deactivate();

                service->Release();
                threadMgr->Deactivate();
                threadMgr->Release();
            }
            writeFile(iniPath, original);

            const std::string iniAfter = readFile(iniPath);
            check("the settings file is left as it was", iniAfter == original);

            /* Both scripts must appear in the log from this run. */
            std::string logText = readFile(dir + L"\\pingzhu-tsf.log");
            const bool sawSimplified = logText.rfind("output script = simplified") != std::string::npos;
            const bool sawTraditional =
                logText.rfind("output script = traditional") != std::string::npos;
            check("a change to the file is picked up on the next activation",
                  sawSimplified && sawTraditional);
        }
    }

    if (SUCCEEDED(comInit)) CoUninitialize();
    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall COM checks passed\n", failures);
    return failures ? 1 : 0;
}
