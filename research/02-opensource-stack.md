# 從零打造跨平台注音（Bopomofo / Zhuyin）輸入法：開源元件、資料集與授權盤點

> 調查日期：2026-09-26（Asia/Taipei）
> 調查方法：GitHub REST API（`gh api`，已登入，避免匿名速率限制）、Codeberg API、crates.io / npm registry API、各專案 `LICENSE` / `COPYING` / `README` 原文、教育部與全字庫官方網頁、Debian sources 套件宣告。
> 原則：**所有星數、授權、最後 push 時間皆為實查值**；無法確認者一律寫「未知，需進一步確認」，不推測。

---

## 0. 速覽：授權分級（決定架構的第一張表）

| 分級 | 代表元件 | 能否用於**閉源商用**產品 |
|---|---|---|
| 🟢 寬鬆（MIT / BSD / Apache-2.0 / MulanPSL-2.0 / CC BY 4.0 / OGDL-1.0） | librime、McBopomofo、OpenVanilla、OpenCC、wlchewing、jszhuyin、AnySoftKeyboard、全字庫資料、libchewing-data v4 語言模型 | ✅ 可以（需保留著作權聲明／姓名標示） |
| 🟡 弱傳染（LGPL-2.1 / LGPL-3.0） | libchewing、fcitx5、fcitx5-chewing、fcitx5-rime、KenLM、rime-essay、rime-bopomofo、terra-pinyin、hime、gcin | ✅ 可以，但**必須動態連結並允許使用者替換該函式庫**；靜態連結閉源需提供 relink 機制 |
| 🔴 強傳染（GPL-2.0 / GPL-3.0 / AGPL-3.0） | Weasel、Squirrel、Trime、ibus-rime、ibus-chewing、LimeHD、GuilelessBopomofo、libpinyin、npm `bopomofo` | ❌ 連結散布即須開源整個作品（AGPL 連網路服務也要開源） |
| ⛔ 禁改作 / 限學術 / 無授權 | 教育部四部辭典（CC BY-**ND** 3.0 TW）、中研院語料庫、CWN、繁化姬、所有「無 LICENSE 檔」的 repo | ❌ 依情況不可，或必須走特許路徑（見 §D） |

---

## A. 注音輸入引擎與詞庫

### A1. libchewing（新酷音）— 目前最值得押注的核心

| 項目 | 內容 |
|---|---|
| 主要位址 | **https://codeberg.org/chewing/libchewing**（2026 年已從 GitHub 遷移至 Codeberg） |
| GitHub 鏡像 | https://github.com/chewing/libchewing （424 ★，描述為「Migrated to Codeberg」，最後 push 2026-04-06） |
| **授權** | **LGPL-2.1-or-later**（`COPYING` 檔為 GNU LGPL v2.1 全文；`Cargo.toml` 明載 `license = "LGPL-2.1-or-later"`） |
| 語言 | **Rust**（核心已重寫）＋ C API ＋ Swift Package |
| 維護狀態 | 🟢 活躍。Codeberg 最後更新 **2026-09-25**；官網 https://chewing.im/ |
| 發行 | crates.io `chewing` 最新版 **0.14.0-alpha.2**（37,639 次下載，2026-09-25 更新）<br>repo 內 `Cargo.toml` 標 0.12.0-alpha.3（master 快照），MSRV Rust ≥ 1.88 |
| 建置 | CMake ≥ 3.21（`cmake --preset rust-release`）＋ Cargo；支援 MSVC / macOS / 交叉編譯 |

**架構（實查 `src/` 目錄）**

```
src/
├── zhuyin/         bopomofo.rs, syllable.rs      # 注音符號與音節模型
├── input/          keycode.rs, keymap.rs, keysym.rs  # 鍵盤事件正規化
├── editor/         composition_editor.rs, abbrev.rs, estimate.rs
│   ├── zhuyin_layout/  standard.rs dc26.rs et.rs et26.rs hsu.rs ibm.rs ginyieh.rs pinyin.rs
│   └── selection/      phrase.rs, symbol.rs       # 詞選擇 / 符號選擇
├── dictionary/     trie.rs, layered.rs, sqlite.rs, uhash.rs, loader.rs, usage.rs
└── conversion/     chewing.rs, simple.rs, symbol.rs, fuzzy.rs   # 四種轉換引擎
capi/               C API（cbindgen）＋ include/chewing.h
swift/ + Package.swift  Swift Package「Chewing／CChewing」，用 CargoBuild plugin 呼叫 cargo build
```

**術語對照（提問中的 chewing / phone / phrase / tree / simple / symbol）**

| 術語 | 在新版 libchewing 的對應 | 說明 |
|---|---|---|
| **chewing** | `src/conversion/chewing.rs` | 「智慧」轉換引擎：以詞庫＋詞頻做長詞優先／上下文選字 |
| **simple** | `src/conversion/simple.rs` | 註解原文：*"Simple engine does not perform any intelligent conversion."* 逐字直譯，不做智慧選字 |
| **symbol** | `src/conversion/symbol.rs`、`editor/selection/symbol.rs` | 全形／標點／特殊符號輸入 |
| **fuzzy**（額外） | `src/conversion/fuzzy.rs` | 模糊音（如 ㄓ/ㄗ）容錯 |
| **phone** | `zhuyin/syllable.rs`；C API `chewing_get_phoneSeq()`、`chewing_get_phoneSeqLen()`、`chewing_phone_to_bopomofo()` | 「phone」= 注音音節的內部編碼 |
| **phrase** | `editor/selection/phrase.rs`；C API `chewing_userphrase_add/remove/get/enumerate` | 詞／使用者自訂詞 |
| **tree** | `dictionary/trie.rs`、`trie_buf.rs` | 詞庫以 trie（樹）索引 |
| 鍵盤 | `editor/zhuyin_layout/*.rs` | 見 §B7 |

> ⚠️ 舊版（0.5.x 以前）常見的資料檔名（`chewing.dat`、`phone.cin`、`phrase.occ`、`tree.dat`、`index_tree.dat`、`symbols.dat`、`swkb.dat`）在新版 master 已不存在——我在 repo 與 `libchewing-data` 中皆未找到這些檔名，**舊檔名對應關係為「未知，需進一步確認」**；新版的實際資料檔見 A1-詞庫。

**詞庫與資料（`libchewing-data`）**

| 項目 | 內容 |
|---|---|
| 位址 | **https://codeberg.org/chewing/libchewing-data**（GitHub 鏡像 `chewing/libchewing-data` 38 ★，已 archived） |
| **授權** | **CC BY 4.0**（repo 內有 `LICENSES/CC-BY-4.0.txt`；`dict/chewing_v4/README.md` 明載 *"This work is licensed under CC BY 4.0"*）<br>例外：`dict/moe/` 衍生自教育部辭典，授權另計（見 §B1） |
| 資料檔 | `dict/chewing/word.csv`（390 KB，單字注音）、`tsi.csv`（5.2 MB，詞＋優先序＋注音）、`mini.csv`、`alt.csv`、`misc/symbols.dat`、`misc/swkb.dat` |
| **v4 語言模型** | `dict/chewing_v4/bigram_p80.arpa`（**150 MB**）、`tsi_unigram.arpa`（4 MB）、`static_words.txt`（1.26 MB）、`tsi_dict.csv`（5 MB）、`tuning.dat` |

**詞庫格式（實查 `libchewing-data` README）**

- `word.csv`：`中文字,0,注音`，例：`呢,0,ㄋㄜ˙`
- `tsi.csv`：`詞,優先順序,注音`，例：`酷音,1000,ㄎㄨˋ ㄧㄣ`（音節間**空格**分隔；數值越大越優先，由語料統計而來，不可任意手改）
- 「破音字」需同時改 `word.csv`（新增讀音）與 `tsi.csv`（新增優先序）

**v4 bigram 語言模型效能（官方 README 實測）**

| keep_frac | 模型大小 | 首選句準確率 | λ |
|---|---|---|---|
| 0.1 | 5.5 MB | 94.87% | 0.6 |
| 0.3 | 14 MB | 95.60% | 0.6 |
| 0.5 | 20 MB | 95.85% | 0.6 |
| 1.0 | 34 MB | 96.11% | 0.6 |
| unigram-only | — | 92.57% | 0 |

> 訓練語料：約 16 GiB 網路中文文本、711,645 句保留集。**這是目前少見「授權明確可商用（CC BY 4.0）＋ 專為注音解碼調校」的中文 bigram 模型**，是本專案最有價值的資料資產。

**語言 binding / 整合（實查 README 的 Status 段）**

- 活躍：**Windows TSF**（`chewing/windows-chewing-tsf`）、**PIME**、**ibus**（`chewing/ibus-chewing`）、**HIME**、**fcitx5**（`fcitx/fcitx5-chewing`）、**Guileless Bopomofo**（Android）、**Fcitx5 macOS**（`fcitx-contrib/fcitx5-macos`）
- 已停止：SCIM（`chewing/scim-chewing`）、獨立 Windows 版 `windows-chewing`、mozc、uim、ucimf、JMCCE、xcin、IIIMF、SpaceChewing、Java Desktop System、OpenVanilla（1.0 之前）、OXIM
- 官方 binding：**C API**（`capi/include/chewing.h`，`chewing_*` 系列）、**Swift Package**（`Package.swift`，product `Chewing` → target `CChewing`，swift-tools 6.1）、**Rust crate**（`chewing` on crates.io）

**支援的鍵盤排列（實查 README）**：大千（預設）、許氏、IBM、精業、倚天、倚天 26 鍵、Dvorak、Dvorak Hsu、漢語拼音、臺灣華語羅馬拼音、MPS2 拼音、Colemak、Colemak-DH ANSI、Colemak-DH Ortholinear、Workman。

---

### A2. RIME（中州韻）／ librime

| 項目 | 內容 |
|---|---|
| librime | https://github.com/rime/librime — **4,628 ★**，C++，**BSD-3-Clause**，最後 push **2026-09-25**（🟢 極活躍） |
| 架構 | 模組化可擴充 C++ 引擎；`src/rime_api.cc` 提供 C API；`plugins/` 外掛機制（`rime-new-plugin.sh`）；`doc/`（含 chording 和弦輸入架構文件） |
| 依賴 | Boost ≥ 1.74、leveldb、**marisa-trie**、**OpenCC ≥ 1.0.2**、yaml-cpp |
| Schema DSL | YAML（`*.schema.yaml`）：`engine`（processors / segmentors / translators / filters）、`speller.algebra`（拼寫代數）、`translator.dictionary/prism`、`punctuator`、`key_binder`、`recognizer`、`__include` / `__patch` |

**注音方案（`rime/rime-bopomofo`）**

| 項目 | 內容 |
|---|---|
| Repo | https://github.com/rime/rime-bopomofo — 53 ★，**LGPL-3.0**，最後 push 2026-05-09 |
| 檔案 | `bopomofo.schema.yaml`（大千式）、`bopomofo_tw.schema.yaml`（臺灣正體）、`bopomofo_express.schema.yaml`、`detenele.schema.yaml`（動態能力）、`zhuyin.yaml`（拼寫代數） |
| 安裝 | 需 `rime-terra-pinyin`（地球拼音）；東風破：`bash rime-install bopomofo terra-pinyin` |
| 版本需求 | 方案描述明載「請配合 **librime ≥ 1.16** 使用」 |

**⚠️ 最關鍵的架構洞見**：RIME 的注音方案**不是**一套獨立的注音詞庫，而是把拼音詞庫「轉寫」成注音：

```yaml
# bopomofo.schema.yaml 節錄
speller:
  alphabet: '1qaz2wsxedcrfv5tgbyhjnum8ik,9ol.0p;/- 6347'
  algebra:
    __patch:
      - zhuyin:/pinyin_to_zhuyin   # iu→iou, ong→ung, zhi→Z, ai→A, ang→K …
      - zhuyin:/free_order         # 聲韻母任意順序（derive）
      - zhuyin:/abbreviation       # 只打聲母也能出字
      - zhuyin:/keymap_bopomofo    # 字母→注音鍵位 xlit
translator:
  dictionary: terra_pinyin          # ← 詞庫其實是 terra_pinyin（1.8 MB dict.yaml）
  prism: bopomofo
```

- `keymap_bopomofo` 的核心對照（實查 `zhuyin.yaml`）：
  `bpmfdtnlgkhjqxZCSrzcsiuvaoeEAIOUMNKGR12345` → `1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347`
- **注音支援程度**：完整音節、可省略聲調與韻母、聲韻任意序、聲母縮寫、Shift+數字選字、空格鍵輸入第一聲「ˉ」、無模式設計；以 `` ` `` 前綴做筆畫反查（依賴 `stroke` 方案）
- 輸出字形切換：`zh_hans`（t2s.json）／`zh_hant_hk`（t2hk.json）／`zh_hant_tw`（t2tw.json）皆走 **OpenCC**
- 語言模型：`__patch: grammar:/hant?` → 使用 **rime-essay 八股文**（`essay.txt` **5.8 MB**，LGPL-3.0）

**生態系（實查 GitHub org `rime`）**

| Repo | 星數 | 授權 | 最後 push | 用途 |
|---|---|---|---|---|
| `rime/weasel`（小狼毫） | 8,062 | **GPL-3.0** | 2026-08-18 | Windows 前端 |
| `rime/squirrel`（鼠鬚管） | 6,397 | **GPL-3.0** | 2026-08-13 | macOS 前端（Swift） |
| `rime/plum`（東風破） | 1,942 | LGPL-3.0 | 2026-05-08 | 方案管理器 |
| `rime/ibus-rime` | 892 | **GPL-3.0** | 2026-09-03 | Linux/IBus 前端 |
| `rime/rime-terra-pinyin` | 166 | LGPL-3.0 | 2026-09-18 | 地球拼音（注音方案的詞庫來源） |
| `rime/rime-essay` | 76 | LGPL-3.0 | 2026-09-23 | 共用詞彙＋語言模型 |
| `rime/rime-prelude` | 77 | LGPL-3.0 | 2026-05-09 | 基礎設定（symbols.yaml 28 KB 等） |
| `fcitx/fcitx5-rime` | 440 | **LGPL-2.1-or-later**（`LICENSES/`） | 2026-09-24 | fcitx5 前端 |
| `osfans/trime`（同文） | 4,667 | **GPL-3.0** | 2026-09-25 | Android 前端（Kotlin） |
| `rime/librime-predict` | 116 | BSD-3-Clause | 2024-11-18 | 下一詞預測外掛 |

> 注意：**前端殼多為 GPL-3.0**（weasel / squirrel / trime / ibus-rime），核心 librime 則是寬鬆的 BSD-3-Clause。這個「核寬鬆、殼傳染」的結構，是選擇 RIME 路線時最關鍵的授權事實。

---

### A3. McBopomofo（小麥注音）與跨平台核心候選

| 專案 | 星數 | 語言 | **授權** | 最後 push | 說明 |
|---|---|---|---|---|---|
| `openvanilla/McBopomofo` | 840 | Swift＋C++ | **MIT**（`LICENSE.txt`：© 2011-2026 Mengjuei Hsieh et al.） | 2026-09-25 | macOS 小麥注音；引擎在 `Source/Engine/`（`McBopomofoLM`、`ParselessLM`、`ParselessPhraseDB`、`Mandarin`、`ByteBlockBackedDictionary`） |
| `openvanilla/McBopomofoWeb` | 27 | TypeScript | **MIT** | 2026-09-21 | 網頁版核心；輸出 ChromeOS、**Windows（PIME）**、MCP server、CLI；npm 名 `@openvanilla/mcbopomofoweb` 2.1.0 |
| `vChewing/vChewing-macOS`（唯音） | 620 | Swift | **MulanPSL-2.0**（應用層）；核心模組 **LGPL-3.0-or-later ＋ 靜態連結例外** | 2026-09-25 | 注音＋拼音；研發管理在 Gitee |
| `vChewing/vChewing-LibVanguard` | 5 | Swift | **LGPL-3.0-or-later ＋ `CUSTOM_LGPLv3_EXCEPTION`** | 2026-09-25 | 「跨平台中文輸入法引擎」，為擺脫 macOS 耦合而重寫；模組 `BPMFVS`、`Homa`、`LexiconAssembly`、`Tekkon`、`BrailleSputnik`；`SwiftExtension`／`ResourceLocator` 為 MulanPSL-2.0 |
| `ButTaiwan/bpmfvs` | 300 | JavaScript | **未知，需進一步確認**（GitHub API 未偵測到授權檔；但 McBopomofo `ACKNOWLEDGEMENTS.md` 稱其採 **Apache-2.0**） | 2026-03-27 | 注音 IVS 字型規格；McBopomofo 的破音字標記資料衍生自此 |

**McBopomofo 資料層（`Source/Data/`）**

| 檔案 | 大小 | 內容 |
|---|---|---|
| `BPMFBase.txt` | 720 KB | 單字注音對照 |
| `BPMFMappings.txt` | **5.0 MB** | 多字詞（2–6 字）；README 明載 *"Originally simplified from **tsi.src of libtabe (BSD Licensed)** with modifications"* |
| `BPMFPunctuations.txt` | 56 KB | 標點 |
| `Symbols.txt` / `Macros.txt` | 38 KB / 2.5 KB | 特殊符號、文字巨集 |
| `bpmfvs-variants.txt` / `bpmfvs-pua.txt` | 425 KB / 18 KB | 破音字變體選擇器（衍生自 bpmfvs） |
| `exclusion.txt`、`heterophony1~3.list`、`phrase.occ` | — | 詞頻排除、破音序、詞頻統計 |

> **跨平台核心的結論**：McBopomofo **沒有**現成的跨平台核心（引擎為 macOS/ObjC++/Swift 混寫）。若需要「一份核心、多平台殼」，目前只有三個現實選項：
> 1. **libchewing**（Rust 核心 ＋ C API ＋ Swift Package，LGPL-2.1+）— 覆蓋面最廣
> 2. **librime**（C++，BSD-3-Clause）— 授權最寬鬆且生態最完整
> 3. **LibVanguard**（Swift 6.4，LGPL-3.0 ＋ 靜態連結例外）— 最新但僅 5 ★、尚在開發中

---

### A4. 其他傳統輸入法框架／前端現況

| 專案 | 星數 | 語言 | **授權** | 最後 push | 現況評語 |
|---|---|---|---|---|---|
| `EasyIME/PIME` | 1,474 | C++／Python／Node | **混合**：核心目錄（`cmake`、`installer`、`libIME`、`libpipe`、`PIME`、`PIMELauncher`、`server`）**LGPL-2.0**（另有 `LGPL-2.0.txt`、`APACHE-2.0.txt`、`PSF.txt`）；內含 Tornado(Apache-2.0)、jsoncpp(MIT)、OpenCC(Apache-2.0)、libchewing(LGPL-2.1)、librime(BSD) | 2026-07-25 | 🟢 活躍。GitHub API 顯示 `NOASSERTION` 是因為授權檔不只一個，**已讀 `LICENSE.txt` 原文確認**。是目前「用 Python / Node.js 快速做 Windows TSF 輸入法」的最佳骨架，已內建新酷音、Rime、McBopomofoWeb 後端 |
| `openvanilla/openvanilla` | 540 | C++ | **MIT 條文**（`LICENSE.txt` 為 MIT 全文；但明文聲明 `Libraries/` 與 `DataTables/` 內各檔案另有授權）→ GitHub API 顯示 `NOASSERTION` | 2026-09-24 | 🟡 macOS 老牌框架，仍維護；**DataTables 授權需逐一確認** |
| `gcin` | — | C++ | **LGPL-2.1**（依 Debian 套件 `debian/copyright`：`Files: *` → `License: LGPL-2.1`，© Edward Der-Hua Liu；`debian/*` 為 GPL-2+；`dayi3.cin` 因 DFSG 非自由被排除）→ **上游無官方 GitHub repo，建議仍向作者確認** | 上游 https://hyperrate.com/gcin-source/ | 🟡 主要在 hyperrate.com 發布；無 GitHub 組織，取用與授權追蹤較困難 |
| `hime-ime/hime` | 272 | C | `README.md`：**LGPLv2.1（Qt immodules 為 GPLv2）** | **2023-12-21** | 🟠 維護趨緩（近 3 年無更新） |
| `chewing/ibus-chewing` | 77 | C | **GPL-2.0** | 2026-04-01 | 🟢 活躍 |
| `fcitx/fcitx5-chewing` | 24 | C++ | **LGPL-2.1-or-later**（`LICENSES/LGPL-2.1-or-later.txt`） | 2026-09-06 | 🟢 活躍 |
| `chewing/windows-chewing-tsf` | 19（Codeberg） | **Rust** | **GPL-3.0**（GitHub 鏡像 251 ★ 標 GPL-3.0；Codeberg repo 有 `COPYING.txt`、`crates/`、`installer/`、`tip/`） | **2026-09-26**（Codeberg） | 🟢 活躍，是目前最現代的 Windows TSF 注音實作 |
| `chewing/windows-chewing`（舊） | 42 | C++ | `NOASSERTION` | 2016-02-04 | 🔴 **已 archived** |
| `chewing/scim-chewing` | 7 | C++ | GPL-2.0 | 2016-05-13 | 🔴 已停 |

---

### A5. 其他引擎：libpinyin、Rust 注音引擎、JS 實作

| 專案 | 星數 | 語言 | **授權** | 最後 push | 備註 |
|---|---|---|---|---|---|
| `libpinyin/libpinyin` | 494 | C++ | **GPL-3.0** | 2026-09-03 | 拼音（非注音）；🔴 GPL-3.0 商用需開源 |
| `tonyq-org/QBopomofo`（Q注音） | 14 | **Rust** | **LGPL-2.1** | 2026-08-03 | 「跨平台智慧注音輸入法，引擎源自 libchewing」→ 與 libchewing Rust 化方向一致 |
| `hiroshiyui/GuilelessBopomofo`（樸實注音） | 133 | Kotlin | **GPL-3.0** | 2026-08-03 | Android；以 libchewing 做智慧選字 |
| `xdavidwu/wlchewing` | 15 | C | **MIT** | 2025-08-30 | Wayland 注音輸入法，用 libchewing |
| `timdream/jszhuyin` | 235 | JavaScript | **MIT** | 2024-10-10 | 「JavaScript 自動選字注音輸入法」；npm `jszhuyin` 1.1.2。**純 JS 注音引擎中授權最乾淨者** |
| `kpu/kenlm` | 2,806 | C++ | **LGPL-2.1**（`LICENSE` 明載多數檔案 LGPL-2.1-or-later；`util/getopt.*`、`murmur_hash.cc`、`string_piece.*`、`double-conversion`、`integer_to_string.*`(BSD) 另有授權） | 2025-03-30 | 語言模型推論工具，非引擎 |
| npm `bopomofo` | — | JS | **AGPL-3.0-or-later** | 4.1.0（2023-11-13） | 🔴 AGPL：連提供網路服務都要開源，**不建議納入商業產品** |
| npm `pinyin-to-zhuyin` / `pinyin-zhuyin` | — | JS | **MIT** | 1.1.0（2026-03-17）/ 1.0.4 | 拼音↔注音轉換，小工具 |
| npm `zh-stroke-data` | — | JS | **無 license 欄位** | 0.0.75 | 「常用國字標準字體筆劃 XML 資料檔」（g0v）→ 未知，需進一步確認 |
| `bopomofo4js` | — | — | — | — | **查無此套件**（npm registry 回傳 `Not found`）→ 提問中的名稱可能有誤 |

---

## B. 資料層：注音 → 漢字對照與語言資料

### B1. 教育部國語辭典開放資料 ⛔ **最重要授權陷阱**

| 項目 | 內容 |
|---|---|
| 官方入口 | **教育部國語辭典公眾授權網** https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html |
| 涵蓋 | 《重編國語辭典修訂本》https://dict.revised.moe.edu.tw/ 、《國語辭典簡編本》https://dict.concised.moe.edu.tw/ 、《國語小字典》https://dict.mini.moe.edu.tw/ 、《成語典》https://dict.idioms.moe.edu.tw/ |
| **授權** | **創用 CC－姓名標示－禁止改作 3.0 臺灣授權條款（CC BY-ND 3.0 TW）** |
| 商用？ | ✅ **允許**（官網原文：「本授權條款允許使用者重製、散布、傳輸著作（**包括商業性利用**）」） |
| 改作？ | ❌ **不得修改該著作** |
| 版本編號（實查） | 重編 2015_20260625、簡編本 2014_20260626、小字典 2019_20260626、成語典 2020_20260625 |

**《國語辭典簡編本》公眾授權使用說明（`conciseddict_10312.pdf` 原文節錄）**

> （四）**額外授權聲明**：依本著作權利人中華民國教育部之聲明，任何使用者皆得依照 CC BY-ND 3.0 TW 的規定，使用《國語辭典簡編本》之資料與素材。使用者對於《國語辭典簡編本》個別條目的詞目、部首、筆畫、字形、音讀及釋義等內容**不得為任何修改，或轉為簡化字**。**惟依教育部所提供對照表內容作字碼改換，或不涉及更改《國語辭典簡編本》個別條目所有內容之調整行為，可不被認定構成上述禁止修改條款之拘束範圍。**
>
> 二、使用者承諾事項：……無論再散布與否，**都必須完整保留本使用說明**，並確認資料版本訊息。

**這正是 `libchewing-data/dict/moe/` 的合規作法**（`dict/moe/ATTRIBUTE.md` 實查）：

- 檔案：`moe_dict_concised.csv`（1.4 MB）、`moe_dict_concised_importer.rb`、`sources/dict_concised_2014_20251229.zip`、`sources/conciseddict_10312.pdf`
- 聲明原文：「本專案因實務需要，對於本資料之原始資料加以變更『輕聲標注位置』、『ㄦ化音前綴空白』、『部份注音組合間補足空白分隔』，其更動符合〈公眾授權使用說明〉當中『**額外授權聲明**』之規定。」

> ✅ **可安全沿用的路徑**：以教育部的對照表做**字碼／格式轉換**（Big5↔Unicode、空白與輕聲標記正規化），並完整保留使用說明與版本標示。
> ❌ **不可**：改寫釋義、增刪音讀、轉成簡化字、把辭典內容當成自家詞庫重新排序後宣稱自行編輯。

---

### B2. 萌典（g0v / moedict）

| 專案 | 星數 | **授權** | 最後 push | 說明 |
|---|---|---|---|---|
| `g0v/moedict-webkit` | — | **程式碼 CC0 1.0**（README 原文：「除前述資料檔之外，本目錄下的所有其他檔案，由作者唐鳳在法律許可的範圍內，拋棄該著作依著作權法所享有之權利……貢獻至公眾領域」） | `master` 分支**已封存**（2013 dump），新前端在 `main` | ⚠️ **但字典資料檔仍承襲教育部授權（CC BY-ND 3.0 TW）** |
| `g0v/moedict-data` | 171 | **無授權檔**（資料檔＝教育部） | 2026-07-11 | 「教育部重編國語辭典 資料檔」 |
| `g0v/moedict-process` | 37 | **無授權檔** | 2026-08-11 | 資料處理工具鏈（TypeScript），產出 pack |
| `g0v/moedict-data-csld` | 130 | **無授權檔** | 2023-11-08 | 中華大辭典 |

**萌典 API（含注音欄位，適合做「注音↔漢字」對照抽取）**

- `https://www.moedict.tw/uni/{字}` → JSON 含 `bopomofo`、`bopomofo2`、`pinyin`、`heteronyms`
- `https://www.moedict.tw/a/{字}.json` → 已斷詞（`` ` `` 標記詞界）
- 其他端點：`/raw/`、`/pua/`、`/t/`（閩南語）、`/h/`（客語）、`/c/`（兩岸詞典）
- 教育部國語辭典授權頁：https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/

> ⚠️ **結論**：萌典的「程式」是 CC0，非常好用；萌典的「資料」不是 CC0——**授權跟著教育部走**。

---

### B3. CNS 11643 全字庫 ✅ **最有價值的合規注音資料源**

| 項目 | 內容 |
|---|---|
| 官方 | https://www.cns11643.gov.tw/ （主管機關：數位發展部） |
| 授權頁 | https://www.cns11643.gov.tw/pageView.jsp?ID=59 |
| **授權** | **1. 政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）**：無償、非專屬、不限時間地域，可**重製、編輯、公開傳輸或為其他利用方式，開發各種產品或服務（加值產品）**；範圍**不含商標權及專利權**，須標示來源出處（數位發展部，CNS11643 中文標準交換碼全字庫網站）<br>**2. 字型檔為 OFL-1.1**（可免費使用、研究、複製、合併、嵌入、修改、散布與販售） |
| **關鍵資料** | 授權下載項目明列「**字型屬性檔：注音**、倉頡、筆畫、部首、拼音、部件、筆順」＋「中文碼對照表（CNS↔Big5／Unicode 5.2／電信碼／地政自造字／財稅內碼／稅務碼／工商自造字）」 |
| 下載 | https://data.gov.tw/dataset/5961 （政府資料開放平臺）<br>檔案清單：https://www.cns11643.gov.tw/opendata/OpenDataFilesList.csv |
| 注音查詢介面 | https://www.cns11643.gov.tw/search.jsp?ID=3 |

> ✅ **這是全清單中「涵蓋全字集＋注音屬性＋可商用＋可改作＋可閉源」的少數資料源**。搭配 libchewing-data v4 的 CC BY 4.0 語言模型，即可完全繞開教育部辭典的 ND 限制。

---

### B4. 注音標注資料集與語言資料

| 資料集 | **授權** | 商用 | 連結／備註 |
|---|---|---|---|
| **中文詞彙網路 CWN** | **未知，需進一步確認**（`loperntu/cwn2` 22 ★、**無授權檔**、最後 push 2016-08-15；`lopentu/CwnWeb` 6 ★、無授權檔） | ❌ 未授權即不可 | https://github.com/loperntu/cwn2 ；原官網 `lope.linguistics.ntu.edu.tw/cwn2/` 已 404，LOPE 實驗室已改版（https://lope.linguistics.ntu.edu.tw/） |
| **中研院平衡語料庫 ASBC** | **未知，需進一步確認**（官網 https://asbc.iis.sinica.edu.tw/ ；中研院語料庫歷來採學術用途授權，商用須另洽） | ⚠️ 需洽談 | 抓取時回傳無法安全轉換的內容，未能取得授權原文 |
| **教育部《常用國字標準字體表》** | **未知，需進一步確認**（教育部標準字體相關著作通常比照教育部其他語文成果；`zh-stroke-data` npm 套件也無 license 欄位） | ⚠️ | 建議改用全字庫字形（OFL-1.1）＋全字庫屬性檔（OGDL-1.0） |
| **教育部《國語一字多音審訂表》** | **未知，需進一步確認**（未找到獨立開放資料頁；官方僅在辭典介紹中說明「本辭典所收的字音，參照教育部公布之國語一字多音審訂表」） | ⚠️ | 實務替代：`libchewing-data/dict/chewing_v4/rare_dict.csv`（23 KB 罕用讀音）＋ 教育部簡編本（CC BY-ND ＋額外授權） |
| **Unicode Bopomofo** | Unicode 資料檔採 **Unicode License**（寬鬆、可商用）→ 條款細節建議於使用前確認 UCD 現行版本 | ✅ | 注音符號 **U+3105–U+312F**；聲調符號 U+02C9 ˉ / U+02CA ˊ / U+02C7 ˇ / U+02CB ˋ / U+02D9 ˙；**Bopomofo Extended U+31A0–U+31BF**（方音符號）；ISO 15924 = `Bopo` (285) |
| **libtabe `tsi.src`** | 依 McBopomofo `Source/Data/README.md`：**BSD Licensed** | ✅ | McBopomofo 的 `BPMFMappings.txt` 由此簡化修改而來；是少見「授權乾淨的大型中文詞庫」來源 |

---

### B5. 簡繁轉換

| 專案 | 星數 | **授權** | 最後 push | 商用可行性 |
|---|---|---|---|---|
| **OpenCC**（`BYVoid/OpenCC`） | **10,011** | **Apache-2.0** | 2026-09-25 | ✅ **可閉源商用**。RIME 的 `t2s.json` / `t2tw.json` / `t2hk.json` 即用它；librime 硬依賴 `libopencc ≥ 1.0.2`；PIME 亦內嵌 |
| **繁化姬 Fanhuaji**（https://zhconvert.org/） | — | **專有（閉源線上服務）**；服務條款：https://docs.zhconvert.org/license/ | — | ❌ **不建議內嵌**。條款要求：(1) 免費使用時不得移除推廣內容（會插入字幕註解）；(2) 程式使用其 API 必須標示並附上 https://zhconvert.org ；另有獨立「商業使用」頁面 |

> ✅ 簡繁／臺灣化一律走 **OpenCC**（Apache-2.0），不要用繁化姬。

---

### B6. 可用於智慧選字的語言模型

| 元件／資料 | **授權** | 商用 | 大小 | 備註 |
|---|---|---|---|---|
| **KenLM**（`kpu/kenlm`，2,806 ★） | **LGPL-2.1**（多數檔案 LGPL-2.1-or-later；`util/getopt.*`、`util/murmur_hash.cc`、`util/string_piece.*`、`util/double-conversion`、`util/integer_to_string.*`(BSD) 另有授權） | ✅（動態連結＋可替換） | — | 只是**推論工具**，不含模型資料 |
| **libchewing-data v4 bigram** | **CC BY 4.0** | ✅ **可商用、可改作**（需姓名標示） | `bigram_p80.arpa` **150 MB**；`tsi_unigram.arpa` 4 MB；`static_words.txt` 1.26 MB；`tsi_dict.csv` 5 MB | ⭐ **首選**。專為注音解碼訓練，首選句準確率 92.57%（unigram）→ 96.11%（完整 bigram） |
| **rime-essay 八股文**（`essay.txt`） | **LGPL-3.0** | ⚠️ 可商用，但 LGPL-3.0 義務較重（含 anti-tivoization） | 5.8 MB | 詞彙＋語言模型；RIME 注音方案預設載入 |
| **rime-terra-pinyin**（`terra_pinyin.dict.yaml`） | **LGPL-3.0** | ⚠️ 同上 | 1.8 MB | 注音方案的詞庫本體 |
| **McBopomofo 語言模型** | **MIT**（`McBopomofoLM` / `ParselessLM` 為 MIT 專案的一部分） | ✅ | 由 `BPMFBase.txt`＋`BPMFMappings.txt`（libtabe BSD 衍生）建構 | 需自行以 `Source/Data/Makefile` 重建 |
| 其他可商用小型中文 LM | — | — | — | 本次調查**未找到**除上述之外「授權明確允許商用」的現成中文 n-gram 資料；若需更大模型，建議**自行以授權乾淨的語料訓練**（語料授權才是真正的瓶頸） |

---

### B7. 注音鍵盤排列的權威定義

| 排列 | 權威開源定義（可作為 single source of truth） | 授權 |
|---|---|---|
| **標準（大千）式** | `libchewing` → `src/editor/zhuyin_layout/standard.rs`；RIME → `bopomofo.schema.yaml` 的 `keymap_bopomofo` | LGPL-2.1+ / LGPL-3.0 |
| **大千 26 鍵** | `libchewing` → `src/editor/zhuyin_layout/dc26.rs` | LGPL-2.1+ |
| **倚天式 / 倚天 26 鍵** | `libchewing` → `src/editor/zhuyin_layout/et.rs`、`et26.rs` | LGPL-2.1+ |
| **IBM 式** | `libchewing` → `src/editor/zhuyin_layout/ibm.rs` | LGPL-2.1+ |
| **許氏鍵盤** | `libchewing` → `src/editor/zhuyin_layout/hsu.rs` | LGPL-2.1+ |
| **精業式** | `libchewing` → `src/editor/zhuyin_layout/ginyieh.rs` | LGPL-2.1+ |
| **拼音類**（漢語拼音、MPS2、國語羅馬字變體） | `libchewing` → `src/editor/zhuyin_layout/pinyin.rs`（含 `PinyinVariant`） | LGPL-2.1+ |
| **動態能力（detenele）** | RIME → `rime-bopomofo/detenele.schema.yaml`（README 以 keyboard-layout-editor 連結定義） | LGPL-3.0 |
| **自然輸入法預設排列** | ❌ **無開源規格**（自然輸入法為網際智慧公司專有軟體）。排列本身屬「事實性按鍵對應」，通常不受著作權保護，但**無權威公開來源** → **未知，需進一步確認** | 專有 |

> **建議**：直接以 `libchewing/src/editor/zhuyin_layout/` 為唯一真實來源（它同時覆蓋 5 種以上排列，且是**可執行、可測試的程式碼**，而非文件描述）。RIME 的 `bopomofo.schema.yaml` 可作為大千式的第二來源交叉驗證。
> 注意：`libchewing-data/misc/swkb.dat`（154 bytes）與 `symbols.dat`（5 KB）也是鍵盤／符號資料，但**檔案格式未在 repo 中文件化** → 格式「未知，需進一步確認」。

---

## C. 各平台 IME 框架的開源範例 repo

### C1. Windows TSF（Text Services Framework）

| Repo | 星數 | 語言 | **授權** | 維護狀態 | 範例價值 |
|---|---|---|---|---|---|
| `EasyIME/PIME` | 1,474 | C++／Python／Node | **LGPL-2.0**（核心目錄）＋內含多個第三方授權 | 🟢 2026-07-25 | ⭐ **首選骨架**。`libIME`（TSF 的簡單封裝）＋`PIMETextService`（後端骨幹）＋`PIMELauncher`。可用 Python 或 Node.js 寫 IME 邏輯，內建新酷音／Rime／McBopomofoWeb 範例 |
| `chewing/windows-chewing-tsf` | 19（Codeberg） | **Rust** | **GPL-3.0** | 🟢 2026-09-26 | ⭐ 最現代的 TSF 注音實作；`crates/`＋`installer/`＋`tip/`。🔴 GPL 傳染 |
| `rime/weasel`（小狼毫） | 8,062 | C++ | **GPL-3.0** | 🟢 2026-08-18 | 完整 Windows 前端；🔴 GPL 傳染 |
| `microsoft/Windows-classic-samples` | 5,683 | C++ | **MIT**（`LICENSE` 已確認） | 2026-09-03 | ✅ 官方 TSF 範例（含文字服務 sample），可自由抄進閉源產品 |
| `Chocobo1/windows-chewing-tsf-build` | 114 | Batchfile | 無授權檔 | 2024-06-01 | 非官方編譯腳本 |

### C2. macOS InputMethodKit

| Repo | 星數 | 語言 | **授權** | 維護狀態 | 範例價值 |
|---|---|---|---|---|---|
| `openvanilla/McBopomofo` | 840 | Swift＋C++ | **MIT** | 🟢 2026-09-25 | ⭐ **閉源商用首選**。完整的 IMK 輸入法（含候選窗 `Packages/CandidateUI`、`InputSourceHelper`、`NotifierUI`、`OpenCCBridge`） |
| `rime/squirrel`（鼠鬚管） | 6,397 | Swift | **GPL-3.0** | 🟢 2026-08-13 | 最成熟的 IMK 前端；🔴 GPL |
| `openvanilla/openvanilla` | 540 | C++ | **MIT 條文**（`DataTables/` 另行授權） | 🟢 2026-09-24 | 老牌框架，模組化載入器設計值得參考 |
| `vChewing/vChewing-macOS` | 620 | Swift | 應用層 **MulanPSL-2.0**；核心 **LGPL-3.0 ＋ 靜態連結例外** | 🟢 2026-09-25 | 功能最豐富的第三方注音 macOS IME |

### C3. Android InputMethodService

| Repo | 星數 | 語言 | **授權** | 維護狀態 | 範例價值 |
|---|---|---|---|---|---|
| `osfans/trime`（同文） | 4,667 | Kotlin | **GPL-3.0** | 🟢 2026-09-25 | Rime 的 Android 前端，最完整；🔴 GPL |
| `AnySoftKeyboard/AnySoftKeyboard` | 3,383 | Java | **Apache-2.0** | 🟢 2026-09-24 | ✅ **閉源可用的 Android IME 骨架**（多語鍵盤、無網路） |
| `lime-ime/limeime`（LIME HD） | 138 | Java | **GPL-3.0**（`LICENSE.md`：「LIME IME 採用 GNU General Public License version 3 授權」；GitHub API 顯示 NOASSERTION） | 🟢 2026-09-20 | 台灣老牌注音／倉頡輸入法；🔴 GPL |
| `hiroshiyui/GuilelessBopomofo` | 133 | Kotlin | **GPL-3.0** | 🟢 2026-08-03 | 以 libchewing 做智慧選字的注音專用鍵盤；🔴 GPL |

### C4. Linux：fcitx5 / ibus

| Repo | 星數 | **授權** | 維護狀態 | 備註 |
|---|---|---|---|---|
| `fcitx/fcitx5` | 2,573 | **LGPL-2.1-or-later**（`LICENSES/`＋`REUSE.toml`；GitHub API 顯示 `null` 是因改用 REUSE 規範） | 🟢 2026-09-25 | 跨平台框架（含 Windows 路徑、Wayland `input-method-v2`） |
| `fcitx/fcitx5-chewing` | 24 | **LGPL-2.1-or-later** | 🟢 2026-09-06 | 注音 addon |
| `fcitx/fcitx5-rime` | 440 | **LGPL-2.1-or-later** | 🟢 2026-09-24 | Rime addon |
| `chewing/ibus-chewing` | 77 | **GPL-2.0** | 🟢 2026-04-01 | 🔴 |
| `ibus/ibus` | 998 | **LGPL-2.1** | 🟢 2026-09-22 | 框架本體 |
| `rime/ibus-rime` | 892 | **GPL-3.0** | 🟢 2026-09-03 | 🔴 |
| `xdavidwu/wlchewing` | 15 | **MIT** | 🟡 2025-08-30 | ✅ Wayland 原生注音 IME，授權最乾淨 |
| `fcitx-contrib/fcitx5-macos` | — | 未查證 | — | libchewing README 列為活躍整合；macOS 上的 fcitx5 |

### C5. 是否有「一份核心、多平台」的框架？

| 選項 | 結論 |
|---|---|
| **librime** | ✅ 核心 BSD-3-Clause，官方前端覆蓋 Windows / macOS / Linux / Android。**但官方前端全為 GPL-3.0**，閉源產品必須自寫前端 |
| **libchewing** | ✅ Rust 核心 ＋ C API ＋ **Swift Package**，官方列出的活躍整合覆蓋 Windows TSF / macOS（fcitx5-macos）/ Linux（ibus、fcitx5、HIME）/ Android（GuilelessBopomofo）/ Wayland（wlchewing）。**核心 LGPL-2.1+，前端可自寫並閉源** |
| **fcitx5** | 🟡 設計上跨 X11/Wayland/Windows，但歷史上以 Linux 為主；macOS 版由 `fcitx-contrib` 維護 |
| **LibVanguard** | 🟡 明確目標是跨平台中文引擎（Swift 6.4，可在 Linux/Windows 建置），但 5 ★、開發中 |
| **Web/JS 核心**（McBopomofoWeb、jszhuyin） | 🟡 MIT，可嵌入 Electron/Tauri 或瀏覽器擴充，但無法取得原生 IME 的系統整合（TSF/IMK 仍需原生殼） |

**各平台「最小可行外殼」建議**

| 平台 | 抄哪裡 | 授權注意 |
|---|---|---|
| Windows | 抄 **PIME 的 `libIME` 架構概念**（或直接用 PIME，LGPL-2.0），或參考 **windows-chewing-tsf** 的 Rust TSF 作法 | 直接用 PIME：LGPL-2.0 → 動態連結即可閉源；抄 windows-chewing-tsf：**GPL-3.0 會傳染，只能「讀」不能「抄」** |
| macOS | 用 **libchewing 的 Swift Package**（`Chewing` product）接 IMK；UI 參考 McBopomofo 的 `CandidateUI`（MIT） | McBopomofo 為 MIT，可自由改；Squirrel 為 GPL-3.0，僅供參考 |
| Android | 以 **AnySoftKeyboard（Apache-2.0）** 為骨架，接 libchewing（透過 JNI/UniFFI） | Trime / LimeHD / GuilelessBopomofo 皆 GPL-3.0，不可抄進閉源 |
| Linux | 寫 **fcitx5 addon**（LGPL-2.1+）或 ibus engine | fcitx5 addon 為 LGPL-2.1+，可閉源；ibus-chewing(GPL-2.0) / ibus-rime(GPL-3.0) 不可抄 |

---

## D. ⚠️ 授權陷阱總表（依風險排序）

| # | 陷阱 | 具體元件 | 後果／解法 |
|---|---|---|---|
| 1 | **CC BY-ND 禁改作** | 教育部《重編國語辭典修訂本》《國語辭典簡編本》《國語小字典》《成語典》 | 商用可、**改作不可**。唯一合規路徑：只做字碼／格式轉換（依「額外授權聲明」），完整保留使用說明與版本標示，**不得轉簡化字**。想要自由改造 → 改用**全字庫注音屬性檔（OGDL-1.0）** |
| 2 | **GPL-3.0 傳染** | weasel、squirrel、trime、ibus-rime、LimeHD、GuilelessBopomofo、libpinyin、windows-chewing-tsf、npm `bopomofo`(AGPL) | 連結散布即須以 GPL-3.0 開源整個作品。**不得用於閉源產品** |
| 3 | **AGPL-3.0** | npm `bopomofo` | 連「以網路提供服務」都要釋出原始碼 |
| 4 | **LGPL 的動態連結義務** | libchewing(LGPL-2.1+)、fcitx5 系列(LGPL-2.1+)、KenLM(LGPL-2.1)、rime-essay/rime-bopomofo/terra-pinyin(**LGPL-3.0**) | 可閉源商用，但必須：動態連結、保留授權聲明、允許使用者替換該函式庫。**靜態連結閉源需提供 relink 機制**。LGPL-**3.0** 另含 anti-tivoization 條款（比 2.1 嚴格） |
| 5 | **無授權檔＝保留所有權利** | `loperntu/cwn2`、`g0v/moedict-data`、`g0v/moedict-process`、`g0v/moedict-data-csld`、`ButTaiwan/bpmfvs`、npm `zh-stroke-data`、`limeime`（API 判定） | 沒有 LICENSE **不等於**可以自由使用。必須逐一取得授權或替換 |
| 6 | **學術限用資料** | 中研院平衡語料庫 ASBC、中文詞彙網路 CWN（皆**未知，需進一步確認**） | 商用須另行洽談授權 |
| 7 | **閉源線上服務** | 繁化姬 Fanhuaji | 條款限制推廣內容的移除，且要求標示；不適合內嵌。改用 OpenCC（Apache-2.0） |
| 8 | **`NOASSERTION` 需讀原文** | PIME（實為 LGPL-2.0 核心）、OpenVanilla（實為 MIT 條文）、KenLM（實為 LGPL-2.1）、fcitx5（實為 LGPL-2.1+）、limeime（實為 GPL-3.0） | GitHub API 的授權欄位**不可盡信**，本報告已逐一讀 LICENSE 原文確認 |
| 9 | **資料衍生的授權繼承** | 萌典（程式 CC0，資料仍是教育部 ND）、McBopomofo `BPMFMappings.txt`（衍生自 libtabe BSD）、libchewing-data `dict/moe/`（衍生自教育部 ND） | 授權跟著**最嚴格的來源**走 |

---

## E. 最推薦的 3 條技術路線（引擎 × 詞庫 × 平台殼）

### 🥇 路線 1：合規閉源商用（推薦給要賺錢的產品）

| 層 | 選擇 | 授權 |
|---|---|---|
| 引擎 | **libchewing（Rust 核心）** — 用其 C API 或 Swift Package | LGPL-2.1-or-later（**動態連結**即可閉源） |
| 語言模型 | **libchewing-data v4 `bigram_p80.arpa`**（可依 5.5 / 14 / 20 MB 版本裁切，準確率 94.87%–95.85%） | **CC BY 4.0** ✅ |
| 詞庫 | **CNS 11643 全字庫「字型屬性檔：注音」**（OGDL-1.0）＋ `libchewing-data` 的 `tsi.csv` / `static_words.txt`（CC BY 4.0）＋ 教育部簡編本（僅做字碼轉換，保留版本標示） | OGDL-1.0 ✅ / CC BY 4.0 ✅ / CC BY-ND ＋額外授權 ⚠️ |
| 簡繁 | **OpenCC** | Apache-2.0 ✅ |
| 平台殼 | Windows：自寫 TSF（架構參考 PIME）／macOS：**libchewing 官方 Swift Package** ＋ 自寫 IMK／Android：**AnySoftKeyboard 骨架（Apache-2.0）** ＋ JNI／Linux：**fcitx5 addon**（LGPL-2.1+） | 全部可閉源 ✅ |

> **優點**：全鏈可閉源商用，且用到目前**唯一授權明確可商用的注音專用 bigram 模型**。
> **代價**：平台殼要自己寫（4 個平台），工作量最大。唯一 LGPL 義務是動態連結 libchewing。
> **為何不用 GPL 前端**：weasel/squirrel/trime 都是 GPL-3.0，一旦連結就必須開源整個產品。

---

### 🥈 路線 2：最快做出全平台 MVP（推薦給開源專案 / 驗證階段）

| 層 | 選擇 | 授權 |
|---|---|---|
| 引擎 | **librime** ＋ **rime-bopomofo** 方案（大千式 + 臺灣正體） | BSD-3-Clause ✅ / LGPL-3.0 ⚠️ |
| 詞庫 | **rime-terra-pinyin**（`terra_pinyin.dict.yaml`，1.8 MB）＋ 透過 `zhuyin.yaml` 轉寫為注音 | LGPL-3.0 |
| 語言模型 | **rime-essay 八股文**（`essay.txt` 5.8 MB） | LGPL-3.0 |
| 平台殼 | **現成即用**：`rime/weasel`(Win) + `rime/squirrel`(macOS) + `osfans/trime`(Android) + `fcitx5-rime`(Linux) | GPL-3.0 / GPL-3.0 / GPL-3.0 / LGPL-2.1+ |

> **優點**：**1–2 週即可在四個平台上線**，注音功能（聲韻任意序、縮寫、Shift 選字、破音字）已完備；生態最成熟（8,062 ★ 的 Weasel）。
> **代價**：前端殼幾乎全是 GPL-3.0 → **只能做開源產品**。若日後要閉源，需重寫全部前端（此時退回路線 1）。
> **關鍵細節**：RIME 的注音是「拼音詞庫 + 拼寫代數轉寫」，不是原生注音詞庫——詞頻分佈會與臺灣使用者習慣有落差，需自行補詞庫。

---

### 🥉 路線 3：Apple 生態優先（MIT 全開綠燈）

| 層 | 選擇 | 授權 |
|---|---|---|
| 引擎 | **McBopomofo 的 `Source/Engine/`**（`McBopomofoLM`、`ParselessLM`、`Mandarin`） | **MIT** ✅ |
| 詞庫 | `BPMFBase.txt`（720 KB 單字）＋ `BPMFMappings.txt`（5 MB 詞，衍生自 libtabe **BSD**） | MIT ✅ / BSD ✅ |
| 語言模型 | McBopomofo 自建 LM（以 `Source/Data/Makefile` 重建）；或直接改用 libchewing v4 bigram（CC BY 4.0） | MIT ✅ / CC BY 4.0 ✅ |
| 平台殼 | macOS：**McBopomofo 本身即可直接閉源改造**（MIT）；Windows：**McBopomofoWeb（MIT）＋ PIME（LGPL-2.0）** | MIT ✅ / LGPL-2.0 ⚠️ |

> **優點**：**MIT 完全允許閉源商用、修改、再散布**；McBopomofo 是臺灣使用者口碑最好的注音 IME，資料品質高。
> **代價**：核心與 macOS 高度耦合，**沒有現成跨平台核心**；Windows/Android/Linux 需另外接（Windows 可走 McBopomofoWeb + PIME）。
> **替代方案**：若堅持「Swift 一份核心多平台」，可評估 `vChewing/vChewing-LibVanguard`（LGPL-3.0 **＋靜態連結例外**），但僅 5 ★、仍在開發中，風險較高。

---

## 附錄：本次調查未取得／需進一步確認清單

| 項目 | 狀態 |
|---|---|
| `bopomofo4js` | **查無此套件**（npm registry: Not found）；提問中的名稱可能有誤，最接近者為 `timdream/jszhuyin`（MIT）與 npm `bopomofo`（AGPL-3.0） |
| 中研院平衡語料庫 ASBC 授權原文 | 官網 https://asbc.iis.sinica.edu.tw/ 抓取時無法安全轉換 → **未知，需進一步確認** |
| 中文詞彙網路 CWN | repo 無授權檔、官網已改版 → **未知，需進一步確認** |
| 教育部《一字多音審訂表》《常用國字標準字體表》獨立授權 | 未找到獨立開放資料頁 → **未知，需進一步確認** |
| `ButTaiwan/bpmfvs` 授權 | GitHub API 未偵測到授權檔；McBopomofo 專案聲稱為 Apache-2.0 → **建議向上游確認** |
| 自然輸入法預設鍵盤排列的公開規格 | 專有軟體，無開源規格 → **未知，需進一步確認** |
| 全字庫「注音屬性檔」的實際欄位格式 | 需下載 https://data.gov.tw/dataset/5961 後檢視 |
| `libchewing-data/misc/swkb.dat`、`symbols.dat` 格式 | repo 內未文件化 → **未知，需進一步確認** |
| 舊版 libchewing 資料檔名（chewing.dat / phone.cin / phrase.occ / tree.dat）與新版對應 | 新版 master 已無這些檔名 → **對應關係未知，需進一步確認** |
| `fcitx-contrib/fcitx5-macos` 授權 | 未查證 |
