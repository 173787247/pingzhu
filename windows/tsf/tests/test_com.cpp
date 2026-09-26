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

#include <cstdio>

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
    const char *path = (argc > 1) ? argv[1] : "pingzhu-tsf.dll";

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
    std::printf(failures ? "\n%d FAILURE(S)\n" : "\nall COM checks passed\n", failures);
    return failures ? 1 : 0;
}
