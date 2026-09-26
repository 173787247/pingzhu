#include "register.h"

#include <msctf.h>
#include <olectl.h>

#include <cstdio>
#include <cwchar>

#include "guids.h"

namespace pingzhu::tsf {

namespace {

constexpr const wchar_t *kClsidKey = L"SOFTWARE\\Classes\\CLSID\\{C2A55EB0-4391-4204-ABCF-4631BEA80A8F}";

HRESULT setString(HKEY root, const std::wstring &subKey, const wchar_t *name,
                  const std::wstring &value) {
    HKEY key = nullptr;
    LONG status = RegCreateKeyExW(root, subKey.c_str(), 0, nullptr, 0, KEY_WRITE | KEY_WOW64_64KEY,
                                  nullptr, &key, nullptr);
    if (status != ERROR_SUCCESS) {
        return HRESULT_FROM_WIN32(status);
    }
    status = RegSetValueExW(key, name, 0, REG_SZ,
                            reinterpret_cast<const BYTE *>(value.c_str()),
                            static_cast<DWORD>((value.size() + 1) * sizeof(wchar_t)));
    RegCloseKey(key);
    return HRESULT_FROM_WIN32(status);
}

void deleteTree(HKEY root, const std::wstring &subKey) {
    RegDeleteTreeW(root, subKey.c_str());
}

}  // namespace

HRESULT registerComServer(const std::wstring &dllPath) {
    std::wstring key = kClsidKey;
    HRESULT hr = setString(HKEY_LOCAL_MACHINE, key, nullptr, L"PingZhu Bopomofo Text Service");
    if (FAILED(hr)) return hr;
    hr = setString(HKEY_LOCAL_MACHINE, key + L"\\InprocServer32", nullptr, dllPath);
    if (FAILED(hr)) return hr;
    /* Apartment: TSF calls a text service on the thread that owns the focused
     * document, and we keep per-thread state (the candidate window). */
    return setString(HKEY_LOCAL_MACHINE, key + L"\\InprocServer32", L"ThreadingModel",
                     L"Apartment");
}

HRESULT unregisterComServer() {
    deleteTree(HKEY_LOCAL_MACHINE, kClsidKey);
    return S_OK;
}

HRESULT registerProfiles() {
    ITfInputProcessorProfiles *profiles = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_TF_InputProcessorProfiles, nullptr, CLSCTX_INPROC_SERVER,
                                  IID_ITfInputProcessorProfiles,
                                  reinterpret_cast<void **>(&profiles));
    if (FAILED(hr)) return hr;

    hr = profiles->Register(CLSID_PingZhuTextService);
    if (SUCCEEDED(hr)) {
        wchar_t dllPath[MAX_PATH] = {0};
        GetModuleFileNameW(nullptr, dllPath, MAX_PATH);
        hr = profiles->AddLanguageProfile(
            CLSID_PingZhuTextService, PINGZHU_LANGID, GUID_PingZhuProfile, PINGZHU_DESCRIPTION,
            static_cast<ULONG>(wcslen(PINGZHU_DESCRIPTION)), dllPath,
            static_cast<ULONG>(wcslen(dllPath)), 0);
        /* Re-registering an existing profile returns E_INVALIDARG on some
         * Windows versions; treat "already there" as success so running the
         * installer twice is not an error. */
        if (hr == E_INVALIDARG) hr = S_OK;
    }
    profiles->Release();
    if (FAILED(hr)) return hr;

    ITfCategoryMgr *categories = nullptr;
    hr = CoCreateInstance(CLSID_TF_CategoryMgr, nullptr, CLSCTX_INPROC_SERVER,
                          IID_ITfCategoryMgr, reinterpret_cast<void **>(&categories));
    if (FAILED(hr)) return hr;
    /* GUID_TFCAT_TIP_KEYBOARD is what makes it selectable as a keyboard input
     * method; without it the profile exists but never appears. */
    categories->RegisterCategory(CLSID_PingZhuTextService, GUID_TFCAT_TIP_KEYBOARD,
                                 CLSID_PingZhuTextService);
    categories->RegisterCategory(CLSID_PingZhuTextService, GUID_TFCAT_DISPLAYATTRIBUTEPROVIDER,
                                 CLSID_PingZhuTextService);
    categories->Release();
    return S_OK;
}

HRESULT unregisterProfiles() {
    ITfCategoryMgr *categories = nullptr;
    if (SUCCEEDED(CoCreateInstance(CLSID_TF_CategoryMgr, nullptr, CLSCTX_INPROC_SERVER,
                                   IID_ITfCategoryMgr, reinterpret_cast<void **>(&categories)))) {
        categories->UnregisterCategory(CLSID_PingZhuTextService, GUID_TFCAT_TIP_KEYBOARD,
                                       CLSID_PingZhuTextService);
        categories->UnregisterCategory(CLSID_PingZhuTextService,
                                       GUID_TFCAT_DISPLAYATTRIBUTEPROVIDER,
                                       CLSID_PingZhuTextService);
        categories->Release();
    }

    ITfInputProcessorProfiles *profiles = nullptr;
    if (SUCCEEDED(CoCreateInstance(CLSID_TF_InputProcessorProfiles, nullptr, CLSCTX_INPROC_SERVER,
                                   IID_ITfInputProcessorProfiles,
                                   reinterpret_cast<void **>(&profiles)))) {
        profiles->RemoveLanguageProfile(CLSID_PingZhuTextService, PINGZHU_LANGID,
                                        GUID_PingZhuProfile);
        profiles->Unregister(CLSID_PingZhuTextService);
        profiles->Release();
    }
    return S_OK;
}

HRESULT installLayoutOrTip(bool install) {
    HMODULE inputDll = LoadLibraryW(L"input.dll");
    if (!inputDll) return HRESULT_FROM_WIN32(GetLastError());
    using Fn = HRESULT(WINAPI *)(PCWSTR, DWORD);
    auto installFn = reinterpret_cast<Fn>(GetProcAddress(inputDll, "InstallLayoutOrTip"));
    if (!installFn) {
        FreeLibrary(inputDll);
        return E_NOTIMPL;
    }

    wchar_t clsidText[64] = {0};
    wchar_t profileText[64] = {0};
    StringFromGUID2(CLSID_PingZhuTextService, clsidText, 64);
    StringFromGUID2(GUID_PingZhuProfile, profileText, 64);

    /* "0404:{CLSID}{PROFILE}" — the layout-or-tip identifier format. */
    std::wstring spec = L"0404:";
    spec += clsidText;
    spec += profileText;

    const DWORD kIlorUninstall = 0x00000001;
    HRESULT hr = installFn(spec.c_str(), install ? 0 : kIlorUninstall);
    FreeLibrary(inputDll);
    return hr;
}

bool isRegistered() {
    HKEY key = nullptr;
    LONG status = RegOpenKeyExW(HKEY_LOCAL_MACHINE, kClsidKey, 0, KEY_READ | KEY_WOW64_64KEY,
                                &key);
    if (status != ERROR_SUCCESS) return false;
    RegCloseKey(key);

    ITfInputProcessorProfiles *profiles = nullptr;
    if (FAILED(CoCreateInstance(CLSID_TF_InputProcessorProfiles, nullptr, CLSCTX_INPROC_SERVER,
                                IID_ITfInputProcessorProfiles,
                                reinterpret_cast<void **>(&profiles)))) {
        return false;
    }
    BSTR description = nullptr;
    BOOL enabled = FALSE;
    HRESULT hr = profiles->GetLanguageProfileDescription(
        CLSID_PingZhuTextService, PINGZHU_LANGID, GUID_PingZhuProfile, &description);
    if (SUCCEEDED(hr) && description) {
        SysFreeString(description);
    }
    profiles->IsEnabledLanguageProfile(CLSID_PingZhuTextService, PINGZHU_LANGID,
                                       GUID_PingZhuProfile, &enabled);
    profiles->Release();
    return SUCCEEDED(hr);
}

bool isInLanguageList() {
    /* The list the Settings UI shows lives here, and the input method spec is the
     * *value name*, not the data:
     *
     *   [HKCU\Control Panel\International\User Profile\zh-Hant-TW]
     *   "0404:{CLSID}{PROFILE}"=dword:00000002
     *
     * Reading the data instead is an easy mistake and produces a confident "not
     * installed" while the input method sits in the language bar. */
    HKEY root = nullptr;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Control Panel\\International\\User Profile", 0,
                      KEY_READ, &root) != ERROR_SUCCESS) {
        return false;
    }

    wchar_t clsidText[64] = {0};
    StringFromGUID2(CLSID_PingZhuTextService, clsidText, 64);
    const std::wstring needle(clsidText);

    bool found = false;
    for (DWORD index = 0; !found; ++index) {
        wchar_t languageName[128] = {0};
        DWORD nameLength = 128;
        if (RegEnumKeyExW(root, index, languageName, &nameLength, nullptr, nullptr, nullptr,
                          nullptr) != ERROR_SUCCESS) {
            break;
        }
        HKEY language = nullptr;
        if (RegOpenKeyExW(root, languageName, 0, KEY_READ, &language) != ERROR_SUCCESS) continue;
        for (DWORD valueIndex = 0; !found; ++valueIndex) {
            wchar_t valueName[256] = {0};
            DWORD valueNameLength = 256;
            if (RegEnumValueW(language, valueIndex, valueName, &valueNameLength, nullptr, nullptr,
                              nullptr, nullptr) != ERROR_SUCCESS) {
                break;
            }
            if (std::wstring(valueName).find(needle) != std::wstring::npos) found = true;
        }
        RegCloseKey(language);
    }
    RegCloseKey(root);
    return found;
}

std::wstring describe(HRESULT hr) {
    if (hr == E_ACCESSDENIED) {
        return L"E_ACCESSDENIED — 需要系統管理員權限（登錄在 HKLM）";
    }
    switch (hr) {
        case S_OK: return L"S_OK";
        case E_INVALIDARG: return L"E_INVALIDARG";
        case E_OUTOFMEMORY: return L"E_OUTOFMEMORY";
        case E_FAIL: return L"E_FAIL";
        case E_NOTIMPL: return L"E_NOTIMPL";
        case CLASS_E_CLASSNOTAVAILABLE: return L"CLASS_E_CLASSNOTAVAILABLE";
        default: break;
    }
    wchar_t buffer[64];
    swprintf_s(buffer, L"HRESULT 0x%08lX", static_cast<unsigned long>(hr));
    return buffer;
}

}  // namespace pingzhu::tsf
