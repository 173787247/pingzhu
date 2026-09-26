# 04 · 資料來源與授權合規

> 輸入法專案最容易死的地方不是演算法，是授權。這份文件把每一個可用零件、每一份資料的
> 授權狀態列清楚，並標明哪些是**本倉庫實測查證**、哪些是**待複核**。

## 本專案目前實際使用的來源

| 來源 | 用途 | 授權 | 查證方式 |
|---|---|---|---|
| [openvanilla/McBopomofo](https://github.com/openvanilla/McBopomofo) `Source/Data/` | 詞庫、單字表、破音字優先序、符號表 | **MIT**（Copyright © 2022 and onwards The McBopomofo Authors） | 本倉庫以 GitHub API 讀取 `license.spdx_id` = `MIT`；資料目錄 README 自述 |
| [openvanilla/McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) `src/McBopomofo/WebData.ts` | 編譯後語言模型（13.4 萬條，含對數機率） | **MIT** | 同上 |
| McBopomofo 的 `BPMFMappings.txt` 上游 | 片語清單 | 衍生自 **libtabe `tsi.src`（BSD）** | McBopomofo `Source/Data/README.md` 自述 |
| McBopomofo `src/Mandarin/BopomofoKeyboardLayout.ts` | 大千式／IBM／倚天鍵位表 | **MIT** | 本倉庫逐行核對鍵位，並以 `su3cl3 → 你好`、`ji394su3 → 我愛你` 驗證 |

**結論**：目前使用的每一個位元都可追溯、皆為寬鬆授權、皆允許商用與閉源連結。
逐項聲明見倉庫根目錄 [NOTICE](../NOTICE)。

## 生態全景：可用的引擎

| 專案 | 語言 | 授權 | 狀態 | 評估 |
|---|---|---|---|---|
| [chewing/libchewing](https://codeberg.org/chewing/libchewing)（新酷音） | **Rust** | **LGPL-2.1-or-later** | 活躍（2026-09-25），已從 GitHub 遷至 Codeberg | 核心重寫為 Rust，附 C API、官方 Swift Package；crates.io `chewing` 0.14.0-alpha.2 |
| [rime/librime](https://github.com/rime/librime)（中州韻） | C++ | **BSD-3-Clause** | 活躍，4,628★ | 引擎寬鬆，但官方前端全是 GPL-3.0 |
| [openvanilla/McBopomofo](https://github.com/openvanilla/McBopomofo)（小麥注音） | Swift | **MIT** | 極活躍，840★ | 引擎與資料全 MIT，但**與 macOS 深度耦合，無可攜核心** |
| [openvanilla/McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) | TypeScript | **MIT** | 活躍 | 網頁技術實作，可跑 ChromeOS／Windows（透過 PIME） |
| [timdream/jszhuyin](https://github.com/timdream/jszhuyin) | JavaScript | **MIT** | 235★ | 純 JS 自動選字注音輸入法，可作為演算法對照 |
| [hiroshiyui/GuilelessBopomofo](https://github.com/hiroshiyui/GuilelessBopomofo)（樸實注音鍵盤） | Kotlin | **GPL-3.0** | 133★ | Android 注音鍵盤，以 libchewing 為引擎 |
| [EasyIME/PIME](https://github.com/EasyIME/PIME) | C++ | **NOASSERTION**（授權檔非標準條文） | 1,474★ | Windows 輸入法框架，需人工審閱條文 |

### 各平台外殼的授權地雷

| 平台 | 專案 | 授權 | 風險 |
|---|---|---|---|
| Windows | [rime/weasel](https://github.com/rime/weasel) 小狼毫 | **GPL-3.0** | 傳染，不可用於寬鬆授權產品 |
| Windows | PIME | NOASSERTION | 需人工審閱 |
| Windows | Microsoft `Windows-classic-samples`（含官方 TSF 範例） | **MIT** | ✅ 正當的 TSF 參考來源 |
| macOS | [rime/squirrel](https://github.com/rime/squirrel) 鼠鬚管 | **GPL-3.0** | 傳染 |
| macOS | McBopomofo / OpenVanilla | **MIT** | ✅ 可參考 |
| Android | [osfans/trime](https://github.com/osfans/trime) 同文 | **GPL-3.0** | 傳染 |
| Android | [AnySoftKeyboard](https://github.com/AnySoftKeyboard/AnySoftKeyboard) | **Apache-2.0** | ✅ 可作骨架參考 |
| Linux | fcitx5 / fcitx5-chewing | **LGPL-2.1-or-later** | 動態連結可接受 |
| Linux | [fcitx/fcitx5-chewing](https://github.com/fcitx/fcitx5-chewing) | 無授權檔（API 回報 `NONE`） | ⚠️ 無授權檔＝保留所有權利 |

**本專案的對策**：四個平台的外殼全部自己寫（Windows TSF 以 Microsoft MIT 範例為參考，
macOS IMK 以 MIT 的 McBopomofo 為參考，Android 以 Apache-2.0 的 AnySoftKeyboard 為骨架參考），
**不引入任何 GPL-3.0 外殼**。

## 生態全景：可用的資料

| 資料 | 授權 | 可否商用 | 可否改作 | 備註 |
|---|---|---|---|---|
| [libchewing-data](https://codeberg.org/chewing/libchewing-data) | **CC BY 4.0** | ✅ | ✅ | 本倉庫實測：`LICENSES/CC-BY-4.0.txt`；v4 新增注音專用 bigram |
| 教育部《重編國語辭典修訂本》等四部辭典 | **CC BY-ND 3.0 TW** | ✅ | ❌ **禁改作** | 《簡編本》另有「額外授權聲明」允許字碼改換 |
| [CNS 11643 全字庫](https://www.cns11643.gov.tw/) | **政府資料開放授權條款第 1 版（OGDL-1.0）** | ✅ | ✅ | 授權清單明列「字型屬性檔：注音」，可涵蓋全字集 |
| [OpenCC](https://github.com/BYVoid/OpenCC) 簡繁轉換 | **Apache-2.0** | ✅ | ✅ | 簡繁轉換的唯一選擇 |
| CWN 中文詞彙網路 | **無授權檔** | ❌ | ❌ | 無授權＝保留所有權利 |
| g0v/moedict-data | **無授權檔** | ❌ | ❌ | 同上 |
| bpmfvs（注音 IVS 字型規格） | **無授權檔** | ❌ | ❌ | 同上 |
| 繁化姬 | 閉源服務，條款限制 | — | — | 不使用 |

### 待複核項目

以下來自桌面研究、尚未由本倉庫獨立驗證，採用前必須自行確認：

- 教育部辭典「額外授權聲明」的**確切適用範圍**（哪些改動不算「改作」）
- CNS 11643「注音屬性檔」的**實際欄位與涵蓋率**
- libchewing-data v4 bigram 語言模型的**檔案大小與實測準確率**
  （桌面研究稱 150 MB，可裁至 5.5 MB；準確率 92.57% → 96.11%）

## 為什麼選擇 McBopomofo 而不是 libchewing 當起點

| 面向 | McBopomofo | libchewing |
|---|---|---|
| 授權 | **MIT**（最寬鬆） | LGPL-2.1（動態連結可行，但有義務） |
| 注音資料 | ✅ 原生注音，13 萬條含對數機率 | ✅ 原生注音，含 bigram |
| 可攜核心 | ❌ 與 macOS 耦合 | ✅ Rust 核心 + C API + Swift Package |
| 拿來當參考 | ✅ 可讀、有測試、有 AGENTS.md 文件 | ✅ 但 Rust 重寫仍在 alpha |

**現在的選擇**：以 McBopomofo 的**資料**起步（MIT、立即可用、已驗證），
以自己的**引擎**為主體（見 [02-architecture.md](02-architecture.md)）。

**未來的選擇**：當需要 bigram 脈絡模型時，評估接入 libchewing-data v4（CC BY 4.0，
可商用可改作）。屆時若考慮直接用 libchewing 的 Rust 核心，LGPL-2.1 的動態連結義務
需要法務確認——這是一條**明確可行但需要決策**的路，不是阻礙。

## 上游資料的清理與再散布

`data/build.mjs` 產生的 `data/bopomofo-lm.tsv` 與 `data/bopomofo-chars.tsv`
是 McBopomofo 資料的**衍生作品**，因此以相同 MIT 條款再散布。
本專案對這些檔案不主張任何額外限制。

`data/vendor/` 內的上游原始檔**不進版控**（4.3 MB），由 `data/fetch-source.sh` 取得，
並在 [NOTICE](../NOTICE) 中記錄檔名與雜湊前綴以供追溯。
