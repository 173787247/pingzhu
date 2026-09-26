/*
 * 平注 PingZhu — TSF text service: COM plumbing.
 *
 * A TSF text service is an in-proc COM server, which means this DLL is loaded
 * into whatever process is being typed into — Notepad, a browser, an Office
 * window. Everything here is therefore about being a well-behaved guest:
 *
 *   - DllCanUnloadNow must be honest, or the DLL stays mapped in every process
 *     that ever loaded it (and cannot be updated without a reboot)
 *   - DllRegisterServer / DllUnregisterServer write the COM registration; the
 *     CTF language profile is registered separately by register_tool.exe, which
 *     needs the same elevation
 *   - the class factory hands out exactly one class, on demand
 */
#include <windows.h>
#include <msctf.h>

#include <new>

#include "class_factory.h"
#include "guids.h"
#include "register.h"
#include "text_service.h"

namespace {

HINSTANCE g_instance = nullptr;
LONG g_objectCount = 0;
LONG g_serverLocks = 0;

}  // namespace

void pingzhu::tsf::objectCreated() { InterlockedIncrement(&g_objectCount); }
void pingzhu::tsf::objectDestroyed() { InterlockedDecrement(&g_objectCount); }
void pingzhu::tsf::serverLocked(BOOL lock) {
    if (lock) {
        InterlockedIncrement(&g_serverLocks);
    } else {
        InterlockedDecrement(&g_serverLocks);
    }
}

HINSTANCE pingzhu::tsf::moduleHandle() { return g_instance; }

/* Absolute path of this DLL. The text service is loaded into other processes,
 * so it can never rely on the working directory to find its data. */
std::wstring pingzhu::tsf::modulePath() {
    wchar_t path[MAX_PATH] = {0};
    GetModuleFileNameW(g_instance, path, MAX_PATH);
    return std::wstring(path);
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        g_instance = instance;
        DisableThreadLibraryCalls(instance);
    }
    return TRUE;
}

STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, void **ppv) {
    if (!ppv) return E_INVALIDARG;
    *ppv = nullptr;
    if (!IsEqualCLSID(rclsid, CLSID_PingZhuTextService)) return CLASS_E_CLASSNOTAVAILABLE;
    PingZhuClassFactory *factory = new (std::nothrow) PingZhuClassFactory();
    if (!factory) return E_OUTOFMEMORY;
    HRESULT hr = factory->QueryInterface(riid, ppv);
    factory->Release();
    return hr;
}

STDAPI DllCanUnloadNow() {
    /* Only unload when no object is alive. Answering TRUE while a text service
     * is still referenced would leave the host with a dangling vtable. */
    return (g_objectCount == 0 && g_serverLocks == 0) ? S_OK : S_FALSE;
}

STDAPI DllRegisterServer() {
    wchar_t path[MAX_PATH] = {0};
    GetModuleFileNameW(g_instance, path, MAX_PATH);
    HRESULT hr = pingzhu::tsf::registerComServer(path);
    /* The language profile needs HKLM write access; a non-elevated call fails
     * here with E_ACCESSDENIED, which the install script reports clearly rather
     * than pretending the registration worked. */
    if (SUCCEEDED(hr)) hr = pingzhu::tsf::registerProfiles();
    return hr;
}

STDAPI DllUnregisterServer() {
    pingzhu::tsf::unregisterProfiles();
    return pingzhu::tsf::unregisterComServer();
}
