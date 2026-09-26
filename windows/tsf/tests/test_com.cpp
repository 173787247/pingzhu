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
    const char *path = (argc > 1) ? argv[1] : "pingzhu-tsf-0.5.2.dll";

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

    if (SUCCEEDED(comInit)) CoUninitialize();
    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall COM checks passed\n", failures);
    return failures ? 1 : 0;
}
