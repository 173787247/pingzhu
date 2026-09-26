# 02 · 架構決策

> 這份文件記錄「為什麼這樣做」，而不只是「做了什麼」。每一條決策都附上被否決的選項與否決理由。

## 決策 1：自己做解碼引擎，而不是包一層 RIME

**否決：以 RIME schema 出貨。** 這是台灣社群最常見的做法，成本也最低：寫一份
`bopomofo.schema.yaml`，Windows 用小狼毫、macOS 用鼠鬚管、Android 用同文、Linux 用 fcitx5-rime，
一到兩週就能「四平台都有」。

否決理由：

1. **它到不了 HarmonyOS。** 本專案的四個目標平台裡，鴻蒙沒有 RIME 前端，而且鴻蒙的輸入法
   只能透過官方 IME Kit 以 `InputMethodExtensionAbility` 實作——那是一段必須自己寫的
   ArkTS 程式碼。既然無論如何都要寫一個原生外殼，外殼背後的引擎就沒有理由外包。
2. **授權會傳染。** librime 本身是 BSD-3-Clause（寬鬆），但**官方四個平台前端全部是 GPL-3.0**
   （weasel、squirrel、trime、ibus-rime）。用它們出貨等於整個產品必須 GPL-3.0。
   本專案希望核心能被寬鬆授權地嵌入，因此不能站在那條鏈上。
3. **RIME 的注音不是原生注音。** `rime-bopomofo` 的 `translator.dictionary` 指向
   `terra_pinyin`（漢語拼音詞庫），再用 `zhuyin.yaml` 的拼寫代數把拼音轉寫成注音。
   這條路徑對注音的破音字、輕聲、ㄦ化處理是繞道而行，除錯時要跨越兩層轉換。
4. **控制權。** 候選排序、學習行為、簡繁轉換、符號表這些「使用體驗」正是平替要競爭的地方，
   隔著一層 schema 表達不出來。

**保留的相容性**：不排斥未來**額外**輸出 RIME schema，讓已經在用 RIME 的使用者也能吃到
本專案的詞庫與排序成果。這是加值，不是架構基礎。

## 決策 2：核心必須有 C ABI，且不碰任何平台 API

四個平台的輸入法框架要求的介面高度一致：

```
按鍵 → [引擎] → 組字中的注音 ＋ 最佳句子 ＋ 候選清單 → 平台負責顯示與送字
```

| 平台 | 進入點 | 需要什麼 |
|---|---|---|
| Windows TSF | `ITfTextInputProcessor` | 一組 COM 介面實作（in-proc DLL） |
| macOS IMK | `IMKInputController` + `IMKServerInput` | 一個 Objective-C/Swift 類別 |
| Android | `InputMethodService` | 一個 Service 子類 |
| HarmonyOS | `InputMethodExtensionAbility` | 一個 ArkTS ExtensionAbility |

四者語言、記憶體模型、執行緒模型都不同，但**介面形狀相同**。因此核心的對外合約被設計成
最小公倍數：

```
engine_feed_key(key)      → 新狀態
engine_backspace()        → 新狀態
engine_candidates()       → 候選陣列
engine_commit()           → 輸出字串
engine_reset()
```

這個合約用 C ABI 表達，任何語言都能綁：

| 平台 | 綁定方式 |
|---|---|
| Windows TSF | 直接連結 C ABI（C++ 外殼） |
| macOS IMK | Swift Package Manager 包一層 Swift 綁定，或直接 C interop |
| Android | JNI（Kotlin 外殼） |
| HarmonyOS | NAPI（ArkTS 外殼呼叫 C/C++） |

**否決 Flutter。** 輸入法不是「畫一個鍵盤」而已：Android 的輸入法必須是
`InputMethodService`（Flutter 只能當其中的一個 View），Windows 的輸入法必須是 TSF COM 元件
（Flutter 無法註冊為 TSF 文字服務），macOS 的 IMK 也必須是原生 `IMKInputController`。
Flutter 能做的只有「鍵盤 UI」這一小塊，而那一塊每個平台本來就有原生做法。
用 Flutter 只會多一層啟動成本與記憶體開銷，卻省不掉任何一個原生外殼。

**否決 Electron／WebView。** 同上，且輸入法對延遲極敏感，多一層 JS bridge 毫無益處。

**否決 Kotlin Multiplatform。** 對 Android 很好，但 Windows TSF 與 macOS IMK 上 KMP 沒有
可用的產出形式（Kotlin/Native 沒有 TSF 或 IMK 的綁定），會變成「Android 用 KMP、其他三個平台另寫」，
等於多維護一套。

## 決策 3：先做 TypeScript 參考實作，再移植 Rust

本倉庫的 `engine/` 是 **TypeScript 參考實作**，不是最終出貨形態。

理由：

1. **零建置成本可驗證。** Node 24 內建型別剝離，`node engine/cli.ts su3cl3` 直接跑，
   不需要編譯器、不需要依賴、不需要 CI 就能重現。這讓「引擎到底能不能用」這件事
   在專案第一天就能被任何人驗證，而不是等 Rust 工具鏈就緒。
2. **演算法先於語言。** 真正難的是切分與讀字格評分（見 [06](06-engine-design.md)），
   這些邏輯用 TS 寫最快、最好除錯，且有 11 項測試釘住行為。
3. **移植有明確的驗收標準。** Rust 版只要對同一批輸入產生同樣輸出，就算移植成功——
   測試案例已經寫好了。

Rust 版是**出貨形態**。三個佐證：

1. crates.io 已有 `chewing` 0.14（libchewing 的 Rust 重寫）證明 Rust 核心在輸入法場景可行，
   且它同時提供 C API 與官方 Swift Package。
2. **唯一被實證的跨平台輸入法架構是「C/C++ 核心 + 各平台原生殼」**（librime →
   Weasel／Squirrel／Trime／fcitx5-rime 全生態）。Rust + C ABI 在這個架構裡
   與 C++ 核心**等價**——風險相同，語言更好。
3. **但要記得一個差異**：HarmonyOS **沒有 Rust target**。鴻蒙端仍必須自己寫 NAPI 橋接層
   呼叫 C ABI。這不改變架構，但是 M7 的一個已知工作量。

**否決「一開始就寫 Rust」。** 沒有 `rustc` 的環境要先裝工具鏈，且演算法還在變動期，
編譯—測試迴圈會拖慢探索。語言選擇不該擋住演算法驗證。

**否決「只用 TypeScript 出貨」。** 沒有 C ABI 就綁不進 TSF／IMK／JNI／NAPI 四個外殼；
用 Node 當執行環境會讓每個輸入法實例多揹一個 VM 的啟動時間與記憶體。

## 決策 4：語言模型用純文字 TSV，不用二進位格式

`data/bopomofo-lm.tsv` 是 `讀音<TAB>詞<TAB>log10機率` 的純文字。6.4 MB、169,604 行。

理由：

1. **可審計。** 使用者可以 `grep` 看「為什麼我的輸入法選了這個字」。
2. **可攜。** Rust 版、ArkTS 版、未來的任何版本讀同一份位元組，沒有格式談判。
3. **可 diff。** 詞庫更新在 git 裡看得見差異，而不是「二進位檔案已變更」。
4. **代價可接受。** 讀取 6.4 MB 純文字耗時 273 ms，且只在啟動時發生一次；
   解碼熱路徑是 15.2 µs/鍵。若未來記憶體吃緊，再另外產生一份排序過的二進位索引即可，
   屆時 TSV 仍可作為規格與 fallback。

## 決策 5：切分與選字聯合評分

見 [06-engine-design.md](06-engine-design.md) 的完整推導。一句話版本：

> `ji394su3` 可以合法切成「我愛你」，也可以切成「我奈以」。
> 任何「先切音節、再選字」的兩段式設計都會在第一步就丟掉正確答案，
> 因為兩個切分在第一階段看起來一樣合理。

## 決策 6：授權策略——寬鬆核心 ＋ 自寫外殼

| 層 | 授權 | 理由 |
|---|---|---|
| 本專案程式碼 | Apache-2.0 | 含專利授權條款；輸入法領域有歷史專利，寬鬆但不放棄專利防禦 |
| 語言模型資料 | MIT（衍生自 McBopomofo） | 上游即是 MIT，不可也無須重新授權 |
| 平台外殼 | 跟隨本專案 Apache-2.0 | 不引入 GPL 外殼，避免傳染 |

**明確避開的地雷**（詳見 [04](04-data-and-licensing.md)）：

- 不使用 GPL-3.0 的 RIME 官方前端（weasel／squirrel／trime／ibus-rime）
- 不靜態連結 LGPL-2.1 的 libchewing 而不提供替換機制
- 不使用**沒有授權檔**的資料集（無授權＝保留所有權利，例如 CWN、moedict-data、bpmfvs）
- 教育部辭典為 CC BY-**ND** 3.0 TW（禁改作），不可逕自簡化字或改編
- 繁化姬是閉源服務且條款限制多，簡繁轉換一律走 **OpenCC（Apache-2.0）**

## 決策 7：平台外殼的優先順序

| 順序 | 平台 | 理由 |
|---|---|---|
| 1 | Windows TSF | 使用者基數最大，且 Microsoft 官方 samples 為 MIT，有正當參考來源 |
| 2 | Android | 缺口最大（商業競品完全缺席），`InputMethodService` 是四個框架裡最簡單的 |
| 3 | macOS IMK | 與 Windows 同屬桌面主力；社群已有 MIT 的 McBopomofo 可對照 |
| 4 | HarmonyOS | 技術未知數最大，先完成可行性驗證再排程 |
| 5 | Linux | 生態現成（fcitx5 addon），成本低但使用者少，選配 |

順序不是「先易後難」，而是**「使用者價值 ÷ 未知數」**：Windows 與 Android 的未知數接近零，
HarmonyOS 的未知數最大，所以鴻蒙先做研究、不先進排程。
