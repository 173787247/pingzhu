#include "class_factory.h"

#include <new>

#include "guids.h"
#include "text_service.h"

PingZhuClassFactory::PingZhuClassFactory() : refCount_(1) {}

PingZhuClassFactory::~PingZhuClassFactory() = default;

STDMETHODIMP PingZhuClassFactory::QueryInterface(REFIID riid, void **ppv) {
    if (!ppv) return E_INVALIDARG;
    *ppv = nullptr;
    if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, IID_IClassFactory)) {
        *ppv = static_cast<IClassFactory *>(this);
        AddRef();
        return S_OK;
    }
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) PingZhuClassFactory::AddRef() { return InterlockedIncrement(&refCount_); }

STDMETHODIMP_(ULONG) PingZhuClassFactory::Release() {
    LONG remaining = InterlockedDecrement(&refCount_);
    if (remaining == 0) delete this;
    return remaining;
}

STDMETHODIMP PingZhuClassFactory::CreateInstance(IUnknown *pUnkOuter, REFIID riid, void **ppv) {
    if (!ppv) return E_INVALIDARG;
    *ppv = nullptr;
    /* Aggregation is not supported, and saying so is required by the COM rules:
     * a factory that silently ignores pUnkOuter produces objects whose outer
     * IUnknown is not in control, which is a subtle lifetime bug. */
    if (pUnkOuter) return CLASS_E_NOAGGREGATION;

    auto *service = new (std::nothrow) pingzhu::tsf::TextService();
    if (!service) return E_OUTOFMEMORY;
    HRESULT hr = service->QueryInterface(riid, ppv);
    service->Release();
    return hr;
}

STDMETHODIMP PingZhuClassFactory::LockServer(BOOL lock) {
    pingzhu::tsf::serverLocked(lock);
    return S_OK;
}
