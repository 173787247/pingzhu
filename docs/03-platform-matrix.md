# 03 · 四平台輸入法框架與限制

> 這份文件回答一個問題：**在每個平台上，一個第三方輸入法到底能做到什麼程度？**
> 標記 🔶 的段落尚未由本倉庫以官方文件原文複核，採用前請自行確認。

## 總覽

| 平台 | 官方框架 | 外殼語言 | 引擎進入點 | 上架／簽章 | 難度 |
|---|---|---|---|---|---|
| Windows 10/11 | Text Services Framework (TSF) | C++ (COM) | `ITfTextInputProcessor` | 無需市集；EXE/MSI 自行發佈 | **高** |
| macOS 12+ | InputMethodKit (IMK) | Swift / Objective-C | `IMKInputController` | Developer ID + notarization | 中 |
| Android 8+ | Input Method Framework | Kotlin/Java | `InputMethodService` | Google Play（或 APK 直裝） | 低—中 |
| HarmonyOS NEXT | IME Kit | ArkTS | `InputMethodExtensionAbility` | AGC 簽章 + AppGallery | 🔶 未知 |

四者的共同形狀：**平台給你能打字的地方，你負責「按鍵 → 文字」與候選 UI**。
差別在註冊方式、生命週期、以及能不能自己畫候選視窗。

---

## Windows · Text Services Framework

### 核心介面

| 介面 | 職責 |
|---|---|
| `ITfTextInputProcessor` / `ITfTextInputProcessorEx` | 輸入法進入點，`ActivateEx` 取得 `ITfThreadMgr` |
| `ITfThreadMgrEventSink` | 焦點與文件切換 |
| `ITfKeyEventSink` | 攔截按鍵（`OnTestKeyDown` / `OnKeyDown`） |
| `ITfComposition` / `ITfContextComposition` | 組字中字串（底線那段） |
| `ITfDisplayAttributeProvider` | 組字字串的外觀 |
| 🔶 `ITfCandidateListUIElement` | 系統候選 UI（「UI Less」模式） |

### 實務要點

1. **必須是 COM in-proc server**，註冊到 `HKLM\SOFTWARE\Microsoft\CTF\TIP\{CLSID}`，
   再以語言設定檔（language profile）掛進某個語系。
2. **候選視窗要自己畫。** TSF 不提供候選清單 UI（除了 UI Less 模式），這是外殼工作量的大頭。
3. **與 Windows 內建注音共存**是歷史坑：使用者必須在語言列切換，且熱鍵衝突需要處理。
4. 官方參考：Microsoft `Windows-classic-samples` 內含 TSF 範例，**授權 MIT**（見 [04](04-data-and-licensing.md)）。
5. 🔶 Windows 11 之後對非市集輸入法**沒有**封鎖；輸入法不需要通過 Microsoft Store 發佈。

### 風險評估

這是四個平台裡最重的一段。COM 的 apartment 模型、TSF 的非同步編輯工作階段
（`ITfEditSession` 的 `DoEditSession` 回呼）、以及組字狀態機的邊界情況，
是這類專案常見的超支來源。路線圖（[05](05-roadmap.md)）因此把「可攜版」列為 TSF 之前的退路。

---

## macOS · InputMethodKit

### 核心介面

| 元件 | 職責 |
|---|---|
| `IMKServer` | 由 `Info.plist` 的 `InputMethodConnectionName` 建立連線 |
| `IMKInputController` | 輸入法主體：`handle(_:client:)` 收按鍵、`inputText(_:client:)` 送字 |
| `IMKTextInput`（client 協定） | 對目前文字欄位送出字串、取得游標位置（決定候選視窗位置） |

### 實務要點

1. **安裝位置**：`/Library/Input Methods/` 或 `~/Library/Input Methods/`。
   這與 App Store 的沙箱模型關係緊張——🔶 **Mac App Store 一般不接受輸入法**，
   發佈路徑是 Developer ID 簽章 + notarization 的獨立安裝檔。
2. **`Info.plist` 是關鍵**：`tsInputModeListKey` / `ComponentInputModeDict` 決定這個輸入法
   在系統設定裡以哪些輸入模式出現。
3. **參考來源極佳**：[McBopomofo](https://github.com/openvanilla/McBopomofo) 是 **MIT**、
   活躍、840★ 的完整同類產品，可以逐一對照。這是四個平台裡最有把握的一個。
4. 🔶 較新的 macOS 版本是否引入新的輸入法 API，需在動工前確認。

---

## Android · Input Method Framework

### 核心介面

| 元件 | 職責 |
|---|---|
| `InputMethodService` | 輸入法 Service，`onCreateInputView()` 回傳鍵盤 View |
| `onStartInput` / `onFinishInput` | 焦點欄位切換 |
| `InputConnection` | `setComposingText()` 顯示組字、`commitText()` 送出 |
| `InputMethodManager` | 系統端管理；使用者需在設定中啟用並選為預設 |
| `method.xml`（`<subtype>`） | 宣告語言／模式（例：注音、繁體中文） |
| 🔶 `CandidatesView` | **已 deprecated**，候選列需自繪（放進 `onCreateInputView` 的佈局） |

### 實務要點

1. **這是四個框架裡最單純的**：`InputMethodService` 就是一個標準 Service，
   沒有 COM、沒有 notarization、沒有特殊註冊。
2. **UI 才是難點**：37 鍵注音 + 聲調鍵在手機直向螢幕上的排列需要真正的設計工作
   （鍵距、誤觸、單手可及範圍）。這是**設計問題不是工程問題**，但會決定成敗。
3. **發佈**：Google Play 的輸入法類別需要填寫資料安全表單；
   若不下載資料、不連網，表單很好填——這也是本專案「不做雲端同步」的一個附帶好處（見 [05](05-roadmap.md)）。
4. 參考骨架：[AnySoftKeyboard](https://github.com/AnySoftKeyboard/AnySoftKeyboard)（**Apache-2.0**，可安全參考）。
   同文輸入法 Trime 是 GPL-3.0，只可閱讀不可沿用。

### 為何這是最該先做的一段

商業競品在 Android **完全缺席**（[01](01-competitive-analysis.md)），而技術風險最低。
缺口最大 × 風險最低 = 最高投報率。

---

## HarmonyOS NEXT · IME Kit

> 🔶 **本節整體標記為待複核。** 以下為目前掌握的架構輪廓，尚需以
> developer.huawei.com 的 IME Kit 官方文件原文逐項確認。

### 已知輪廓

| 元件 | 職責 |
|---|---|
| `InputMethodExtensionAbility` | 輸入法的 Extension 進入點（對應 Android 的 `InputMethodService`） |
| IME Kit（`@ohos.inputMethod` 等） | 系統端 API：查詢／切換輸入法 |
| `inputMethodEngine` | 輸入法端 API：`InputClient` 送字、`KeyboardController` 控制鍵盤 |
| `module.json5` 的 `extensionAbilities` | 宣告 `type: "inputMethod"` |
| ArkTS / ArkUI | 外殼語言與 UI |

### 與 Android 的關鍵差異

1. **不再相容 APK。** HarmonyOS NEXT（HarmonyOS 5+）是純鴻蒙，Android 的
   `InputMethodService` 整套不適用——**Android 外殼的程式碼無法複用**，
   但**引擎可以**：透過 NAPI 呼叫 C/C++（也就是 Rust 核心的 C ABI）。
2. **語言是 ArkTS**，不是 Java/Kotlin。ArkTS 是 TypeScript 的受限超集——
   這對本專案是個意外的利多：**M0 的 TypeScript 參考實作在語法上最接近 ArkTS**，
   若 Rust 核心移植遇到阻礙，ArkTS 直接跑引擎是可行的備案。
3. **簽章與上架**：🔶 需要 DevEco Studio + AGC 申請的簽章材料（`.p12` / `.cer` / `.p7b`），
   開發者實名認證，上架需經 AppGallery 審核。

### 三個必須先驗證的問題

這三題決定 HarmonyOS 是「一個里程碑」還是「一個研究報告」：

1. **第三方輸入法能否側載？** 開發者簽章的應用能否安裝並在設定中被選為輸入法？
2. **AppGallery 是否開放輸入法類別？** 是否有額外的資質或審核要求？
3. **NAPI 呼叫自帶 C/C++ 函式庫的限制？** 能否打包 Rust 靜態庫並在
   `InputMethodExtensionAbility` 中使用？

**驗證方式**：用兩週做一個「最小可用注音輸入法」——只支援大千式、只做單字候選、
不接 Rust 核心（先用 ArkTS 寫死一個小詞表），目標是在實機上打出「你好」。
成功則 M7 立項；失敗則改為「把引擎與詞庫開放給鴻蒙開發者」的策略。

**為何值得試**：純鴻蒙生態目前沒有成熟的注音輸入法（見 [01](01-competitive-analysis.md)），
若可行，這是本專案唯一能取得「先行者」位置的平台。

---

## 跨平台核心的介面設計

四個外殼都只依賴同一組 C ABI：

```c
// 生命週期
EngineHandle engine_create(const char* data_dir, const char* layout);
void         engine_destroy(EngineHandle);

// 輸入
void engine_feed_key(EngineHandle, const char* key);   // 單一按鍵（UTF-8）
void engine_backspace(EngineHandle);
void engine_reset(EngineHandle);

// 輸出
const char* engine_composing(EngineHandle);   // 注音預覽（含未完成音節）
const char* engine_best_sentence(EngineHandle);
int         engine_candidate_count(EngineHandle);
const char* engine_candidate_at(EngineHandle, int index);
const char* engine_commit(EngineHandle);      // 接受最佳解，清空緩衝
const char* engine_choose(EngineHandle, int index); // 選第 index 個候選
```

三個設計約束：

1. **回傳字串的所有權固定在引擎**（呼叫端不負責釋放），避免四個外殼各寫一套記憶體管理。
2. **按鍵以 UTF-8 字串傳入**，而不是 keycode——鍵盤排列的知識留在核心，
   外殼只負責把實體按鍵轉成字元。這讓「新增許氏鍵盤」不需要改四個平台。
3. **不提供非同步介面**。解碼是 15.2 µs 的純函式計算，同步呼叫即可；
   引入非同步只會讓四個外殼各寫一套 callback 生命週期。
