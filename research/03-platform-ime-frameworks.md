# 自研注音输入法：四平台官方框架、API、上架与签章限制研究

> 研究日期：2026-09-26
> 研究范围：Windows / macOS / Android / HarmonyOS NEXT（鸿蒙 5+）
> 目标：确认「一套自研注音输入法」在四个平台上要接哪个官方框架、API 名称、上架与签章限制、以及能做到什么程度。

---

## 0. 阅读说明：可信度标记

本报告严格区分三种陈述：

| 标记 | 含义 |
|---|---|
| **【已查证】** | 直接来自官方文件 / 官方原始码 / 官方范例，并附完整 URL。 |
| **【推测】** | 基于已查证事实的工程推论，尚无官方明文。 |
| **【需查证】** | 我未能取得可信来源（多为需登入、SPA 动态载入或无公开文件），**不可当作结论使用**。 |

### 本次研究的工具限制（重要）

本次执行环境的 `web_search` 工具故障（DeepSeek 搜寻端点回传未解压的二进位 body，JSON 解析失败；根因是本机 undici 大版本错配，已在 `/home/rchua/GO/dsh-websearch-修复记录.md` 有完整诊断，需重启 dsh 才会生效）。因此本报告改用：

- `web_fetch` / `curl`：抓取 Microsoft Learn、Apple Developer、Android Developers、Google Play Help、GitHub raw 等静态站。
- **OpenHarmony 官方 docs repo（`raw.githubusercontent.com/openharmony/docs`）**：这是本次最重大的方法论突破 —— OpenHarmony 的 IME Kit 文件以纯 Markdown 形式提供，内容与华为 `@kit.IMEKit` API 几乎一致，且**可完整下载与本地检索**。
- **Obscura（headless Chromium）**：用于华为 `developer.huawei.com` 这类 SPA 站。**成功率不稳定**（需载入大量动态脚本），成功时可取得内文。

失败的来源：`web_search`（全挂）、DuckDuckGo / Mojeek（bot 验证）、Bing（中文查询回传无关结果）、`developer.huawei.com` 多数页面（SPA 逾时）。**因此华为侧的「签章 / AGC / 上架审核 / 侧载」章节有较多【需查证】项，已逐项标明并附上应查证的官方 URL。**

---

## 1. 结论速览

| 平台 | 官方框架 | 第三方可否自研 IME | 主要卡点 | 上架/散布路径 |
|---|---|---|---|---|
| **Windows** | Text Services Framework (TSF)，COM in-proc server | **可以**，完全开放 | COM 注册 + 语言设定；需自行处理 TSF 复杂度 | 官网下载 / 商店皆可；建议程式码签章 |
| **macOS** | InputMethodKit (IMK) | **可以**，完全开放 | Info.plist 遗留 key 无现代官方文件；App Store 沙箱与 IME 安装模型冲突 | 官网下载 + Developer ID 签章 + **公证**（非 App Store 为主） |
| **Android** | `InputMethodService` | **可以**，完全开放 | 需引导使用者手动启用与切换；Play targetSdk 36 | Google Play / F-Droid 皆可 |
| **HarmonyOS NEXT** | IME Kit（`InputMethodExtensionAbility` + `@ohos.inputMethodEngine`） | **框架明文支持三方输入法**，但受「基础访问模式」安全管控与华为商业流程双重约束 | ①基础模式禁网路 ②签章/AGC/上架流程 ③侧载受限 | AppGallery（需实名认证；资质要求**【需查证】**） |

**一句话结论：**
Windows / macOS / Android 三平台技术上完全可行且路径成熟（RIME 生态已证明）；**HarmonyOS NEXT 技术上可行（框架明文含「三方输入法应用」），但它是四平台中唯一「技术可用 ≠ 商业可交付」的平台** —— 真正的难点不在 API，而在华为的签章、上架与侧载治理。

---

## 2. Windows：Text Services Framework (TSF)

### 2.1 框架定位【已查证】

> "Microsoft Windows Text Services Framework (TSF) is a system service available as a redistributable for Windows. TSF provides a simple and scalable framework for the delivery of advanced text input and natural language technologies. TSF can be enabled in applications, or as a TSF text service. A TSF text service provides multilingual support and delivers text services such as keyboard processors, handwriting recognition, and speech recognition."
> — https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework

> "Text Services Framework is designed for use by **Component Object Model (COM) programmers using the C/C++ programming languages**."
> 同页

> "**Text service providers should provide digital signatures with their binary executables.**"
> 同页（Windows 对 TSF 文字服务的签章要求，原文用 "should"，非 "must"）

**关键含义**：TSF 文字服务是一个 **in-proc COM 伺服器**（DLL），不是独立 exe。这对跨平台核心策略有直接影响（见第 6 节）。

### 2.2 核心介面【已查证】

| 介面 | 角色 | 关键成员 | 官方 URL |
|---|---|---|---|
| `ITfTextInputProcessor` | 文字服务实作此介面，TSF manager 用它启用/停用服务。manager 以 `CoCreateInstance` 建立服务实例并取得此介面指标。 | `Activate`、`Deactivate` | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itftextinputprocessor |
| `ITfTextInputProcessorEx` | 扩充版，提供 `ActivateEx` | `ActivateEx` | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itftextinputprocessorex |
| `ITfThreadMgr` | TSF manager 的主要物件；应用与文字服务用它启用/停用文字服务、建立 document manager、维护 document context focus。 | `Activate`、`Deactivate`、`CreateDocumentMgr`、`GetFocus`、`SetFocus`、`AssociateFocus`、`EnumDocumentMgrs`、`IsThreadFocus`、`GetGlobalCompartment`、`GetFunctionProvider`、`EnumFunctionProviders` | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfthreadmgr |
| `ITfKeyEventSink` | 文字服务实作此介面以接收键盘与焦点事件通知。**安装方式：`ITfKeystrokeMgr::AdviseKeyEventSink`**。 | `OnKeyDown`、`OnKeyUp`、`OnTestKeyDown`、`OnTestKeyUp`、`OnSetFocus`、`OnPreservedKey` | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfkeyeventsink |
| `ITfThreadMgr2` / `ITfThreadMgrEx` | 较新版本，多了 `SuspendKeystrokeHandling` / `ResumeKeystrokeHandling` / `GetActiveFlags` | — | https://learn.microsoft.com/en-us/windows/desktop/api/msctf/nn-msctf-itfthreadmgr2 |
| `ITfInputProcessorProfiles` | **注册用**：`Register`、`Unregister`、`AddLanguageProfile`、`RemoveLanguageProfile`、`EnableLanguageProfile`、`ActivateLanguageProfile`、`EnumLanguageProfiles` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfinputprocessorprofiles |
| `ITfInputProcessorProfileMgr` | 较新的 profile 注册介面：`RegisterProfile`、`UnregisterProfile` | — | https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfinputprocessorprofilemgr |
| `ITfCategoryMgr` | 注册服务类别：`RegisterCategory`、`UnregisterCategory`、`RegisterGUID` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcategorymgr |
| `ITfComposition` / `ITfContextComposition` | 组字（composition）管理：`StartComposition`、`EndComposition`、`GetRange`、`ShiftStart`、`ShiftEnd` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcomposition |
| `ITfRange` / `ITfRangeACP` | 文字范围操作：`SetText`、`GetText`、`Collapse`、`ShiftStart`、`ShiftEnd` | — | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfrange |
| `ITfUIElementMgr` / `ITfCandidateListUIElement` | 候选字 UI 元素注册（让辅助技术能读取候选视窗）：`BeginUIElement`、`UpdateUIElement`、`EndUIElement`；候选清单：`GetCount`、`GetString`、`GetSelection`、`SetPageIndex` | 对**无障碍支援**很重要 | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfcandidatelistuielement |
| `ITfFnSearchCandidateProvider` | 候选搜寻（供系统整合） | `GetSearchCandidates`、`SetResult` | https://learn.microsoft.com/en-us/windows/desktop/api/Ctffunc/nn-ctffunc-itffnsearchcandidateprovider |
| `ITfDisplayAttributeProvider` / `ITfDisplayAttributeInfo` | 自订组字显示样式（底线、颜色等） | `EnumDisplayAttributeInfo`、`GetDisplayAttributeInfo` | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itfdisplayattributeprovider |
| `ITfFunctionProvider` / `ITfFunction` | 提供额外功能（如 `ITfFnReconversion` 重新转换） | `GetFunction`、`GetType`、`GetDisplayName` | https://learn.microsoft.com/en-us/windows/desktop/api/Msctf/nn-msctf-itffunctionprovider |

TSF 完整介面清单（TOC）：https://learn.microsoft.com/en-us/windows/win32/tsf/toc.json

### 2.3 取得 `ITfThreadMgr` 与生命周期【已查证】

官方范例（来自 `ITfThreadMgr` 页面「Remarks」）：

```cpp
HRESULT hr;
ITfThreadMgr* pThreadMgr;

hr = CoCreateInstance(  CLSID_TF_ThreadMgr,
                        NULL,
                        CLSCTX_INPROC_SERVER,
                        IID_ITfThreadMgr,
                        (void**)&pThreadMgr);
```

**关键**：
- **应用端**：用 `CoCreateInstance(CLSID_TF_ThreadMgr, ...)` 取得 `ITfThreadMgr`。
- **文字服务端**：**不是自己 CoCreate**，而是在 `ITfTextInputProcessor::Activate` 方法中**收到** manager 传入的 `ITfThreadMgr` 指标。
- 对应的 `ITfTextInputProcessor::Activate` / `Deactivate` 是服务的进入点/离开点。

### 2.4 注册流程（安装第三方 IME 的核心）【已查证】

> "In addition to the standard COM in-proc server registry entries, a text service must register itself with the Text Services Framework (TSF) so that it can be available for use with an application. TSF supplies the `ITfInputProcessorProfiles` and `ITfCategoryMgr` interface to simplify the registration process."
> — https://learn.microsoft.com/en-us/windows/win32/tsf/text-service-registration

三步骤（同页）：

1. **注册文字服务本体**：`CoCreateInstance(CLSID_TF_InputProcessorProfiles, NULL, CLSCTX_INPROC_SERVER, IID_ITfInputProcessorProfiles, ...)` 取得介面，再呼叫 `ITfInputProcessorProfiles::Register(clsidTextService)`。
   官方范例：
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
2. **注册语言设定档（必要！）**：
   > "A text service is only available when an application has the focus and **the proper language is selected in the language bar**. To facilitate this, TSF requires that a text service register itself for all of the languages that it supports."
   呼叫 `ITfInputProcessorProfiles::AddLanguageProfile`，传入「文字服务 CLSID + language identifier + 服务自订的 profile GUID」。
   → **注音输入法必须注册 `zh-TW`（繁体中文／台湾）语言设定档**，否则使用者无法在语言列选到它。
   移除：`RemoveLanguageProfile`；卸载：`Unregister`（会移除该服务所有语言设定档）。
3. **注册类别**：`ITfCategoryMgr::RegisterCategory(clsid, GUID_TFCAT_*, clsid)`。例如提供显示属性的服务要注册为 `GUID_TFCAT_DISPLAYATTRIBUTEPROVIDER`。可用类别见 https://learn.microsoft.com/en-us/windows/win32/tsf/predefined-category-values

另有较新的 `ITfInputProcessorProfileMgr::RegisterProfile`：https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itfinputprocessorprofilemgr-registerprofile

### 2.5 TSF vs IMM32【已查证】

IMM32（Input Method Manager）：

> "Input Method Manager (IMM) is a technology used by an application to communicate with an input method editor (IME), which runs as a service. The IME allows computer users to enter complex characters and symbols, such as Japanese kanji characters, by using a standard keyboard. This section describes the IMM API and explains how to use the functionality to create and manage IME windows."
> — https://learn.microsoft.com/en-us/windows/win32/intl/input-method-manager

| 面向 | IMM32（旧） | TSF（新，XP 以后） |
|---|---|---|
| 架构 | 应用 ↔ IME 以视窗讯息沟通；IME 提供 UI 视窗 | COM 服务；应用与服务都接同一个 framework |
| 开发语言 | C（Win32 API） | **C++ / COM**（官方明文） |
| 组字（composition） | 由 IME 自己维护 | 有正式的 composition / range / edit session 模型 |
| 显示样式 | IME 自绘 | `ITfDisplayAttributeProvider` 可与应用整合 |
| 无障碍 | 弱 | `ITfUIElementMgr` / `ITfCandidateListUIElement` |
| 现况 | 仍存在（相容层） | **新开发应选 TSF** |

【推测】对新专案：**选 TSF**。IMM32 仍被系统保留以相容旧 IME，但官方新文件教学都以 TSF 为主，且 TSF 才能与现代应用（含 UWP/WinUI）正常互动。

### 2.6 使用者如何安装与启用【已查证】

官方「How To Set Up Text Services Framework」描述的是使用者端流程（文件较旧，以 Windows XP 的 UI 用语描述，但概念沿用至 Windows 11 的「语言与地区 / 进阶键盘设定」）：

1. 控制台 → **Regional and Language Options** → Languages 页 → **Details**。
2. 在 **Text Services and Input Languages** 视窗的 Settings 页 → **Add** → 选择想要的 text service。选中的服务会出现在对应语言之下。
3. 移除：选取后按 **Remove**。
4. 语言列（Language Bar）右键 → **Settings** 也可快速增减。
5. 验证 TSF 是否运作：工作管理员中应有 **`ctfmon.exe`** 程序。

URL：https://learn.microsoft.com/en-us/windows/win32/tsf/how-to-set-up-tsf

【推测】对自研 IME 的含义：
- 安装程式必须做**两件事**：① 注册 COM in-proc server（DLL 的 `DllRegisterServer` 或自建注册逻辑）② 呼叫 TSF 注册 API 建立 language profile。
- 使用者仍需**手动**到设定中把该输入法加入/启用 —— 应用无法静默设定自己为预设输入法。
- 参考实作：**小狼毫 Weasel** 的安装程式会显示「安装选项」对话框，让使用者选择要注册到哪个输入语言（例如「中文（台湾）」），安装后仍可从开始选单重新开启该对话框变更输入语言。
  https://github.com/rime/weasel （README 明载：「若要将【小狼毫】注册到繁体中文（台湾）键盘布局，请在「输入语言」栏选择「中文（台湾）」」；适用 Windows 8.1 ~ Windows 11）

### 2.7 签章需求（EV 凭证？）【已查证 + 推测】

**已查证**：
- TSF 官方文件只说 "Text service providers **should** provide digital signatures with their binary executables."（should，非 must），并连到 "Introduction to Code Signing"。
  https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework
- Windows SmartScreen 会检查下载程式的**数位签章与凭证信誉**：
  > "It also provides reputation checks for apps, checking downloaded programs and **the digital signature used to sign a file**. If a URL, a file, an app, or a certificate has an established reputation, users don't see any warnings. If there's no reputation, the item is marked as a hi[gh risk]…"
  https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/

**结论**：
- **Windows 没有强制 TSF 输入法必须用 EV 凭证的官方规定**【已查证：文件中查无此要求】。
- **但实务上**：未签章或凭证无信誉的安装档会被 SmartScreen 拦阻（「Windows 已保护您的电脑」）。标准做法是 OV 或 **EV 程式码签章凭证**；EV 凭证可较快累积 SmartScreen 信誉。【推测 —— 微软现行 SmartScreen 对 EV 的加速机制细节需查证】

### 2.8 Windows 11/12 对 IME 的限制、与「Microsoft 限制非市集 IME」政策

- **【已查证：查无此政策】** 我未能在 Microsoft 官方文件中找到任何「限制非 Microsoft Store 来源输入法」的规定。TSF 文件至今（最后更新 2022-05-10）仍公开描述第三方文字服务的注册流程；RIME 小狼毫明确支援 Windows 11 并持续发布（见 2.6）。
- **【已查证】** 值得注意的**趋势性限制**（非针对 IME 的封锁，但会影响体验）：
  - 新版 Windows 的 **UWP / WinUI / 部分系统介面** 对旧式 IMM32 IME 支援较差 → 这是「选 TSF 而非 IMM32」的主要理由。【推测：具体清单需查证】
  - **Windows 11 对「语言与地区」设定 UI 重新设计**后，加入输入法的路径与旧文件用语不同。【需查证：需要 Windows 11 专版的官方安装说明】
- **【需查证】** 我无法查证「Windows 12」是否存在官方 IME 限制政策。截至 2026-09，我未取得任何 Windows 12 的官方开发者文件。**建议不要把 Windows 12 列入规划前提。**

---

## 3. macOS：InputMethodKit (IMK)

### 3.1 框架定位【已查证】

> "Develop input methods and manage communication with client applications, candidates windows, and input method modes."
> — https://developer.apple.com/documentation/inputmethodkit

InputMethodKit 官方文件揭露的完整符号集（共 3 个 class、3 个 protocol、3 个 reference 群组）：

| 类型 | 符号 |
|---|---|
| Classes | `IMKCandidates`、`IMKInputController`、`IMKServer` |
| Protocols | `IMKMouseHandling`、`IMKServerInput`、`IMKStateSetting` |
| Reference | Enumerations、Constants、Data Types |

### 3.2 API 对照表【已查证，逐字核对 Apple 官方 JSON】

#### `IMKServer`

| 成员 | 用途 |
|---|---|
| `init(name:bundleIdentifier:)` | 初始化 server |
| `init(name:controllerClass:delegateClass:)` | 初始化 server 并指定 controller / delegate class |
| `bundle()` | 取得输入法的 bundle |
| `lastKeyEventWasDeadKey()` | 上一个按键是否为 dead key |
| `paletteWillTerminate()` | palette 即将结束 |

> ⚠️ **重要更正**：任务描述中提到的 `init(name:bundleIdentifier:controllerClass:delegateClass:)` **不存在**。Apple 官方只有上面两个 initializer（二参数与三参数，各自独立），**没有四参数版本**。
> — https://developer.apple.com/documentation/inputmethodkit/imkserver

#### `IMKInputController`

| 分类 | 成员 |
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

> ⚠️ **重要澄清**：`handle(_:client:)`、`inputText(_:client:)`、`setMarkedText(...)`、`commitComposition(_:)`、`candidates(_:)`、`activateServer(_:)`、`deactivateServer(_:)` **都不在 `IMKInputController` 的文件中** —— 它们来自 `IMKInputController` 所 conform 的 protocol（见下）。
> — https://developer.apple.com/documentation/inputmethodkit/imkinputcontroller

#### `IMKServerInput`（协定）— 这是真正处理输入事件的地方【已查证】

| 分类 | 成员 |
|---|---|
| Supporting Key Binding | `inputText(_:client:)`、`didCommand(by:client:)` |
| Unpacking Text Data | `inputText(_:key:modifiers:client:)` |
| Receiving Events Directly from TSM | `handle(_:client:)` |
| Committing a Composition | `commitComposition(_:)` |
| Getting Input Strings and Candidates | `composedString(_:)`、`originalString(_:)`、`candidates(_:)` |

> — https://developer.apple.com/documentation/inputmethodkit/imkserverinput

#### `IMKStateSetting`（协定）【已查证】

| 分类 | 成员 |
|---|---|
| Activating / Deactivating | `activateServer(_:)`、`deactivateServer(_:)` |
| Preferences | `showPreferences(_:)` |
| Supported Events | `recognizedEvents(_:)` |
| Mode Dictionary | `modes(_:)` |
| Getting / Setting Values | `value(forTag:client:)`、`setValue(_:forTag:client:)` |

> — https://developer.apple.com/documentation/inputmethodkit/imkstatesetting

#### `IMKMouseHandling`（协定）【已查证】

`mouseDown(onCharacterIndex:coordinate:withModifier:continueTracking:client:)`、`mouseUp(onCharacterIndex:coordinate:withModifier:client:)`、`mouseMoved(onCharacterIndex:coordinate:withModifier:client:)`
> — https://developer.apple.com/documentation/inputmethodkit/imkmousehandling

#### `IMKCandidates`【已查证】

| 分类 | 成员 |
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

#### InputMethodKit Constants【已查证】

`IMKCandidatesOpacityAttributeName`、`IMKCandidatesSendServerKeyEventFirst`、`IMKControllerClass`、`IMKDelegateClass`、`IMKModeDictionary`
> — https://developer.apple.com/documentation/inputmethodkit/inputmethodkit-constants

#### `IMKTextInput`

**【需查证】** Apple 现行 InputMethodKit 文件**未列出 `IMKTextInput`**（framework 符号表中没有这个 protocol）。但 `IMKInputController.client()` 回传的物件在实务上就是 client 端的 text input 物件。
→ **不要凭记忆写 `IMKTextInput` 的方法名**，需以 Xcode SDK header（`IMKInputController.h` / `IMKTextInput.h`）实地核对。

#### `IMKInputSession`

**【需查证】** Apple 公开文件中**查无** `IMKInputSession` 的类别文件。**【推测】** 它可能是私有或未文件化的型别。**不要依赖它。**

### 3.3 Info.plist：输入法 bundle 的必要 key

**【重要发现】** Apple 现行官方文件中的 "Info Dictionary Keys" 页面（https://developer.apple.com/documentation/inputmethodkit/info-dictionary-keys ）**只记载两个常数**：`kIMKCommandMenuItemName`、`kIMKCommandClientName`。

也就是说：**`tsInputModeListKey`、`ComponentInputModeDict` 这批关键 key 已经没有现代 Apple 官方文件**。它们属于旧的 Text Services Manager (TSM) 时代词汇，但仍**必须**存在，否则系统不会把输入法正确注册到输入源清单。

**实证来源**：小麦注音 McBopomofo（开源注音输入法，实际发行）的 `Info.plist`。
https://raw.githubusercontent.com/openvanilla/McBopomofo/master/Source/McBopomofo-Info.plist

实际使用的 key（逐字，来自上列档案）：

| Key | 层级 | 实例值 | 说明 |
|---|---|---|---|
| `InputMethodConnectionName` | 顶层 | `McBopomofo_1_Connection` | 对应 `IMKServer` 的 `name` |
| `InputMethodServerControllerClass` | 顶层 | `McBopomofoInputMethodController` | 对应 `IMKServer` 的 `controllerClass` |
| `InputMethodServerDelegateClass` | 顶层 | `McBopomofoInputMethodController` | 对应 `delegateClass` |
| `InputMethodServerPreferencesWindowControllerClass` | 顶层 | `PreferencesWindowController` | 偏好设定视窗 |
| `ComponentInputModeDict` | 顶层 dict | — | 容器，内含下面两项 |
| `tsInputModeListKey` | `ComponentInputModeDict` 内 | dict of dict | **每个输入模式一个 dict，key 是 `TISInputSourceID`** |
| `tsVisibleInputModeOrderedArrayKey` | `ComponentInputModeDict` 内 | array | 选单中显示顺序 |
| `TISInputSourceID` | 每个模式 | `org.openvanilla.inputmethod.McBopomofo.Bopomofo` | 输入源唯一 ID |
| `TISIntendedLanguage` | 每个模式 | `zh-Hant` | **注音应填 `zh-Hant`（繁中）** |
| `tsInputModeScriptKey` | 每个模式 | `smTradChinese` | Script manager 代码（繁中） |
| `tsInputModePrimaryInScriptKey` | 每个模式 | `<true/>` | 是否为该 script 的主要输入法 |
| `tsInputModeIsVisibleKey` | 每个模式 | `<true/>` | 是否显示于选单 |
| `tsInputModeDefaultStateKey` | 每个模式 | `<true/>` | 预设状态 |
| `tsInputModeMenuIconFileKey` | 每个模式 | `Bopomofo.tiff` | 选单图示档名 |
| `tsInputModePaletteIconFileKey` | 每个模式 | `Bopomofo.tiff` | Palette 图示 |
| `tsInputModeAlternateMenuIconFileKey` | 每个模式 | `Bopomofo.tiff` | 替代选单图示 |
| `tsInputModeCharacterRepertoireKey` | 每个模式 | `["Hant","Han"]` | 字集 |
| `tsInputModeKeyEquivalentModifiersKey` | 每个模式 | `4608` | 切换快速键 modifier |
| `tsInputMethodCharacterRepertoireKey` | 顶层 | — | 字集（顶层） |
| `tsInputMethodIconFileKey` | 顶层 | — | 图示（顶层） |
| `TICapsLockLanguageSwitchCapable` | 顶层 | — | Caps Lock 切换语言 |
| `TISParticipatesInTouchBar` | 顶层 | — | Touch Bar 支援 |
| `TISDoubleSpaceSubstitution` | 每个模式 | `。` | 连按两下空白键替换字元（中文输入法关键体验） |
| `LSUIElement` | 顶层 | — | 不在 Dock 显示（IME 必备） |

**【推测】** 一份最小可用的注音输入法 Info.plist 骨架：
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
> 此骨架是**推测**（依 McBopomofo 实例裁剪），**必须以实机测试验证**。

### 3.4 安装方式与实例【已查证】

| 专案 | 安装方式 | 目标位置 | 签章/公证 | App Store |
|---|---|---|---|---|
| **Squirrel 鼠须管**（RIME） | `make package` 产生安装包；或 `brew install squirrel-app` | `Squirrel.app`（安装包安装） | `make package` 时设 `DEV_ID` 自动签章与公证；凭证用 `xcrun notarytool store-credentials` 存 | **不在** |
| **McBopomofo 小麦注音**（注音！） | Xcode 开 `McBopomofo.xcodeproj`，build **"McBopomofo Installer" target** 后执行安装程式 | Installer 安装 | 【需查证：签章细节】 | **不在** |
| 小企鹅 fcitx5-macos | 第三方，需下载中州韵版安装器 | — | — | 不在 |

来源：
- https://github.com/rime/squirrel/blob/master/INSTALL.md
- https://rime.im/download/
- https://github.com/openvanilla/McBopomofo （README）

**Squirrel INSTALL.md 原文要点**【已查证】：
> "Define `DEV_ID` to automatically handle code signing and notarization (Apple Developer ID needed)"
> "To make notarization work, you also need to save your credential under the same name as above: `xcrun notarytool store-credentials 'your name/org'`"
> "You **don't** need to define DEV_ID if you don't intend to distribute the package."
> 直接安装（`make install`）："**You might need to precede with sudo, and without a logout, the App might not work properly. Direct install is not very recommended.**"

**McBopomofo README 原文要点**【已查证】：
> 系统需求：macOS 13 以上（执行）；开发需要 **macOS 26 / Xcode 26** 或更高。
> 「第一次安装完，日后程式码或词库有任何修改，只要重复上述流程，再次安装小麦注音即可。」
> 「macOS 可能会限制同一次 login session 能 kill 同一个输入法 process 的次数（安装程式透过 kill input method process 来让新版的输入法生效）。如果安装若干次后，发现程式修改的结果并没有出现…只要**登出目前帐号再重新登入**即可。」
> → **实务含意**：macOS 不会自动重新载入已被系统快取的 IME process；开发迭代需要 kill process 或登出。

### 3.5 沙箱、公证与 App Store【已查证】

#### App Store Review Guidelines 2.4.5（逐字，原文）

> **2.4.5** Apps distributed via the Mac App Store have some additional requirements to keep in mind:
> **(i)** They must be **appropriately sandboxed**, and follow macOS File System Documentation. They should also only use the appropriate macOS APIs for modifying user data stored by other apps (e.g. bookmarks, Address Book, or Calendar entries).
> **(ii)** They must be packaged and submitted using technologies provided in **Xcode**; **no third-party installers allowed**. They must also be **self-contained, single app installation bundles** and **cannot install code or resources in shared locations**.
> **(iii)** They may not auto-launch or have other code run automatically at startup or login without consent nor spawn processes that continue to run without consent after a user has quit the app. They should not automatically add their icons to the Dock or leave shortcuts…
> — https://developer.apple.com/app-store/review/guidelines/ （§2.4.5）

#### 对输入法的含意

| 条款 | 对 IME 的冲击 |
|---|---|
| 2.4.5(i) 必须沙箱 | 输入法需要跨 process 与前台 app 互动（`IMKTextInput` 注入文字）。**【推测】** 沙箱与 IMK 的注入模型存在根本张力。 |
| 2.4.5(ii) 不得安装到 shared location、必须单一 bundle | 传统 IME 安装到 `/Library/Input Methods/`（shared location）或 `~/Library/Input Methods/`。InstallScript 安装 `.pkg` 到 `/Library` 属 shared location。 |
| 2.4.5(iii) 不得未经同意常驻 | IME 本质上就是常驻服务（每个 client app 一个 input session）。 |

**【已查证的事实】**：**Squirrel 与 McBopomofo 这两个最活跃的开源中文输入法，都不在 Mac App Store 发行**（Squirrel 用 GitHub release + Homebrew；McBopomofo 用 GitHub release + 自制 Installer pkg）。

**【推测（高信心）】**：**自研注音输入法的 macOS 发行路径应为「官网 / GitHub 下载 + Developer ID 签章 + Apple 公证」，而非 Mac App Store。** 理由：2.4.5(i)(ii) 与 IME 的安装/注入模型直接冲突，且业界两个主要先例都选择站外散布。
> **【需查证】** 是否有 IME 成功上架 Mac App Store 的案例（例如某些日文/简中输入法）。若有，其沙箱配置值得研究。我未能查证。

#### 公证（Notarization）【已查证】

> "Notarize your macOS software to give users more confidence that the Developer ID-signed software you distribute has been checked by Apple for malicious components. **Notarization of macOS software is not App Review.** The Apple notary service is an automated system that scans your software for malicious content, checks for code-signing issues, and returns the results to you quickly. If there are no issues, the notary service generates a ticket for you to staple to your software…"
> "Starting **November 1, 2023**, the Apple notary service **no longer accepts uploads from `altool` or Xcode 13 or earlier**. … you need to transition to the **`notarytool`** command-line utility or upgrade to Xcode 14 or later."
> — https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution

**重点**：
- 公证 ≠ App Review，是自动化恶意软体扫描 + 签章检查。
- 产出 ticket，可 staple 到软体；Gatekeeper 据此决定是否显示警告。
- 现在**必须**用 `notarytool`（`altool` 自 2023-11-01 起被拒）。
- 可公证的交付型态包含：macOS apps、non-app bundles（如 kext）、**UDIF 磁碟映像**、**flat installer packages**。→ 对 IME 的 `.pkg`/`.dmg` 散布路径友善。

### 3.6 macOS 26 有无新版输入法 API

**【已查证：查无】** 我未能在 Apple 官方文件中找到 macOS 26（Tahoe）针对 InputMethodKit 的新 API、新 protocol 或 deprecation 公告。InputMethodKit 的符号集仍是 3 classes + 3 protocols。

**【已查证的侧面证据】**：McBopomofo 对**开发环境**要求 macOS 26 / Xcode 26，但**执行环境**只要 macOS 13+ —— 表示 macOS 26 并未带来破坏性的 IME API 变更。

**【需查证】** WWDC 2025 / WWDC 2026 是否有 InputMethodKit session。我无法查证（Apple session 影片页为 JS 渲染且我没有可用的搜寻引擎）。
→ **建议**：开发前用 Xcode 26 SDK 的 `IMKInputController.h` / `IMKCandidates.h` header 做一次 header diff，这是最可靠的「有无新增 API」判定法。

---

## 4. Android：InputMethodService

### 4.1 生命周期与核心类别【已查证（AOSP 原始码 + 官方文件）】

`android.inputmethodservice.InputMethodService`

官方类别说明（AOSP master 原始码 javadoc，逐字）：
> "InputMethodService provides a standard implementation of an InputMethod, which final implementations can derive from and customize. See the base class `AbstractInputMethodService` and the `InputMethod` interface for more information…"
> "In addition to the normal Service lifecycle methods, this class introduces some new specific callbacks that most subclasses will want to make use of:
> - `onInitializeInterface()` for user-interface initialization, in particular to deal with configuration changes while the service is running.
> - `onBindInput()` to find out about switching to a new client.
> - `onStartInput(EditorInfo, boolean)` to deal with an input session starting with the client.
> - `onCreateInputView()`, `onCreateCandidatesView()`, and `onCreateExtractTextView()` for non-demand generation of the UI.
> - `onStartInputView(EditorInfo, boolean)` to deal with input starting within the input area of the IME."

来源：
- https://developer.android.com/reference/android/inputmethodservice/InputMethodService
- AOSP 原始码：`core/java/android/inputmethodservice/InputMethodService.java`（https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/inputmethodservice/InputMethodService.java）

| 成员 | 时机 | 用途 |
|---|---|---|
| `onCreate()` | Service 首次建立 | 初始化 |
| `onInitializeInterface()` | 建立时 / 设定变更 | UI 初始化，处理旋转等 configuration change |
| `onBindInput()` | 切换到新 client | 取得 `InputBinding` |
| `onStartInput(EditorInfo, boolean restarting)` | 输入连线开始 | 读取 `EditorInfo`（inputType、imeOptions、packageName…） |
| `onCreateInputView()` | 需要输入区域 UI 时（一次） | **回传软键盘 View 阶层** |
| `onCreateCandidatesView()` | 需要候选 UI 时（一次） | 回传候选字 View 阶层，预设 `null` |
| `onCreateExtractTextView()` | 全萤幕模式 | 回传抽取文字编辑器 |
| `onStartInputView(EditorInfo, boolean)` | 输入区域开始 | view 专属设定 |
| `onFinishInputView(boolean)` / `onFinishInput()` | 结束 | 收尾 |
| `onUpdateSelection(...)` | 选取范围变动 | 更新组字状态 |
| `onUpdateCursorAnchorInfo(CursorAnchorInfo)` | 游标位置变动 | **取代已 deprecated 的 `onUpdateCursor(Rect)`** |
| `onUpdateEditorToolType(int)` | 使用者以笔/触控点击 | **取代已 deprecated 的 `onViewClicked(boolean)`**（API 29） |
| `onEvaluateInputViewShown()` | 是否显示输入区域 | 预设依硬体键盘有无决定 |
| `onEvaluateFullscreenMode()` | 是否全萤幕 | — |
| `onComputeInsets(Insets)` | 计算 UI insets | **Android 15+ edge-to-edge 下更关键** |
| `onCurrentInputMethodSubtypeChanged(...)` | 子类型切换 | 注音/拼音切换 |
| `onCreateInlineSuggestionsRequest(Bundle)` | Autofill 要求 inline suggestion | 与候选字**不同**的机制 |
| `setCandidatesViewShown(boolean)` | 执行期 | 控制候选区显示 |
| `setCandidatesView(View)` / `setInputView(View)` | 执行期 | 动态替换 |

`android.view.inputmethod.InputMethodManager`：
- `showSoftInput()`、`hideSoftInputFromWindow()`、`showInputMethodPicker()`、`getInputMethodList()`、`setInputMethod()`
- 官方文件：https://developer.android.com/reference/android/view/inputmethod/InputMethodManager

`InputConnection`（IME → app 的文字操作）：
- `commitText()`、`setComposingText()`、`finishComposingText()`、`deleteSurroundingText()`、`sendKeyEvent()`、`getCursorCapsMode()`、`performEditorAction()`
- 官方文件：https://developer.android.com/reference/android/view/inputmethod/InputConnection

Manifest 必要宣告【已查证，官方 IME 开发指南】：
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
（`android:imeSubtypeLocale`、`android:imeSubtypeMode`、`android:isAsciiCapable` 逐字来自官方指南）

官方指南：https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method

### 4.2 候选字视窗：⚠️ 更正一个常见误解

**任务描述假设「CandidatesView 已 deprecated」——这个假设是错的。**

**【已查证，两路独立证据】**：

1. **官方 reference 页**：`onCreateCandidatesView()` 标示 "**Added in API level 3**"，**没有** deprecated 标记，也没有 "This method was deprecated" 字样。
   https://developer.android.com/reference/android/inputmethodservice/InputMethodService
2. **AOSP master 原始码**：`public View onCreateCandidatesView()` **没有任何 `@Deprecated` annotation**。其 javadoc 为：
   > "Create and return the view hierarchy used to show candidates. This will be called once, when the candidates are first displayed. You can return null to have no candidates view; the default implementation returns null. To control when the candidates view is displayed, use `setCandidatesViewShown(boolean)`. To change the candidates view after the first one is created by this function, use `setCandidatesView(View)`."

同样地，`setCandidatesView(View)`、`setCandidatesViewShown(boolean)`、`onStartCandidatesView(EditorInfo, boolean)`、`onFinishCandidatesView(boolean)` 均**未** deprecated。

**真正 deprecated 的 `InputMethodService` 成员**【已查证，从官方 reference 逐项抓取】：

| 成员 | Deprecated 于 | 替代方案 |
|---|---|---|
| `onCreateInputMethodInterface()` | 未标版本（"A future version of Android will remove the ability to use this method"） | 改用 `InputMethodService` 的 callbacks |
| `onCreateInputMethodSessionInterface()` | 未标版本 | 改用 `InputMethodService` 的 callbacks |
| `onUpdateCursor(Rect)` | **API 21** | `onUpdateCursorAnchorInfo(CursorAnchorInfo)` |
| `onViewClicked(boolean)` | **API 29** | `onUpdateEditorToolType(int)` |
| `getInputMethodWindowRecommendedHeight()` | **API 29**（"the actual behavior of this method has never been well defined"） | 无直接替代 |
| `enableHardwareAcceleration()` | **API 21** | 硬体加速自 API 21 起一律启用 |
| `BACK_DISPOSITION_WILL_DISMISS` / `BACK_DISPOSITION_WILL_NOT_DISMISS` | **API 28** | `BACK_DISPOSITION_DEFAULT` |

**实务结论**：
- **候选字可以用 `onCreateCandidatesView()` + `setCandidatesViewShown()`**，这是官方支援、未 deprecated 的机制。
- **但在实务上仍建议「在 `onCreateInputView()` 里自绘整个键盘 + 候选列」**，理由【推测】：
  1. 候选区与键盘区在 CandidatesView 模型下是**分离的两个 frame**，无法做统一的动画与高度协商。
  2. Android 15+ 强制 edge-to-edge 后，IME insets 行为改变，单一 view 较好控制。
  3. 主流 IME（Gboard、Trime）都采自绘候选列。
- **【已查证】`InlineSuggestion` / `onCreateInlineSuggestionsRequest()` 是 Autofill 的 inline suggestion 机制，与 IME 候选字是两件不同的事**，不要混用。

### 4.3 设为预设输入法

**【已查证，使用者流程】**：
设定 → 系统 → 语言与输入 → 萤幕键盘 → 启用你的输入法 → 用输入法切换器（导航列地球/键盘图示）切换。
（首次启用时系统会显示「允许使用此输入法？」警告对话框，因为 IME 能看到所有输入内容。）

**【已查证，程式面】**：
- `InputMethodManager.setInputMethod()` 需要 `android.permission.WRITE_SECURE_SETTINGS`，**只有系统 app 或 adb 能取得**。
- **应用无法静默把自己设为预设输入法**。必须引导使用者手动操作。
- 开发阶段可用 adb：
  ```
  adb shell ime list -a
  adb shell ime enable com.example.ime/.MyInputMethod
  adb shell ime set    com.example.ime/.MyInputMethod
  ```
  【需查证：`adb shell ime` 的官方文件页面 URL —— 我未取得官方 `ime` 指令的独立文件页】

### 4.4 Google Play 政策

**【已查证：查无 IME 专属政策条目】** 我检索了 Google Play 政策中心与使用者资料政策页面，**未找到针对输入法（IME / keyboard）的专门政策条目或专属申报表单**。

**【已查证的间接证据】**：Trime（同文输入法，开源 RIME Android 前端）**同时在 Google Play 与 F-Droid 上架**：
> "[Get it on F-Droid] … [Get it on Google Play]"
> — https://github.com/osfans/trime
→ 证明**第三方开源输入法可以通过 Google Play 审核**。

**【推测（高信心）】**：IME 适用 Google Play 的**一般性政策**，主要风险领域：
- **Personal and Sensitive User Data**（输入法可读取使用者所有按键 → 最高敏感度）→ 必须有隐私政策、必须揭露资料收集。
- **Device and Network Abuse** / **Malware**（键盘侧录器是重点打击对象）。
- 政策中心：https://support.google.com/googleplay/android-developer/topic/9858052
- 使用者资料政策：https://support.google.com/googleplay/android-developer/answer/10144311

**【需查证】** 是否有 Play Console 内的额外宣告表单（我未能登入验证）。

### 4.5 targetSdk 要求（2026 年现况）【已查证】

> "**Starting August 31, 2026:** New apps and app updates must **target Android 16 (API level 36) or higher** to be submitted to Google Play; except for Wear OS, and Android Automotive OS apps, which must target Android 15 (API level 35) or higher, and Android TV and Android XR apps, which must target Android 14 (API level 34) or higher."
> "Existing apps must target Android 15 (API level 35) or higher to remain available to new users on devices running Android OS higher than your app's target API level."
> — https://support.google.com/googleplay/android-developer/answer/11926878

| 期限 | 要求 |
|---|---|
| 2025-08-31 | 新 app / 更新必须 target API 35 (Android 15) |
| **2026-08-31（已生效）** | **新 app / 更新必须 target API 36 (Android 16)** |
| Wear OS / Automotive | API 35 |
| Android TV / XR | API 34 |

**注意**：今天是 2026-09-26，所以 **API 36 已经是硬性要求**。新专案直接以 `targetSdk = 36` 起跳。
另见：https://developer.android.com/google/play/requirements/target-sdk

### 4.6 Android 15 / 16 / 17 对 IME 的影响

| 版本 | API | 已查证的变更 | 对 IME 的影响 |
|---|---|---|---|
| Android 15 | 35 | **edge-to-edge 强制**；`Window.setDecorFitsSystemWindows` 相关变更 | IME 的 `onComputeInsets()` 需重写；候选列高度与系统列需协商 |
| Android 16 | 36 | edge-to-edge **全面强制（opt-out 移除）**；predictive back 预设开启 | IME 需完整支援 predictive back（`onBackPressed` / `OnBackInvokedCallback`）；`BACK_DISPOSITION_ADJUST_NOTHING` 在 target CINNAMON_BUN 以上且 manifest 设 `android:enableOnBackInvokedCallback="true"` 时，会让 back 事件**绕过 IME 直接送给 app** |
| Android 17 | 37 | **查无 IME 专属变更** | — |

**【已查证】** Android 17 的 AOSP 代号为 **`CINNAMON_BUN`** —— 这是我在官方 reference 页的 `setBackDisposition()` 说明中读到的（"targeting `Build.VERSION_CODES.CINNAMON_BUN` or higher"）。
https://developer.android.com/reference/android/inputmethodservice/InputMethodService

**【需查证】** Android 17（API 37）的 behavior changes 页面（`developer.android.com/about/versions/17/behavior-changes-*`）是否已公布且有 IME 相关条目。我未能查证该页面内容。

**【已查证】** Android 16 behavior changes 总览页存在：https://developer.android.com/about/versions/16/behavior-changes-all

---

## 5. HarmonyOS NEXT（HarmonyOS 5/6/7，纯鸿蒙）

> 本节是全报告最关键部分。**重大方法论说明**：华为 `developer.huawei.com` 是纯 SPA，抓取极不稳定。因此本节主体证据来自 **OpenHarmony 官方 docs repo**（`openharmony/docs`）。其 IME Kit 文件与华为 `@kit.IMEKit` 的 API 高度一致（同一套 `@ohos.inputMethodEngine` 等模组），且可完整下载检索。
> **OpenHarmony 与 HarmonyOS NEXT 的差异见 5.9 节** —— 引用 OpenHarmony 文件时我会明确标示。

### 5.1 框架定位【已查证】

**IME Kit 简介（华为官方页，Obscura 成功抓取原文）**：

> "IME Kit 负责建立**编辑框所在应用与输入法应用之间的通信通道**，确保两者可以共同协作提供文本输入功能，也为系统应用提供管理输入法应用的能力。"
> "IME Kit提供**输入法框架**和**输入法服务**两类API。用于实现输入法应用，也可以用于实现自绘编辑框以及实现对输入法应用的控制。"
> - 输入法应用：支持创建**固定态、悬浮态、状态栏三种类型的Panel**，可支持开发一个输入法应用同时部署在手机、平板等多设备中。
> - 自定义编辑框：支持开发者自定义编辑框，实现绑定输入法应用…
> - 提供系统应用管理输入法应用能力：显示/隐藏输入法软键盘、切换输入法、获取所有输入法列表。
> 与相关 Kit 的关系：**ArkUI** — IME Kit 在输入法软键盘和自绘编辑框时使用 ArkUI 提供的部分组件、事件、动效、状态管理等能力，例如 `Text`、`Button` 组件，`onClick` 点击事件。
> 约束限制：针对切换输入法应用的系统 API，需要申请系统权限，部分 API 仅支持当前输入法应用调用。
> 模拟器支持情况：本 Kit 支持模拟器。

URL：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ime-kit-intro

**API 参考文件清单**（同页列出）：`inputMethodEngine`、`inputMethod`、`InputMethodExtensionAbility`、`InputMethodExtensionContext`、`inputMethodList`、`InputMethodSubtype`、`inputMethod.Panel`

### 5.2 `@ohos.inputMethodEngine`（输入法服务端 API）【已查证】

**导入方式**（逐字）：
```ts
import { inputMethodEngine } from '@kit.IMEKit';
```
**首批接口从 API version 8 开始支持**。**SystemCapability：`SystemCapability.MiscServices.InputMethodFramework`**

来源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethodengine.md
（华为对应页：https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-inputmethodengine）

> **官方明文：本模组面向「包括系统输入法应用、**三方输入法应用**」**
> "本模块面向输入法应用（包括系统输入法应用、三方输入法应用），为输入法应用提供能力，包括：创建软键盘窗口、插入/删除字符、选中文本、监听物理键盘按键事件等。"
> → **这是「HarmonyOS IME 框架支持第三方输入法」最直接的官方证据。**

#### 取得实例

| API | 版本 | 说明 |
|---|---|---|
| `inputMethodEngine.getInputMethodAbility(): InputMethodAbility` | API 9+ | **输入法应用取得此实例后，可订阅软键盘显示/隐藏请求事件、建立/销毁输入法面板等** |
| `inputMethodEngine.getKeyboardDelegate(): KeyboardDelegate` | API 9+ | 取得客户端编辑事件监听代理，可订阅**物理键盘按键事件、选中文本变化事件** |
| ~~`getInputMethodEngine()`~~ | API 8 支援、**API 9 废弃、API 23 废弃** | 用 `getInputMethodAbility()` 替代 |
| ~~`createKeyboardDelegate()`~~ | API 8 支援、API 9 废弃 | 用 `getKeyboardDelegate()` 替代 |

#### `InputMethodAbility` 事件

| 事件 | 版本 | 回呼签名 |
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

`PanelType`（模组 `@ohos.inputMethod.Panel`）：

| 名称 | 值 | 说明 |
|---|---|---|
| `SOFT_KEYBOARD` | 0 | 软键盘类型 |
| `STATUS_BAR` | 1 | 状态栏类型 |

`PanelFlag`（目前仅用于 `SOFT_KEYBOARD`）：

| 名称 | 值 | 说明 |
|---|---|---|
| `FLAG_FIXED` | 0 | 固定态面板 |
| `FLAG_FLOATING` | 1 | 悬浮态面板 |
| `FLAG_CANDIDATE` | 2 | **候选词态面板** — 「当输入面板为候选词态时，面板为显示用户输入候选词的窗口。**输入法服务不会主动控制候选词态面板的显示和隐藏，需要开发者根据情况自行控制**」 |

`Panel` 方法（节选）：

| 方法 | 版本 | 说明 / 权限 |
|---|---|---|
| `setUiContent(path)` | — | 载入 ArkUI 页面（例如 `'InputMethodExtensionAbility/pages/Index'`） |
| `resize(w, h)` | 10+ | 改变面板大小 |
| `adjustPanelRect(...)` | 12+ / 15+ | 调整面板矩形（系统会按规则校验） |
| `moveTo(...)` | — | 移动面板 |
| `show()` / `hide()` | 10+ | 显示 / 隐藏 |
| `on('show' \| 'hide')` | 10+ | 监听显示 / 隐藏 |
| `on('sizeChange')` | 12+ | 面板大小变化（系统校验后的真实大小）；API 15 起回呼增加 `KeyboardArea` |
| `changeFlag(flag: PanelFlag)` | 10+ | 切换面板形态，**仅对 SOFT_KEYBOARD 生效** |
| `setPrivacyMode(isPrivacyMode: boolean)` | 11+ | 隐私模式（不可录屏/截屏）。**需要权限 `ohos.permission.PRIVACY_WINDOW`** |
| `setImmersiveMode(mode: ImmersiveMode)` | 15+ | 沉浸模式（`NONE_IMMERSIVE` / `LIGHT_IMMERSIVE` / `DARK_IMMERSIVE`；**不能设为 `IMMERSIVE`**） |
| `getImmersiveMode()` | 15+ | — |
| `setImmersiveEffect(effect)` | 20+ | 渐变/流光效果；**只有系统应用才能设置流光模式** |
| `setKeepScreenOn(bool)` | 20+ | 萤幕常亮（语音输入等场景） |
| `getSystemPanelCurrentInsets(displayId)` | 21+ | 取得键盘相对系统面板的偏移区域 |
| `setSystemPanelButtonColor(fill, bg)` | 22+ | 设定功能键颜色 |
| `getDisplayId()` | 15+ | — |

#### `InputClient`（输入法 → 编辑框）

| 方法 | 版本 | 说明 |
|---|---|---|
| `sendKeyFunction(action: number)` | 9+ | 发送功能键（0 = 无效按键，1 = 确认键/回车） |
| `insertText(text)` / `deleteForward(n)` / `deleteBackward(n)` | — | 文字插入与删除 |
| `moveCursor(direction: Direction)` | — | `CURSOR_UP/DOWN/LEFT/RIGHT` |
| `getForward(n)` / `getBackward(n)` | — | 读取游标前后文字 |
| `recvMessage(handler: MessageHandler)` | 15+ | 接收编辑框应用发送的自订资料（`onMessage(msgId, msgParam?)` / `onTerminated()`） |
| `sendMessage(msgId, msgParam?)` | 15+ | 反向发送 |
| `getEditorAttribute()` / `getTextConfig()` | — | 取得编辑框属性 |

#### `KeyboardController`（输入法 → 系统）

| 方法 | 版本 | 说明 |
|---|---|---|
| `hide()` | 9+ | 隐藏输入法（取代已废弃的 `hideKeyboard()`） |
| `exitCurrentInputType()` | 11+ | 退出当前输入类型。**仅支持系统配置的预设输入法应用调用**（错误码 `12800010 not the preconfigured default input method.`） |

#### `KeyboardDelegate` 事件

`on('keyDown')`、`on('keyUp')`、`on('cursorContextChange')`、`on('selectionChange')`、`on('textChange')`、`on('editorAttributeChanged')`

回呼回传 `KeyEvent { keyCode, keyAction }`；`keyDown`/`keyUp` 回呼**需回传 boolean** 表示是否消费该按键。

#### 常数（节选）

`ENTER_KEY_TYPE_*`（`UNSPECIFIED`=0, `GO`=2, `SEARCH`=3, `SEND`=4, `NEXT`=5, `DONE`=6, `PREVIOUS`=7, `NEWLINE`=8/API12+）
`PATTERN_*`（`NULL`=-1, `TEXT`=0, `NUMBER`=2, `PHONE`=3, `DATETIME`=4, `EMAIL`=5, `URI`=6, `PASSWORD`=7, `PASSWORD_NUMBER`=8/API11+, `PASSWORD_SCREEN_LOCK`=9/API11+, `USER_NAME`=10/API20+, `NEW_PASSWORD`=11/API20+, `NUMBER_DECIMAL`=12/API20+, `ONE_TIME_CODE`=13/API20+）
`OPTION_*`（`NONE`=0, `MULTI_LINE`=1, `AUTO_CAP_CHARACTERS`=2, `AUTO_WORDS`=4, `AUTO_CAP_SENTENCES`=8, `ASCII`=20, `NO_FULLSCREEN`=10）
`FLAG_SELECTING`=2, `FLAG_SINGLE_LINE`=1
`DISPLAY_MODE_PART`=0, `DISPLAY_MODE_FULL`=1
`CURSOR_UP`=1, `CURSOR_DOWN`=2, `CURSOR_LEFT`=3, `CURSOR_RIGHT`=4（API 9+）
`WINDOW_TYPE_INPUT_METHOD_FLOAT` = **2105**（API 9+，输入法应用窗口风格标识）

`ExtendAction`：`SELECT_ALL`=0, `CUT`=3, `COPY`=4, `PASTE`=5
`Direction`：`CURSOR_UP`=1, `CURSOR_DOWN`=2, `CURSOR_LEFT`=3, `CURSOR_RIGHT`=4

#### ⭐ `SecurityMode`（安全模式）—— 对第三方输入法最关键的设计【已查证】

| 名称 | 值 | 说明（逐字） |
|---|---|---|
| `BASIC` | 0 | **基础访问模式，基础打字模式，会限制网络访问。** |
| `FULL` | 1 | **完全访问模式，不做限制，可以访问网络。** |

→ **HarmonyOS 把「输入法能否连网」做成了使用者/系统可控的安全模式**，这与 iOS 的 "Allow Full Access" 是完全同构的设计。**这意味著：任何依赖云端词库、云端联想、云端同步的注音输入法功能，在 BASIC 模式下都会失效，必须纯本地降级。**

### 5.3 `@ohos.InputMethodExtensionAbility`【已查证】

**导入**：`import { InputMethodExtensionAbility } from '@kit.IMEKit';`
**首批接口从 API version 9 开始支持**。**本模组接口仅可在 Stage 模型下使用。**

| 成员 | 说明 |
|---|---|
| `context: InputMethodExtensionContext` | Extension 上下文（继承 `ExtensionContext`） |
| `onCreate(want: Want): void` | Extension 生命周期回呼，**拉起输入法 Extension 时调用**，执行初始化 |
| `onDestroy(): void` | 销毁时回呼，清理资源 |

> "如果服务已创建，再次启动该InputMethodExtensionAbility不会触发onCreate()回调。"

来源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod-extension-ability.md

### 5.4 `module.json5` 设定（输入法 Extension 注册）【已查证】

官方开发指南原文：

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

**逐字确认**：`"type": "inputMethod"`；metadata name = `"ohos.extension.input_method"`；resource = `"$profile:input_method_config"`。

`module-configuration-file.md` 对 `inputMethod` 的官方定义：
> `inputMethod` | 输入法的ExtensionAbility。

来源：
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-application-guide.md
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/quick-start/module-configuration-file.md

**【需查证】** `input_method_config` profile 的 JSON schema（栏位定义）。我未取得该 profile 的官方规格文件，官方范例 repo 的路径也未能确认。
→ 取得方式：DevEco Studio 新建 InputMethodExtensionAbility 模板时会自动产生 `resources/base/profile/input_method_config.json`，直接看模板最可靠。

### 5.5 官方开发流程（实作骨架）【已查证】

官方「实现一个输入法应用」指南给出的工程结构：

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

`InputMethodService.ets`（官方范例，逐字）：
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

`KeyboardController.ets`（官方范例核心逻辑，逐字）：
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

**游标定位**：`KeyboardDelegate.on('cursorContextChange', (x, y, height))` → 这是候选字窗跟随游标的官方机制。

### 5.6 ⚠️ 安全管控与「基础访问模式」——第三方输入法的真正限制【已查证】

官方「约束与限制」原文（**逐字，极重要**）：

> "为了降低InputMethodExtensionAbility能力被三方应用滥用的风险，现通过**基础访问模式**的功能约束对输入法应用进行安全管控。
> **说明：** 严格遵从基础访问模式的功能约束。在此模式下，开发者应**仅提供基础打字功能，不应提供任何形式与网络交互相关的功能**。系统会逐步增加基础访问模式的安全管控能力，包括但不限于：**以独立进程和沙箱的方式运行Extension进程；禁止Extension进程创建子进程；进程间通信与网络访问**等。因此未遵从此约定可能会导致功能异常。"

来源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-application-guide.md

**解读**：
1. 官方**明确承认三方输入法会被限制**，且限制会**逐步加强**（"系统会逐步增加…"）。
2. 基础模式下**禁止网路互动** → 云端词库/云端联想不可用。
3. 未来会**独立进程 + 沙箱 + 禁止子进程 + 限制 IPC** → 对「C++ 核心 + 多进程架构」是重大风险（见第 6 节）。
4. 对应的 API 就是 `SecurityMode.BASIC` / `SecurityMode.FULL`。
5. `on('privateCommand')` 与 `KeyboardController.exitCurrentInputType()` 的错误码 `12800010 not the preconfigured default input method.` 显示：**部分能力只有「系统预配置的预设输入法」能用**。

### 5.7 切换输入法与 hdc 工具

#### `@ohos.inputMethod`（框架端 API）【已查证】

导入：`import { inputMethod } from '@kit.IMEKit';`

| API | 版本 | 权限 / 限制（逐字） |
|---|---|---|
| `inputMethod.getController()` | 9+ | — |
| `inputMethod.getDefaultInputMethod()` | 11+ | — |
| `inputMethod.getSystemInputMethodConfigAbility()` | 11+ | — |
| `inputMethod.getSetting()` | 9+ | 取得 `InputMethodSetting` |
| `inputMethod.switchInputMethod(target)` | 9+ | "在API version 9-10版本，仅支持系统应用调用且需要权限 `ohos.permission.CONNECT_IME_ABILITY`。**在API version 11版本起，仅支持当前输入法应用调用。**" |
| `inputMethod.switchCurrentInputMethodSubtype(subtype)` | 9+ | 限当前输入法应用 |
| `inputMethod.switchCurrentInputMethodAndSubtype(...)` | 9+ | 限当前输入法应用 |
| `inputMethod.getCurrentInputMethod()` | 9+ | — |
| `inputMethod.setSimpleKeyboardEnabled()` | 20+ | — |
| `inputMethod.onAttachmentDidFail()` | 22+ | — |
| `InputMethodController.showSoftKeyboard()` / `hideSoftKeyboard()` | 9+ | **需要权限 `ohos.permission.CONNECT_IME_ABILITY`，仅系统应用可用** |
| `InputMethodController.showTextInput()` / `hideTextInput()` | 10+ | 同上 |
| `InputMethodController.attach()` | 10+ | 绑定输入法到自绘编辑框 |
| `InputMethodController.attachWithUIContext()` | 23+ | — |

来源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod.md

**关键推论**：
- **普通 app 无法切换输入法**（API 11 起 `switchInputMethod` 只允许「当前输入法应用」呼叫）。
- **显示/隐藏软键盘的系统级 API 只有系统应用能用**（`ohos.permission.CONNECT_IME_ABILITY`）。
- → 使用者**必须手动**到设定中启用并切换输入法。

#### `hdc shell ime` 工具（API 20+）【已查证】

**Ime工具从 API version 20 开始支持。**

```
hdc shell ime [选项] [参数]
```

| 选项 | 参数 | 描述（逐字要点） |
|---|---|---|
| `-u` | userId | 指定操作的使用者 ID（API 26.0.0 起支援多使用者） |
| `-e` | bundle [-b /-f] | **启用指定输入法到指定模式。未设定 -b/-f 选项时，预设 `-b` 为基础模式，`-f` 为完整体验模式。** ⚠️「**系统预置的默认输入法不支持通过此命令更改其使能状态**」 |
| `-d` | bundle | 禁用指定输入法。⚠️「**不允许禁用预置默认输入法**」 |
| `-s` | bundle | 切换到指定输入法。⚠️「**在锁屏或密码输入场景下，不允许切换到其他输入法**」 |
| `-g` | — | 取得当前输入法 |
| `-l` | — | 列出所有输入法（预置预设输入法不显示使能状态） |
| `-h` | — | 说明 |

官方范例：
```shell
hdc shell ime -e com.xxx.yyy        # 启用三方输入法到基础模式
hdc shell ime -e com.xxx.yyy -f     # 启用三方输入法到完整体验模式
hdc shell ime -d com.xxx.yyy        # 禁用三方输入法
hdc shell ime -s com.xxx.yyy        # 切换输入法
hdc shell ime -g                    # 获取当前输入法
hdc shell ime -l                    # 列出所有输入法
```

来源：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-hdc-commands-guide.md

**极重要**：原文明确写「**支持启用三方输入法到基础模式或者完整体验模式**」→ **官方命令层面确认：三方输入法可以在 OpenHarmony 上被启用，且有 basic / full 两种模式。**

### 5.8 ⭐ 第三方输入法在 HarmonyOS NEXT 上到底可不可行？

#### 技术层面：**可行**【已查证】

| 证据 | 来源 |
|---|---|
| IME 引擎模组明文面向「**三方输入法应用**」 | `js-apis-inputmethodengine.md` |
| `InputMethodSetting.getInputMethods()` 可列出已启用输入法 | `js-apis-inputmethod.md` |
| `switchInputMethod()` API 11 起开放给「当前输入法应用」呼叫 | `js-apis-inputmethod.md` |
| hdc `ime -e <bundle> [-f]` 明文「**支持启用三方输入法**到基础模式或者完整体验模式」 | `inputmethod-hdc-commands-guide.md` |
| 官方提供完整开发指南 + **官方范例 App（KikaInput）** | `inputmethod-application-guide.md` |
| `InputMethodExtensionAbility` 向所有开发者开放（非 system-only） | `js-apis-inputmethod-extension-ability.md` |

#### 商业/治理层面：**受多重约束**

| 约束 | 性质 | 来源 |
|---|---|---|
| 三方输入法可能被限制为**基础访问模式**（禁网路、未来禁子进程/IPC、独立沙箱） | **已查证（官方明文）** | `inputmethod-application-guide.md` 约束与限制 |
| 部分能力仅「系统预配置的预设输入法」可用（错误码 12800010） | **已查证** | `js-apis-inputmethodengine.md` |
| 系统预置预设输入法不可被 `ime -d` 禁用 | **已查证** | `inputmethod-hdc-commands-guide.md` |
| 应用的签章（`.p12` / `.cer` / `.p7b`）与 AGC 凭证流程 | **【需查证细节】** | 见 5.10 |
| 侧载（sideload）第三方输入法的可行性与装置数上限 | **【需查证】** | 见 5.10 |
| AppGallery 上架审核、输入法类别是否需特殊资质 | **【需查证】** | 见 5.10 |

#### 难度评估【推测】

| 面向 | 难度 | 说明 |
|---|---|---|
| 取得 IME Extension 跑起来（示范级软键盘） | **低–中** | 官方有完整指南 + KikaInput 范例；ArkTS/ArkUI 开发 |
| 做出可用的注音输入法（键盘 + 候选 + 组字 + 词库） | **中–高** | 核心难点是注音组字逻辑与词库；ArkTS 语言限制会增加移植成本 |
| 纯本地高效能词库引擎（C++/Rust） | **中** | NDK/NAPI 可用，但**注意基础模式未来「禁止子进程 / 限制 IPC」**，且 IME 面板 UI 必须是 ArkUI |
| 通过上架审核 | **【需查证】** | 取决于资质要求 |
| 让使用者真的能选用你的输入法 | **中** | 需引导使用者手动启用；部分情境（锁屏/密码）系统不允许切换 |

#### 开源先例【已查证】

| 专案 | 性质 | 来源 |
|---|---|---|
| **KikaInput（轻量级输入法）** | **OpenHarmony 官方范例**，完整 IME 实作 | https://gitcode.com/openharmony/applications_app_samples/tree/master/code/Solutions/InputMethod/KikaInput |
| KikaInputMethod | 官方文件中引用的 DocsSample 范例（ArkTS，含 KeyboardController / Index.ets） | 见 `inputmethod-application-guide.md` 内注解连结 |

**【已查证：查无】** 我**未找到**任何「Trime 鸿蒙版」、「Rime 移植到 HarmonyOS NEXT」的官方或可信专案。**【需查证】** 这是因为我没有可用的搜寻引擎，**不代表不存在**。

**【已查证】** 已上架的第三方鸿蒙输入法（百度/搜狗/讯飞鸿蒙版）：**我无法查证**。我的搜寻工具全数失效，且 AppGallery 网站为 SPA。
→ **这是本报告最重要的待办事项**：**若能确认「搜狗/百度输入法鸿蒙版」已上架且可被设为预设，则商业可行性立即确认**。建议用可用的搜寻引擎或直接询问华为开发者支援。

### 5.9 OpenHarmony vs HarmonyOS NEXT 对 IME 的影响

| 面向 | OpenHarmony（开源） | HarmonyOS NEXT（华为商业版） |
|---|---|---|
| IME 框架 | 有（IME Kit，本次引用的全部 API） | 同一套 IME Kit（`@kit.IMEKit`） |
| 应用来源 | 可自由侧载、可自行签章 | **强制签章 + 透过 AppGallery / 官方测试管道** |
| 预设输入法 | `hdc shell ime -e/-s` 可控 | 使用者手动 + 系统治理；`-d` 不可禁用预置预设输入法 |
| 系统权限 API | 同样有 `system_basic` / `system_core` 限制 | 同 |
| NDK | 开放 | 开放（NAPI / Native） |
| 差异本质 | **技术框架相同；治理与签章不同** | |

**【推测（高信心）】**：OpenHarmony 文件描述的 API 与限制**适用于 HarmonyOS NEXT**（同一套 Kit、同一份 `module.json5` schema）。差异在于：
- **发布管道**：OpenHarmony 装置可自由装；HarmonyOS NEXT 必须走 AGC 签章与 AppGallery（或官方测试管道）。
- **安全管控强度**：OpenHarmony 文件已预告「系统会逐步增加基础访问模式的安全管控能力」；**商业版可能比开源版更早、更严格地实施**。**【推测】**

### 5.10 签章、侧载、上架（多为【需查证】）

#### 已查证

**DevEco Studio 提供自动签名与手动签名两种除错签章方式**（Obscura 成功抓取原文）：

> "针对**开发调试场景**，DevEco Studio提供**自动签名**和**手动签名**两种调试签名方式，帮助开发者高效进行应用调试。
> 自动签名适用于大部分调试场景，但部分调试场景须使用手动签名，具体为**跨设备调试、跨应用交互调试、断网情况下调试、多用户共同开发且需要共享密钥、kit需要配置指纹**。"

URL：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing

→ **这证明：HarmonyOS 开发有「自动签名」与「手动签名」两条路径，且手动签名用于特定场景。** 但**页面的「手动签名」分页内容是 SPA tab，Obscura 未抓到**，因此 `.p12` / `.cer` / `.p7b` 的具体关系**【需查证】**。

#### 【需查证】清单（附应查证的官方 URL，均已验证 HTTP 200 可达）

| 项目 | 应查证 URL |
|---|---|
| 手动签名：`.p12` / `.cer` / `.p7b` 三者关系与产生流程 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing （「手动签名」分页） |
| 真机执行与装置注册（debug 凭证 + 装置白名单） | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-run-device |
| 应用发布流程 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-publish-app |
| AGC 申请凭证 / Profile | https://developer.huawei.com/consumer/cn/doc/app/ （AppGallery Connect 说明文件） |
| AppGallery 审核指南 | https://developer.huawei.com/consumer/cn/doc/app/50104 |
| 开发者实名认证 | https://developer.huawei.com/consumer/cn/ （开发者联盟帐号流程） |
| 应用资质要求（输入法是否需特殊资质） | AppGallery 审核指南「资质要求」章节 |
| 侧载 / 调试装置数量上限 / 内部测试 | AGC「内部测试」/「公开测试」说明 |
| 已上架第三方鸿蒙输入法清单 | AppGallery 搜寻「输入法」 |

> **建议**：这些页面需要**登入华为开发者帐号**才能完整阅读，且是 SPA。取得方式：用 Windows 浏览器登入后人工阅读，或请华为开发者支援直接回答。

### 5.11 跨语言开发可行性

| 方案 | 可行性 | 依据 |
|---|---|---|
| **ArkTS / ArkUI** | ✅ **官方首选，唯一被明确支援的 IME UI 方案** | 官方指南全部用 `.ets`；`Panel.setUiContent('.../pages/Index')` 载入 ArkUI 页面 |
| **C/C++ via NAPI（NDK）** | ⚠️ **部分可行 —— 但 C API 是给「自绘编辑框」用的，不是给输入法本身** | 见下 |
| **Flutter** | **【需查证】** | 我未能查证 OpenHarmony SIG 的 Flutter fork 现况 |
| **Qt** | **【需查证】** | 同上 |

#### 关于 C/C++（重要澄清）【已查证】

OpenHarmony 确实有 IME 的 **C API**，但**它的服务对象是「自绘编辑框」（client 端），不是输入法应用本身**：

官方指南标题即为：**「在自绘编辑框中使用输入法开发指导 (C/C++)」**
> "IME Kit支持开发者在**自绘编辑框**中使用输入法，与输入法应用交互，包括显示、隐藏输入法，接收来自输入法应用的文本编辑操作通知等，本文档介绍开发者如何使用C/C++完成此功能开发。"

```txt
CMakeLists.txt: libohinputmethod.so
#include <inputmethod/inputmethod_controller_capi.h>
```

C API 档案清单（`InputMethod` 模组，起始版本 **12**）：

| 标头 | 描述 |
|---|---|
| `inputmethod_attach_options_capi.h` | 输入法绑定选项物件 |
| `inputmethod_controller_capi.h` | **绑定、解绑输入法**的方法 |
| `inputmethod_cursor_info_capi.h` | 游标资讯物件 |
| `inputmethod_inputmethod_proxy_capi.h` | 使用输入法的方法，向输入法应用发送请求与通知 |
| `inputmethod_private_command_capi.h` | 私有资料物件 |
| `inputmethod_text_avoid_info_capi.h` | 输入框避让资讯 |
| `inputmethod_text_config_capi.h` | 输入框配置资讯 |
| `inputmethod_text_editor_proxy_capi.h` | **支持自绘输入框获取来自输入法应用的通知和请求** |
| `inputmethod_types_capi.h` | 型别定义 |

关键函式（逐字）：
- `OH_TextEditorProxy_Create()` / `OH_TextEditorProxy_SetGetTextConfigFunc()` / `OH_TextEditorProxy_SetInsertTextFunc()` / `OH_TextEditorProxy_SetDeleteForwardFunc()`
- `OH_AttachOptions_Create(showKeyboard)` / `OH_AttachOptions_Destroy()`
- `OH_InputMethodController_Attach(textEditorProxy, attachOptions, &inputMethodProxy)`
- `OH_InputMethodProxy_ShowKeyboard()` / `OH_InputMethodProxy_HideKeyboard()` / `OH_InputMethodProxy_NotifyConfigurationChange()`
- 错误码型别：`InputMethod_ErrorCode`，`IME_ERR_OK`
- 回呼：`GetTextConfig()`、`InsertText()`、`DeleteForward()`

来源：
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/use-inputmethod-in-custom-edit-box-ndk.md
- https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/capi-inputmethod.md

**【推测（高信心）】**：
- **输入法「服务端」（`InputMethodExtensionAbility` + `Panel` UI）没有等价的 C API** —— 官方指南中 IME 应用一律用 ArkTS/ArkUI 撰写，`Panel.setUiContent()` 载入的是 ArkUI 页面。
- 因此 **C/C++ 只能作为「被 ArkTS 呼叫的计算核心」**（透过 NAPI 载入 `.so`），**无法用来渲染键盘 UI**。
- **【需查证】** 是否可用 `XComponent` + Native（OpenGL/Vulkan）在 Panel 内自绘键盘。

**【风险】** 基础访问模式未来将「禁止 Extension 进程创建子进程；限制进程间通信与网路访问」（官方明文）。**【推测】** 这会让「C++ 核心跑在独立进程 + IPC」的架构在 HarmonyOS 上不可行，**核心必须 in-process（NAPI `.so` 或纯 ArkTS）**。

---

## 6. 跨平台核心策略比较

### 6.1 五种策略总表

| 策略 | 代表实作 | Windows | macOS | Android | HarmonyOS NEXT | 综合评价 |
|---|---|---|---|---|---|---|
| **(a) C/C++ 核心 + 原生壳** | **RIME**（librime + Weasel/Squirrel/Trime/fcitx5-rime） | ✅ TSF in-proc DLL | ✅ IMK .app | ✅ JNI + InputMethodService | ⚠️ NAPI `.so` 可行，但 UI 必须 ArkUI | **★★★★★ 已验证** |
| **(b) Rust 核心 + uniffi/cbindgen** | 新兴（如某些 IME 实验） | ✅ cbindgen → C ABI → COM DLL | ✅ uniffi → Swift | ✅ uniffi → Kotlin/JNI | ⚠️ 需手写 NAPI 绑定（uniffi 无 OHOS target） | **★★★★ 现代化选择** |
| **(c) Kotlin Multiplatform** | — | ❌ 无 Windows GUI/COM 支援 | ❌ 无 macOS IMK 支援 | ✅ 原生 | ❌ | **★★ 不适合** |
| **(d) Flutter** | — | ❌ 无法做 TSF COM server | ❌ 无法做 IMK | ⚠️ 需原生壳；Flutter 无法直接实作 IME | **【需查证】** | **★ 不适合 IME 本体** |
| **(e) WASM 核心** | — | ⚠️ wasmtime 可行但增延迟 | ⚠️ 同上 | ⚠️ 同上 | **【需查证】** | **★★ 风险高** |

### 6.2 RIME 模式（策略 a）—— 最强证据【已查证】

RIME 官方下载页明列跨平台前端矩阵：

> "RIME／中州韵输入法引擎，是一个**跨平台的输入法算法框架**。基于这一框架，Rime 开发者与其他开源社区的参与者在 **Windows、macOS、Linux、Android** 等平台上创造了不同的输入法前端实现。"

| 平台 | 前端 | 版本 / 需求 |
|---|---|---|
| Windows | **小狼毫 Weasel** | 0.17.0，适用 Windows 8.1 / 10 / 11 |
| macOS | **鼠须管 Squirrel** | 1.1.2，适用 macOS 13.0+；亦可 `brew install squirrel-app` |
| Linux | ibus-rime / fcitx5-rime | — |
| Android | **同文 Trime**（第三方） | — |

来源：https://rime.im/download/

**librime 技术组成【已查证】**（https://github.com/rime/librime）：
- "A modular, extensible **input method engine in cross-platform C++ code**"
- 建置需求：C++17 编译器、cmake ≥ 3.12、libboost ≥ 1.74、libleveldb、**libmarisa**、libopencc ≥ 1.0.2、libyaml-cpp
- 「Rime input schema, a DSL in **YAML** syntax」
- 「**Spelling Algebra**」— 建立变体拼写的机制，**对注音符号的变体处理特别有用**
- 授权：BSD 3-Clause

**Trime 的整合方式【已查证】**（https://github.com/osfans/trime）：
> "Trime … is based on [RIME] input method framework and **written in Java/Kotlin with JNI**."
→ **Android 端用 JNI 呼叫 librime 的 C++ 核心**。这是策略 (a) 在 Android 的实证。

**优点**：每个平台都能用该平台**最原生**的输入法 API（TSF COM / IMK / InputMethodService），效能最佳，无 abstraction 泄漏。
**缺点**：**4 套壳 = 4 套 UI + 4 套建置 + 4 套生命周期逻辑**。librime 的 C++17 + Boost 依赖在行动平台是负担。

### 6.3 Rust + uniffi / cbindgen（策略 b）

**【已查证】**：
- `cbindgen`：从 Rust 产生 C/C++ header。https://github.com/mozilla/cbindgen
- `uniffi`：Mozilla 的 Rust → 多语言绑定产生器。https://mozilla.github.io/uniffi-rs/
  （**【需查证】** 我在本次环境中无法载入 uniffi 官网，因此其**支援的目标语言清单与 OHOS 支援状况需查证**。已知其设计目标是 Kotlin / Swift / Python 等。）

**【推测】** 对本专案的适用性：

| 平台 | 绑定路径 | 评价 |
|---|---|---|
| Windows | `cbindgen` → C ABI → 手写 COM 包装（`ITfTextInputProcessor` 等） | uniffi 不产生 C++ COM，仍需手写壳 |
| macOS | `uniffi` → Swift（`IMKInputController` 子类别呼叫 Rust） | 最顺 |
| Android | `uniffi` → Kotlin（JNI） | 顺 |
| HarmonyOS | **无官方 target** → 需手写 NAPI 绑定（`napi_*` C API）或先出 C ABI 再包 | **额外工作量** |

**结论【推测】**：Rust 核心的**演算法/词库部分**很适合（记忆体安全、无 GC、可 `no_std` 化），但**绑定层仍需为 4 个平台各写一次**，并不会比 C++ 少多少工作；好处是**核心本身只需一份安全的实作**。

### 6.4 Kotlin Multiplatform（策略 c）—— 不建议

**【已查证】** KMP 的目标平台以 Android / iOS / JVM / Native / JS 为主。https://kotlinlang.org/docs/multiplatform.html
**【已查证：查无】** KMP 对 Windows TSF 或 macOS IMK 的官方支援。

**结论**：KMP 无法产生 TSF 的 COM in-proc server，也无法产生 macOS 的 `IMKInputController` 子类别。**不适合作为 IME 本体策略**。（可用于「非 UI 的共用业务逻辑」，但 IME 的共用逻辑就是核心引擎，那用 Rust/C++ 更合适。）

### 6.5 Flutter（策略 d）—— 不建议

| 平台 | 问题 |
|---|---|
| Windows | Flutter 应用是自绘视窗，**无法实作 TSF 的 in-proc COM 文字服务**（TSF 要求 `ITfTextInputProcessor` 实作在 DLL 内） |
| macOS | **无法实作 `IMKInputController` / `IMKServer`**；Flutter 的 macOS embedder 不提供 IMK 挂载点 |
| Android | Flutter **无法直接实作 `InputMethodService`**（那是 Android Service 元件，需原生）；理论上可用 platform channel 把 UI 委外，但键盘 UI 本身就必须是原生 view |
| HarmonyOS | **【需查证】** |

**【推测（高信心）】**：Flutter 适合「输入法的设定页 / 词库管理 App」，**不适合做输入法本体**。原因是输入法本体必须寄生在**作业系统定义的输入法框架**里，而 Flutter 的执行模型是「自己是一个 app」，两者根本冲突。

### 6.6 WASM 核心（策略 e）—— 高风险

| 风险 | 说明 |
|---|---|
| 启动延迟 | WASM runtime 初始化（尤其 wasmtime/wasmer）是毫秒到数十毫秒级，**与「按键到候选字 < 16ms」的目标冲突** |
| 记忆体 | runtime 本身占用可观；行动装置上 IME 是常驻 process，记忆体预算紧 |
| 资料交换成本 | 每次查询要跨 WASM 边界复制字串 → 对「每按一键查一次词库」的场景是灾难 |
| 平台支援 | Android 支援 WASM 需自带 runtime；HarmonyOS **【需查证】** |
| 唯一优势 | 沙箱隔离（安全性）—— 但 IME 的核心是**效能敏感**，不是安全边界 |

**【推测】**：不建议把 WASM 放在**按键热路径**上。若真要用，只适合放「离线词库编译工具」这种非即时场景。

### 6.7 输入法场景的共通风险清单

| 风险 | 说明 | 缓解 |
|---|---|---|
| **低延迟** | 按键 → 组字 → 候选显示必须在一个 frame 内 | 核心与 UI 同 process；避免 IPC 与跨语言边界复制；词库 mmap |
| **原生文字输入 API** | 每个平台的组字模型不同（TSF composition / IMK marked text / Android `setComposingText`） | 抽象层只做「已组字字串 + 候选清单 + 选取范围」三件事 |
| **沙箱** | macOS MAS 沙箱、HarmonyOS 基础访问模式（禁网路/禁子进程/IPC） | 核心设计成**纯本地、无网路、单进程** |
| **生命周期** | IME 是常驻服务，会被系统杀；macOS 快取 process 需 kill/登出 | 状态持久化；快速冷启动 |
| **平台语言限制** | ArkTS 禁用 `any`/动态属性 | 核心用 NAPI `.so`，ArkTS 只做 UI |
| **输入法特权审查** | IME 能看到所有输入 | 隐私政策、明确的「不收集」承诺、开源 |

---

## 7. 效能：延迟、记忆体、词库结构

### 7.1 候选字延迟可接受范围

**【需查证】** 我未能取得可引用的官方或学术来源（搜寻工具全数失效）。
**【推测 / 工程惯例】** 以下为业界常见目标，非官方标准：

| 指标 | 目标 | 依据 |
|---|---|---|
| 按键 → 组字显示 | **< 16 ms**（一个 60Hz frame） | 【推测】低于此值使用者无法察觉；超过会感觉「黏」 |
| 按键 → 候选字出现 | **< 30 ms** | 【推测】候选字非同步更新可接受略高 |
| 首次显示键盘 | **< 100 ms** | 【推测】超过会被感知为「卡」 |
| 最坏情况（冷查询、磁碟 I/O） | **< 50 ms** | 【推测】超过需改为 mmap / 预热 |

**【推测】** 工程结论：**注音输入法的单次查询必须是「记忆体内的确定性查询」，不能有磁碟 I/O、不能有 IPC、不能有记忆体分配**。这是选 (a)/(b) 而非 (d)/(e) 的核心理由。

### 7.2 词库大小 vs 查询速度

#### marisa-trie 官方 benchmark【已查证】

测试语料：英文维基百科所有页面标题（2012-11），**9,805,576 keys**，原始大小 200,435,403 bytes（gzip 后 54,933,690 bytes）。

| 实作 | 大小 (bytes) | 备注 |
|---|---|---|
| darts-clone | 376,613,888 | Compacted double-array trie |
| tx-trie | 127,727,058 | LOUDS-based trie |
| **marisa-trie** | **50,753,560** | MARISA trie |

> "The biggest advantage of libmarisa is that its dictionary size is **considerably more compact** than others."
> MARISA-based dictionary 支援：lookup、reverse lookup、common prefix search、**predictive search**。
> — https://github.com/s-yata/marisa-trie

**→ marisa-trie 在同等 key 数下约为 darts-clone 的 1/7.4、tx-trie 的 1/2.5。**

#### 各候选结构比较

| 结构 | 代表实作 | 空间 | 查询 | 前缀/预测搜寻 | 可变更 | 适用 |
|---|---|---|---|---|---|---|
| **MARISA trie** | `libmarisa`（C++） | ★★★★★ 最省 | ★★★★ | ✅ predictive search | ❌ 静态（需重建） | **RIME 的选择**【已查证：librime 依赖 libmarisa】 |
| **Double-Array Trie** | `darts` / `darts-clone`（C++）、`cedar`（C++） | ★★ | ★★★★★ 最快 | ✅ | cedar 支援动态更新 | 需频繁更新的场景 |
| **FST** | `fst` crate（Rust, BurntSushi） | ★★★★ | ★★★★ | ✅（有序、支援 range query） | ❌ 静态 | **Rust 核心首选**【已查证】 |
| **LOUDS** | `tx-trie` | ★★★ | ★★★★ | ✅ | ❌ | — |
| **DAWG** | `dawgdic` | ★★★★ | ★★★★ | ✅ | ❌ | — |
| **LevelDB** | Google LevelDB | ★★ | ★★（磁碟） | ⚠️ | ✅ | RIME 用来存**使用者学习记录**，非主词库【已查证：librime 依赖 libleveldb】 |

`fst` crate 官方说明【已查证】：
> "This crate provides a fast implementation of ordered sets and maps using finite state machines. In particular, it makes use of finite state transducers to map keys to values as the machine is executed. Using finite state machines as data structures enables us to store keys in a **compact format that is also easily searchable**. For example, this crate leverages **memory maps** to make range queries very fast."
> — https://github.com/BurntSushi/fst

#### RIME 的实际架构【已查证】

| 元件 | 用途 |
|---|---|
| **libmarisa** | 主词库（`.table.bin`）—— 静态、极省空间、支援前缀预测 |
| **libleveldb** | 使用者词库 / 学习记录 —— 可写、持久化 |
| **libopencc** | 简繁转换 |
| **libyaml-cpp** | 解析 Rime schema（YAML DSL） |
| **Boost** | 一般用途 |

来源：https://github.com/rime/librime

**【推测】对自研注音输入法的建议**：
- **主词库用 marisa-trie 或 FST**（静态、mmap、极省空间）。
- **注音的关键需求是「前缀预测搜寻」**（打 `ㄓ` 就要列出所有以 `ㄓ` 开头的候选）→ marisa 的 `predictive search` 与 FST 的 range query 都原生支援。
- **使用者学习词库另存**（LevelDB / SQLite / 自订 append-only log），不要混进主词库。
- **词库大小预算**【推测】：注音（ㄅㄆㄇㄈ + 声调）的 key 空间远小于拼音，一个涵盖 10 万词的繁中注音词库应可控制在 **数 MB 以内**；即使到 100 万词，用 marisa 也在 **10–20 MB** 量级（依 7.2 的 980 万 key → 50MB 外推）。

---

## 8. 建议架构（综合）

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

**四个平台的壳各自必做**：

| 平台 | 壳的关键工作 |
|---|---|
| Windows | COM in-proc DLL；`ITfTextInputProcessor`/`ITfKeyEventSink`；`ITfInputProcessorProfiles::Register` + `AddLanguageProfile(zh-TW)`；候选窗用 Win32 视窗；`ITfUIElementMgr` 做无障碍 |
| macOS | `.app` bundle + Info.plist（`InputMethodConnectionName` 等）；`IMKServer` + `IMKInputController` 子类别；`IMKCandidates`；Developer ID 签章 + 公证 |
| Android | `InputMethodService` 子类别；`onCreateInputView()` 自绘键盘+候选列；`res/xml/method.xml` 宣告 zh_TW subtype；`targetSdk 36` |
| HarmonyOS | `InputMethodExtensionAbility`（`module.json5` type `inputMethod`）；`createPanel` + ArkUI 页面；`getKeyboardDelegate()` 接键盘事件；NAPI 载入核心 `.so`；**必须支援 BASIC 模式（纯本地）** |

**优先顺序建议【推测】**：
1. **先做共用核心 + Windows（TSF）或 macOS（IMK）之一** —— 这两个平台生态最开放、无治理风险，适合验证核心。
2. **Android 次之** —— 需要处理 insets/edge-to-edge 与 targetSdk 36。
3. **HarmonyOS NEXT 最后，且先做可行性验证（spike）** —— 在投入前，**必须先确认能不能取得签章并侧载到实机**（见 5.10）。

---

## 9. 附录

### 9.1 官方文件 URL 总表

**Windows / TSF**
- TSF 总览：https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework
- TSF TOC（完整介面清单）：https://learn.microsoft.com/en-us/windows/win32/tsf/toc.json
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
- Info Dictionary Keys（仅 2 个常数）：https://developer.apple.com/documentation/inputmethodkit/info-dictionary-keys
- App Store Review Guidelines（§2.4.5）：https://developer.apple.com/app-store/review/guidelines/
- Notarization：https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Squirrel（鼠须管）：https://github.com/rime/squirrel
- Squirrel 安装说明：https://github.com/rime/squirrel/blob/master/INSTALL.md
- McBopomofo（小麦注音）：https://github.com/openvanilla/McBopomofo
- McBopomofo Info.plist（实证）：https://raw.githubusercontent.com/openvanilla/McBopomofo/master/Source/McBopomofo-Info.plist
- RIME 下载矩阵：https://rime.im/download/

**Android**
- `InputMethodService`：https://developer.android.com/reference/android/inputmethodservice/InputMethodService
- AOSP 原始码：https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/inputmethodservice/InputMethodService.java
- `InputMethodManager`：https://developer.android.com/reference/android/view/inputmethod/InputMethodManager
- `InputConnection`：https://developer.android.com/reference/android/view/inputmethod/InputConnection
- 建立输入法（官方指南）：https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method
- Play targetSdk 要求：https://support.google.com/googleplay/android-developer/answer/11926878
- Play targetSdk 迁移指南：https://developer.android.com/google/play/requirements/target-sdk
- Android 16 behavior changes：https://developer.android.com/about/versions/16/behavior-changes-all
- Play 政策中心：https://support.google.com/googleplay/android-developer/topic/9858052
- Play 使用者资料政策：https://support.google.com/googleplay/android-developer/answer/10144311
- Trime（Play + F-Droid）：https://github.com/osfans/trime

**HarmonyOS / OpenHarmony**
- IME Kit 简介（华为）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ime-kit-intro
- 设定除错签名（华为）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing
- 真机执行（华为）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-run-device
- 发布应用（华为）：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-publish-app
- AppGallery 审核指南（华为）：https://developer.huawei.com/consumer/cn/doc/app/50104
- 华为 API 参考 `inputMethodEngine`：https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-inputmethodengine
- **OpenHarmony IME Kit 文件（可完整下载）**：
  - `js-apis-inputmethodengine.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethodengine.md
  - `js-apis-inputmethod.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod.md
  - `js-apis-inputmethod-extension-ability.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod-extension-ability.md
  - `js-apis-inputmethod-panel.md`：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/js-apis-inputmethod-panel.md
  - `capi-inputmethod.md`（C API）：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/reference/apis-ime-kit/capi-inputmethod.md
- **OpenHarmony IME 开发指南**：
  - 实现一个输入法应用：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-application-guide.md
  - 切换输入法应用：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/switch-inputmethod-guide.md
  - Ime 工具（hdc）：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/inputmethod-hdc-commands-guide.md
  - 自绘编辑框（C/C++）：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/inputmethod/use-inputmethod-in-custom-edit-box-ndk.md
  - module.json5 设定：https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/quick-start/module-configuration-file.md
- 官方范例 KikaInput：https://gitcode.com/openharmony/applications_app_samples/tree/master/code/Solutions/InputMethod/KikaInput

**跨平台 / 词库**
- librime：https://github.com/rime/librime
- marisa-trie：https://github.com/s-yata/marisa-trie
- fst crate：https://github.com/BurntSushi/fst
- cbindgen：https://github.com/mozilla/cbindgen
- uniffi：https://mozilla.github.io/uniffi-rs/
- Kotlin Multiplatform：https://kotlinlang.org/docs/multiplatform.html

### 9.2 【需查证】清单（依重要性排序）

| # | 问题 | 为何重要 | 建议查证方式 |
|---|---|---|---|
| 1 | **是否有第三方（非华为）输入法已成功在 HarmonyOS NEXT 上架并可设为预设？** | **直接决定商业可行性** | 用可用的搜寻引擎查「鸿蒙版输入法 上架」；或 AppGallery 搜「输入法」；或询问华为开发者支援 |
| 2 | **HarmonyOS NEXT 侧载第三方 IME 的可行性与限制**（调试凭证装置数上限、内部测试管道） | 决定能否在投入前做实机验证 | 华为 AGC 文件「内部测试」；`ide-run-device` 页面 |
| 3 | **`.p12` / `.cer` / `.p7b` 的产生与关系**；AGC 凭证申请流程 | 决定签章工作量 | `ide-signing` 页「手动签名」分页（需登入） |
| 4 | **AppGallery 对「输入法」类别是否有特殊资质要求** | 决定能否上架 | AppGallery 审核指南「资质要求」章节 |
| 5 | **华为开发者实名认证**（个人 vs 企业）是否影响 IME 上架 | 决定主体资格 | 华为开发者联盟帐号流程 |
| 6 | **`input_method_config` profile 的 JSON schema** | 实作必需 | DevEco Studio 新建 InputMethodExtensionAbility 模板 |
| 7 | **macOS：有无 IME 成功上架 Mac App Store 的案例** | 决定 macOS 发行路径 | 搜寻 Mac App Store 上的日文/中文输入法 |
| 8 | **`IMKTextInput` protocol 的方法清单** | 实作必需 | 直接读 Xcode SDK header `IMKTextInput.h` |
| 9 | **macOS 26 / WWDC 2025-2026 有无新 IME API** | 避免用错 API | Xcode 26 SDK header diff |
| 10 | **Android 17（API 37 / CINNAMON_BUN）的 IME 相关 behavior changes** | 前瞻规划 | `developer.android.com/about/versions/17/behavior-changes-*` |
| 11 | **Google Play 是否有 IME 专属申报表单** | 上架流程 | 登入 Play Console 查看 |
| 12 | **Flutter / Qt 在 HarmonyOS NEXT 的现况** | 技术选型 | OpenHarmony SIG `flutter_flutter`；Qt 官方 |
| 13 | **是否存在 Rime / Trime 的鸿蒙移植专案** | 可重用性 | GitHub/Gitee 搜寻 `openharmony ime`、`trime 鸿蒙` |
| 14 | **候选字延迟的学术/官方基准** | 效能目标设定 | 搜寻 touch latency / typing latency 研究 |
| 15 | **Windows 11/12 是否有 IME 相关新限制** | 风险评估 | 目前**查无任何官方限制政策**；Windows 12 尚无官方开发者文件 |

### 9.3 本次未能在环境中完成的验证

- `web_search` 工具全程故障（undici 版本错配，需重启 dsh 生效）。
- DuckDuckGo / Mojeek：bot 验证阻挡。
- Bing：英文查询可用但品质差；**中文查询回传完全无关的结果**。
- `developer.huawei.com`：SPA，Obscura 成功率约 30%，多数页面逾时。
- Apple 部分文件（`IMKTextInput`、App Store 各平台 IME 案例）无 JSON API 端点。

---

*报告结束。所有【已查证】项目均附官方 URL；【推测】与【需查证】项目已明确标示，请勿当作结论使用。*
