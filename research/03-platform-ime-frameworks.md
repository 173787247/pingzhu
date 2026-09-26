# 自研注音輸入法：四平台官方框架、API、上架與簽章限制研究

> 研究日期：2026-09-26
> 研究範圍：Windows / macOS / Android / HarmonyOS NEXT（鴻蒙 5+）
> 目標：確認「一套自研注音輸入法」在四個平台上要接哪個官方框架、API 名稱、上架與簽章限制、以及能做到什麼程度。

---

## 0. 閱讀說明：可信度標記

本報告嚴格區分三種陳述：

| 標記 | 含義 |
|---|---|
| **【已查證】** | 直接來自官方文件 / 官方原始碼 / 官方範例，並附完整 URL。 |
| **【推測】** | 基於已查證事實的工程推論，尚無官方明文。 |
| **【需查證】** | 我未能取得可信來源（多為需登入、SPA 動態載入或無公開文件），**不可當作結論使用**。 |

### 本次研究的工具限制（重要）

本次執行環境的 `web_search` 工具故障（DeepSeek 搜尋端點回傳未解壓的二進位 body，JSON 解析失敗；根因是本機 undici 大版本錯配，已在 `/home/rchua/GO/dsh-websearch-修复记录.md` 有完整診斷，需重啟 dsh 才會生效）。因此本報告改用：

- `web_fetch` / `curl`：抓取 Microsoft Learn、Apple Developer、Android Developers、Google Play Help、GitHub raw 等靜態站。
- **OpenHarmony 官方 docs repo（`raw.githubusercontent.com/openharmony/docs`）**：這是本次最重大的方法論突破 —— OpenHarmony 的 IME Kit 文件以純 Markdown 形式提供，內容與華為 `@kit.IMEKit` API 幾乎一致，且**可完整下載與本地檢索**。
- **Obscura（headless Chromium）**：用於華為 `developer.huawei.com` 這類 SPA 站。**成功率不穩定**（需載入大量動態腳本），成功時可取得內文。

失敗的來源：`web_search`（全掛）、DuckDuckGo / Mojeek（bot 驗證）、Bing（中文查詢回傳無關結果）、`developer.huawei.com` 多數頁面（SPA 逾時）。**因此華為側的「簽章 / AGC / 上架審核 / 側載」章節有較多【需查證】項，已逐項標明並附上應查證的官方 URL。**

---

## 1. 結論速覽

| 平台 | 官方框架 | 第三方可否自研 IME | 主要卡點 | 上架/散佈路徑 |
|---|---|---|---|---|
| **Windows** | Text Services Framework (TSF)，COM in-proc server | **可以**，完全開放 | COM 註冊 + 語言設定；需自行處理 TSF 複雜度 | 官網下載 / 商店皆可；建議程式碼簽章 |
| **macOS** | InputMethodKit (IMK) | **可以**，完全開放 | Info.plist 遺留 key 無現代官方文件；App Store 沙箱與 IME 安裝模型衝突 | 官網下載 + Developer ID 簽章 + **公證**（非 App Store 為主） |
| **Android** | `InputMethodService` | **可以**，完全開放 | 需引導使用者手動啟用與切換；Play targetSdk 36 | Google Play / F-Droid 皆可 |
| **HarmonyOS NEXT** | IME Kit（`InputMethodExtensionAbility` + `@ohos.inputMethodEngine`） | **框架明文支持三方輸入法**，但受「基礎訪問模式」安全管控與華為商業流程雙重約束 | ①基礎模式禁網路 ②簽章/AGC/上架流程 ③側載受限 | AppGallery（需實名認證；資質要求**【需查證】**） |

**一句話結論：**
Windows / macOS / Android 三平台技術上完全可行且路徑成熟（RIME 生態已證明）；**HarmonyOS NEXT 技術上可行（框架明文含「三方輸入法應用」），但它是四平台中唯一「技術可用 ≠ 商業可交付」的平台** —— 真正的難點不在 API，而在華為的簽章、上架與側載治理。

---

## 2. Windows：Text Services Framework (TSF)

### 2.1 框架定位【已查證】

> "Microsoft Windows Text Services Framework (TSF) is a system service available as a redistributable for Windows. TSF provides a simple and scalable framework for the delivery of advanced text input and natural language technologies. TSF can be enabled in applications, or as a TSF text service. A TSF text service provides multilingual support and delivers text services such as keyboard processors, handwriting recognition, and speech recognition."
> — https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework

> "Text Services Framework is designed for use by **Component Object Model (COM) programmers using the C/C++ programming languages**."
> 同頁

> "**Text service providers should provide digital signatures with their binary executables.**"
> 同頁（Windows 對 TSF 文字服務的簽章要求，原文用 "should"，非 "must"）

**關鍵含義**：TSF 文字服務是一個 **in-proc COM 伺服器**（DLL），不是獨立 exe。這對跨平台核心策略有直接影響（見第 6 節）。

### 2.2 核心介面【已查證】

| 介面 | 角色 | 關鍵成員 | 官方 URL |
|---|---|---|---|
| `ITfTextInputProcessor` | 文字服務實作此介面，TSF manager 用它啟用/停用服務。manager 以 `CoCreateInstance` 建立服務實例並取得此介面指標。 | `Activate`、`Deactivate` | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itftextinputprocessor |
| `ITfTextInputProcessorEx` | 擴充版，提供 `ActivateEx` | `ActivateEx` | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itftextinputprocessorex |
| `ITfThreadMgr` | TSF manager 的主要物件；應用與文字服務用它啟用/停用文字服務、建立 document manager、維護 document context focus。 | `Activate`、`Deactivate`、`CreateDocumentMgr`、`GetFocus`、`SetFocus`、`AssociateFocus`、`EnumDocumentMgrs`、`IsThreadFocus`、`GetGlobalCompartment`、`GetFunctionProvider`、`EnumFunctionProviders` | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfthreadmgr |
| `ITfKeyEventSink` | 文字服務實作此介面以接收鍵盤與焦點事件通知。**安裝方式：`ITfKeystrokeMgr::AdviseKeyEventSink`**。 | `OnKeyDown`、`OnKeyUp`、`OnTestKeyDown`、`OnTestKeyUp`、`OnSetFocus`、`OnPreservedKey` | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfkeyeventsink |
| `ITfThreadMgr2` / `ITfThreadMgrEx` | 較新版本，多了 `SuspendKeystrokeHandling` / `ResumeKeystrokeHandling` / `GetActiveFlags` | — | https://learn.microsoft.com/en-us/windows/desktop/api/msctf/nn-msctf-itfthreadmgr2 |
| `ITfInputProcessorProfiles` | **註冊用**：`Register`、`Unregister`、`AddLanguageProfile`、`RemoveLanguageProfile`、`EnableLanguageProfile`、`ActivateLanguageProfile`、`EnumLanguageProfiles` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfinputprocessorprofiles |
| `ITfInputProcessorProfileMgr` | 較新的 profile 註冊介面：`RegisterProfile`、`UnregisterProfile` | — | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfinputprocessorprofilemgr |
| `ITfCategoryMgr` | 註冊服務類別：`RegisterCategory`、`UnregisterCategory`、`RegisterGUID` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcategorymgr |
| `ITfComposition` / `ITfContextComposition` | 組字（composition）管理：`StartComposition`、`EndComposition`、`GetRange`、`ShiftStart`、`ShiftEnd` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcomposition |
| `ITfRange` / `ITfRangeACP` | 文字範圍操作：`SetText`、`GetText`、`Collapse`、`ShiftStart`、`ShiftEnd` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfrange |
| `ITfUIElementMgr` / `ITfCandidateListUIElement` | 候選字 UI 元素註冊（讓輔助技術能讀取候選視窗）：`BeginUIElement`、`UpdateUIElement`、`EndUIElement`；候選清單：`GetCount`、`GetString`、`GetSelection`、`SetPageIndex` | 對**無障礙支援**很重要 | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcandidatelistuielement |
| `ITfFnSearchCandidateProvider` | 候選搜尋（供系統整合） | `GetSearchCandidates`、`SetResult` | https://learn.microsoft.com/en-us/windows/desktop/api/Ctffunc/nn-ctffunc-itffnsearchcandidateprovider |
| `ITfDisplayAttributeProvider` / `ITfDisplayAttributeInfo` | 自訂組字顯示樣式（底線、顏色等） | `EnumDisplayAttributeInfo`、`GetDisplayAttributeInfo` | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfdisplayattributeprovider |
| `ITfFunctionProvider` / `ITfFunction` | 提供額外功能（如 `ITfFnReconversion` 重新轉換） | `GetFunction`、`GetType`、`GetDisplayName` | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itffunctionprovider |

TSF 完整介面清單（TOC）：https://learn.microsoft.com/en-us/windows/win32/tsf/toc.json

### 2.3 取得 `ITfThreadMgr` 與生命週期【已查證】

官方範例（來自 `ITfThreadMgr` 頁面「Remarks」）：

```cpp
HRESULT hr;
ITfThreadMgr* pThreadMgr;

hr = CoCreateInstance(  CLSID_TF_ThreadMgr,
                        NULL,
                        CLSCTX_INPROC_SERVER,
                        IID_ITfThreadMgr,
                        (void**)&pThreadMgr);
```

**關鍵**：
- **應用端**：用 `CoCreateInstance(CLSID_TF_ThreadMgr, ...)` 取得 `ITfThreadMgr`。
- **文字服務端**：**不是自己 CoCreate**，而是在 `ITfTextInputProcessor::Activate` 方法中**收到** manager 傳入的 `ITfThreadMgr` 指標。
- 對應的 `ITfTextInputProcessor::Activate` / `Deactivate` 是服務的進入點/離開點。

### 2.4 註冊流程（安裝第三方 IME 的核心）【已查證】

> "In addition to the standard COM in-proc server registry entries, a text service must register itself with the Text Services Framework (TSF) so that it can be available for use with an application. TSF supplies the `ITfInputProcessorProfiles` and `ITfCategoryMgr` interface to simplify the registration process."
> — https://learn.microsoft.com/en-us/windows/win32/tsf/text-service-registration

三步驟（同頁）：

1. **註冊文字服務本體**：`CoCreateInstance(CLSID_TF_InputProcessorProfiles, NULL, CLSCTX_INPROC_SERVER, IID_ITfInputProcessorProfiles, ...)` 取得介面，再呼叫 `ITfInputProcessorProfiles::Register(clsidTextService)`。
   官方範例：
   ```cpp
   BOOL RegisterTextService(CLSID clsidTextService)
   {
       HRESULT hr;
       ITfInputProcessorProfiles *pInputProcessProfiles;

       hr = CoCreateInstance(  CLSID_TF_InputProcessorProfiles,
                               NULL,
                               CLSCTX_INPROC_SERVER,
                               IID_ITfInputProcessorProfiles,
                               (LPVOID*)&pInputProcessProfiles);
       if (hr != S_OK) { return FALSE; }

       hr = pInputProcessProfiles->Register(clsidTextService);
       pInputProcessProfiles->Release();
       return (S_OK == hr);
   }
   ```
2. **註冊語言設定檔（必要！）**：
   > "A text service is only available when an application has the focus and **the proper language is selected in the language bar**. To facilitate this, TSF requires that a text service register itself for all of the languages that it supports."
   呼叫 `ITfInputProcessorProfiles::AddLanguageProfile`，傳入「文字服務 CLSID + language identifier + 服務自訂的 profile GUID」。
   → **注音輸入法必須註冊 `zh-TW`（繁體中文／台灣）語言設定檔**，否則使用者無法在語言列選到它。
   移除：`RemoveLanguageProfile`；卸載：`Unregister`（會移除該服務所有語言設定檔）。
3. **註冊類別**：`ITfCategoryMgr::RegisterCategory(clsid, GUID_TFCAT_*, clsid)`。例如提供顯示屬性的服務要註冊為 `GUID_TFCAT_DISPLAYATTRIBUTEPROVIDER`。可用類別見 https://learn.microsoft.com/en-us/windows/win32/tsf/predefined-category-values

另有較新的 `ITfInputProcessorProfileMgr::RegisterProfile`：https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itfinputprocessorprofilemgr-registerprofile

### 2.5 TSF vs IMM32【已查證】

IMM32（Input Method Manager）：

> "Input Method Manager (IMM) is a technology used by an application to communicate with an input method editor (IME), which runs as a service. The IME allows computer users to enter complex characters and symbols, such as Japanese kanji characters, by using a standard keyboard. This section describes the IMM API and explains how to use the functionality to create and manage IME windows."
> — https://learn.microsoft.com/en-us/windows/win32/intl/input-method-manager

| 面向 | IMM32（舊） | TSF（新，XP 以後） |
|---|---|---|
| 架構 | 應用 ↔ IME 以視窗訊息溝通；IME 提供 UI 視窗 | COM 服務；應用與服務都接同一個 framework |
| 開發語言 | C（Win32 API） | **C++ / COM**（官方明文） |
| 組字（composition） | 由 IME 自己維護 | 有正式的 composition / range / edit session 模型 |
| 顯示樣式 | IME 自繪 | `ITfDisplayAttributeProvider` 可與應用整合 |
| 無障礙 | 弱 | `ITfUIElementMgr` / `ITfCandidateListUIElement` |
| 現況 | 仍存在（相容層） | **新開發應選 TSF** |

【推測】對新專案：**選 TSF**。IMM32 仍被系統保留以相容舊 IME，但官方新文件教學都以 TSF 為主，且 TSF 才能與現代應用（含 UWP/WinUI）正常互動。

### 2.6 使用者如何安裝與啟用【已查證】

官方「How To Set Up Text Services Framework」描述的是使用者端流程（文件較舊，以 Windows XP 的 UI 用語描述，但概念沿用至 Windows 11 的「語言與地區 / 進階鍵盤設定」）：

1. 控制台 → **Regional and Language Options** → Languages 頁 → **Details**。
2. 在 **Text Services and Input Languages** 視窗的 Settings 頁 → **Add** → 選擇想要的 text service。選中的服務會出現在對應語言之下。
3. 移除：選取後按 **Remove**。
4. 語言列（Language Bar）右鍵 → **Settings** 也可快速增減。
5. 驗證 TSF 是否運作：工作管理員中應有 **`ctfmon.exe`** 程序。

URL：https://learn.microsoft.com/en-us/windows/win32/tsf/how-to-set-up-tsf

【推測】對自研 IME 的含義：
- 安裝程式必須做**兩件事**：① 註冊 COM in-proc server（DLL 的 `DllRegisterServer` 或自建註冊邏輯）② 呼叫 TSF 註冊 API 建立 language profile。
- 使用者仍需**手動**到設定中把該輸入法加入/啟用 —— 應用無法靜默設定自己為預設輸入法。
- 參考實作：**小狼毫 Weasel** 的安裝程式會顯示「安裝選項」對話框，讓使用者選擇要註冊到哪個輸入語言（例如「中文（臺灣）」），安裝後仍可從開始選單重新開啟該對話框變更輸入語言。
  https://github.com/rime/weasel （README 明載：「若要將【小狼毫】註冊到繁體中文（臺灣）鍵盤佈局，請在「輸入語言」欄選擇「中文（臺灣）」」；適用 Windows 8.1 ~ Windows 11）

### 2.7 簽章需求（EV 憑證？）【已查證 + 推測】

**已查證**：
- TSF 官方文件只說 "Text service providers **should** provide digital signatures with their binary executables."（should，非 must），並連到 "Introduction to Code Signing"。
  https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework
- Windows SmartScreen 會檢查下載程式的**數位簽章與憑證信譽**：
  > "It also provides reputation checks for apps, checking downloaded programs and **the digital signature used to sign a file**. If a URL, a file, an app, or a certificate has an established reputation, users don't see any warnings. If there's no reputation, the item is marked as a hi[gh risk]…"
  https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/

**結論**：
- **Windows 沒有強制 TSF 輸入法必須用 EV 憑證的官方規定**【已查證：文件中查無此要求】。
- **但實務上**：未簽章或憑證無信譽的安裝檔會被 SmartScreen 攔阻（「Windows 已保護您的電腦」）。標準做法是 OV 或 **EV 程式碼簽章憑證**；EV 憑證可較快累積 SmartScreen 信譽。【推測 —— 微軟現行 SmartScreen 對 EV 的加速機制細節需查證】

### 2.8 Windows 11/12 對 IME 的限制、與「Microsoft 限制非市集 IME」政策

- **【已查證：查無此政策】** 我未能在 Microsoft 官方文件中找到任何「限制非 Microsoft Store 來源輸入法」的規定。TSF 文件至今（最後更新 2022-05-10）仍公開描述第三方文字服務的註冊流程；RIME 小狼毫明確支援 Windows 11 並持續發佈（見 2.6）。
- **【已查證】** 值得注意的**趨勢性限制**（非針對 IME 的封鎖，但會影響體驗）：
  - 新版 Windows 的 **UWP / WinUI / 部分系統介面** 對舊式 IMM32 IME 支援較差 → 這是「選 TSF 而非 IMM32」的主要理由。【推測：具體清單需查證】
  - **Windows 11 對「語言與地區」設定 UI 重新設計**後，加入輸入法的路徑與舊文件用語不同。【需查證：需要 Windows 11 專版的官方安裝說明】
- **【需查證】** 我無法查證「Windows 12」是否存在官方 IME 限制政策。截至 2026-09，我未取得任何 Windows 12 的官方開發者文件。**建議不要把 Windows 12 列入規劃前提。**

---

## 3. macOS：InputMethodKit (IMK)

### 3.1 框架定位【已查證】

> "Develop input methods and manage communication with client applications, candidates windows, and input method modes."
> — https://developer.apple.com/documentation/inputmethodkit

InputMethodKit 官方文件揭露的完整符號集（共 3 個 class、3 個 protocol、3 個 reference 群組）：

| 類型 | 符號 |
|---|---|
| Classes | `IMKCandidates`、`IMKInputController`、`IMKServer` |
| Protocols | `IMKMouseHandling`、`IMKServerInput`、`IMKStateSetting` |
| Reference | Enumerations、Constants、Data Types |

### 3.2 API 對照表【已查證，逐字核對 Apple 官方 JSON】

#### `IMKServer`

| 成員 | 用途 |
|---|---|
| `init(name:bundleIdentifier:)` | 初始化 server |
| `init(name:controllerClass:delegateClass:)` | 初始化 server 並指定 controller / delegate class |
| `bundle()` | 取得輸入法的 bundle |
| `lastKeyEventWasDeadKey()` | 上一個按鍵是否為 dead key |
| `paletteWillTerminate()` | palette 即將結束 |

> ⚠️ **重要更正**：任務描述中提到的 `init(name:bundleIdentifier:controllerClass:delegateClass:)` **不存在**。Apple 官方只有上面兩個 initializer（二參數與三參數，各自獨立），**沒有四參數版本**。
> — https://developer.apple.com/documentation/inputmethodkit/imkserver

#### `IMKInputController`

| 分類 | 成員 |
|---|---|
| Initializing | `init(server:delegate:client:)` |
| Working with Ranges | `compositionAttributes(at:)`、`selectionRange()`、`replacementRange()`、`mark(forStyle:at:)` |
| Managing the Delegate | `delegate()`、`setDelegate(_:)` |
| Getting Client and Server | `server()`、`client()` |
| Tracking Selections | `annotationSelected(_:forCandidate:)`、`candidateSelectionChanged(_:)`、`candidateSelected(_:)` |
| Managing Composition | `updateComposition()`、`cancelComposition()` |
| Hiding the UI | `hidePalettes()` |
| Custom Commands | `doCommand(by:command:)`、`menu()` |
| Instance Methods | `inputControllerWillClose()` |

> ⚠️ **重要澄清**：`handle(_:client:)`、`inputText(_:client:)`、`setMarkedText(...)`、`commitComposition(_:)`、`candidates(_:)`、`activateServer(_:)`、`deactivateServer(_:)` **都不在 `IMKInputController` 的文件中** —— 它們來自 `IMKInputController` 所 conform 的 protocol（見下）。
> — https://developer.apple.com/documentation/inputmethodkit/imkinputcontroller

#### `IMKServerInput`（協定）— 這是真正處理輸入事件的地方【已查證】

| 分類 | 成員 |
|---|---|
| Supporting Key Binding | `inputText(_:client:)`、`didCommand(by:client:)` |
| Unpacking Text Data | `inputText(_:key:modifiers:client:)` |
| Receiving Events Directly from TSM | `handle(_:client:)` |
| Committing a Composition | `commitComposition(_:)` |
| Getting Input Strings and Candidates | `composedString(_:)`、`originalString(_:)`、`candidates(_:)` |

> — https://developer.apple.com/documentation/inputmethodkit/imkserverinput

#### `IMKStateSetting`（協定）【已查證】

| 分類 | 成員 |
|---|---|
| Activating / Deactivating | `activateServer(_:)`、`deactivateServer(_:)` |
| Preferences | `showPreferences(_:)` |
| Supported Events | `recognizedEvents(_:)` |
| Mode Dictionary | `modes(_:)` |
| Getting / Setting Values | `value(forTag:client:)`、`setValue(_:forTag:client:)` |

> — https://developer.apple.com/documentation/inputmethodkit/imkstatesetting

#### `IMKMouseHandling`（協定）【已查證】

`mouseDown(onCharacterIndex:coordinate:withModifier:continueTracking:client:)`、`mouseUp(onCharacterIndex:coordinate:withModifier:client:)`、`mouseMoved(onCharacterIndex:coordinate:withModifier:client:)`
> — https://developer.apple.com/documentation/inputmethodkit/imkmousehandling

#### `IMKCandidates`【已查證】

| 分類 | 成員 |
|---|---|
| Initializing | `init(server:panelType:)`、`init(server:panelType:styleType:)` |
| Selection Keys | `setSelectionKeys(_:)`、`selectionKeys()`、`setSelectionKeysKeylayout(_:)`、`selectionKeysKeylayout()` |
| Visibility / Behavior | `show(_:)`、`hide()`、`isVisible()`、`setDismissesAutomatically(_:)`、`dismissesAutomatically()`、`update()` |
| Window Type / Attributes | `panelType()`、`setPanelType(_:)`、`setAttributes(_:)`、`attributes()` |
| Annotation | `showAnnotation(_:)` |
| Sub-lists / Children | `showSublist(_:subListDelegate:)`、`attachChild(_:toCandidate:type:)`、`detachChild(_:)`、`showChild()`、`hideChild()`、`clearSelection()` |
| Query / Select | `selectedCandidate()`、`selectedCandidateString()`、`selectCandidate(_:)`、`selectCandidate(withIdentifier:)`、`candidateIdentifier(atLineNumber:)`、`candidateStringIdentifier(_:)`、`lineNumberForCandidate(withIdentifier:)`、`setCandidateData(_:)`、`candidateFrame()`、`setCandidateFrameTopLeft(_:)` |
| Constants | `IMKCandidatePanelType`、`IMKCandidatesLocationHint` |

> — https://developer.apple.com/documentation/inputmethodkit/imkcandidates

#### InputMethodKit Constants【已查證】

`IMKCandidatesOpacityAttributeName`、`IMKCandidatesSendServerKeyEventFirst`、`IMKControllerClass`、`IMKDelegateClass`、`IMKModeDictionary`
> — https://developer.apple.com/documentation/inputmethodkit/inputmethodkit-constants

#### `IMKTextInput`

**【需查證】** Apple 現行 InputMethodKit 文件**未列出 `IMKTextInput`**（framework 符號表中沒有這個 protocol）。但 `IMKInputController.client()` 回傳的物件在實務上就是 client 端的 text input 物件。
→ **不要憑記憶寫 `IMKTextInput` 的方法名**，需以 Xcode SDK header（`IMKInputController.h` / `IMKTextInput.h`）實地核對。

#### `IMKInputSession`

**【需查證】** Apple 公開文件中**查無** `IMKInputSession` 的類別文件。**【推測】** 它可能是私有或未文件化的型別。**不要依賴它。**

### 3.3 Info.plist：輸入法 bundle 的必要 key

**【重要發現】** Apple 現行官方文件中的 "Info Dictionary Keys" 頁面（https://developer.apple.com/documentation/inputmethodkit/info-dictionary-keys ）**只記載兩個常數**：`kIMKCommandMenuItemName`、`kIMKCommandClientName`。

也就是說：**`tsInputModeListKey`、`ComponentInputModeDict` 這批關鍵 key 已經沒有現代 Apple 官方文件**。它們屬於舊的 Text Services Manager (TSM) 時代詞彙，但仍**必須**存在，否則系統不會把輸入法正確註冊到輸入源清單。

**實證來源**：小麥注音 McBopomofo（開源注音輸入法，實際發行）的 `Info.plist`。
https://raw.githubusercontent.com/openvanilla/McBopomofo/master/Source/McBopomofo-Info.plist

實際使用的 key（逐字，來自上列檔案）：

| Key | 層級 | 實例值 | 說明 |
|---|---|---|---|
| `InputMethodConnectionName` | 頂層 | `McBopomofo_1_Connection` | 對應 `IMKServer` 的 `name` |
| `InputMethodServerControllerClass` | 頂層 | `McBopomofoInputMethodController` | 對應 `IMKServer` 的 `controllerClass` |
| `InputMethodServerDelegateClass` | 頂層 | `McBopomofoInputMethodController` | 對應 `delegateClass` |
| `InputMethodServerPreferencesWindowControllerClass` | 頂層 | `PreferencesWindowController` | 偏好設定視窗 |
| `ComponentInputModeDict` | 頂層 dict | — | 容器，內含下面兩項 |
| `tsInputModeListKey` | `ComponentInputModeDict` 內 | dict of dict | **每個輸入模式一個 dict，key 是 `TISInputSourceID`** |
| `tsVisibleInputModeOrderedArrayKey` | `ComponentInputModeDict` 內 | array | 選單中顯示順序 |
| `TISInputSourceID` | 每個模式 | `org.openvanilla.inputmethod.McBopomofo.Bopomofo` | 輸入源唯一 ID |
| `TISIntendedLanguage` | 每個模式 | `zh-Hant` | **注音應填 `zh-Hant`（繁中）** |
| `tsInputModeScriptKey` | 每個模式 | `smTradChinese` | Script manager 代碼（繁中） |
| `tsInputModePrimaryInScriptKey` | 每個模式 | `<true/>` | 是否為該 script 的主要輸入法 |
| `tsInputModeIsVisibleKey` | 每個模式 | `<true/>` | 是否顯示於選單 |
| `tsInputModeDefaultStateKey` | 每個模式 | `<true/>` | 預設狀態 |
| `tsInputModeMenuIconFileKey` | 每個模式 | `Bopomofo.tiff` | 選單圖示檔名 |
| `tsInputModePaletteIconFileKey` | 每個模式 | `Bopomofo.tiff` | Palette 圖示 |
| `tsInputModeAlternateMenuIconFileKey` | 每個模式 | `Bopomofo.tiff` | 替代選單圖示 |
| `tsInputModeCharacterRepertoireKey` | 每個模式 | `["Hant","Han"]` | 字集 |
| `tsInputModeKeyEquivalentModifiersKey` | 每個模式 | `4608` | 切換快速鍵 modifier |
| `tsInputMethodCharacterRepertoireKey` | 頂層 | — | 字集（頂層） |
| `tsInputMethodIconFileKey` | 頂層 | — | 圖示（頂層） |
| `TICapsLockLanguageSwitchCapable` | 頂層 | — | Caps Lock 切換語言 |
| `TISParticipatesInTouchBar` | 頂層 | — | Touch Bar 支援 |
| `TISDoubleSpaceSubstitution` | 每個模式 | `。` | 連按兩下空白鍵替換字元（中文輸入法關鍵體驗） |
| `LSUIElement` | 頂層 | — | 不在 Dock 顯示（IME 必備） |

**【推測】** 一份最小可用的注音輸入法 Info.plist 骨架：
```xml
<key>InputMethodConnectionName</key><string>MyBopomofo_1_Connection</string>
<key>InputMethodServerControllerClass</key><string>MyBopomofoController</string>
<key>InputMethodServerDelegateClass</key><string>MyBopomofoController</string>
<key>LSUIElement</key><true/>
<key>ComponentInputModeDict</key>
<dict>
  <key>tsInputModeListKey</key>
  <dict>
    <key>com.example.inputmethod.MyBopomofo.Bopomofo</key>
    <dict>
      <key>TISIntendedLanguage</key><string>zh-Hant</string>
      <key>tsInputModeScriptKey</key><string>smTradChinese</string>
      <key>tsInputModePrimaryInScriptKey</key><true/>
      <key>tsInputModeIsVisibleKey</key><true/>
      <key>tsInputModeDefaultStateKey</key><true/>
      <key>TISDoubleSpaceSubstitution</key><string>。</string>
    </dict>
  </dict>
  <key>tsVisibleInputModeOrderedArrayKey</key>
  <array><string>com.example.inputmethod.MyBopomofo.Bopomofo</string></array>
</dict>
```
> 此骨架是**推測**（依 McBopomofo 實例裁剪），**必須以實機測試驗證**。

### 3.4 安裝方式與實例【已查證】

| 專案 | 安裝方式 | 目標位置 | 簽章/公證 | App Store |
|---|---|---|---|---|
| **Squirrel 鼠鬚管**（RIME） | `make package` 產生安裝包；或 `brew install squirrel-app` | `Squirrel.app`（安裝包安裝） | `make package` 時設 `DEV_ID` 自動簽章與公證；憑證用 `xcrun notarytool store-credentials` 存 | **不在** |
| **McBopomofo 小麥注音**（注音！） | Xcode 開 `McBopomofo.xcodeproj`，build **"McBopomofo Installer" target** 後執行安裝程式 | Installer 安裝 | 【需查證：簽章細節】 | **不在** |
| 小企鵝 fcitx5-macos | 第三方，需下載中州韻版安裝器 | — | — | 不在 |

來源：
- https://github.com/rime/squirrel/blob/master/INSTALL.md
- https://rime.im/download/
- https://github.com/openvanilla/McBopomofo （README）

**Squirrel INSTALL.md 原文要點**【已查證】：
> "Define `DEV_ID` to automatically handle code signing and notarization (Apple Developer ID needed)"
> "To make notarization work, you also need to save your credential under the same name as above: `xcrun notarytool store-credentials 'your name/org'`"
> "You **don't** need to define DEV_ID if you don't intend to distribute the package."
> 直接安裝（`make install`）："**You might need to precede with sudo, and without a logout, the App might not work properly. Direct install is not very recommended.**"

**McBopomofo README 原文要點**【已查證】：
> 系統需求：macOS 13 以上（執行）；開發需要 **macOS 26 / Xcode 26** 或更高。
> 「第一次安裝完，日後程式碼或詞庫有任何修改，只要重複上述流程，再次安裝小麥注音即可。」
> 「macOS 可能會限制同一次 login session 能 kill 同一個輸入法 process 的次數（安裝程式透過 kill input method process 來讓新版的輸入法生效）。如果安裝若干次後，發現程式修改的結果並沒有出現…只要**登出目前帳號再重新登入**即可。」
> → **實務含意**：macOS 不會自動重新載入已被系統快取的 IME process；開發迭代需要 kill process 或登出。

### 3.5 沙箱、公證與 App Store【已查證】

#### App Store Review Guidelines 2.4.5（逐字，原文）

> **2.4.5** Apps distributed via the Mac App Store have some additional requirements to keep in mind:
> **(i)** They must be **appropriately sandboxed**, and follow macOS File System Documentation. They should also only use the appropriate macOS APIs for modifying user data stored by other apps (e.g. bookmarks, Address Book, or Calendar entries).
> **(ii)** They must be packaged and submitted using technologies provided in **Xcode**; **no third-party installers allowed**. They must also be **self-contained, single app installation bundles** and **cannot install code or resources in shared locations**.
> **(iii)** They may not auto-launch or have other code run automatically at startup or login without consent nor spawn processes that continue to run without consent after a user has quit the app. They should not automatically add their icons to the Dock or leave shortcuts…
> — https://developer.apple.com/app-store/review/guidelines/ （§2.4.5）

#### 對輸入法的含意

| 條款 | 對 IME 的衝擊 |
|---|---|
| 2.4.5(i) 必須沙箱 | 輸入法需要跨 process 與前台 app 互動（`IMKTextInput` 注入文字）。**【推測】** 沙箱與 IMK 的注入模型存在根本張力。 |
| 2.4.5(ii) 不得安裝到 shared location、必須單一 bundle | 傳統 IME 安裝到 `/Library/Input Methods/`（shared location）或 `~/Library/Input Methods/`。InstallScript 安裝 `.pkg` 到 `/Library` 屬 shared location。 |
| 2.4.5(iii) 不得未經同意常駐 | IME 本質上就是常駐服務（每個 client app 一個 input session）。 |

**【已查證的事實】**：**Squirrel 與 McBopomofo 這兩個最活躍的開源中文輸入法，都不在 Mac App Store 發行**（Squirrel 用 GitHub release + Homebrew；McBopomofo 用 GitHub release + 自製 Installer pkg）。

**【推測（高信心）】**：**自研注音輸入法的 macOS 發行路徑應為「官網 / GitHub 下載 + Developer ID 簽章 + Apple 公證」，而非 Mac App Store。** 理由：2.4.5(i)(ii) 與 IME 的安裝/注入模型直接衝突，且業界兩個主要先例都選擇站外散佈。
> **【需查證】** 是否有 IME 成功上架 Mac App Store 的案例（例如某些日文/簡中输入法）。若有，其沙箱配置值得研究。我未能查證。

#### 公證（Notarization）【已查證】

> "Notarize your macOS software to give users more confidence that the Developer ID-signed software you distribute has been checked by Apple for malicious components. **Notarization of macOS software is not App Review.** The Apple notary service is an automated system that scans your software for malicious content, checks for code-signing issues, and returns the results to you quickly. If there are no issues, the notary service generates a ticket for you to staple to your software…"
> "Starting **November 1, 2023**, the Apple notary service **no longer accepts uploads from `altool` or Xcode 13 or earlier**. … you need to transition to the **`notarytool`** command-line utility or upgrade to Xcode 14 or later."
> — https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution

**重點**：
- 公證 ≠ App Review，是自動化惡意軟體掃描 + 簽章檢查。
- 產出 ticket，可 staple 到軟體；Gatekeeper 據此決定是否顯示警告。
- 現在**必須**用 `notarytool`（`altool` 自 2023-11-01 起被拒）。
- 可公證的交付型態包含：macOS apps、non-app bundles（如 kext）、**UDIF 磁碟映像**、**flat installer packages**。→ 對 IME 的 `.pkg`/`.dmg` 散佈路徑友善。

### 3.6 macOS 26 有無新版輸入法 API

**【已查證：查無】** 我未能在 Apple 官方文件中找到 macOS 26（Tahoe）針對 InputMethodKit 的新 API、新 protocol 或 deprecation 公告。InputMethodKit 的符號集仍是 3 classes + 3 protocols。

**【已查證的側面證據】**：McBopomofo 對**開發環境**要求 macOS 26 / Xcode 26，但**執行環境**只要 macOS 13+ —— 表示 macOS 26 並未帶來破壞性的 IME API 變更。

**【需查證】** WWDC 2025 / WWDC 2026 是否有 InputMethodKit session。我無法查證（Apple session 影片頁為 JS 渲染且我沒有可用的搜尋引擎）。
→ **建議**：開發前用 Xcode 26 SDK 的 `IMKInputController.h` / `IMKCandidates.h` header 做一次 header diff，這是最可靠的「有無新增 API」判定法。

---

## 4. Android：InputMethodService

### 4.1 生命週期與核心類別【已查證（AOSP 原始碼 + 官方文件）】

`android.inputmethodservice.InputMethodService`

官方類別說明（AOSP master 原始碼 javadoc，逐字）：
> "InputMethodService provides a standard implementation of an InputMethod, which final implementations can derive from and customize. See the base class `AbstractInputMethodService` and the `InputMethod` interface for more information…"
> "In addition to the normal Service lifecycle methods, this class introduces some new specific callbacks that most subclasses will want to make use of:
> - `onInitializeInterface()` for user-interface initialization, in particular to deal with configuration changes while the service is running.
> - `onBindInput()` to find out about switching to a new client.
> - `onStartInput(EditorInfo, boolean)` to deal with an input session starting with the client.
> - `onCreateInputView()`, `onCreateCandidatesView()`, and `onCreateExtractTextView()` for non-demand generation of the UI.
> - `onStartInputView(EditorInfo, boolean)` to deal with input starting within the input area of the IME."

來源：
- https://developer.android.com/reference/android/inputmethodservice/InputMethodService
- AOSP 原始碼：`core/java/android/inputmethodservice/InputMethodService.java`（https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/inputmethodservice/InputMethodService.java）

| 成員 | 時機 | 用途 |
|---|---|---|
| `onCreate()` | Service 首次建立 | 初始化 |
| `onInitializeInterface()` | 建立時 / 設定變更 | UI 初始化，處理旋轉等 configuration change |
| `onBindInput()` | 切換到新 client | 取得 `InputBinding` |
| `onStartInput(EditorInfo, boolean restarting)` | 輸入連線開始 | 讀取 `EditorInfo`（inputType、imeOptions、packageName…） |
| `onCreateInputView()` | 需要輸入區域 UI 時（一次） | **回傳軟鍵盤 View 階層** |
| `onCreateCandidatesView()` | 需要候選 UI 時（一次） | 回傳候選字 View 階層，預設 `null` |
| `onCreateExtractTextView()` | 全螢幕模式 | 回傳抽取文字編輯器 |
| `onStartInputView(EditorInfo, boolean)` | 輸入區域開始 | view 專屬設定 |
| `onFinishInputView(boolean)` / `onFinishInput()` | 結束 | 收尾 |
| `onUpdateSelection(...)` | 選取範圍變動 | 更新組字狀態 |
| `onUpdateCursorAnchorInfo(CursorAnchorInfo)` | 游標位置變動 | **取代已 deprecated 的 `onUpdateCursor(Rect)`** |
| `onUpdateEditorToolType(int)` | 使用者以筆/觸控點擊 | **取代已 deprecated 的 `onViewClicked(boolean)`**（API 29） |
| `onEvaluateInputViewShown()` | 是否顯示輸入區域 | 預設依硬體鍵盤有無決定 |
| `onEvaluateFullscreenMode()` | 是否全螢幕 | — |
| `onComputeInsets(Insets)` | 計算 UI insets | **Android 15+ edge-to-edge 下更關鍵** |
| `onCurrentInputMethodSubtypeChanged(...)` | 子類型切換 | 注音/拼音切換 |
| `onCreateInlineSuggestionsRequest(Bundle)` | Autofill 要求 inline suggestion | 與候選字**不同**的機制 |
| `setCandidatesViewShown(boolean)` | 執行期 | 控制候選區顯示 |
| `setCandidatesView(View)` / `setInputView(View)` | 執行期 | 動態替換 |

`android.view.inputmethod.InputMethodManager`：
- `showSoftInput()`、`hideSoftInputFromWindow()`、`showInputMethodPicker()`、`getInputMethodList()`、`setInputMethod()`
- 官方文件：https://developer.android.com/reference/android/view/inputmethod/InputMethodManager

`InputConnection`（IME → app 的文字操作）：
- `commitText()`、`setComposingText()`、`finishComposingText()`、`deleteSurroundingText()`、`sendKeyEvent()`、`getCursorCapsMode()`、`performEditorAction()`
- 官方文件：https://developer.android.com/reference/android/view/inputmethod/InputConnection

Manifest 必要宣告【已查證，官方 IME 開發指南】：
```xml
<service android:name=".MyInputMethod"
         android:label="@string/ime_name"
         android:permission="android.permission.BIND_INPUT_METHOD"
         android:exported="true">
    <intent-filter>
        <action android:name="android.view.InputMethod" />
    </intent-filter>
    <meta-data android:name="android.view.im"
               android:resource="@xml/method" />
</service>
```
`res/xml/method.xml`：
```xml
<input-method xmlns:android="http://schemas.android.com/apk/res/android">
    <subtype android:label="@string/subtype_zhuyin"
             android:imeSubtypeLocale="zh_TW"
             android:imeSubtypeMode="keyboard"
             android:isAsciiCapable="true" />
</input-method>
```
（`android:imeSubtypeLocale`、`android:imeSubtypeMode`、`android:isAsciiCapable` 逐字來自官方指南）

官方指南：https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method

### 4.2 候選字視窗：⚠️ 更正一個常見誤解

**任務描述假設「CandidatesView 已 deprecated」——這個假設是錯的。**

**【已查證，兩路獨立證據】**：

1. **官方 reference 頁**：`onCreateCandidatesView()` 標示 "**Added in API level 3**"，**沒有** deprecated 標記，也沒有 "This method was deprecated" 字樣。
   https://developer.android.com/reference/android/inputmethodservice/InputMethodService
2. **AOSP master 原始碼**：`public View onCreateCandidatesView()` **沒有任何 `@Deprecated` annotation**。其 javadoc 為：
   > "Create and return the view hierarchy used to show candidates. This will be called once, when the candidates are first displayed. You can return null to have no candidates view; the default implementation returns null. To control when the candidates view is displayed, use `setCandidatesViewShown(boolean)`. To change the candidates view after the first one is created by this function, use `setCandidatesView(View)`."

同樣地，`setCandidatesView(View)`、`setCandidatesViewShown(boolean)`、`onStartCandidatesView(EditorInfo, boolean)`、`onFinishCandidatesView(boolean)` 均**未** deprecated。

**真正 deprecated 的 `InputMethodService` 成員**【已查證，從官方 reference 逐項抓取】：

| 成員 | Deprecated 於 | 替代方案 |
|---|---|---|
| `onCreateInputMethodInterface()` | 未標版本（"A future version of Android will remove the ability to use this method"） | 改用 `InputMethodService` 的 callbacks |
| `onCreateInputMethodSessionInterface()` | 未標版本 | 改用 `InputMethodService` 的 callbacks |
| `onUpdateCursor(Rect)` | **API 21** | `onUpdateCursorAnchorInfo(CursorAnchorInfo)` |
| `onViewClicked(boolean)` | **API 29** | `onUpdateEditorToolType(int)` |
| `getInputMethodWindowRecommendedHeight()` | **API 29**（"the actual behavior of this method has never been well defined"） | 無直接替代 |
| `enableHardwareAcceleration()` | **API 21** | 硬體加速自 API 21 起一律啟用 |
| `BACK_DISPOSITION_WILL_DISMISS` / `BACK_DISPOSITION_WILL_NOT_DISMISS` | **API 28** | `BACK_DISPOSITION_DEFAULT` |

**實務結論**：
- **候選字可以用 `onCreateCandidatesView()` + `setCandidatesViewShown()`**，這是官方支援、未 deprecated 的機制。
- **但在實務上仍建議「在 `onCreateInputView()` 裡自繪整個鍵盤 + 候選列」**，理由【推測】：
  1. 候選區與鍵盤區在 CandidatesView 模型下是**分離的兩個 frame**，無法做統一的動畫與高度協商。
  2. Android 15+ 強制 edge-to-edge 後，IME insets 行為改變，單一 view 較好控制。
  3. 主流 IME（Gboard、Trime）都採自繪候選列。
- **【已查證】`InlineSuggestion` / `onCreateInlineSuggestionsRequest()` 是 Autofill 的 inline suggestion 機制，與 IME 候選字是兩件不同的事**，不要混用。

### 4.3 設為預設輸入法

**【已查證，使用者流程】**：
設定 → 系統 → 語言與輸入 → 螢幕鍵盤 → 啟用你的輸入法 → 用輸入法切換器（導航列地球/鍵盤圖示）切換。
（首次啟用時系統會顯示「允許使用此輸入法？」警告對話框，因為 IME 能看到所有輸入內容。）

**【已查證，程式面】**：
- `InputMethodManager.setInputMethod()` 需要 `android.permission.WRITE_SECURE_SETTINGS`，**只有系統 app 或 adb 能取得**。
- **應用無法靜默把自己設為預設輸入法**。必須引導使用者手動操作。
- 開發階段可用 adb：
  ```
  adb shell ime list -a
  adb shell ime enable com.example.ime/.MyInputMethod
  adb shell ime set    com.example.ime/.MyInputMethod
  ```
  【需查證：`adb shell ime` 的官方文件頁面 URL —— 我未取得官方 `ime` 指令的獨立文件頁】

### 4.4 Google Play 政策

**【已查證：查無 IME 專屬政策條目】** 我檢索了 Google Play 政策中心與使用者資料政策頁面，**未找到針對輸入法（IME / keyboard）的專門政策條目或專屬申報表單**。

**【已查證的間接證據】**：Trime（同文輸入法，開源 RIME Android 前端）**同時在 Google Play 與 F-Droid 上架**：
> "[Get it on F-Droid] … [Get it on Google Play]"
> — https://github.com/osfans/trime
→ 證明**第三方開源輸入法可以通過 Google Play 審核**。

**【推測（高信心）】**：IME 適用 Google Play 的**一般性政策**，主要風險領域：
- **Personal and Sensitive User Data**（輸入法可讀取使用者所有按鍵 → 最高敏感度）→ 必須有隱私政策、必須揭露資料收集。
- **Device and Network Abuse** / **Malware**（鍵盤側錄器是重點打擊對象）。
- 政策中心：https://support.google.com/googleplay/android-developer/topic/9858052
- 使用者資料政策：https://support.google.com/googleplay/android-developer/answer/10144311

**【需查證】** 是否有 Play Console 內的額外宣告表單（我未能登入驗證）。

### 4.5 targetSdk 要求（2026 年現況）【已查證】

> "**Starting August 31, 2026:** New apps and app updates must **target Android 16 (API level 36) or higher** to be submitted to Google Play; except for Wear OS, and Android Automotive OS apps, which must target Android 15 (API level 35) or higher, and Android TV and Android XR apps, which must target Android 14 (API level 34) or higher."
> "Existing apps must target Android 15 (API level 35) or higher to remain available to new users on devices running Android OS higher than your app's target API level."
> — https://support.google.com/googleplay/android-developer/answer/11926878

| 期限 | 要求 |
|---|---|
| 2025-08-31 | 新 app / 更新必須 target API 35 (Android 15) |
| **2026-08-31（已生效）** | **新 app / 更新必須 target API 36 (Android 16)** |
| Wear OS / Automotive | API 35 |
| Android TV / XR | API 34 |

**注意**：今天是 2026-09-26，所以 **API 36 已經是硬性要求**。新專案直接以 `targetSdk = 36` 起跳。
另見：https://developer.android.com/google/play/requirements/target-sdk

### 4.6 Android 15 / 16 / 17 對 IME 的影響

| 版本 | API | 已查證的變更 | 對 IME 的影響 |
|---|---|---|---|
| Android 15 | 35 | **edge-to-edge 強制**；`Window.setDecorFitsSystemWindows` 相關變更 | IME 的 `onComputeInsets()` 需重寫；候選列高度與系統列需協商 |
| Android 16 | 36 | edge-to-edge **全面強制（opt-out 移除）**；predictive back 預設開啟 | IME 需完整支援 predictive back（`onBackPressed` / `OnBackInvokedCallback`）；`BACK_DISPOSITION_ADJUST_NOTHING` 在 target CINNAMON_BUN 以上且 manifest 設 `android:enableOnBackInvokedCallback="true"` 時，會讓 back 事件**繞過 IME 直接送給 app** |
| Android 17 | 37 | **查無 IME 專屬變更** | — |

**【已查證】** Android 17 的 AOSP 代號為 **`CINNAMON_BUN`** —— 這是我在官方 reference 頁的 `setBackDisposition()` 說明中讀到的（"targeting `Build.VERSION_CODES.CINNAMON_BUN` or higher"）。
https://developer.android.com/reference/android/inputmethodservice/InputMethodService

**【需查證】** Android 17（API 37）的 behavior changes 頁面（`developer.android.com/about/versions/17/behavior-changes-*`）是否已公布且有 IME 相關條目。我未能查證該頁面內容。

**【已查證】** Android 16 behavior changes 總覽頁存在：https://developer.android.com/about/versions/16/behavior-changes-all

---

## 5. HarmonyOS NEXT（HarmonyOS 5/6/7，純鴻蒙）

> 本節是全報告最關鍵部分。**重大方法論說明**：華為 `developer.huawei.com` 是純 SPA，抓取極不穩定。因此本節主體證據來自 **OpenHarmony 官方 docs repo**（`openharmony/docs`）。其 IME Kit 文件與華為 `@kit.IMEKit` 的 API 高度一致（同一套 `@ohos.inputMethodEngine` 等模組），且可完整下載檢索。
> **OpenHarmony 與 HarmonyOS NEXT 的差異見 5.9 節** —— 引用 OpenHarmony 文件時我會明確標示。

### 5.1 框架定位【已查證】

**IME Kit 簡介（華為官方頁，Obscura 成功抓取原文）**：

> "IME Kit 负责建立**编辑框所在应用与输入法应用之间的通信通道**，确保两者可以共同协作提供文本输入功能，也为系统应用提供管理输入法应用的能力。"
> "IME Kit提供**输入法框架**和**输入法服务**两类API。用于实现输入法应用，也可以用于实现自绘编辑框以及实现对输入法应用的控制。"
> - 输入法应用：支持创建**固定态、悬浮态、状态栏三种类型的Panel**，可支持开发一个输入法应用同时部署在手机、平板等多设备中。
> - 自定义编辑框：支持开发者自定义编辑框，实现绑定输入法应用…
> - 提供系统应用管理输入法应用能力：显示/隐藏输入法软键盘、切换输入法、获取所有输入法列表。
> 与相关 Kit 的关系：**ArkUI** — IME Kit 在输入法软键盘和自绘编辑框时使用 ArkUI 提供的部分组件、事件、动效、状态管理等能力，例如 `Text`、`Button` 组件，`onClick` 点击事件。
> 约束限制：针对切换输入法应用的系统 API，需要申请系统权限，部分 API 仅支持当前输入法应用调用。
> 模拟器支持情况：本 Kit 支持模拟器。

URL：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ime-kit-intro

**API 參考文件清單**（同頁列出）：`inputMethodEngine`、`inputMethod`、`InputMethodExtensionAbility`、`InputMethodExtensionContext`、`inputMethodList`、`InputMethodSubtype`、`inputMethod.Panel`

### 5.2 `@ohos.inputMethodEngine`（輸入法服務端 API）【已查證】

**導入方式**（逐字）：
```ts
import { inputMethodEngine } from '@kit.IMEKit';
```
**首批接口從 API version 8 開始支持**。**SystemCapability：`SystemCapability.MiscServices.InputMethodFramework`**

來源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethodengine.md
（華為對應頁：https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-inputmethodengine）

> **官方明文：本模組面向「包括系統輸入法應用、**三方輸入法應用**」**
> "本模块面向输入法应用（包括系统输入法应用、三方输入法应用），为输入法应用提供能力，包括：创建软键盘窗口、插入/删除字符、选中文本、监听物理键盘按键事件等。"
> → **這是「HarmonyOS IME 框架支持第三方輸入法」最直接的官方證據。**

#### 取得實例

| API | 版本 | 說明 |
|---|---|---|
| `inputMethodEngine.getInputMethodAbility(): InputMethodAbility` | API 9+ | **輸入法應用取得此實例後，可訂閱軟鍵盤顯示/隱藏請求事件、建立/銷毀輸入法面板等** |
| `inputMethodEngine.getKeyboardDelegate(): KeyboardDelegate` | API 9+ | 取得客戶端編輯事件監聽代理，可訂閱**物理鍵盤按鍵事件、選中文本變化事件** |
| ~~`getInputMethodEngine()`~~ | API 8 支援、**API 9 廢棄、API 23 廢棄** | 用 `getInputMethodAbility()` 替代 |
| ~~`createKeyboardDelegate()`~~ | API 8 支援、API 9 廢棄 | 用 `getKeyboardDelegate()` 替代 |

#### `InputMethodAbility` 事件

| 事件 | 版本 | 回呼簽名 |
|---|---|---|
| `on('inputStart')` | 9+ | `(kbController: KeyboardController, inputClient: InputClient) => void` |
| `on('inputStop')` | 9+ | `() => void` |
| `on('setCallingWindow')` | 9+ | `(wid: number) => void` |
| `on('keyboardShow' \| 'keyboardHide')` | 9+ | `() => void` |
| `on('setSubtype')` | 9+ | `(inputMethodSubtype: InputMethodSubtype) => void` |
| `on('securityModeChange')` | 11+ | `Callback<SecurityMode>` |
| `on('privateCommand')` | 12+ | `Callback<Record<string, CommandDataType>>` |
| `on('callingDisplayDidChange')` | 18+ | `Callback<number>` |

#### `inputMethodAbility.createPanel(context, panelInfo)` → `Panel`

`PanelInfo`：`{ type: PanelType, flag?: PanelFlag }`

`PanelType`（模組 `@ohos.inputMethod.Panel`）：

| 名稱 | 值 | 說明 |
|---|---|---|
| `SOFT_KEYBOARD` | 0 | 軟鍵盤類型 |
| `STATUS_BAR` | 1 | 狀態欄類型 |

`PanelFlag`（目前僅用於 `SOFT_KEYBOARD`）：

| 名稱 | 值 | 說明 |
|---|---|---|
| `FLAG_FIXED` | 0 | 固定態面板 |
| `FLAG_FLOATING` | 1 | 懸浮態面板 |
| `FLAG_CANDIDATE` | 2 | **候選詞態面板** — 「當輸入面板為候選詞態時，面板為顯示用戶輸入候選詞的窗口。**輸入法服務不會主動控制候選詞態面板的顯示和隱藏，需要開發者根據情況自行控制**」 |

`Panel` 方法（節選）：

| 方法 | 版本 | 說明 / 權限 |
|---|---|---|
| `setUiContent(path)` | — | 載入 ArkUI 頁面（例如 `'InputMethodExtensionAbility/pages/Index'`） |
| `resize(w, h)` | 10+ | 改變面板大小 |
| `adjustPanelRect(...)` | 12+ / 15+ | 調整面板矩形（系統會按規則校驗） |
| `moveTo(...)` | — | 移動面板 |
| `show()` / `hide()` | 10+ | 顯示 / 隱藏 |
| `on('show' \| 'hide')` | 10+ | 監聽顯示 / 隱藏 |
| `on('sizeChange')` | 12+ | 面板大小變化（系統校驗後的真實大小）；API 15 起回呼增加 `KeyboardArea` |
| `changeFlag(flag: PanelFlag)` | 10+ | 切換面板形態，**僅對 SOFT_KEYBOARD 生效** |
| `setPrivacyMode(isPrivacyMode: boolean)` | 11+ | 隱私模式（不可錄屏/截屏）。**需要權限 `ohos.permission.PRIVACY_WINDOW`** |
| `setImmersiveMode(mode: ImmersiveMode)` | 15+ | 沉浸模式（`NONE_IMMERSIVE` / `LIGHT_IMMERSIVE` / `DARK_IMMERSIVE`；**不能設為 `IMMERSIVE`**） |
| `getImmersiveMode()` | 15+ | — |
| `setImmersiveEffect(effect)` | 20+ | 漸變/流光效果；**只有系统应用才能设置流光模式** |
| `setKeepScreenOn(bool)` | 20+ | 螢幕常亮（語音輸入等場景） |
| `getSystemPanelCurrentInsets(displayId)` | 21+ | 取得鍵盤相對系統面板的偏移區域 |
| `setSystemPanelButtonColor(fill, bg)` | 22+ | 設定功能鍵顏色 |
| `getDisplayId()` | 15+ | — |

#### `InputClient`（輸入法 → 編輯框）

| 方法 | 版本 | 說明 |
|---|---|---|
| `sendKeyFunction(action: number)` | 9+ | 發送功能鍵（0 = 無效按鍵，1 = 確認鍵/回車） |
| `insertText(text)` / `deleteForward(n)` / `deleteBackward(n)` | — | 文字插入與刪除 |
| `moveCursor(direction: Direction)` | — | `CURSOR_UP/DOWN/LEFT/RIGHT` |
| `getForward(n)` / `getBackward(n)` | — | 讀取游標前後文字 |
| `recvMessage(handler: MessageHandler)` | 15+ | 接收編輯框應用發送的自訂資料（`onMessage(msgId, msgParam?)` / `onTerminated()`） |
| `sendMessage(msgId, msgParam?)` | 15+ | 反向發送 |
| `getEditorAttribute()` / `getTextConfig()` | — | 取得編輯框屬性 |

#### `KeyboardController`（輸入法 → 系統）

| 方法 | 版本 | 說明 |
|---|---|---|
| `hide()` | 9+ | 隱藏輸入法（取代已廢棄的 `hideKeyboard()`） |
| `exitCurrentInputType()` | 11+ | 退出當前輸入類型。**僅支持系統配置的預設輸入法應用調用**（錯誤碼 `12800010 not the preconfigured default input method.`） |

#### `KeyboardDelegate` 事件

`on('keyDown')`、`on('keyUp')`、`on('cursorContextChange')`、`on('selectionChange')`、`on('textChange')`、`on('editorAttributeChanged')`

回呼回傳 `KeyEvent { keyCode, keyAction }`；`keyDown`/`keyUp` 回呼**需回傳 boolean** 表示是否消費該按鍵。

#### 常數（節選）

`ENTER_KEY_TYPE_*`（`UNSPECIFIED`=0, `GO`=2, `SEARCH`=3, `SEND`=4, `NEXT`=5, `DONE`=6, `PREVIOUS`=7, `NEWLINE`=8/API12+）
`PATTERN_*`（`NULL`=-1, `TEXT`=0, `NUMBER`=2, `PHONE`=3, `DATETIME`=4, `EMAIL`=5, `URI`=6, `PASSWORD`=7, `PASSWORD_NUMBER`=8/API11+, `PASSWORD_SCREEN_LOCK`=9/API11+, `USER_NAME`=10/API20+, `NEW_PASSWORD`=11/API20+, `NUMBER_DECIMAL`=12/API20+, `ONE_TIME_CODE`=13/API20+）
`OPTION_*`（`NONE`=0, `MULTI_LINE`=1, `AUTO_CAP_CHARACTERS`=2, `AUTO_WORDS`=4, `AUTO_CAP_SENTENCES`=8, `ASCII`=20, `NO_FULLSCREEN`=10）
`FLAG_SELECTING`=2, `FLAG_SINGLE_LINE`=1
`DISPLAY_MODE_PART`=0, `DISPLAY_MODE_FULL`=1
`CURSOR_UP`=1, `CURSOR_DOWN`=2, `CURSOR_LEFT`=3, `CURSOR_RIGHT`=4（API 9+）
`WINDOW_TYPE_INPUT_METHOD_FLOAT` = **2105**（API 9+，輸入法應用窗口風格標識）

`ExtendAction`：`SELECT_ALL`=0, `CUT`=3, `COPY`=4, `PASTE`=5
`Direction`：`CURSOR_UP`=1, `CURSOR_DOWN`=2, `CURSOR_LEFT`=3, `CURSOR_RIGHT`=4

#### ⭐ `SecurityMode`（安全模式）—— 對第三方輸入法最關鍵的設計【已查證】

| 名稱 | 值 | 說明（逐字） |
|---|---|---|
| `BASIC` | 0 | **基础访问模式，基础打字模式，会限制网络访问。** |
| `FULL` | 1 | **完全访问模式，不做限制，可以访问网络。** |

→ **HarmonyOS 把「輸入法能否連網」做成了使用者/系統可控的安全模式**，這與 iOS 的 "Allow Full Access" 是完全同構的設計。**這意味著：任何依賴雲端詞庫、雲端聯想、雲端同步的注音輸入法功能，在 BASIC 模式下都會失效，必須純本地降級。**

### 5.3 `@ohos.InputMethodExtensionAbility`【已查證】

**導入**：`import { InputMethodExtensionAbility } from '@kit.IMEKit';`
**首批接口從 API version 9 開始支持**。**本模組接口僅可在 Stage 模型下使用。**

| 成員 | 說明 |
|---|---|
| `context: InputMethodExtensionContext` | Extension 上下文（繼承 `ExtensionContext`） |
| `onCreate(want: Want): void` | Extension 生命週期回呼，**拉起輸入法 Extension 時調用**，執行初始化 |
| `onDestroy(): void` | 銷毀時回呼，清理資源 |

> "如果服务已创建，再次启动该InputMethodExtensionAbility不会触发onCreate()回调。"

來源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod-extension-ability.md

### 5.4 `module.json5` 設定（輸入法 Extension 註冊）【已查證】

官方開發指南原文：

> "在工程Module对应的 `module.json5` 配置文件中注册InputMethodExtensionAbility，**type标签需要设置为"inputMethod"**，srcEntry标签表示当前InputMethodExtensionAbility组件所对应的代码路径。"

```json5
"extensionAbilities": [
  {
    "srcEntry": "./ets/InputMethodExtensionAbility/InputMethodService.ets",
    "name": "InputMethodService",
    "label": "$string:MainAbility_label",
    "description": "$string:extension_ability_descriptor",
    "type": "inputMethod",
    "exported": true,
    "metadata": [
      {
        "name": "ohos.extension.input_method",
        "resource": "$profile:input_method_config"
      }
    ]
  }
]
```

**逐字確認**：`"type": "inputMethod"`；metadata name = `"ohos.extension.input_method"`；resource = `"$profile:input_method_config"`。

`module-configuration-file.md` 對 `inputMethod` 的官方定義：
> `inputMethod` | 输入法的ExtensionAbility。

來源：
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-application-guide.md
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/quick-start/module-configuration-file.md

**【需查證】** `input_method_config` profile 的 JSON schema（欄位定義）。我未取得該 profile 的官方規格文件，官方範例 repo 的路徑也未能確認。
→ 取得方式：DevEco Studio 新建 InputMethodExtensionAbility 模板時會自動產生 `resources/base/profile/input_method_config.json`，直接看模板最可靠。

### 5.5 官方開發流程（實作骨架）【已查證】

官方「实现一个输入法应用」指南給出的工程結構：

```
/src/main/
├── ets/InputMethodExtensionAbility
│       └──model/KeyboardController.ets      # 显示键盘
│       └──InputMethodService.ets            # 自定义类继承InputMethodExtensionAbility并加上需要的生命周期回调
│       └──pages
│         └── Index.ets                      # 绘制键盘，添加输入删除功能
│         └── KeyboardKeyData.ets            # 键盘属性定义
├── resources/base/profile/main_pages.json
```

`main_pages.json`：
```json
{ "src": [ "InputMethodExtensionAbility/pages/Index" ] }
```

`InputMethodService.ets`（官方範例，逐字）：
```ts
import { InputMethodExtensionAbility } from '@kit.IMEKit';
import { Want } from '@kit.AbilityKit';

export default class ServiceExtAbility extends InputMethodExtensionAbility {
  onCreate(want: Want): void {
    keyboardController.onCreate(this.context);   // 傳入 InputMethodExtensionContext
  }
  onDestroy(): void {
    keyboardController.onDestroy();
  }
}
```

`KeyboardController.ets`（官方範例核心邏輯，逐字）：
```ts
// 1. 建立面板
let panelInfo: inputMethodEngine.PanelInfo = {
  type: inputMethodEngine.PanelType.SOFT_KEYBOARD,
  flag: inputMethodEngine.PanelFlag.FLG_FIXED
};
inputMethodAbility.createPanel(this.mContext, panelInfo).then((panel) => {
  this.panel = panel;
  panel.resize(dWidth, keyHeight).then(() => {
    panel.setUiContent('InputMethodExtensionAbility/pages/Index');
  });
});

// 2. 監聽 inputStart / inputStop / setSubtype / privateCommand
inputMethodAbility.on('inputStart',
  (kbController: inputMethodEngine.KeyboardController, textInputClient: inputMethodEngine.InputClient) => {
    this.inputHandle.onInputStart(kbController, textInputClient);
  });
inputMethodAbility.on('setSubtype', (subtype: InputMethodSubtype) => { /* 切換注音/拼音介面 */ });
inputMethodAbility.on('inputStop', () => { /* 清理，mContext.destroy() */ });

// 3. 取得 KeyboardDelegate，監聽物理鍵盤
this.mKeyboardDelegate = inputMethodEngine.getKeyboardDelegate();
this.mKeyboardDelegate.on('keyDown', (keyEvent: inputMethodEngine.KeyEvent) => { /* 回傳 boolean */ });
this.mKeyboardDelegate.on('cursorContextChange', (x, y, height) => { /* 游標位置 → 候選窗定位 */ });

// 4. 銷毀
inputMethodAbility.destroyPanel(this.panel);
```

**游標定位**：`KeyboardDelegate.on('cursorContextChange', (x, y, height))` → 這是候選字窗跟隨游標的官方機制。

### 5.6 ⚠️ 安全管控與「基礎訪問模式」——第三方輸入法的真正限制【已查證】

官方「约束与限制」原文（**逐字，極重要**）：

> "为了降低InputMethodExtensionAbility能力被三方应用滥用的风险，现通过**基础访问模式**的功能约束对输入法应用进行安全管控。
> **说明：** 严格遵从基础访问模式的功能约束。在此模式下，开发者应**仅提供基础打字功能，不应提供任何形式与网络交互相关的功能**。系统会逐步增加基础访问模式的安全管控能力，包括但不限于：**以独立进程和沙箱的方式运行Extension进程；禁止Extension进程创建子进程；进程间通信与网络访问**等。因此未遵从此约定可能会导致功能异常。"

來源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-application-guide.md

**解讀**：
1. 官方**明確承認三方輸入法會被限制**，且限制會**逐步加強**（"系统会逐步增加…"）。
2. 基礎模式下**禁止網路互動** → 雲端詞庫/雲端聯想不可用。
3. 未來會**獨立進程 + 沙箱 + 禁止子進程 + 限制 IPC** → 對「C++ 核心 + 多進程架構」是重大風險（見第 6 節）。
4. 對應的 API 就是 `SecurityMode.BASIC` / `SecurityMode.FULL`。
5. `on('privateCommand')` 與 `KeyboardController.exitCurrentInputType()` 的錯誤碼 `12800010 not the preconfigured default input method.` 顯示：**部分能力只有「系統預配置的預設輸入法」能用**。

### 5.7 切換輸入法與 hdc 工具

#### `@ohos.inputMethod`（框架端 API）【已查證】

導入：`import { inputMethod } from '@kit.IMEKit';`

| API | 版本 | 權限 / 限制（逐字） |
|---|---|---|
| `inputMethod.getController()` | 9+ | — |
| `inputMethod.getDefaultInputMethod()` | 11+ | — |
| `inputMethod.getSystemInputMethodConfigAbility()` | 11+ | — |
| `inputMethod.getSetting()` | 9+ | 取得 `InputMethodSetting` |
| `inputMethod.switchInputMethod(target)` | 9+ | "在API version 9-10版本，僅支持系統應用調用且需要權限 `ohos.permission.CONNECT_IME_ABILITY`。**在API version 11版本起，僅支持當前輸入法應用調用。**" |
| `inputMethod.switchCurrentInputMethodSubtype(subtype)` | 9+ | 限當前輸入法應用 |
| `inputMethod.switchCurrentInputMethodAndSubtype(...)` | 9+ | 限當前輸入法應用 |
| `inputMethod.getCurrentInputMethod()` | 9+ | — |
| `inputMethod.setSimpleKeyboardEnabled()` | 20+ | — |
| `inputMethod.onAttachmentDidFail()` | 22+ | — |
| `InputMethodController.showSoftKeyboard()` / `hideSoftKeyboard()` | 9+ | **需要權限 `ohos.permission.CONNECT_IME_ABILITY`，仅系统应用可用** |
| `InputMethodController.showTextInput()` / `hideTextInput()` | 10+ | 同上 |
| `InputMethodController.attach()` | 10+ | 綁定輸入法到自繪編輯框 |
| `InputMethodController.attachWithUIContext()` | 23+ | — |

來源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod.md

**關鍵推論**：
- **普通 app 無法切換輸入法**（API 11 起 `switchInputMethod` 只允許「當前輸入法應用」呼叫）。
- **顯示/隱藏軟鍵盤的系統級 API 只有系統應用能用**（`ohos.permission.CONNECT_IME_ABILITY`）。
- → 使用者**必須手動**到設定中啟用並切換輸入法。

#### `hdc shell ime` 工具（API 20+）【已查證】

**Ime工具從 API version 20 開始支持。**

```
hdc shell ime [选项] [参数]
```

| 選項 | 參數 | 描述（逐字要點） |
|---|---|---|
| `-u` | userId | 指定操作的使用者 ID（API 26.0.0 起支援多使用者） |
| `-e` | bundle [-b /-f] | **啟用指定輸入法到指定模式。未設定 -b/-f 選項時，預設 `-b` 為基礎模式，`-f` 為完整體驗模式。** ⚠️「**系统预置的默认输入法不支持通过此命令更改其使能状态**」 |
| `-d` | bundle | 禁用指定輸入法。⚠️「**不允许禁用预置默认输入法**」 |
| `-s` | bundle | 切換到指定輸入法。⚠️「**在锁屏或密码输入场景下，不允许切换到其他输入法**」 |
| `-g` | — | 取得當前輸入法 |
| `-l` | — | 列出所有輸入法（預置預設輸入法不顯示使能狀態） |
| `-h` | — | 說明 |

官方範例：
```shell
hdc shell ime -e com.xxx.yyy        # 启用三方输入法到基础模式
hdc shell ime -e com.xxx.yyy -f     # 启用三方输入法到完整体验模式
hdc shell ime -d com.xxx.yyy        # 禁用三方输入法
hdc shell ime -s com.xxx.yyy        # 切换输入法
hdc shell ime -g                    # 获取当前输入法
hdc shell ime -l                    # 列出所有输入法
```

來源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-hdc-commands-guide.md

**極重要**：原文明確寫「**支持启用三方输入法到基础模式或者完整体验模式**」→ **官方命令層面確認：三方輸入法可以在 OpenHarmony 上被啟用，且有 basic / full 兩種模式。**

### 5.8 ⭐ 第三方輸入法在 HarmonyOS NEXT 上到底可不可行？

#### 技術層面：**可行**【已查證】

| 證據 | 來源 |
|---|---|
| IME 引擎模組明文面向「**三方輸入法應用**」 | `js-apis-inputmethodengine.md` |
| `InputMethodSetting.getInputMethods()` 可列出已啟用輸入法 | `js-apis-inputmethod.md` |
| `switchInputMethod()` API 11 起開放給「當前輸入法應用」呼叫 | `js-apis-inputmethod.md` |
| hdc `ime -e <bundle> [-f]` 明文「**支持启用三方输入法**到基础模式或者完整体验模式」 | `inputmethod-hdc-commands-guide.md` |
| 官方提供完整開發指南 + **官方範例 App（KikaInput）** | `inputmethod-application-guide.md` |
| `InputMethodExtensionAbility` 向所有開發者開放（非 system-only） | `js-apis-inputmethod-extension-ability.md` |

#### 商業/治理層面：**受多重約束**

| 約束 | 性質 | 來源 |
|---|---|---|
| 三方輸入法可能被限制為**基礎訪問模式**（禁網路、未來禁子進程/IPC、獨立沙箱） | **已查證（官方明文）** | `inputmethod-application-guide.md` 约束与限制 |
| 部分能力僅「系統預配置的預設輸入法」可用（錯誤碼 12800010） | **已查證** | `js-apis-inputmethodengine.md` |
| 系統預置預設輸入法不可被 `ime -d` 禁用 | **已查證** | `inputmethod-hdc-commands-guide.md` |
| 應用的簽章（`.p12` / `.cer` / `.p7b`）與 AGC 憑證流程 | **【需查證細節】** | 見 5.10 |
| 側載（sideload）第三方輸入法的可行性與裝置數上限 | **【需查證】** | 見 5.10 |
| AppGallery 上架審核、輸入法類別是否需特殊資質 | **【需查證】** | 見 5.10 |

#### 難度評估【推測】

| 面向 | 難度 | 說明 |
|---|---|---|
| 取得 IME Extension 跑起來（示範級軟鍵盤） | **低–中** | 官方有完整指南 + KikaInput 範例；ArkTS/ArkUI 開發 |
| 做出可用的注音輸入法（鍵盤 + 候選 + 組字 + 詞庫） | **中–高** | 核心難點是注音組字邏輯與詞庫；ArkTS 語言限制會增加移植成本 |
| 純本地高效能詞庫引擎（C++/Rust） | **中** | NDK/NAPI 可用，但**注意基礎模式未來「禁止子進程 / 限制 IPC」**，且 IME 面板 UI 必須是 ArkUI |
| 通過上架審核 | **【需查證】** | 取決於資質要求 |
| 讓使用者真的能選用你的輸入法 | **中** | 需引導使用者手動啟用；部分情境（鎖屏/密碼）系統不允許切換 |

#### 開源先例【已查證】

| 專案 | 性質 | 來源 |
|---|---|---|
| **KikaInput（轻量级输入法）** | **OpenHarmony 官方範例**，完整 IME 實作 | https://gitcode.com/openharmony/applications_app_samples/tree/master/code/Solutions/InputMethod/KikaInput |
| KikaInputMethod | 官方文件中引用的 DocsSample 範例（ArkTS，含 KeyboardController / Index.ets） | 見 `inputmethod-application-guide.md` 內註解連結 |

**【已查證：查無】** 我**未找到**任何「Trime 鴻蒙版」、「Rime 移植到 HarmonyOS NEXT」的官方或可信專案。**【需查證】** 這是因為我沒有可用的搜尋引擎，**不代表不存在**。

**【已查證】** 已上架的第三方鴻蒙輸入法（百度/搜狗/訊飛鴻蒙版）：**我無法查證**。我的搜尋工具全數失效，且 AppGallery 網站為 SPA。
→ **這是本報告最重要的待辦事項**：**若能確認「搜狗/百度輸入法鴻蒙版」已上架且可被設為預設，則商業可行性立即確認**。建議用可用的搜尋引擎或直接詢問華為開發者支援。

### 5.9 OpenHarmony vs HarmonyOS NEXT 對 IME 的影響

| 面向 | OpenHarmony（開源） | HarmonyOS NEXT（華為商業版） |
|---|---|---|
| IME 框架 | 有（IME Kit，本次引用的全部 API） | 同一套 IME Kit（`@kit.IMEKit`） |
| 應用來源 | 可自由側載、可自行簽章 | **強制簽章 + 透過 AppGallery / 官方測試管道** |
| 預設輸入法 | `hdc shell ime -e/-s` 可控 | 使用者手動 + 系統治理；`-d` 不可禁用預置預設輸入法 |
| 系統權限 API | 同樣有 `system_basic` / `system_core` 限制 | 同 |
| NDK | 開放 | 開放（NAPI / Native） |
| 差異本質 | **技術框架相同；治理與簽章不同** | |

**【推測（高信心）】**：OpenHarmony 文件描述的 API 與限制**適用於 HarmonyOS NEXT**（同一套 Kit、同一份 `module.json5` schema）。差異在於：
- **發佈管道**：OpenHarmony 裝置可自由裝；HarmonyOS NEXT 必須走 AGC 簽章與 AppGallery（或官方測試管道）。
- **安全管控強度**：OpenHarmony 文件已預告「系統會逐步增加基礎訪問模式的安全管控能力」；**商業版可能比開源版更早、更嚴格地實施**。**【推測】**

### 5.10 簽章、側載、上架（多為【需查證】）

#### 已查證

**DevEco Studio 提供自動簽名與手動簽名兩種除錯簽章方式**（Obscura 成功抓取原文）：

> "针对**开发调试场景**，DevEco Studio提供**自动签名**和**手动签名**两种调试签名方式，帮助开发者高效进行应用调试。
> 自动签名适用于大部分调试场景，但部分调试场景须使用手动签名，具体为**跨设备调试、跨应用交互调试、断网情况下调试、多用户共同开发且需要共享密钥、kit需要配置指纹**。"

URL：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing

→ **這證明：HarmonyOS 開發有「自動簽名」與「手動簽名」兩條路徑，且手動簽名用於特定場景。** 但**頁面的「手動簽名」分頁內容是 SPA tab，Obscura 未抓到**，因此 `.p12` / `.cer` / `.p7b` 的具體關係**【需查證】**。

#### 【需查證】清單（附應查證的官方 URL，均已驗證 HTTP 200 可達）

| 項目 | 應查證 URL |
|---|---|
| 手動簽名：`.p12` / `.cer` / `.p7b` 三者關係與產生流程 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing （「手动签名」分頁） |
| 真機執行與裝置註冊（debug 憑證 + 裝置白名單） | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-run-device |
| 應用發布流程 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-publish-app |
| AGC 申請憑證 / Profile | https://developer.huawei.com/consumer/cn/doc/app/ （AppGallery Connect 說明文件） |
| AppGallery 審核指南 | https://developer.huawei.com/consumer/cn/doc/app/50104 |
| 開發者實名認證 | https://developer.huawei.com/consumer/cn/ （開發者聯盟帳號流程） |
| 應用資質要求（輸入法是否需特殊資質） | AppGallery 審核指南「资质要求」章節 |
| 側載 / 調試裝置數量上限 / 內部測試 | AGC「内部测试」/「公开测试」說明 |
| 已上架第三方鴻蒙輸入法清單 | AppGallery 搜尋「输入法」 |

> **建議**：這些頁面需要**登入華為開發者帳號**才能完整閱讀，且是 SPA。取得方式：用 Windows 瀏覽器登入後人工閱讀，或請華為開發者支援直接回答。

### 5.11 跨語言開發可行性

| 方案 | 可行性 | 依據 |
|---|---|---|
| **ArkTS / ArkUI** | ✅ **官方首選，唯一被明確支援的 IME UI 方案** | 官方指南全部用 `.ets`；`Panel.setUiContent('.../pages/Index')` 載入 ArkUI 頁面 |
| **C/C++ via NAPI（NDK）** | ⚠️ **部分可行 —— 但 C API 是給「自繪編輯框」用的，不是給輸入法本身** | 見下 |
| **Flutter** | **【需查證】** | 我未能查證 OpenHarmony SIG 的 Flutter fork 現況 |
| **Qt** | **【需查證】** | 同上 |

#### 關於 C/C++（重要澄清）【已查證】

OpenHarmony 確實有 IME 的 **C API**，但**它的服務對象是「自繪編輯框」（client 端），不是輸入法應用本身**：

官方指南標題即為：**「在自绘编辑框中使用输入法开发指导 (C/C++)」**
> "IME Kit支持开发者在**自绘编辑框**中使用输入法，与输入法应用交互，包括显示、隐藏输入法，接收来自输入法应用的文本编辑操作通知等，本文档介绍开发者如何使用C/C++完成此功能开发。"

```txt
CMakeLists.txt: libohinputmethod.so
#include <inputmethod/inputmethod_controller_capi.h>
```

C API 檔案清單（`InputMethod` 模組，起始版本 **12**）：

| 標頭 | 描述 |
|---|---|
| `inputmethod_attach_options_capi.h` | 輸入法綁定選項物件 |
| `inputmethod_controller_capi.h` | **綁定、解綁輸入法**的方法 |
| `inputmethod_cursor_info_capi.h` | 游標資訊物件 |
| `inputmethod_inputmethod_proxy_capi.h` | 使用輸入法的方法，向輸入法應用發送請求與通知 |
| `inputmethod_private_command_capi.h` | 私有資料物件 |
| `inputmethod_text_avoid_info_capi.h` | 輸入框避讓資訊 |
| `inputmethod_text_config_capi.h` | 輸入框配置資訊 |
| `inputmethod_text_editor_proxy_capi.h` | **支持自繪輸入框獲取來自輸入法應用的通知和請求** |
| `inputmethod_types_capi.h` | 型別定義 |

關鍵函式（逐字）：
- `OH_TextEditorProxy_Create()` / `OH_TextEditorProxy_SetGetTextConfigFunc()` / `OH_TextEditorProxy_SetInsertTextFunc()` / `OH_TextEditorProxy_SetDeleteForwardFunc()`
- `OH_AttachOptions_Create(showKeyboard)` / `OH_AttachOptions_Destroy()`
- `OH_InputMethodController_Attach(textEditorProxy, attachOptions, &inputMethodProxy)`
- `OH_InputMethodProxy_ShowKeyboard()` / `OH_InputMethodProxy_HideKeyboard()` / `OH_InputMethodProxy_NotifyConfigurationChange()`
- 錯誤碼型別：`InputMethod_ErrorCode`，`IME_ERR_OK`
- 回呼：`GetTextConfig()`、`InsertText()`、`DeleteForward()`

來源：
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/use-inputmethod-in-custom-edit-box-ndk.md
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/capi-inputmethod.md

**【推測（高信心）】**：
- **輸入法「服務端」（`InputMethodExtensionAbility` + `Panel` UI）沒有等價的 C API** —— 官方指南中 IME 應用一律用 ArkTS/ArkUI 撰寫，`Panel.setUiContent()` 載入的是 ArkUI 頁面。
- 因此 **C/C++ 只能作為「被 ArkTS 呼叫的計算核心」**（透過 NAPI 載入 `.so`），**無法用來渲染鍵盤 UI**。
- **【需查證】** 是否可用 `XComponent` + Native（OpenGL/Vulkan）在 Panel 內自繪鍵盤。

**【風險】** 基礎訪問模式未來將「禁止 Extension 進程創建子進程；限制進程間通信與網路訪問」（官方明文）。**【推測】** 這會讓「C++ 核心跑在獨立進程 + IPC」的架構在 HarmonyOS 上不可行，**核心必須 in-process（NAPI `.so` 或純 ArkTS）**。

---

## 6. 跨平台核心策略比較

### 6.1 五種策略總表

| 策略 | 代表實作 | Windows | macOS | Android | HarmonyOS NEXT | 綜合評價 |
|---|---|---|---|---|---|---|
| **(a) C/C++ 核心 + 原生殼** | **RIME**（librime + Weasel/Squirrel/Trime/fcitx5-rime） | ✅ TSF in-proc DLL | ✅ IMK .app | ✅ JNI + InputMethodService | ⚠️ NAPI `.so` 可行，但 UI 必須 ArkUI | **★★★★★ 已驗證** |
| **(b) Rust 核心 + uniffi/cbindgen** | 新興（如某些 IME 實驗） | ✅ cbindgen → C ABI → COM DLL | ✅ uniffi → Swift | ✅ uniffi → Kotlin/JNI | ⚠️ 需手寫 NAPI 綁定（uniffi 無 OHOS target） | **★★★★ 現代化選擇** |
| **(c) Kotlin Multiplatform** | — | ❌ 無 Windows GUI/COM 支援 | ❌ 無 macOS IMK 支援 | ✅ 原生 | ❌ | **★★ 不適合** |
| **(d) Flutter** | — | ❌ 無法做 TSF COM server | ❌ 無法做 IMK | ⚠️ 需原生殼；Flutter 無法直接實作 IME | **【需查證】** | **★ 不適合 IME 本體** |
| **(e) WASM 核心** | — | ⚠️ wasmtime 可行但增延遲 | ⚠️ 同上 | ⚠️ 同上 | **【需查證】** | **★★ 風險高** |

### 6.2 RIME 模式（策略 a）—— 最強證據【已查證】

RIME 官方下載頁明列跨平台前端矩陣：

> "RIME／中州韻輸入法引擎，是一個**跨平臺的輸入法算法框架**。基於這一框架，Rime 開發者與其他開源社區的參與者在 **Windows、macOS、Linux、Android** 等平臺上創造了不同的輸入法前端實現。"

| 平台 | 前端 | 版本 / 需求 |
|---|---|---|
| Windows | **小狼毫 Weasel** | 0.17.0，適用 Windows 8.1 / 10 / 11 |
| macOS | **鼠鬚管 Squirrel** | 1.1.2，適用 macOS 13.0+；亦可 `brew install squirrel-app` |
| Linux | ibus-rime / fcitx5-rime | — |
| Android | **同文 Trime**（第三方） | — |

來源：https://rime.im/download/

**librime 技術組成【已查證】**（https://github.com/rime/librime）：
- "A modular, extensible **input method engine in cross-platform C++ code**"
- 建置需求：C++17 編譯器、cmake ≥ 3.12、libboost ≥ 1.74、libleveldb、**libmarisa**、libopencc ≥ 1.0.2、libyaml-cpp
- 「Rime input schema, a DSL in **YAML** syntax」
- 「**Spelling Algebra**」— 建立變體拼寫的機制，**對注音符號的變體處理特別有用**
- 授權：BSD 3-Clause

**Trime 的整合方式【已查證】**（https://github.com/osfans/trime）：
> "Trime … is based on [RIME] input method framework and **written in Java/Kotlin with JNI**."
→ **Android 端用 JNI 呼叫 librime 的 C++ 核心**。這是策略 (a) 在 Android 的實證。

**優點**：每個平台都能用該平台**最原生**的輸入法 API（TSF COM / IMK / InputMethodService），效能最佳，無 abstraction 洩漏。
**缺點**：**4 套殼 = 4 套 UI + 4 套建置 + 4 套生命週期邏輯**。librime 的 C++17 + Boost 依賴在行動平台是負擔。

### 6.3 Rust + uniffi / cbindgen（策略 b）

**【已查證】**：
- `cbindgen`：從 Rust 產生 C/C++ header。https://github.com/mozilla/cbindgen
- `uniffi`：Mozilla 的 Rust → 多語言綁定產生器。https://mozilla.github.io/uniffi-rs/
  （**【需查證】** 我在本次環境中無法載入 uniffi 官網，因此其**支援的目標語言清單與 OHOS 支援狀況需查證**。已知其設計目標是 Kotlin / Swift / Python 等。）

**【推測】** 對本專案的適用性：

| 平台 | 綁定路徑 | 評價 |
|---|---|---|
| Windows | `cbindgen` → C ABI → 手寫 COM 包裝（`ITfTextInputProcessor` 等） | uniffi 不產生 C++ COM，仍需手寫殼 |
| macOS | `uniffi` → Swift（`IMKInputController` 子類別呼叫 Rust） | 最順 |
| Android | `uniffi` → Kotlin（JNI） | 順 |
| HarmonyOS | **無官方 target** → 需手寫 NAPI 綁定（`napi_*` C API）或先出 C ABI 再包 | **額外工作量** |

**結論【推測】**：Rust 核心的**演算法/詞庫部分**很適合（記憶體安全、無 GC、可 `no_std` 化），但**綁定層仍需為 4 個平台各寫一次**，並不會比 C++ 少多少工作；好處是**核心本身只需一份安全的實作**。

### 6.4 Kotlin Multiplatform（策略 c）—— 不建議

**【已查證】** KMP 的目標平台以 Android / iOS / JVM / Native / JS 為主。https://kotlinlang.org/docs/multiplatform.html
**【已查證：查無】** KMP 對 Windows TSF 或 macOS IMK 的官方支援。

**結論**：KMP 無法產生 TSF 的 COM in-proc server，也無法產生 macOS 的 `IMKInputController` 子類別。**不適合作為 IME 本體策略**。（可用於「非 UI 的共用業務邏輯」，但 IME 的共用邏輯就是核心引擎，那用 Rust/C++ 更合適。）

### 6.5 Flutter（策略 d）—— 不建議

| 平台 | 問題 |
|---|---|
| Windows | Flutter 應用是自繪視窗，**無法實作 TSF 的 in-proc COM 文字服務**（TSF 要求 `ITfTextInputProcessor` 實作在 DLL 內） |
| macOS | **無法實作 `IMKInputController` / `IMKServer`**；Flutter 的 macOS embedder 不提供 IMK 掛載點 |
| Android | Flutter **無法直接實作 `InputMethodService`**（那是 Android Service 元件，需原生）；理論上可用 platform channel 把 UI 委外，但鍵盤 UI 本身就必須是原生 view |
| HarmonyOS | **【需查證】** |

**【推測（高信心）】**：Flutter 適合「輸入法的設定頁 / 詞庫管理 App」，**不適合做輸入法本體**。原因是輸入法本體必須寄生在**作業系統定義的輸入法框架**裡，而 Flutter 的執行模型是「自己是一個 app」，兩者根本衝突。

### 6.6 WASM 核心（策略 e）—— 高風險

| 風險 | 說明 |
|---|---|
| 啟動延遲 | WASM runtime 初始化（尤其 wasmtime/wasmer）是毫秒到數十毫秒級，**與「按鍵到候選字 < 16ms」的目標衝突** |
| 記憶體 | runtime 本身佔用可觀；行動裝置上 IME 是常駐 process，記憶體預算緊 |
| 資料交換成本 | 每次查詢要跨 WASM 邊界複製字串 → 對「每按一键查一次詞庫」的場景是災難 |
| 平台支援 | Android 支援 WASM 需自帶 runtime；HarmonyOS **【需查證】** |
| 唯一優勢 | 沙箱隔離（安全性）—— 但 IME 的核心是**效能敏感**，不是安全邊界 |

**【推測】**：不建議把 WASM 放在**按鍵熱路徑**上。若真要用，只適合放「離線詞庫編譯工具」這種非即時場景。

### 6.7 輸入法場景的共通風險清單

| 風險 | 說明 | 緩解 |
|---|---|---|
| **低延遲** | 按鍵 → 組字 → 候選顯示必須在一個 frame 內 | 核心與 UI 同 process；避免 IPC 與跨語言邊界複製；詞庫 mmap |
| **原生文字輸入 API** | 每個平台的組字模型不同（TSF composition / IMK marked text / Android `setComposingText`） | 抽象層只做「已組字字串 + 候選清單 + 選取範圍」三件事 |
| **沙箱** | macOS MAS 沙箱、HarmonyOS 基礎訪問模式（禁網路/禁子進程/IPC） | 核心設計成**純本地、無網路、單進程** |
| **生命週期** | IME 是常駐服務，會被系統殺；macOS 快取 process 需 kill/登出 | 狀態持久化；快速冷啟動 |
| **平台語言限制** | ArkTS 禁用 `any`/動態屬性 | 核心用 NAPI `.so`，ArkTS 只做 UI |
| **輸入法特權審查** | IME 能看到所有輸入 | 隱私政策、明確的「不收集」承諾、開源 |

---

## 7. 效能：延遲、記憶體、詞庫結構

### 7.1 候選字延遲可接受範圍

**【需查證】** 我未能取得可引用的官方或學術來源（搜尋工具全數失效）。
**【推測 / 工程慣例】** 以下為業界常見目標，非官方標準：

| 指標 | 目標 | 依據 |
|---|---|---|
| 按鍵 → 組字顯示 | **< 16 ms**（一個 60Hz frame） | 【推測】低於此值使用者無法察覺；超過會感覺「黏」 |
| 按鍵 → 候選字出現 | **< 30 ms** | 【推測】候選字非同步更新可接受略高 |
| 首次顯示鍵盤 | **< 100 ms** | 【推測】超過會被感知為「卡」 |
| 最壞情況（冷查詢、磁碟 I/O） | **< 50 ms** | 【推測】超過需改為 mmap / 預熱 |

**【推測】** 工程結論：**注音輸入法的單次查詢必須是「記憶體內的確定性查詢」，不能有磁碟 I/O、不能有 IPC、不能有記憶體分配**。這是選 (a)/(b) 而非 (d)/(e) 的核心理由。

### 7.2 詞庫大小 vs 查詢速度

#### marisa-trie 官方 benchmark【已查證】

測試語料：英文維基百科所有頁面標題（2012-11），**9,805,576 keys**，原始大小 200,435,403 bytes（gzip 後 54,933,690 bytes）。

| 實作 | 大小 (bytes) | 備註 |
|---|---|---|
| darts-clone | 376,613,888 | Compacted double-array trie |
| tx-trie | 127,727,058 | LOUDS-based trie |
| **marisa-trie** | **50,753,560** | MARISA trie |

> "The biggest advantage of libmarisa is that its dictionary size is **considerably more compact** than others."
> MARISA-based dictionary 支援：lookup、reverse lookup、common prefix search、**predictive search**。
> — https://github.com/s-yata/marisa-trie

**→ marisa-trie 在同等 key 數下約為 darts-clone 的 1/7.4、tx-trie 的 1/2.5。**

#### 各候選結構比較

| 結構 | 代表實作 | 空間 | 查詢 | 前綴/預測搜尋 | 可變更 | 適用 |
|---|---|---|---|---|---|---|
| **MARISA trie** | `libmarisa`（C++） | ★★★★★ 最省 | ★★★★ | ✅ predictive search | ❌ 靜態（需重建） | **RIME 的選擇**【已查證：librime 依賴 libmarisa】 |
| **Double-Array Trie** | `darts` / `darts-clone`（C++）、`cedar`（C++） | ★★ | ★★★★★ 最快 | ✅ | cedar 支援動態更新 | 需頻繁更新的場景 |
| **FST** | `fst` crate（Rust, BurntSushi） | ★★★★ | ★★★★ | ✅（有序、支援 range query） | ❌ 靜態 | **Rust 核心首選**【已查證】 |
| **LOUDS** | `tx-trie` | ★★★ | ★★★★ | ✅ | ❌ | — |
| **DAWG** | `dawgdic` | ★★★★ | ★★★★ | ✅ | ❌ | — |
| **LevelDB** | Google LevelDB | ★★ | ★★（磁碟） | ⚠️ | ✅ | RIME 用來存**使用者學習記錄**，非主詞庫【已查證：librime 依賴 libleveldb】 |

`fst` crate 官方說明【已查證】：
> "This crate provides a fast implementation of ordered sets and maps using finite state machines. In particular, it makes use of finite state transducers to map keys to values as the machine is executed. Using finite state machines as data structures enables us to store keys in a **compact format that is also easily searchable**. For example, this crate leverages **memory maps** to make range queries very fast."
> — https://github.com/BurntSushi/fst

#### RIME 的實際架構【已查證】

| 元件 | 用途 |
|---|---|
| **libmarisa** | 主詞庫（`.table.bin`）—— 靜態、極省空間、支援前綴預測 |
| **libleveldb** | 使用者詞庫 / 學習記錄 —— 可寫、持久化 |
| **libopencc** | 簡繁轉換 |
| **libyaml-cpp** | 解析 Rime schema（YAML DSL） |
| **Boost** | 一般用途 |

來源：https://github.com/rime/librime

**【推測】對自研注音輸入法的建議**：
- **主詞庫用 marisa-trie 或 FST**（靜態、mmap、極省空間）。
- **注音的關鍵需求是「前綴預測搜尋」**（打 `ㄓ` 就要列出所有以 `ㄓ` 開頭的候選）→ marisa 的 `predictive search` 與 FST 的 range query 都原生支援。
- **使用者學習詞庫另存**（LevelDB / SQLite / 自訂 append-only log），不要混進主詞庫。
- **詞庫大小預算**【推測】：注音（ㄅㄆㄇㄈ + 聲調）的 key 空間遠小於拼音，一個涵蓋 10 萬詞的繁中注音詞庫應可控制在 **數 MB 以內**；即使到 100 萬詞，用 marisa 也在 **10–20 MB** 量級（依 7.2 的 980 萬 key → 50MB 外推）。

---

## 8. 建議架構（綜合）

```
┌─────────────────────────────────────────────────────────┐
│  共用核心（C++17 或 Rust，無網路、無 IPC、無 GC）          │
│  ├── 注音解析（ㄅㄆㄇㄈ + 聲調 + 變體拼寫）                 │
│  ├── 詞庫引擎（marisa-trie / FST，mmap，前綴預測）         │
│  ├── 候選排序（詞頻 + 使用者學習）                          │
│  └── 使用者詞庫（append-only / SQLite）                    │
└─────────────────────────────────────────────────────────┘
        │              │              │              │
   ┌────▼───┐    ┌─────▼────┐   ┌────▼─────┐  ┌────▼──────────┐
   │Windows │    │  macOS   │   │ Android  │  │ HarmonyOS NEXT│
   │TSF DLL │    │ IMK .app │   │  APK     │  │ HAP           │
   │C++ COM │    │ Swift +  │   │ Kotlin + │  │ ArkTS UI +    │
   │in-proc │    │ uniffi   │   │ JNI      │  │ NAPI(.so)     │
   └────────┘    └──────────┘   └──────────┘  └───────────────┘
```

**四個平台的殼各自必做**：

| 平台 | 殼的關鍵工作 |
|---|---|
| Windows | COM in-proc DLL；`ITfTextInputProcessor`/`ITfKeyEventSink`；`ITfInputProcessorProfiles::Register` + `AddLanguageProfile(zh-TW)`；候選窗用 Win32 視窗；`ITfUIElementMgr` 做無障礙 |
| macOS | `.app` bundle + Info.plist（`InputMethodConnectionName` 等）；`IMKServer` + `IMKInputController` 子類別；`IMKCandidates`；Developer ID 簽章 + 公證 |
| Android | `InputMethodService` 子類別；`onCreateInputView()` 自繪鍵盤+候選列；`res/xml/method.xml` 宣告 zh_TW subtype；`targetSdk 36` |
| HarmonyOS | `InputMethodExtensionAbility`（`module.json5` type `inputMethod`）；`createPanel` + ArkUI 頁面；`getKeyboardDelegate()` 接鍵盤事件；NAPI 載入核心 `.so`；**必須支援 BASIC 模式（純本地）** |

**優先順序建議【推測】**：
1. **先做共用核心 + Windows（TSF）或 macOS（IMK）之一** —— 這兩個平台生態最開放、無治理風險，適合驗證核心。
2. **Android 次之** —— 需要處理 insets/edge-to-edge 與 targetSdk 36。
3. **HarmonyOS NEXT 最後，且先做可行性驗證（spike）** —— 在投入前，**必須先確認能不能取得簽章並側載到實機**（見 5.10）。

---

## 9. 附錄

### 9.1 官方文件 URL 總表

**Windows / TSF**
- TSF 總覽：https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework
- TSF TOC（完整介面清單）：https://learn.microsoft.com/en-us/windows/win32/tsf/toc.json
- `ITfTextInputProcessor`：https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itftextinputprocessor
- `ITfThreadMgr`：https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfthreadmgr
- `ITfKeyEventSink`：https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfkeyeventsink
- **Text Service Registration**：https://learn.microsoft.com/en-us/windows/win32/tsf/text-service-registration
- `ITfInputProcessorProfiles`：https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfinputprocessorprofiles
- `ITfInputProcessorProfileMgr::RegisterProfile`：https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itfinputprocessorprofilemgr-registerprofile
- `ITfCategoryMgr`：https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcategorymgr
- Predefined Category Values：https://learn.microsoft.com/en-us/windows/win32/tsf/predefined-category-values
- How To Set Up TSF：https://learn.microsoft.com/en-us/windows/win32/tsf/how-to-set-up-tsf
- IMM32：https://learn.microsoft.com/en-us/windows/win32/intl/input-method-manager
- SmartScreen：https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/
- RIME 小狼毫（Windows）：https://github.com/rime/weasel

**macOS / InputMethodKit**
- InputMethodKit：https://developer.apple.com/documentation/inputmethodkit
- `IMKServer`：https://developer.apple.com/documentation/inputmethodkit/imkserver
- `IMKInputController`：https://developer.apple.com/documentation/inputmethodkit/imkinputcontroller
- `IMKCandidates`：https://developer.apple.com/documentation/inputmethodkit/imkcandidates
- `IMKServerInput`：https://developer.apple.com/documentation/inputmethodkit/imkserverinput
- `IMKStateSetting`：https://developer.apple.com/documentation/inputmethodkit/imkstatesetting
- `IMKMouseHandling`：https://developer.apple.com/documentation/inputmethodkit/imkmousehandling
- IMK Constants：https://developer.apple.com/documentation/inputmethodkit/inputmethodkit-constants
- Info Dictionary Keys（僅 2 個常數）：https://developer.apple.com/documentation/inputmethodkit/info-dictionary-keys
- App Store Review Guidelines（§2.4.5）：https://developer.apple.com/app-store/review/guidelines/
- Notarization：https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Squirrel（鼠鬚管）：https://github.com/rime/squirrel
- Squirrel 安裝說明：https://github.com/rime/squirrel/blob/master/INSTALL.md
- McBopomofo（小麥注音）：https://github.com/openvanilla/McBopomofo
- McBopomofo Info.plist（實證）：https://raw.githubusercontent.com/openvanilla/McBopomofo/master/Source/McBopomofo-Info.plist
- RIME 下載矩陣：https://rime.im/download/

**Android**
- `InputMethodService`：https://developer.android.com/reference/android/inputmethodservice/InputMethodService
- AOSP 原始碼：https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/inputmethodservice/InputMethodService.java
- `InputMethodManager`：https://developer.android.com/reference/android/view/inputmethod/InputMethodManager
- `InputConnection`：https://developer.android.com/reference/android/view/inputmethod/InputConnection
- 建立輸入法（官方指南）：https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method
- Play targetSdk 要求：https://support.google.com/googleplay/android-developer/answer/11926878
- Play targetSdk 遷移指南：https://developer.android.com/google/play/requirements/target-sdk
- Android 16 behavior changes：https://developer.android.com/about/versions/16/behavior-changes-all
- Play 政策中心：https://support.google.com/googleplay/android-developer/topic/9858052
- Play 使用者資料政策：https://support.google.com/googleplay/android-developer/answer/10144311
- Trime（Play + F-Droid）：https://github.com/osfans/trime

**HarmonyOS / OpenHarmony**
- IME Kit 簡介（華為）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ime-kit-intro
- 設定除錯簽名（華為）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing
- 真機執行（華為）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-run-device
- 發布應用（華為）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-publish-app
- AppGallery 審核指南（華為）：https://developer.huawei.com/consumer/cn/doc/app/50104
- 華為 API 參考 `inputMethodEngine`：https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-inputmethodengine
- **OpenHarmony IME Kit 文件（可完整下載）**：
  - `js-apis-inputmethodengine.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethodengine.md
  - `js-apis-inputmethod.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod.md
  - `js-apis-inputmethod-extension-ability.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod-extension-ability.md
  - `js-apis-inputmethod-panel.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod-panel.md
  - `capi-inputmethod.md`（C API）：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/capi-inputmethod.md
- **OpenHarmony IME 開發指南**：
  - 實現一個輸入法應用：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-application-guide.md
  - 切換輸入法應用：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/switch-inputmethod-guide.md
  - Ime 工具（hdc）：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-hdc-commands-guide.md
  - 自繪編輯框（C/C++）：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/use-inputmethod-in-custom-edit-box-ndk.md
  - module.json5 設定：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/quick-start/module-configuration-file.md
- 官方範例 KikaInput：https://gitcode.com/openharmony/applications_app_samples/tree/master/code/Solutions/InputMethod/KikaInput

**跨平台 / 詞庫**
- librime：https://github.com/rime/librime
- marisa-trie：https://github.com/s-yata/marisa-trie
- fst crate：https://github.com/BurntSushi/fst
- cbindgen：https://github.com/mozilla/cbindgen
- uniffi：https://mozilla.github.io/uniffi-rs/
- Kotlin Multiplatform：https://kotlinlang.org/docs/multiplatform.html

### 9.2 【需查證】清單（依重要性排序）

| # | 問題 | 為何重要 | 建議查證方式 |
|---|---|---|---|
| 1 | **是否有第三方（非華為）輸入法已成功在 HarmonyOS NEXT 上架並可設為預設？** | **直接決定商業可行性** | 用可用的搜尋引擎查「鸿蒙版输入法 上架」；或 AppGallery 搜「输入法」；或詢問華為開發者支援 |
| 2 | **HarmonyOS NEXT 側載第三方 IME 的可行性與限制**（調試憑證裝置數上限、內部測試管道） | 決定能否在投入前做實機驗證 | 華為 AGC 文件「内部测试」；`ide-run-device` 頁面 |
| 3 | **`.p12` / `.cer` / `.p7b` 的產生與關係**；AGC 憑證申請流程 | 決定簽章工作量 | `ide-signing` 頁「手动签名」分頁（需登入） |
| 4 | **AppGallery 對「輸入法」類別是否有特殊資質要求** | 決定能否上架 | AppGallery 審核指南「资质要求」章節 |
| 5 | **華為開發者實名認證**（個人 vs 企業）是否影響 IME 上架 | 決定主體資格 | 華為開發者聯盟帳號流程 |
| 6 | **`input_method_config` profile 的 JSON schema** | 實作必需 | DevEco Studio 新建 InputMethodExtensionAbility 模板 |
| 7 | **macOS：有無 IME 成功上架 Mac App Store 的案例** | 決定 macOS 發行路徑 | 搜尋 Mac App Store 上的日文/中文輸入法 |
| 8 | **`IMKTextInput` protocol 的方法清單** | 實作必需 | 直接讀 Xcode SDK header `IMKTextInput.h` |
| 9 | **macOS 26 / WWDC 2025-2026 有無新 IME API** | 避免用錯 API | Xcode 26 SDK header diff |
| 10 | **Android 17（API 37 / CINNAMON_BUN）的 IME 相關 behavior changes** | 前瞻規劃 | `developer.android.com/about/versions/17/behavior-changes-*` |
| 11 | **Google Play 是否有 IME 專屬申報表單** | 上架流程 | 登入 Play Console 查看 |
| 12 | **Flutter / Qt 在 HarmonyOS NEXT 的現況** | 技術選型 | OpenHarmony SIG `flutter_flutter`；Qt 官方 |
| 13 | **是否存在 Rime / Trime 的鴻蒙移植專案** | 可重用性 | GitHub/Gitee 搜尋 `openharmony ime`、`trime 鸿蒙` |
| 14 | **候選字延遲的學術/官方基準** | 效能目標設定 | 搜尋 touch latency / typing latency 研究 |
| 15 | **Windows 11/12 是否有 IME 相關新限制** | 風險評估 | 目前**查無任何官方限制政策**；Windows 12 尚無官方開發者文件 |

### 9.3 本次未能在環境中完成的驗證

- `web_search` 工具全程故障（undici 版本錯配，需重啟 dsh 生效）。
- DuckDuckGo / Mojeek：bot 驗證阻擋。
- Bing：英文查詢可用但品質差；**中文查詢回傳完全無關的結果**。
- `developer.huawei.com`：SPA，Obscura 成功率約 30%，多數頁面逾時。
- Apple 部分文件（`IMKTextInput`、App Store 各平台 IME 案例）無 JSON API 端點。

---

*報告結束。所有【已查證】項目均附官方 URL；【推測】與【需查證】項目已明確標示，請勿當作結論使用。*
