# 03 · 四平台輸入法框架與限制

> 每一條都標明可信度：**【已查證】**＝官方文件／官方原始碼原文；**【推測】**＝基於已查證
> 事實的工程推論；**【需查證】**＝尚未取得可信來源，不可當作結論。
> 完整取證與 URL 見 [research/03-platform-ime-frameworks.md](../research/03-platform-ime-frameworks.md)。

## 結論速覽

| 平台 | 官方框架 | 第三方可否自研 | 主要卡點 | 散佈路徑 |
|---|---|---|---|---|
| **Windows** | Text Services Framework (TSF)，COM in-proc DLL | **可以**，完全開放 | COM 註冊 + 語言設定；TSF 本身的複雜度 | 官網下載；建議簽章 |
| **macOS** | InputMethodKit (IMK) | **可以**，完全開放 | Info.plist 遺留 key 無現代文件；App Store 沙箱與 IME 安裝模型衝突 | Developer ID + **公證**（非 App Store） |
| **Android** | `InputMethodService` | **可以**，完全開放 | 需引導使用者手動啟用與切換 | Google Play / F-Droid 皆可 |
| **HarmonyOS NEXT** | IME Kit | **框架明文支持三方輸入法**，但受安全管控與華為商業流程雙重約束 | ①基礎模式禁網路 ②簽章／AGC／側載 ③部分能力僅系統預設輸入法可用 | AppGallery（資質要求**【需查證】**） |

**一句話**：前三個平台技術上完全可行且路徑成熟；**HarmonyOS 是四者中唯一
「技術可用 ≠ 商業可交付」的平台**——難點不在 API，而在治理。

---

## Windows · Text Services Framework

### 框架定位【已查證】

> "Text Services Framework is designed for use by **Component Object Model (COM) programmers
> using the C/C++ programming languages**."
> — [learn.microsoft.com/windows/win32/tsf](https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework)

**關鍵含義**：TSF 文字服務是一個 **in-proc COM 伺服器（DLL）**，不是獨立 exe。
它被載入到使用者的應用程式行程內，因此核心引擎必須是**執行緒安全、低延遲、可重入**的。

### 核心介面【已查證】

| 介面 | 職責 |
|---|---|
| `ITfTextInputProcessor` / `ITfTextInputProcessorEx` | 進入點，`Activate`／`Deactivate` |
| `ITfThreadMgr`（`CLSID_TF_ThreadMgr`） | 執行緒層管理器 |
| `ITfThreadMgrEventSink` | 焦點與文件切換 |
| `ITfKeyEventSink`（6 個方法） | 攔截按鍵，經 `ITfKeystrokeMgr::AdviseKeyEventSink` 安裝 |
| `ITfComposition` / `ITfContextComposition` | 組字中字串 |
| `ITfDisplayAttributeProvider` | 組字字串外觀 |

### 註冊流程【已查證】——安裝第三方 IME 的核心

```
1. ITfInputProcessorProfiles::Register          註冊 CLSID 與描述
2. ITfInputProcessorProfiles::AddLanguageProfile 加入語言設定檔
                                                 （zh-TW 必填，否則語言列不會出現）
3. ITfCategoryMgr::RegisterCategory              註冊到 TSF 分類
```

再加上 COM in-proc server 的標準註冊（`HKLM\SOFTWARE\Microsoft\CTF\TIP\{CLSID}`）。

### 簽章【已查證】

官方原文：**"Text service providers *should* provide digital signatures with their binary
executables."** —— 用詞是 *should*，不是 *must*。

- **沒有 EV 憑證的強制規定。**
- **查無任何「Microsoft 限制非市集 IME」的政策。** Windows 11／12 對第三方輸入法沒有封鎖。

**但這不等於不需要簽章**：未簽章的 DLL 會觸發 SmartScreen 警告，實務上仍應簽章。
這是**使用者體驗問題，不是平台限制**。

### 風險評估

仍是四平台裡最重的一段。COM apartment 模型、TSF 的非同步編輯工作階段
（`ITfEditSession::DoEditSession` 回呼）、組字狀態機的邊界情況，是這類專案常見的超支來源。

**但有一個重要的降低風險因素**：TSF 的註冊與生命週期已被 RIME 小狼毫等開源專案走通多年，
且 Microsoft 官方範例為 MIT。**未知數低，工作量高**——這與 HarmonyOS 正好相反。

---

## macOS · InputMethodKit

> ⚠️ **本節修正了常見的錯誤說法。** 網路上的 IMK 教學常把方法掛錯協定，
> 以下逐字核對 Apple 官方 JSON 文件。

### 核心介面【已查證】

| 元件 | 所屬 | 職責 |
|---|---|---|
| `IMKServer` | class | 建立連線。**只有兩個 initializer**：`init(name:bundleIdentifier:)` 與 `init(name:controllerClass:delegateClass:)`——**沒有四參數版本** |
| `handle(_:client:)` | **`IMKServerInput`** protocol | 收按鍵 |
| `inputText(_:client:)` | **`IMKServerInput`** | 送出字串 |
| `commitComposition(_:)` | **`IMKServerInput`** | 提交組字 |
| `candidates(_:)` | **`IMKServerInput`** | 候選 |
| `activateServer(_:)` / `deactivateServer(_:)` | **`IMKStateSetting`** protocol | 啟用／停用 |
| `IMKTextInput`（client 協定） | protocol | 對目前文字欄位送字、取游標位置 |

**注意**：`handle(_:client:)`、`activateServer` 等**不在 `IMKInputController` 上**，
而是在 `IMKServerInput` / `IMKStateSetting` 這兩個協定中。
照著錯誤的教學寫會出現「方法沒被呼叫」的鬼打牆。

### Info.plist【已查證，以實際產品還原】

`tsInputModeListKey` 與 `ComponentInputModeDict` 是**關鍵的遺留 key**，
**Apple 現代文件只列出 2 個常數**，等於沒有官方文件。
研究方式是直接讀取實際產品的 `Info.plist`（McBopomofo、Squirrel）逐字還原。
`research/03` §3.3 附有可用的最小骨架。

### 安裝、沙箱與公證【已查證】

- 安裝位置：`/Library/Input Methods/` 或 `~/Library/Input Methods/`
- **App Store 與輸入法模型衝突**：App Store 審核指南 2.4.5(i)(ii) 要求
  應用必須沙箱化、**且不得安裝到 shared location**。而輸入法**必須**安裝到
  `/Library/Input Methods/`。兩者不相容。
- **實證**：Squirrel 與 McBopomofo **都不透過 Mac App Store 發佈**，
  走 Developer ID 簽章 + `notarytool` 公證。
- macOS 26：**查無新版輸入法 API**，IMK 仍是唯一路徑。

### 風險評估

中。IMK 相對穩定，且有一個 MIT、活躍、840★ 的完整同類產品（McBopomofo）可逐一對照。
**主要風險在打包與公證流程，不在程式邏輯。**

---

## Android · Input Method Framework

### 核心介面【已查證】

| 元件 | 職責 |
|---|---|
| `InputMethodService` | 輸入法 Service，`onCreateInputView()` 回傳鍵盤 View |
| `onStartInput` / `onFinishInput` | 焦點欄位切換 |
| `InputConnection` | `setComposingText()` 組字、`commitText()` 送出 |
| `InputMethodManager` | 系統端管理；使用者需手動啟用並選為預設 |
| `method.xml`（`<subtype>`） | 宣告語言／模式 |

### ⚠️ 更正：候選字視窗並沒有 deprecated

網路上常見「`CandidatesView` 已 deprecated」的說法。**這是錯的。**

- Android 官方 reference 對 `onCreateCandidatesView()` **沒有 deprecated 標記**
- AOSP master 原始碼中該方法**沒有 `@Deprecated`**

真正被 deprecated 的是別的方法（`onUpdateCursor` → 改用 `onUpdateCursorAnchorInfo`、
`onViewClicked` → 改用 `onUpdateEditorToolType`、
`getInputMethodWindowRecommendedHeight` 等），清單見 `research/03` §4.2。

**實務建議仍然是自繪候選列**，但理由不是「API 被廢棄」，而是
**候選列與鍵盤需要在同一套佈局裡協調高度**，用 `CandidatesView` 反而難控。

### targetSdk 與上架【已查證】

- **Google Play 自 2026-08-31 起強制 targetSdk 36（Android 16）**
- **查無 IME 專屬的 Play 政策**。反證：Trime 同時在 Google Play 與 F-Droid 上架。
- 輸入法類別需填寫資料安全表單——本專案不連網、不上傳，表單極簡。

### 風險評估

低—中，**四平台中最低**。UI 才是難點：37 鍵注音加聲調鍵在手機直向螢幕的排列
需要真正的設計工作。這是**設計問題不是工程問題**，但會決定成敗。

**這是投報率最高的一段**：商業競品在此完全缺席（見 [01](01-competitive-analysis.md)），
而技術風險最低。

---

## HarmonyOS NEXT · IME Kit

### 技術可行性：**可行**【已查證】

官方 OpenHarmony 文件（與華為 `@kit.IMEKit` API 同源，且為可下載的純 Markdown）
提供了五項直接證據：

| 證據 | 原文／位置 |
|---|---|
| IME 引擎模組明文面向三方 | `@ohos.inputMethodEngine` 自述「面向输入法应用（包括系统输入法应用、**三方输入法应用**）」 |
| hdc 明文支持三方 | `hdc shell ime -e <bundle> [-f]`：「支持启用**三方输入法**到基础模式或者完整体验模式」 |
| Extension 對所有開發者開放 | `InputMethodExtensionAbility`（非 system-only） |
| 官方完整開發指南 | `inputmethod-application-guide.md` |
| **官方範例 App** | **KikaInput**（完整 IME 實作，ArkTS） |

開發路徑：

```
module.json5  extensionAbilities: type = "inputMethod"
              metadata: ohos.extension.input_method
      ▼
InputMethodExtensionAbility
      ▼
inputMethodEngine.getInputMethodAbility() / getKeyboardDelegate()
      ▼
createPanel() + setUiContent() 載入 ArkUI 頁面（鍵盤 UI 必須是 ArkUI）
```

### ⚠️ 真正的限制：基礎訪問模式（官方明文）

> 「为了降低 InputMethodExtensionAbility 能力被三方应用滥用的风险，现通过**基础访问模式**
> 的功能约束对输入法应用进行安全管控。**说明：** 严格遵从基础访问模式的功能约束。
> 在此模式下，开发者应**仅提供基础打字功能，不应提供任何形式与网络交互相关的功能**。
> 系统会**逐步增加**基础访问模式的安全管控能力，包括但不限于：**以独立进程和沙箱的方式
> 运行 Extension 进程；禁止 Extension 进程创建子进程；进程间通信与网络访问**等。
> 因此未遵从此约定可能会导致功能异常。」

這段話對架構有**直接且強制**的影響：

| 官方限制 | 對本專案的影響 |
|---|---|
| 禁止網路互動 | **雲端詞庫、雲端聯想不可行**。本專案本來就不做雲端同步——這裡從「設計選擇」變成「平台要求」 |
| 未來禁止子進程、限制 IPC | 核心引擎必須 **in-process**，不能是獨立守護進程 |
| 未來獨立沙箱 | 不能依賴跨應用共享的檔案路徑 |
| 部分能力僅系統預設輸入法可用（錯誤碼 `12800010`） | 某些進階能力（如 `privateCommand`、`exitCurrentInputType`）第三方拿不到 |

**好消息**：本專案的核心本來就是**純本地、同步、in-process 的 C ABI 函式庫**
（見 [02](02-architecture.md) 決策 2），這些限制幾乎不造成架構改動。
**唯一被排除的是雲端同步——而我們本來就不做。**

### 尚待查證（**這是目前最大的未知數**）

| 項目 | 狀態 |
|---|---|
| 簽章材料（`.p12` / `.cer` / `.p7b`）與 AGC 憑證流程細節 | **【需查證】** |
| **側載（sideload）第三方輸入法是否可行、有無裝置數上限** | **【需查證】** |
| AppGallery 上架審核、輸入法類別是否需特殊資質 | **【需查證】** |
| **是否已有第三方鴻蒙輸入法上架**（搜狗／百度／訊飛鴻蒙版） | **【需查證】**——工具限制，不代表不存在 |
| 是否有 RIME／Trime 的鴻蒙移植 | **【已查證：查無】**，但同樣受工具限制 |

### 難度評估【推測】

| 面向 | 難度 | 說明 |
|---|---|---|
| 讓 IME Extension 跑起來（示範級軟鍵盤） | **低—中** | 有官方指南與 KikaInput 範例 |
| 做出可用的注音輸入法 | **中—高** | 注音組字與詞庫；ArkTS 限制增加移植成本 |
| 純本地高效能詞庫引擎（C ABI） | **中** | NDK/NAPI 可用，但須遵守上述限制 |
| 上架審核 | **【需查證】** | 取決於資質要求 |
| 讓使用者真的能選用 | **中** | 需引導手動啟用；鎖屏／密碼情境系統不允許切換 |

### 驗證計畫（兩週，先做再說）

**第一步不是寫程式，是確認市場是否已經有答案**：

1. **確認 AppGallery 上是否已有第三方注音／中文輸入法**（最關鍵的一項，若已有，
   商業可行性立即確認；若無，則是先行者機會）
2. 用 DevEco Studio 建一個最小 `InputMethodExtensionAbility`，在實機上被系統列為可選輸入法
3. 用 ArkTS 寫死一個小詞表，打出「你好」
4. 確認 NAPI 能否載入自帶的 C ABI 靜態庫

**成功** → M7 立項。
**失敗** → 改為「把引擎與詞庫開放給鴻蒙開發者」，不自建外殼。

---

## 跨平台核心策略

| 方案 | 評價 | 理由 |
|---|---|---|
| **(a) C/C++ 核心 + 各平台原生殼** | ★★★★★ | **唯一被實證的路徑**：librime → Weasel／Squirrel／Trime／fcitx5-rime 全生態 |
| **(b) Rust 核心 + uniffi／cbindgen** | ★★★★ | 安全、現代；但**HarmonyOS 沒有 Rust target**，仍需手寫 NAPI 層 |
| (c) Kotlin Multiplatform | ★★ | Android 很好，Windows TSF／macOS IMK 無可用產出形式 |
| (d) Flutter | ★ | 輸入法必須寄生在 OS 框架上，Flutter 模型根本衝突 |
| (e) WASM 核心 | ★★ | 需要宿主 runtime，增加啟動成本，輸入法無此需求 |

**本專案的選擇：Rust 核心 + C ABI**（見 [02](02-architecture.md) 決策 3）。
理由：Rust 的安全性与現代工具鏈勝過 C++，而 C ABI 這一層讓四個平台的外殼
與 (a) 方案完全等價——**風險與被實證的路徑相同，語言卻更好**。
唯一要記得的是：HarmonyOS 上仍要自己寫 NAPI 橋接。

### 詞庫索引技術

RIME 的做法可供參考：**libmarisa 靜態 trie + LevelDB**。
marisa 官方 benchmark（980 萬 key）：**50.7 MB**，而 darts-clone 376 MB、
tx-trie 127 MB。

**本專案目前不需要**：6.4 MB 的 TSV 在啟動時載入只要 273 ms，解碼 15.2 µs/鍵。
移動端若記憶體吃緊再引入（見 [06](06-engine-design.md)）。

### 延遲目標

**【推測】** 目標 <16 ms／按鍵（一個 60 Hz 影格）。查無可引用的官方或學術來源，
這個數字是工程慣例而非標準。

---

## 四個外殼共用的 C ABI

```c
EngineHandle engine_create(const char* data_dir, const char* layout);
void         engine_destroy(EngineHandle);
void         engine_feed_key(EngineHandle, const char* key);   // UTF-8，單一按鍵
void         engine_backspace(EngineHandle);
void         engine_reset(EngineHandle);
const char*  engine_composing(EngineHandle);
const char*  engine_best_sentence(EngineHandle);
int          engine_candidate_count(EngineHandle);
const char*  engine_candidate_at(EngineHandle, int index);
const char*  engine_commit(EngineHandle);
const char*  engine_choose(EngineHandle, int index);
```

三個設計約束：

1. **回傳字串的所有權固定在引擎**，呼叫端不負責釋放——避免四個外殼各寫一套記憶體管理。
2. **按鍵以 UTF-8 字元傳入，而非 keycode**——鍵盤排列的知識留在核心，
   新增許氏鍵盤不需要改四個平台。
3. **沒有非同步介面**。解碼是 15.2 µs 的純函式計算，同步呼叫即可；
   引入非同步只會讓四個外殼各寫一套 callback 生命週期。
