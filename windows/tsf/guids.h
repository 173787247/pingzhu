/*
 * 平注 PingZhu — TSF text service: GUIDs.
 *
 * These are permanent. Changing any of them orphans every installation: Windows
 * keys the COM registration, the language profile and the category entries off
 * these values, and an existing profile pointing at a CLSID that no longer
 * resolves shows up in the language bar as a dead entry the user cannot remove
 * through the UI.
 */
#ifndef PINGZHU_TSF_GUIDS_H
#define PINGZHU_TSF_GUIDS_H

#include <initguid.h>

/* The text service object (the in-proc COM server's one class). */
/* {C2A55EB0-4391-4204-ABCF-4631BEA80A8F} */
DEFINE_GUID(CLSID_PingZhuTextService,
            0xc2a55eb0, 0x4391, 0x4204, 0xab, 0xcf, 0x46, 0x31, 0xbe, 0xa8, 0x0a, 0x8f);

/* The language profile: what appears in the language bar for zh-TW. A TIP can
 * expose several (注音, 倉頡, ...); we have one. */
/* {F5759A47-0422-4EA5-A64A-F8FFDCDBC0A1} */
DEFINE_GUID(GUID_PingZhuProfile,
            0xf5759a47, 0x0422, 0x4ea5, 0xa6, 0x4a, 0xf8, 0xff, 0xdc, 0xdb, 0xc0, 0xa1);

/* Display attribute: how the composing bopomofo is drawn in the document. */
/* {76DCF6F6-C27D-4CCD-9CC3-1ADEEEA5D138} */
DEFINE_GUID(GUID_PingZhuDisplayAttribute,
            0x76dcf6f6, 0xc27d, 0x4ccd, 0x9c, 0xc3, 0x1a, 0xde, 0xee, 0xa5, 0xd1, 0x38);

/* The language bar button. Distinct from the profile GUID: the profile is what
 * the language bar lists as an input method, this is the item attached to it. */
/* {ACA08321-C39E-4213-9346-5696E32B16E7} */
DEFINE_GUID(GUID_PingZhuLangBarItem,
            0x7ac196b6, 0x1230, 0x4572,
            0x91, 0x7b, 0x81, 0x8a, 0xc6, 0x51, 0xca, 0x4e);

/* {D7C42B11-849C-41EA-8A07-81BA1EAD7AB8} */
DEFINE_GUID(GUID_PingZhuRegisterTool,
            0xd7c42b11, 0x849c, 0x41ea, 0x8a, 0x07, 0x81, 0xba, 0x1e, 0xad, 0x7a, 0xb8);

/* Traditional Chinese, Taiwan. */
#define PINGZHU_LANGID 0x0404

#define PINGZHU_DESCRIPTION L"平注注音輸入法"
#define PINGZHU_DESCRIPTION_EN L"PingZhu Bopomofo"

#endif  // PINGZHU_TSF_GUIDS_H
