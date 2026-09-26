/*
 * The class factory. One COM class, created on demand.
 */
#ifndef PINGZHU_TSF_CLASS_FACTORY_H
#define PINGZHU_TSF_CLASS_FACTORY_H

#include <windows.h>
#include <unknwn.h>

#include <string>

class PingZhuClassFactory : public IClassFactory {
public:
    PingZhuClassFactory();

    /* IUnknown */
    STDMETHOD(QueryInterface)(REFIID riid, void **ppv) override;
    STDMETHOD_(ULONG, AddRef)() override;
    STDMETHOD_(ULONG, Release)() override;

    /* IClassFactory */
    STDMETHOD(CreateInstance)(IUnknown *pUnkOuter, REFIID riid, void **ppv) override;
    STDMETHOD(LockServer)(BOOL lock) override;

private:
    ~PingZhuClassFactory();
    LONG refCount_;
};

namespace pingzhu::tsf {
/* Object accounting, so DllCanUnloadNow can answer honestly. A server lock from
 * IClassFactory::LockServer counts too: a host that locks the server and then
 * releases its last object still intends to create more. */
void objectCreated();
void objectDestroyed();
void serverLocked(BOOL lock);
HINSTANCE moduleHandle();
std::wstring modulePath();
}  // namespace pingzhu::tsf

#endif  // PINGZHU_TSF_CLASS_FACTORY_H
