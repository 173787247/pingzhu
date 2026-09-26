# 平注 PingZhu

**開放原始碼、跨平台的注音輸入法引擎 —— 目標是成為「自然輸入法」的平替。**

Windows · macOS · Android · HarmonyOS NEXT · Linux

[![release](https://img.shields.io/github/v/release/173787247/pingzhu?include_prereleases&label=release&color=orange)](https://github.com/173787247/pingzhu/releases)
[![engine tests](https://img.shields.io/badge/engine%20tests-37%2F37-brightgreen)](#現況)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![data](https://img.shields.io/badge/data-MIT%20%2B%20BSD-lightgrey)](NOTICE)

---

## 這是什麼

平注（PingZhu）是一套從零打造的注音（Bopomofo／Zhuyin）輸入法。它不做「又一個 RIME 設定檔」，
而是把注音解碼引擎本身做成可攜核心，再為每個平台接上該平台的官方輸入法框架：

| 平台 | 官方框架 | 引擎 | 外殼狀態 |
|---|---|---|---|
| Windows 10/11 (x64 + Arm64) | Text Services Framework (TSF) | ✅ C ABI | 待做（技術完全開放，工作量最大） |
| macOS 12+ | InputMethodKit (IMK) | ✅ C ABI | 待做（走 Developer ID + 公證，非 App Store） |
| Android 8+ | `InputMethodService` | ✅ C ABI（JNI） | 待做（缺口最大、風險最低） |
| HarmonyOS NEXT | IME Kit / `InputMethodExtensionAbility` | ✅ C ABI（NAPI） | **技術已確認可行**，商業流程待查證（見 [docs/03](docs/03-platform-matrix.md)） |
| Linux | fcitx5 / ibus addon | ✅ C ABI | 選配 |

**現況：M0 – M3 完成** —— 解碼引擎、資料管線、個人化學習，以及**可被四個平台外殼連結的
Rust 核心 ＋ C ABI**。平台外殼本身尚未開始。

| | TypeScript 參考實作 | Rust 核心 |
|---|---|---|
| 測試 | 37 項 | 16 項單元 + **1,529 例差異化測試** |
| 每按鍵 | 15.2 µs | 16.5 µs |
| C ABI | — | ✅ 純 C 程式可直接驅動（見 [core-rs](core-rs/README.md)） |

```console
$ node engine/cli.ts su3cl3 ji394su3 w96j0

> su3cl3
  keys      su3cl3
  注音      ㄋㄧˇ ㄏㄠˇ
  → 中文    你好   (score -5.09)
  候選      1.好  2.郝  3.㚼  4.㝀  5.🆗  6.👌 …

> ji394su3
  注音      ㄨㄛˇ ㄞˋ ㄋㄧˇ
  → 中文    我愛你   (score -5.40)
```

`ji394su3` 這一串刻意選得很刁鑽：那八個按鍵可以合法切成 `ㄨㄛˇ-ㄞˋ-ㄋㄧˇ`（我愛你），
也可以切成 `ㄨㄛˇ-ㄋㄞˋ-ㄧˇ`（我奈以）。光看鍵盤順序無法分辨，只有語言模型能選對。
這就是為什麼本專案一開始就把「音節切分」和「詞彙選擇」放在同一次解碼裡評分，而不是拆成兩段各自最佳化。

---

## 為什麼要做這個

### 1. 自然輸入法沒有行動版，而且官方寫得很清楚

自然輸入法（網際智慧 IQ Technology；1990 年由中央研究院許聞廉博士以「國音輸入法」起家，
是台灣唯一仍在維護的付費商業注音輸入法）是目前台灣最成熟的注音輸入法。
但它的平台覆蓋在 2026 年仍然只有兩個桌面系統：

- Windows 專業版 `V13.1.1.35084`（2026/09/08），Windows 11／10 1903+，支援 Windows on Arm
- macOS 版 `V13.2.1`（2026/09/08），macOS Catalina 10.15+，**官網明寫「不支援 iOS、iPadOS」**

官方客服中心甚至直接以「不支援」為標題發布條目：

- 【不支援】自然輸入法是否能在 iPad、iPhone 上使用？
- 【不支援】自然輸入法有 Linux 版嗎？
- 【不支援】如何在 WIN10 平板上使用自然輸入法？

也就是說，**Android、iOS、Linux、HarmonyOS 全部是空的**。而且這不是「沒人做過」——
Google 注音輸入法與 IQQI 智能輸入法都曾在台灣行動市場存在，如今都已從 App Store 消失。
台灣使用者手機上打注音，至今仍只能將就內建鍵盤或 Gboard。

### 2. 授權模式製造了大量摩擦

官方零售價（2026 年，iqt.ai 價格頁）：

| 方案 | 價格 |
|---|---|
| V13 專業版 買斷 1 人 2 台 | NT$2,800 |
| V13 專業版 買斷 1 人 3 台 | NT$3,900 |
| 訂閱 月繳 / 季繳 | NT$129 / NT$329 |
| 訂閱 年繳 2 台 / 3 台 / 4 台 | NT$899 / NT$1,299 / NT$1,649 |
| 追音版（2 台 Windows） | NT$3,500 |

買斷版「限購買當時的版本」，官方說明一年後若系統環境更新可能出現相容問題，「您就需要購買本公司新版軟體」。
免費 Lite 版則必須註冊帳號、不支援 Mac、不支援離線、只有標準注音鍵盤、無技術客服，
且公告 2026/10/15 起舊版本將無法登入訂閱帳號（強制升級）。

這些摩擦直接反映在客服中心的內容分布上：**絕大多數條目都是授權到期、授權已滿、換電腦、
移除裝置、扣款失敗、登入失敗、取消訂閱**——而不是「怎麼打字」。

### 3. 開源生態有零件，但沒有成品

注音引擎的零件其實不缺，缺的是把它們組合成一個四平台產品的人（詳見
[docs/04-data-and-licensing.md](docs/04-data-and-licensing.md)）：

- **libchewing**（新酷音）核心已重寫為 **Rust**、附 C API 與官方 Swift Package，授權 LGPL-2.1
- **McBopomofo**（小麥注音）是 **MIT**，引擎與 13 萬條注音詞庫全部開放，但**與 macOS 深度耦合**，沒有可攜核心
- **RIME／librime** 是 BSD-3，但它的「注音」是把拼音詞庫用拼寫代數轉寫而成，且官方各平台前端全是 GPL-3.0
- 純 Android 的注音鍵盤（如樸實注音）多為 GPL-3.0 且功能單薄

平注的定位就是那個缺掉的成品：**寬鬆授權的可攜核心 ＋ 四個平台的原生外殼**。

---

## 快速開始

需要 Node.js ≥ 22.6（用到內建 TypeScript 型別剝離，不需要編譯步驟、零依賴）。

```bash
git clone <this-repo> && cd pingzhu

# 互動模式：直接敲注音按鍵，即時看解碼結果
node engine/cli.ts

# 非互動：直接解一串按鍵
node engine/cli.ts su3cl3 ji394su3 w96j0
node engine/cli.ts --layout eten ne3     # 倚天鍵盤

# 測試與評測
cd engine && node --test "test/*.test.ts"   # 37 項
node engine/bench.mjs 5000                  # 解碼品質
node engine/bench.mjs 5000 --compare        # promotion 開啟前後的逐例對比
node engine/bench-learn.mjs 5000            # 學習前後對比
node engine/bench-learn.mjs 5000 --recall   # 候選可達性
```

| 按鍵 | 輸出 | 說明 |
|---|---|---|
| `su3cl3` | 你好 | ㄋㄧˇ ㄏㄠˇ |
| `ji394su3` | 我愛你 | ㄨㄛˇ ㄞˋ ㄋㄧˇ（歧義切分） |
| `w96j0` | 台灣 | ㄊㄞˊ ㄨㄢ（第二音節省略聲調鍵） |
| `rupwu0` | 今天 | ㄐㄧㄣ ㄊㄧㄢ（一聲不打調號） |
| `g4` | 是 | ㄕˋ（單獨成音的ㄕ） |
| `j0420` | 萬丹 | ㄨㄢˋ ㄉㄢ（聲調不會跑到下一個音節） |

互動模式下：`1`-`9`/`0` 選字、`空白鍵` 翻下一頁十個、`←`/`→` 移動候選游標。

---

## 架構

```
                     ┌──────────────────────────────┐
   按鍵 ───────────▶ │  KeyboardLayout              │  大千式／倚天式（許氏、倚天26 待補）
                     │  key → component             │
                     └──────────────┬───────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │  音節切分 (segmentation)      │  列舉所有合法切分；含「打一半」狀態
                     │  components → syllables      │
                     └──────────────┬───────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │  ReadingGrid + Viterbi       │  音節格上鋪所有詞，取總分最高路徑
                     │  切分 × 詞彙 聯合評分          │  log10 機率，多字詞自然勝過逐字
                     └──────────────┬───────────────┘
                                    ▼
                     最佳句子 ＋ 候選詞清單

   語言模型：data/bopomofo-lm.tsv（169,604 詞條／131,048 讀音／1,413 合法音節）
```

這個分層不是為了好看，而是為了**平台外殼可以極薄**：TSF、IMK、`InputMethodService`、
`InputMethodExtensionAbility` 四者要的都只是「給我一串按鍵，還我一段文字＋候選清單」，
所以核心完全不碰 UI、不碰視窗、不碰平台 API。

實測效能（Node 24，單執行緒，載入 6.4 MB 語言模型）：

| 指標 | 數值 |
|---|---|
| 模型載入 | 273 ms（一次性） |
| 每按鍵解碼 | **15.2 µs** |
| 吞吐 | 65,934 鍵/秒 |

輸入法可接受的候選字延遲是 10 ms 等級，這裡差了三個數量級——**延遲不是這個專案的風險**。

### 解碼品質（可重跑）

```console
$ node engine/bench.mjs 5000

  top-1 accuracy    90.38%   (4519/5000)  exact word match
  reading accuracy  100.00%   (5000/5000)  output reads as typed
    homophone ties        480   (another real word, same reading)
    lost to decomposition   1   (a word existed and lost to single characters)
  KSPC              2.986 keys per character
```

**沒選對的 481 例，480 例是同音詞**：`畜牲`/`畜生`、`申飭`/`申斥` 讀音完全相同，
任何注音解碼器在沒有上下文時都無法分辨。5,000 個樣本裡**沒有任何一次真正的解碼失敗**
——輸出永遠讀得回你打的音。

### 個人化：教一次就記住（可重跑）

```console
$ node engine/bench-learn.mjs 5000

                              before      after
  top-1 accuracy              90.38%      99.54%
  homophone ties                480          21
  fixed by learning         464    regressed 6 (5 例是測試集碰撞，1 例已知副作用)
```

同音詞的答案不是「讓模型更聰明」，而是**讓使用者自己選，並且記住**：

| 操作 | 行為 |
|---|---|
| `1`…`9`、`0` | 選目前頁面的第 1…10 個候選 |
| `空白鍵` | 翻到下一頁（十個） |
| `←` `→` | 沿組字緩衝區移動候選游標 |

引擎選錯時，正確的字有 **99.8%** 落在第一頁——所以更正的成本是一個按鍵。

> ⚠️ 樣本取自語言模型本身，因此這是**自我一致性**（上界）與**回歸守門**，不是與競品的對比數字。
> 真正的對比需要真實使用者的打字語料，目前不存在。詳見 [docs/06](docs/06-engine-design.md)。

---

## 專案狀態

| 里程碑 | 內容 | 狀態 |
|---|---|---|
| **M0** | 解碼引擎：鍵盤／切分／讀字格 Viterbi／候選視窗；37 項測試 | ✅ 已完成 |
| **M1** | 資料管線：從 McBopomofo 開放資料編譯出可攜語言模型 | ✅ 已完成 |
| **M2** | 個人化：使用者詞庫、學習排序、候選翻頁 | ✅ 已完成 |
| **M3** | Rust 核心 ＋ C ABI（差異化測試對 TS 參考實作） | ✅ 已完成 |
| **M4** | Windows TSF 外殼 | 待做 |
| **M5** | macOS IMK 外殼 | 待做 |
| **M6** | Android `InputMethodService` 外殼 | 待做 |
| **M7** | HarmonyOS IME Kit 外殼 | 研究中 |
| **M8** | 加值功能：簡繁轉換、符號表、聯想詞、快捷輸入 | 待做 |

詳細排程、工作量與風險見 [docs/05-roadmap.md](docs/05-roadmap.md)。

---

## 文件

| 文件 | 內容 |
|---|---|
| [docs/01-competitive-analysis.md](docs/01-competitive-analysis.md) | 自然輸入法產品拆解：35 年版本史、功能清單、定價、平台矩陣、技術架構、使用者痛點 |
| [docs/02-architecture.md](docs/02-architecture.md) | 架構決策：為何寬鬆授權核心、為何四平台原生殼、為何不用 Flutter |
| [docs/03-platform-matrix.md](docs/03-platform-matrix.md) | 四平台輸入法框架能力、簽章與上架限制、HarmonyOS 可行性 |
| [docs/04-data-and-licensing.md](docs/04-data-and-licensing.md) | 每一個可用元件的授權、資料來源合規、地雷清單 |
| [docs/08-self-built-data.md](docs/08-self-built-data.md) | **資料層可以自建**：Unihan 讀音／簡繁、詞頻公式、無監督新詞發現 |
| [docs/05-roadmap.md](docs/05-roadmap.md) | MVP → v1 的路線、工作量估算、風險與退路 |
| [docs/06-engine-design.md](docs/06-engine-design.md) | 引擎內部：切分演算法、讀字格、資料格式、評測方法 |
| [docs/07-research-tooling.md](docs/07-research-tooling.md) | 本倉庫的調研工具鏈（可重現取證） |
| [core-rs/README.md](core-rs/README.md) | **Rust 核心 ＋ C ABI**：外殼怎麼接、怎麼驗證 |
| [research/01](research/01-iqt-natural-ime.md) · [02](research/02-opensource-stack.md) · [03](research/03-platform-ime-frameworks.md) · [04](research/04-zhuyin-ime-internals.md) | 四份原始調研報告（約 34 萬字，含逐條來源與【已查證】/【推測】/【需查證】三級標記） |

---

## 授權與致謝

**整包 MIT**——程式碼與資料同一個授權，見 [LICENSE](LICENSE)。

- **程式碼**：MIT
- **語言模型資料**：衍生自 **McBopomofo**（MIT，Copyright © 2022 and onwards The McBopomofo Authors），
  其詞庫 `BPMFMappings.txt` 又衍生自 libtabe 的 `tsi.src`（BSD）

選 MIT 而非 Apache-2.0 的理由：本專案零程式碼依賴，且資料本身即衍生自 MIT 來源，
單一授權讓整條授權鏈一致；MIT 同時與 GPL-2.0-only 相容，而 Apache-2.0 不相容
（見 [docs/02](docs/02-architecture.md) 決策 6）。授權鏈與逐項聲明見 [NOTICE](NOTICE)。

平注與網際智慧股份有限公司（IQ Technology Inc.）無任何關聯；「自然輸入法」為其商標，
本專案僅在評論與相容性描述中提及該產品名稱。

---

## English summary

**PingZhu** is an open-source, cross-platform Bopomofo (Zhuyin) input method engine for
Windows, macOS, Android, HarmonyOS NEXT and Linux. It exists because the dominant
commercial Taiwanese IME, 自然輸入法 (IQ Technology, in the market since 1995), still ships
only on Windows and macOS — its own support centre publishes articles literally titled
"not supported" for iPad/iPhone, Linux and Android tablets — while its licensing model
generates a support burden overwhelmingly made of activation, device-transfer and
subscription failures rather than typing questions.

The repository currently contains a **working decoder** (M0): keyboard layouts, syllable
segmentation, a reading grid decoded with Viterbi over a 169,604-entry language model
compiled from McBopomofo's MIT-licensed data, plus 11 tests. Decoding costs 15.2 µs per
keystroke. Platform shells are the next milestones.
