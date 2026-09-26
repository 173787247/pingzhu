# 从零打造跨平台注音（Bopomofo / Zhuyin）输入法：开源元件、资料集与授权盘点

> 调查日期：2026-09-26（Asia/Taipei）
> 调查方法：GitHub REST API（`gh api`，已登入，避免匿名速率限制）、Codeberg API、crates.io / npm registry API、各专案 `LICENSE` / `COPYING` / `README` 原文、教育部与全字库官方网页、Debian sources 套件宣告。
> 原则：**所有星数、授权、最后 push 时间皆为实查值**；无法确认者一律写「未知，需进一步确认」，不推测。

---

## 0. 速览：授权分级（决定架构的第一张表）

| 分级 | 代表元件 | 能否用于**闭源商用**产品 |
|---|---|---|
| 🟢 宽松（MIT / BSD / Apache-2.0 / MulanPSL-2.0 / CC BY 4.0 / OGDL-1.0） | librime、McBopomofo、OpenVanilla、OpenCC、wlchewing、jszhuyin、AnySoftKeyboard、全字库资料、libchewing-data v4 语言模型 | ✅ 可以（需保留著作权声明／姓名标示） |
| 🟡 弱传染（LGPL-2.1 / LGPL-3.0） | libchewing、fcitx5、fcitx5-chewing、fcitx5-rime、KenLM、rime-essay、rime-bopomofo、terra-pinyin、hime、gcin | ✅ 可以，但**必须动态连结并允许使用者替换该函式库**；静态连结闭源需提供 relink 机制 |
| 🔴 强传染（GPL-2.0 / GPL-3.0 / AGPL-3.0） | Weasel、Squirrel、Trime、ibus-rime、ibus-chewing、LimeHD、GuilelessBopomofo、libpinyin、npm `bopomofo` | ❌ 连结散布即须开源整个作品（AGPL 连网路服务也要开源） |
| ⛔ 禁改作 / 限学术 / 无授权 | 教育部四部辞典（CC BY-**ND** 3.0 TW）、中研院语料库、CWN、繁化姬、所有「无 LICENSE 档」的 repo | ❌ 依情况不可，或必须走特许路径（见 §D） |

---

## A. 注音输入引擎与词库

### A1. libchewing（新酷音）— 目前最值得押注的核心

| 项目 | 内容 |
|---|---|
| 主要位址 | **https://codeberg.org/chewing/libchewing**（2026 年已从 GitHub 迁移至 Codeberg） |
| GitHub 镜像 | https://github.com/chewing/libchewing （424 ★，描述为「Migrated to Codeberg」，最后 push 2026-04-06） |
| **授权** | **LGPL-2.1-or-later**（`COPYING` 档为 GNU LGPL v2.1 全文；`Cargo.toml` 明载 `license = "LGPL-2.1-or-later"`） |
| 语言 | **Rust**（核心已重写）＋ C API ＋ Swift Package |
| 维护状态 | 🟢 活跃。Codeberg 最后更新 **2026-09-25**；官网 https://chewing.im/ |
| 发行 | crates.io `chewing` 最新版 **0.14.0-alpha.2**（37,639 次下载，2026-09-25 更新）<br>repo 内 `Cargo.toml` 标 0.12.0-alpha.3（master 快照），MSRV Rust ≥ 1.88 |
| 建置 | CMake ≥ 3.21（`cmake --preset rust-release`）＋ Cargo；支援 MSVC / macOS / 交叉编译 |

**架构（实查 `src/` 目录）**

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

**术语对照（提问中的 chewing / phone / phrase / tree / simple / symbol）**

| 术语 | 在新版 libchewing 的对应 | 说明 |
|---|---|---|
| **chewing** | `src/conversion/chewing.rs` | 「智慧」转换引擎：以词库＋词频做长词优先／上下文选字 |
| **simple** | `src/conversion/simple.rs` | 注解原文：*"Simple engine does not perform any intelligent conversion."* 逐字直译，不做智慧选字 |
| **symbol** | `src/conversion/symbol.rs`、`editor/selection/symbol.rs` | 全形／标点／特殊符号输入 |
| **fuzzy**（额外） | `src/conversion/fuzzy.rs` | 模糊音（如 ㄓ/ㄗ）容错 |
| **phone** | `zhuyin/syllable.rs`；C API `chewing_get_phoneSeq()`、`chewing_get_phoneSeqLen()`、`chewing_phone_to_bopomofo()` | 「phone」= 注音音节的内部编码 |
| **phrase** | `editor/selection/phrase.rs`；C API `chewing_userphrase_add/remove/get/enumerate` | 词／使用者自订词 |
| **tree** | `dictionary/trie.rs`、`trie_buf.rs` | 词库以 trie（树）索引 |
| 键盘 | `editor/zhuyin_layout/*.rs` | 见 §B7 |

> ⚠️ 旧版（0.5.x 以前）常见的资料档名（`chewing.dat`、`phone.cin`、`phrase.occ`、`tree.dat`、`index_tree.dat`、`symbols.dat`、`swkb.dat`）在新版 master 已不存在——我在 repo 与 `libchewing-data` 中皆未找到这些档名，**旧档名对应关系为「未知，需进一步确认」**；新版的实际资料档见 A1-词库。

**词库与资料（`libchewing-data`）**

| 项目 | 内容 |
|---|---|
| 位址 | **https://codeberg.org/chewing/libchewing-data**（GitHub 镜像 `chewing/libchewing-data` 38 ★，已 archived） |
| **授权** | **CC BY 4.0**（repo 内有 `LICENSES/CC-BY-4.0.txt`；`dict/chewing_v4/README.md` 明载 *"This work is licensed under CC BY 4.0"*）<br>例外：`dict/moe/` 衍生自教育部辞典，授权另计（见 §B1） |
| 资料档 | `dict/chewing/word.csv`（390 KB，单字注音）、`tsi.csv`（5.2 MB，词＋优先序＋注音）、`mini.csv`、`alt.csv`、`misc/symbols.dat`、`misc/swkb.dat` |
| **v4 语言模型** | `dict/chewing_v4/bigram_p80.arpa`（**150 MB**）、`tsi_unigram.arpa`（4 MB）、`static_words.txt`（1.26 MB）、`tsi_dict.csv`（5 MB）、`tuning.dat` |

**词库格式（实查 `libchewing-data` README）**

- `word.csv`：`中文字,0,注音`，例：`呢,0,ㄋㄜ˙`
- `tsi.csv`：`詞,優先順序,注音`，例：`酷音,1000,ㄎㄨˋ ㄧㄣ`（音节间**空格**分隔；数值越大越优先，由语料统计而来，不可任意手改）
- 「破音字」需同时改 `word.csv`（新增读音）与 `tsi.csv`（新增优先序）

**v4 bigram 语言模型效能（官方 README 实测）**

| keep_frac | 模型大小 | 首选句准确率 | λ |
|---|---|---|---|
| 0.1 | 5.5 MB | 94.87% | 0.6 |
| 0.3 | 14 MB | 95.60% | 0.6 |
| 0.5 | 20 MB | 95.85% | 0.6 |
| 1.0 | 34 MB | 96.11% | 0.6 |
| unigram-only | — | 92.57% | 0 |

> 训练语料：约 16 GiB 网路中文文本、711,645 句保留集。**这是目前少见「授权明确可商用（CC BY 4.0）＋ 专为注音解码调校」的中文 bigram 模型**，是本专案最有价值的资料资产。

**语言 binding / 整合（实查 README 的 Status 段）**

- 活跃：**Windows TSF**（`chewing/windows-chewing-tsf`）、**PIME**、**ibus**（`chewing/ibus-chewing`）、**HIME**、**fcitx5**（`fcitx/fcitx5-chewing`）、**Guileless Bopomofo**（Android）、**Fcitx5 macOS**（`fcitx-contrib/fcitx5-macos`）
- 已停止：SCIM（`chewing/scim-chewing`）、独立 Windows 版 `windows-chewing`、mozc、uim、ucimf、JMCCE、xcin、IIIMF、SpaceChewing、Java Desktop System、OpenVanilla（1.0 之前）、OXIM
- 官方 binding：**C API**（`capi/include/chewing.h`，`chewing_*` 系列）、**Swift Package**（`Package.swift`，product `Chewing` → target `CChewing`，swift-tools 6.1）、**Rust crate**（`chewing` on crates.io）

**支援的键盘排列（实查 README）**：大千（预设）、许氏、IBM、精业、倚天、倚天 26 键、Dvorak、Dvorak Hsu、汉语拼音、台湾华语罗马拼音、MPS2 拼音、Colemak、Colemak-DH ANSI、Colemak-DH Ortholinear、Workman。

---

### A2. RIME（中州韵）／ librime

| 项目 | 内容 |
|---|---|
| librime | https://github.com/rime/librime — **4,628 ★**，C++，**BSD-3-Clause**，最后 push **2026-09-25**（🟢 极活跃） |
| 架构 | 模组化可扩充 C++ 引擎；`src/rime_api.cc` 提供 C API；`plugins/` 外挂机制（`rime-new-plugin.sh`）；`doc/`（含 chording 和弦输入架构文件） |
| 依赖 | Boost ≥ 1.74、leveldb、**marisa-trie**、**OpenCC ≥ 1.0.2**、yaml-cpp |
| Schema DSL | YAML（`*.schema.yaml`）：`engine`（processors / segmentors / translators / filters）、`speller.algebra`（拼写代数）、`translator.dictionary/prism`、`punctuator`、`key_binder`、`recognizer`、`__include` / `__patch` |

**注音方案（`rime/rime-bopomofo`）**

| 项目 | 内容 |
|---|---|
| Repo | https://github.com/rime/rime-bopomofo — 53 ★，**LGPL-3.0**，最后 push 2026-05-09 |
| 档案 | `bopomofo.schema.yaml`（大千式）、`bopomofo_tw.schema.yaml`（台湾正体）、`bopomofo_express.schema.yaml`、`detenele.schema.yaml`（动态能力）、`zhuyin.yaml`（拼写代数） |
| 安装 | 需 `rime-terra-pinyin`（地球拼音）；东风破：`bash rime-install bopomofo terra-pinyin` |
| 版本需求 | 方案描述明载「请配合 **librime ≥ 1.16** 使用」 |

**⚠️ 最关键的架构洞见**：RIME 的注音方案**不是**一套独立的注音词库，而是把拼音词库「转写」成注音：

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

- `keymap_bopomofo` 的核心对照（实查 `zhuyin.yaml`）：
  `bpmfdtnlgkhjqxZCSrzcsiuvaoeEAIOUMNKGR12345` → `1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347`
- **注音支援程度**：完整音节、可省略声调与韵母、声韵任意序、声母缩写、Shift+数字选字、空格键输入第一声「ˉ」、无模式设计；以 `` ` `` 前綴做筆畫反查（依賴 `stroke` 方案）
- 输出字形切换：`zh_hans`（t2s.json）／`zh_hant_hk`（t2hk.json）／`zh_hant_tw`（t2tw.json）皆走 **OpenCC**
- 语言模型：`__patch: grammar:/hant?` → 使用 **rime-essay 八股文**（`essay.txt` **5.8 MB**，LGPL-3.0）

**生态系（实查 GitHub org `rime`）**

| Repo | 星数 | 授权 | 最后 push | 用途 |
|---|---|---|---|---|
| `rime/weasel`（小狼毫） | 8,062 | **GPL-3.0** | 2026-08-18 | Windows 前端 |
| `rime/squirrel`（鼠须管） | 6,397 | **GPL-3.0** | 2026-08-13 | macOS 前端（Swift） |
| `rime/plum`（东风破） | 1,942 | LGPL-3.0 | 2026-05-08 | 方案管理器 |
| `rime/ibus-rime` | 892 | **GPL-3.0** | 2026-09-03 | Linux/IBus 前端 |
| `rime/rime-terra-pinyin` | 166 | LGPL-3.0 | 2026-09-18 | 地球拼音（注音方案的词库来源） |
| `rime/rime-essay` | 76 | LGPL-3.0 | 2026-09-23 | 共用词汇＋语言模型 |
| `rime/rime-prelude` | 77 | LGPL-3.0 | 2026-05-09 | 基础设定（symbols.yaml 28 KB 等） |
| `fcitx/fcitx5-rime` | 440 | **LGPL-2.1-or-later**（`LICENSES/`） | 2026-09-24 | fcitx5 前端 |
| `osfans/trime`（同文） | 4,667 | **GPL-3.0** | 2026-09-25 | Android 前端（Kotlin） |
| `rime/librime-predict` | 116 | BSD-3-Clause | 2024-11-18 | 下一词预测外挂 |

> 注意：**前端壳多为 GPL-3.0**（weasel / squirrel / trime / ibus-rime），核心 librime 则是宽松的 BSD-3-Clause。这个「核宽松、壳传染」的结构，是选择 RIME 路线时最关键的授权事实。

---

### A3. McBopomofo（小麦注音）与跨平台核心候选

| 专案 | 星数 | 语言 | **授权** | 最后 push | 说明 |
|---|---|---|---|---|---|
| `openvanilla/McBopomofo` | 840 | Swift＋C++ | **MIT**（`LICENSE.txt`：© 2011-2026 Mengjuei Hsieh et al.） | 2026-09-25 | macOS 小麦注音；引擎在 `Source/Engine/`（`McBopomofoLM`、`ParselessLM`、`ParselessPhraseDB`、`Mandarin`、`ByteBlockBackedDictionary`） |
| `openvanilla/McBopomofoWeb` | 27 | TypeScript | **MIT** | 2026-09-21 | 网页版核心；输出 ChromeOS、**Windows（PIME）**、MCP server、CLI；npm 名 `@openvanilla/mcbopomofoweb` 2.1.0 |
| `vChewing/vChewing-macOS`（唯音） | 620 | Swift | **MulanPSL-2.0**（应用层）；核心模组 **LGPL-3.0-or-later ＋ 静态连结例外** | 2026-09-25 | 注音＋拼音；研发管理在 Gitee |
| `vChewing/vChewing-LibVanguard` | 5 | Swift | **LGPL-3.0-or-later ＋ `CUSTOM_LGPLv3_EXCEPTION`** | 2026-09-25 | 「跨平台中文输入法引擎」，为摆脱 macOS 耦合而重写；模组 `BPMFVS`、`Homa`、`LexiconAssembly`、`Tekkon`、`BrailleSputnik`；`SwiftExtension`／`ResourceLocator` 为 MulanPSL-2.0 |
| `ButTaiwan/bpmfvs` | 300 | JavaScript | **未知，需进一步确认**（GitHub API 未侦测到授权档；但 McBopomofo `ACKNOWLEDGEMENTS.md` 称其采 **Apache-2.0**） | 2026-03-27 | 注音 IVS 字型规格；McBopomofo 的破音字标记资料衍生自此 |

**McBopomofo 资料层（`Source/Data/`）**

| 档案 | 大小 | 内容 |
|---|---|---|
| `BPMFBase.txt` | 720 KB | 单字注音对照 |
| `BPMFMappings.txt` | **5.0 MB** | 多字词（2–6 字）；README 明载 *"Originally simplified from **tsi.src of libtabe (BSD Licensed)** with modifications"* |
| `BPMFPunctuations.txt` | 56 KB | 标点 |
| `Symbols.txt` / `Macros.txt` | 38 KB / 2.5 KB | 特殊符号、文字巨集 |
| `bpmfvs-variants.txt` / `bpmfvs-pua.txt` | 425 KB / 18 KB | 破音字变体选择器（衍生自 bpmfvs） |
| `exclusion.txt`、`heterophony1~3.list`、`phrase.occ` | — | 词频排除、破音序、词频统计 |

> **跨平台核心的结论**：McBopomofo **没有**现成的跨平台核心（引擎为 macOS/ObjC++/Swift 混写）。若需要「一份核心、多平台壳」，目前只有三个现实选项：
> 1. **libchewing**（Rust 核心 ＋ C API ＋ Swift Package，LGPL-2.1+）— 覆盖面最广
> 2. **librime**（C++，BSD-3-Clause）— 授权最宽松且生态最完整
> 3. **LibVanguard**（Swift 6.4，LGPL-3.0 ＋ 静态连结例外）— 最新但仅 5 ★、尚在开发中

---

### A4. 其他传统输入法框架／前端现况

| 专案 | 星数 | 语言 | **授权** | 最后 push | 现况评语 |
|---|---|---|---|---|---|
| `EasyIME/PIME` | 1,474 | C++／Python／Node | **混合**：核心目录（`cmake`、`installer`、`libIME`、`libpipe`、`PIME`、`PIMELauncher`、`server`）**LGPL-2.0**（另有 `LGPL-2.0.txt`、`APACHE-2.0.txt`、`PSF.txt`）；内含 Tornado(Apache-2.0)、jsoncpp(MIT)、OpenCC(Apache-2.0)、libchewing(LGPL-2.1)、librime(BSD) | 2026-07-25 | 🟢 活跃。GitHub API 显示 `NOASSERTION` 是因为授权档不只一个，**已读 `LICENSE.txt` 原文确认**。是目前「用 Python / Node.js 快速做 Windows TSF 输入法」的最佳骨架，已内建新酷音、Rime、McBopomofoWeb 后端 |
| `openvanilla/openvanilla` | 540 | C++ | **MIT 条文**（`LICENSE.txt` 为 MIT 全文；但明文声明 `Libraries/` 与 `DataTables/` 内各档案另有授权）→ GitHub API 显示 `NOASSERTION` | 2026-09-24 | 🟡 macOS 老牌框架，仍维护；**DataTables 授权需逐一确认** |
| `gcin` | — | C++ | **LGPL-2.1**（依 Debian 套件 `debian/copyright`：`Files: *` → `License: LGPL-2.1`，© Edward Der-Hua Liu；`debian/*` 为 GPL-2+；`dayi3.cin` 因 DFSG 非自由被排除）→ **上游无官方 GitHub repo，建议仍向作者确认** | 上游 https://hyperrate.com/gcin-source/ | 🟡 主要在 hyperrate.com 发布；无 GitHub 组织，取用与授权追踪较困难 |
| `hime-ime/hime` | 272 | C | `README.md`：**LGPLv2.1（Qt immodules 为 GPLv2）** | **2023-12-21** | 🟠 维护趋缓（近 3 年无更新） |
| `chewing/ibus-chewing` | 77 | C | **GPL-2.0** | 2026-04-01 | 🟢 活跃 |
| `fcitx/fcitx5-chewing` | 24 | C++ | **LGPL-2.1-or-later**（`LICENSES/LGPL-2.1-or-later.txt`） | 2026-09-06 | 🟢 活跃 |
| `chewing/windows-chewing-tsf` | 19（Codeberg） | **Rust** | **GPL-3.0**（GitHub 镜像 251 ★ 标 GPL-3.0；Codeberg repo 有 `COPYING.txt`、`crates/`、`installer/`、`tip/`） | **2026-09-26**（Codeberg） | 🟢 活跃，是目前最现代的 Windows TSF 注音实作 |
| `chewing/windows-chewing`（旧） | 42 | C++ | `NOASSERTION` | 2016-02-04 | 🔴 **已 archived** |
| `chewing/scim-chewing` | 7 | C++ | GPL-2.0 | 2016-05-13 | 🔴 已停 |

---

### A5. 其他引擎：libpinyin、Rust 注音引擎、JS 实作

| 专案 | 星数 | 语言 | **授权** | 最后 push | 备注 |
|---|---|---|---|---|---|
| `libpinyin/libpinyin` | 494 | C++ | **GPL-3.0** | 2026-09-03 | 拼音（非注音）；🔴 GPL-3.0 商用需开源 |
| `tonyq-org/QBopomofo`（Q注音） | 14 | **Rust** | **LGPL-2.1** | 2026-08-03 | 「跨平台智慧注音输入法，引擎源自 libchewing」→ 与 libchewing Rust 化方向一致 |
| `hiroshiyui/GuilelessBopomofo`（朴实注音） | 133 | Kotlin | **GPL-3.0** | 2026-08-03 | Android；以 libchewing 做智慧选字 |
| `xdavidwu/wlchewing` | 15 | C | **MIT** | 2025-08-30 | Wayland 注音输入法，用 libchewing |
| `timdream/jszhuyin` | 235 | JavaScript | **MIT** | 2024-10-10 | 「JavaScript 自动选字注音输入法」；npm `jszhuyin` 1.1.2。**纯 JS 注音引擎中授权最干净者** |
| `kpu/kenlm` | 2,806 | C++ | **LGPL-2.1**（`LICENSE` 明载多数档案 LGPL-2.1-or-later；`util/getopt.*`、`murmur_hash.cc`、`string_piece.*`、`double-conversion`、`integer_to_string.*`(BSD) 另有授权） | 2025-03-30 | 语言模型推论工具，非引擎 |
| npm `bopomofo` | — | JS | **AGPL-3.0-or-later** | 4.1.0（2023-11-13） | 🔴 AGPL：连提供网路服务都要开源，**不建议纳入商业产品** |
| npm `pinyin-to-zhuyin` / `pinyin-zhuyin` | — | JS | **MIT** | 1.1.0（2026-03-17）/ 1.0.4 | 拼音↔注音转换，小工具 |
| npm `zh-stroke-data` | — | JS | **无 license 栏位** | 0.0.75 | 「常用国字标准字体笔划 XML 资料档」（g0v）→ 未知，需进一步确认 |
| `bopomofo4js` | — | — | — | — | **查无此套件**（npm registry 回传 `Not found`）→ 提问中的名称可能有误 |

---

## B. 资料层：注音 → 汉字对照与语言资料

### B1. 教育部国语辞典开放资料 ⛔ **最重要授权陷阱**

| 项目 | 内容 |
|---|---|
| 官方入口 | **教育部国语辞典公众授权网** https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html |
| 涵盖 | 《重编国语辞典修订本》https://dict.revised.moe.edu.tw/ 、《国语辞典简编本》https://dict.concised.moe.edu.tw/ 、《国语小字典》https://dict.mini.moe.edu.tw/ 、《成语典》https://dict.idioms.moe.edu.tw/ |
| **授权** | **创用 CC－姓名标示－禁止改作 3.0 台湾授权条款（CC BY-ND 3.0 TW）** |
| 商用？ | ✅ **允许**（官网原文：「本授权条款允许使用者重制、散布、传输著作（**包括商业性利用**）」） |
| 改作？ | ❌ **不得修改该著作** |
| 版本编号（实查） | 重编 2015_20260625、简编本 2014_20260626、小字典 2019_20260626、成语典 2020_20260625 |

**《国语辞典简编本》公众授权使用说明（`conciseddict_10312.pdf` 原文节录）**

> （四）**额外授权声明**：依本著作权利人中华民国教育部之声明，任何使用者皆得依照 CC BY-ND 3.0 TW 的规定，使用《国语辞典简编本》之资料与素材。使用者对于《国语辞典简编本》个别条目的词目、部首、笔画、字形、音读及释义等内容**不得为任何修改，或转为简化字**。**惟依教育部所提供对照表内容作字码改换，或不涉及更改《国语辞典简编本》个别条目所有内容之调整行为，可不被认定构成上述禁止修改条款之拘束范围。**
>
> 二、使用者承诺事项：……无论再散布与否，**都必须完整保留本使用说明**，并确认资料版本讯息。

**这正是 `libchewing-data/dict/moe/` 的合规作法**（`dict/moe/ATTRIBUTE.md` 实查）：

- 档案：`moe_dict_concised.csv`（1.4 MB）、`moe_dict_concised_importer.rb`、`sources/dict_concised_2014_20251229.zip`、`sources/conciseddict_10312.pdf`
- 声明原文：「本专案因实务需要，对于本资料之原始资料加以变更『轻声标注位置』、『ㄦ化音前缀空白』、『部份注音组合间补足空白分隔』，其更动符合〈公众授权使用说明〉当中『**额外授权声明**』之规定。」

> ✅ **可安全沿用的路径**：以教育部的对照表做**字码／格式转换**（Big5↔Unicode、空白与轻声标记正规化），并完整保留使用说明与版本标示。
> ❌ **不可**：改写释义、增删音读、转成简化字、把辞典内容当成自家词库重新排序后宣称自行编辑。

---

### B2. 萌典（g0v / moedict）

| 专案 | 星数 | **授权** | 最后 push | 说明 |
|---|---|---|---|---|
| `g0v/moedict-webkit` | — | **程式码 CC0 1.0**（README 原文：「除前述资料档之外，本目录下的所有其他档案，由作者唐凤在法律许可的范围内，抛弃该著作依著作权法所享有之权利……贡献至公众领域」） | `master` 分支**已封存**（2013 dump），新前端在 `main` | ⚠️ **但字典资料档仍承袭教育部授权（CC BY-ND 3.0 TW）** |
| `g0v/moedict-data` | 171 | **无授权档**（资料档＝教育部） | 2026-07-11 | 「教育部重编国语辞典 资料档」 |
| `g0v/moedict-process` | 37 | **无授权档** | 2026-08-11 | 资料处理工具链（TypeScript），产出 pack |
| `g0v/moedict-data-csld` | 130 | **无授权档** | 2023-11-08 | 中华大辞典 |

**萌典 API（含注音栏位，适合做「注音↔汉字」对照抽取）**

- `https://www.moedict.tw/uni/{字}` → JSON 含 `bopomofo`、`bopomofo2`、`pinyin`、`heteronyms`
- `https://www.moedict.tw/a/{字}.json` → 已断词（`` ` `` 标记词界）
- 其他端点：`/raw/`、`/pua/`、`/t/`（闽南语）、`/h/`（客语）、`/c/`（两岸词典）
- 教育部国语辞典授权页：https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/

> ⚠️ **结论**：萌典的「程式」是 CC0，非常好用；萌典的「资料」不是 CC0——**授权跟著教育部走**。

---

### B3. CNS 11643 全字库 ✅ **最有价值的合规注音资料源**

| 项目 | 内容 |
|---|---|
| 官方 | https://www.cns11643.gov.tw/ （主管机关：数位发展部） |
| 授权页 | https://www.cns11643.gov.tw/pageView.jsp?ID=59 |
| **授权** | **1. 政府资料开放授权条款-第1版（OGDL-Taiwan-1.0）**：无偿、非专属、不限时间地域，可**重制、编辑、公开传输或为其他利用方式，开发各种产品或服务（加值产品）**；范围**不含商标权及专利权**，须标示来源出处（数位发展部，CNS11643 中文标准交换码全字库网站）<br>**2. 字型档为 OFL-1.1**（可免费使用、研究、复制、合并、嵌入、修改、散布与贩售） |
| **关键资料** | 授权下载项目明列「**字型属性档：注音**、仓颉、笔画、部首、拼音、部件、笔顺」＋「中文码对照表（CNS↔Big5／Unicode 5.2／电信码／地政自造字／财税内码／税务码／工商自造字）」 |
| 下载 | https://data.gov.tw/dataset/5961 （政府资料开放平台）<br>档案清单：https://www.cns11643.gov.tw/opendata/OpenDataFilesList.csv |
| 注音查询介面 | https://www.cns11643.gov.tw/search.jsp?ID=3 |

> ✅ **这是全清单中「涵盖全字集＋注音属性＋可商用＋可改作＋可闭源」的少数资料源**。搭配 libchewing-data v4 的 CC BY 4.0 语言模型，即可完全绕开教育部辞典的 ND 限制。

---

### B4. 注音标注资料集与语言资料

| 资料集 | **授权** | 商用 | 连结／备注 |
|---|---|---|---|
| **中文词汇网路 CWN** | **未知，需进一步确认**（`loperntu/cwn2` 22 ★、**无授权档**、最后 push 2016-08-15；`lopentu/CwnWeb` 6 ★、无授权档） | ❌ 未授权即不可 | https://github.com/loperntu/cwn2 ；原官网 `lope.linguistics.ntu.edu.tw/cwn2/` 已 404，LOPE 实验室已改版（https://lope.linguistics.ntu.edu.tw/） |
| **中研院平衡语料库 ASBC** | **未知，需进一步确认**（官网 https://asbc.iis.sinica.edu.tw/ ；中研院语料库历来采学术用途授权，商用须另洽） | ⚠️ 需洽谈 | 抓取时回传无法安全转换的内容，未能取得授权原文 |
| **教育部《常用国字标准字体表》** | **未知，需进一步确认**（教育部标准字体相关著作通常比照教育部其他语文成果；`zh-stroke-data` npm 套件也无 license 栏位） | ⚠️ | 建议改用全字库字形（OFL-1.1）＋全字库属性档（OGDL-1.0） |
| **教育部《国语一字多音审订表》** | **未知，需进一步确认**（未找到独立开放资料页；官方仅在辞典介绍中说明「本辞典所收的字音，参照教育部公布之国语一字多音审订表」） | ⚠️ | 实务替代：`libchewing-data/dict/chewing_v4/rare_dict.csv`（23 KB 罕用读音）＋ 教育部简编本（CC BY-ND ＋额外授权） |
| **Unicode Bopomofo** | Unicode 资料档采 **Unicode License**（宽松、可商用）→ 条款细节建议于使用前确认 UCD 现行版本 | ✅ | 注音符号 **U+3105–U+312F**；声调符号 U+02C9 ˉ / U+02CA ˊ / U+02C7 ˇ / U+02CB ˋ / U+02D9 ˙；**Bopomofo Extended U+31A0–U+31BF**（方音符号）；ISO 15924 = `Bopo` (285) |
| **libtabe `tsi.src`** | 依 McBopomofo `Source/Data/README.md`：**BSD Licensed** | ✅ | McBopomofo 的 `BPMFMappings.txt` 由此简化修改而来；是少见「授权干净的大型中文词库」来源 |

---

### B5. 简繁转换

| 专案 | 星数 | **授权** | 最后 push | 商用可行性 |
|---|---|---|---|---|
| **OpenCC**（`BYVoid/OpenCC`） | **10,011** | **Apache-2.0** | 2026-09-25 | ✅ **可闭源商用**。RIME 的 `t2s.json` / `t2tw.json` / `t2hk.json` 即用它；librime 硬依赖 `libopencc ≥ 1.0.2`；PIME 亦内嵌 |
| **繁化姬 Fanhuaji**（https://zhconvert.org/） | — | **专有（闭源线上服务）**；服务条款：https://docs.zhconvert.org/license/ | — | ❌ **不建议内嵌**。条款要求：(1) 免费使用时不得移除推广内容（会插入字幕注解）；(2) 程式使用其 API 必须标示并附上 https://zhconvert.org ；另有独立「商业使用」页面 |

> ✅ 简繁／台湾化一律走 **OpenCC**（Apache-2.0），不要用繁化姬。

---

### B6. 可用于智慧选字的语言模型

| 元件／资料 | **授权** | 商用 | 大小 | 备注 |
|---|---|---|---|---|
| **KenLM**（`kpu/kenlm`，2,806 ★） | **LGPL-2.1**（多数档案 LGPL-2.1-or-later；`util/getopt.*`、`util/murmur_hash.cc`、`util/string_piece.*`、`util/double-conversion`、`util/integer_to_string.*`(BSD) 另有授权） | ✅（动态连结＋可替换） | — | 只是**推论工具**，不含模型资料 |
| **libchewing-data v4 bigram** | **CC BY 4.0** | ✅ **可商用、可改作**（需姓名标示） | `bigram_p80.arpa` **150 MB**；`tsi_unigram.arpa` 4 MB；`static_words.txt` 1.26 MB；`tsi_dict.csv` 5 MB | ⭐ **首选**。专为注音解码训练，首选句准确率 92.57%（unigram）→ 96.11%（完整 bigram） |
| **rime-essay 八股文**（`essay.txt`） | **LGPL-3.0** | ⚠️ 可商用，但 LGPL-3.0 义务较重（含 anti-tivoization） | 5.8 MB | 词汇＋语言模型；RIME 注音方案预设载入 |
| **rime-terra-pinyin**（`terra_pinyin.dict.yaml`） | **LGPL-3.0** | ⚠️ 同上 | 1.8 MB | 注音方案的词库本体 |
| **McBopomofo 语言模型** | **MIT**（`McBopomofoLM` / `ParselessLM` 为 MIT 专案的一部分） | ✅ | 由 `BPMFBase.txt`＋`BPMFMappings.txt`（libtabe BSD 衍生）建构 | 需自行以 `Source/Data/Makefile` 重建 |
| 其他可商用小型中文 LM | — | — | — | 本次调查**未找到**除上述之外「授权明确允许商用」的现成中文 n-gram 资料；若需更大模型，建议**自行以授权干净的语料训练**（语料授权才是真正的瓶颈） |

---

### B7. 注音键盘排列的权威定义

| 排列 | 权威开源定义（可作为 single source of truth） | 授权 |
|---|---|---|
| **标准（大千）式** | `libchewing` → `src/editor/zhuyin_layout/standard.rs`；RIME → `bopomofo.schema.yaml` 的 `keymap_bopomofo` | LGPL-2.1+ / LGPL-3.0 |
| **大千 26 键** | `libchewing` → `src/editor/zhuyin_layout/dc26.rs` | LGPL-2.1+ |
| **倚天式 / 倚天 26 键** | `libchewing` → `src/editor/zhuyin_layout/et.rs`、`et26.rs` | LGPL-2.1+ |
| **IBM 式** | `libchewing` → `src/editor/zhuyin_layout/ibm.rs` | LGPL-2.1+ |
| **许氏键盘** | `libchewing` → `src/editor/zhuyin_layout/hsu.rs` | LGPL-2.1+ |
| **精业式** | `libchewing` → `src/editor/zhuyin_layout/ginyieh.rs` | LGPL-2.1+ |
| **拼音类**（汉语拼音、MPS2、国语罗马字变体） | `libchewing` → `src/editor/zhuyin_layout/pinyin.rs`（含 `PinyinVariant`） | LGPL-2.1+ |
| **动态能力（detenele）** | RIME → `rime-bopomofo/detenele.schema.yaml`（README 以 keyboard-layout-editor 连结定义） | LGPL-3.0 |
| **自然输入法预设排列** | ❌ **无开源规格**（自然输入法为网际智慧公司专有软体）。排列本身属「事实性按键对应」，通常不受著作权保护，但**无权威公开来源** → **未知，需进一步确认** | 专有 |

> **建议**：直接以 `libchewing/src/editor/zhuyin_layout/` 为唯一真实来源（它同时覆盖 5 种以上排列，且是**可执行、可测试的程式码**，而非文件描述）。RIME 的 `bopomofo.schema.yaml` 可作为大千式的第二来源交叉验证。
> 注意：`libchewing-data/misc/swkb.dat`（154 bytes）与 `symbols.dat`（5 KB）也是键盘／符号资料，但**档案格式未在 repo 中文件化** → 格式「未知，需进一步确认」。

---

## C. 各平台 IME 框架的开源范例 repo

### C1. Windows TSF（Text Services Framework）

| Repo | 星数 | 语言 | **授权** | 维护状态 | 范例价值 |
|---|---|---|---|---|---|
| `EasyIME/PIME` | 1,474 | C++／Python／Node | **LGPL-2.0**（核心目录）＋内含多个第三方授权 | 🟢 2026-07-25 | ⭐ **首选骨架**。`libIME`（TSF 的简单封装）＋`PIMETextService`（后端骨干）＋`PIMELauncher`。可用 Python 或 Node.js 写 IME 逻辑，内建新酷音／Rime／McBopomofoWeb 范例 |
| `chewing/windows-chewing-tsf` | 19（Codeberg） | **Rust** | **GPL-3.0** | 🟢 2026-09-26 | ⭐ 最现代的 TSF 注音实作；`crates/`＋`installer/`＋`tip/`。🔴 GPL 传染 |
| `rime/weasel`（小狼毫） | 8,062 | C++ | **GPL-3.0** | 🟢 2026-08-18 | 完整 Windows 前端；🔴 GPL 传染 |
| `microsoft/Windows-classic-samples` | 5,683 | C++ | **MIT**（`LICENSE` 已确认） | 2026-09-03 | ✅ 官方 TSF 范例（含文字服务 sample），可自由抄进闭源产品 |
| `Chocobo1/windows-chewing-tsf-build` | 114 | Batchfile | 无授权档 | 2024-06-01 | 非官方编译脚本 |

### C2. macOS InputMethodKit

| Repo | 星数 | 语言 | **授权** | 维护状态 | 范例价值 |
|---|---|---|---|---|---|
| `openvanilla/McBopomofo` | 840 | Swift＋C++ | **MIT** | 🟢 2026-09-25 | ⭐ **闭源商用首选**。完整的 IMK 输入法（含候选窗 `Packages/CandidateUI`、`InputSourceHelper`、`NotifierUI`、`OpenCCBridge`） |
| `rime/squirrel`（鼠须管） | 6,397 | Swift | **GPL-3.0** | 🟢 2026-08-13 | 最成熟的 IMK 前端；🔴 GPL |
| `openvanilla/openvanilla` | 540 | C++ | **MIT 条文**（`DataTables/` 另行授权） | 🟢 2026-09-24 | 老牌框架，模组化载入器设计值得参考 |
| `vChewing/vChewing-macOS` | 620 | Swift | 应用层 **MulanPSL-2.0**；核心 **LGPL-3.0 ＋ 静态连结例外** | 🟢 2026-09-25 | 功能最丰富的第三方注音 macOS IME |

### C3. Android InputMethodService

| Repo | 星数 | 语言 | **授权** | 维护状态 | 范例价值 |
|---|---|---|---|---|---|
| `osfans/trime`（同文） | 4,667 | Kotlin | **GPL-3.0** | 🟢 2026-09-25 | Rime 的 Android 前端，最完整；🔴 GPL |
| `AnySoftKeyboard/AnySoftKeyboard` | 3,383 | Java | **Apache-2.0** | 🟢 2026-09-24 | ✅ **闭源可用的 Android IME 骨架**（多语键盘、无网路） |
| `lime-ime/limeime`（LIME HD） | 138 | Java | **GPL-3.0**（`LICENSE.md`：「LIME IME 采用 GNU General Public License version 3 授权」；GitHub API 显示 NOASSERTION） | 🟢 2026-09-20 | 台湾老牌注音／仓颉输入法；🔴 GPL |
| `hiroshiyui/GuilelessBopomofo` | 133 | Kotlin | **GPL-3.0** | 🟢 2026-08-03 | 以 libchewing 做智慧选字的注音专用键盘；🔴 GPL |

### C4. Linux：fcitx5 / ibus

| Repo | 星数 | **授权** | 维护状态 | 备注 |
|---|---|---|---|---|
| `fcitx/fcitx5` | 2,573 | **LGPL-2.1-or-later**（`LICENSES/`＋`REUSE.toml`；GitHub API 显示 `null` 是因改用 REUSE 规范） | 🟢 2026-09-25 | 跨平台框架（含 Windows 路径、Wayland `input-method-v2`） |
| `fcitx/fcitx5-chewing` | 24 | **LGPL-2.1-or-later** | 🟢 2026-09-06 | 注音 addon |
| `fcitx/fcitx5-rime` | 440 | **LGPL-2.1-or-later** | 🟢 2026-09-24 | Rime addon |
| `chewing/ibus-chewing` | 77 | **GPL-2.0** | 🟢 2026-04-01 | 🔴 |
| `ibus/ibus` | 998 | **LGPL-2.1** | 🟢 2026-09-22 | 框架本体 |
| `rime/ibus-rime` | 892 | **GPL-3.0** | 🟢 2026-09-03 | 🔴 |
| `xdavidwu/wlchewing` | 15 | **MIT** | 🟡 2025-08-30 | ✅ Wayland 原生注音 IME，授权最干净 |
| `fcitx-contrib/fcitx5-macos` | — | 未查证 | — | libchewing README 列为活跃整合；macOS 上的 fcitx5 |

### C5. 是否有「一份核心、多平台」的框架？

| 选项 | 结论 |
|---|---|
| **librime** | ✅ 核心 BSD-3-Clause，官方前端覆盖 Windows / macOS / Linux / Android。**但官方前端全为 GPL-3.0**，闭源产品必须自写前端 |
| **libchewing** | ✅ Rust 核心 ＋ C API ＋ **Swift Package**，官方列出的活跃整合覆盖 Windows TSF / macOS（fcitx5-macos）/ Linux（ibus、fcitx5、HIME）/ Android（GuilelessBopomofo）/ Wayland（wlchewing）。**核心 LGPL-2.1+，前端可自写并闭源** |
| **fcitx5** | 🟡 设计上跨 X11/Wayland/Windows，但历史上以 Linux 为主；macOS 版由 `fcitx-contrib` 维护 |
| **LibVanguard** | 🟡 明确目标是跨平台中文引擎（Swift 6.4，可在 Linux/Windows 建置），但 5 ★、开发中 |
| **Web/JS 核心**（McBopomofoWeb、jszhuyin） | 🟡 MIT，可嵌入 Electron/Tauri 或浏览器扩充，但无法取得原生 IME 的系统整合（TSF/IMK 仍需原生壳） |

**各平台「最小可行外壳」建议**

| 平台 | 抄哪里 | 授权注意 |
|---|---|---|
| Windows | 抄 **PIME 的 `libIME` 架构概念**（或直接用 PIME，LGPL-2.0），或参考 **windows-chewing-tsf** 的 Rust TSF 作法 | 直接用 PIME：LGPL-2.0 → 动态连结即可闭源；抄 windows-chewing-tsf：**GPL-3.0 会传染，只能「读」不能「抄」** |
| macOS | 用 **libchewing 的 Swift Package**（`Chewing` product）接 IMK；UI 参考 McBopomofo 的 `CandidateUI`（MIT） | McBopomofo 为 MIT，可自由改；Squirrel 为 GPL-3.0，仅供参考 |
| Android | 以 **AnySoftKeyboard（Apache-2.0）** 为骨架，接 libchewing（透过 JNI/UniFFI） | Trime / LimeHD / GuilelessBopomofo 皆 GPL-3.0，不可抄进闭源 |
| Linux | 写 **fcitx5 addon**（LGPL-2.1+）或 ibus engine | fcitx5 addon 为 LGPL-2.1+，可闭源；ibus-chewing(GPL-2.0) / ibus-rime(GPL-3.0) 不可抄 |

---

## D. ⚠️ 授权陷阱总表（依风险排序）

| # | 陷阱 | 具体元件 | 后果／解法 |
|---|---|---|---|
| 1 | **CC BY-ND 禁改作** | 教育部《重编国语辞典修订本》《国语辞典简编本》《国语小字典》《成语典》 | 商用可、**改作不可**。唯一合规路径：只做字码／格式转换（依「额外授权声明」），完整保留使用说明与版本标示，**不得转简化字**。想要自由改造 → 改用**全字库注音属性档（OGDL-1.0）** |
| 2 | **GPL-3.0 传染** | weasel、squirrel、trime、ibus-rime、LimeHD、GuilelessBopomofo、libpinyin、windows-chewing-tsf、npm `bopomofo`(AGPL) | 连结散布即须以 GPL-3.0 开源整个作品。**不得用于闭源产品** |
| 3 | **AGPL-3.0** | npm `bopomofo` | 连「以网路提供服务」都要释出原始码 |
| 4 | **LGPL 的动态连结义务** | libchewing(LGPL-2.1+)、fcitx5 系列(LGPL-2.1+)、KenLM(LGPL-2.1)、rime-essay/rime-bopomofo/terra-pinyin(**LGPL-3.0**) | 可闭源商用，但必须：动态连结、保留授权声明、允许使用者替换该函式库。**静态连结闭源需提供 relink 机制**。LGPL-**3.0** 另含 anti-tivoization 条款（比 2.1 严格） |
| 5 | **无授权档＝保留所有权利** | `loperntu/cwn2`、`g0v/moedict-data`、`g0v/moedict-process`、`g0v/moedict-data-csld`、`ButTaiwan/bpmfvs`、npm `zh-stroke-data`、`limeime`（API 判定） | 没有 LICENSE **不等于**可以自由使用。必须逐一取得授权或替换 |
| 6 | **学术限用资料** | 中研院平衡语料库 ASBC、中文词汇网路 CWN（皆**未知，需进一步确认**） | 商用须另行洽谈授权 |
| 7 | **闭源线上服务** | 繁化姬 Fanhuaji | 条款限制推广内容的移除，且要求标示；不适合内嵌。改用 OpenCC（Apache-2.0） |
| 8 | **`NOASSERTION` 需读原文** | PIME（实为 LGPL-2.0 核心）、OpenVanilla（实为 MIT 条文）、KenLM（实为 LGPL-2.1）、fcitx5（实为 LGPL-2.1+）、limeime（实为 GPL-3.0） | GitHub API 的授权栏位**不可尽信**，本报告已逐一读 LICENSE 原文确认 |
| 9 | **资料衍生的授权继承** | 萌典（程式 CC0，资料仍是教育部 ND）、McBopomofo `BPMFMappings.txt`（衍生自 libtabe BSD）、libchewing-data `dict/moe/`（衍生自教育部 ND） | 授权跟著**最严格的来源**走 |

---

## E. 最推荐的 3 条技术路线（引擎 × 词库 × 平台壳）

### 🥇 路线 1：合规闭源商用（推荐给要赚钱的产品）

| 层 | 选择 | 授权 |
|---|---|---|
| 引擎 | **libchewing（Rust 核心）** — 用其 C API 或 Swift Package | LGPL-2.1-or-later（**动态连结**即可闭源） |
| 语言模型 | **libchewing-data v4 `bigram_p80.arpa`**（可依 5.5 / 14 / 20 MB 版本裁切，准确率 94.87%–95.85%） | **CC BY 4.0** ✅ |
| 词库 | **CNS 11643 全字库「字型属性档：注音」**（OGDL-1.0）＋ `libchewing-data` 的 `tsi.csv` / `static_words.txt`（CC BY 4.0）＋ 教育部简编本（仅做字码转换，保留版本标示） | OGDL-1.0 ✅ / CC BY 4.0 ✅ / CC BY-ND ＋额外授权 ⚠️ |
| 简繁 | **OpenCC** | Apache-2.0 ✅ |
| 平台壳 | Windows：自写 TSF（架构参考 PIME）／macOS：**libchewing 官方 Swift Package** ＋ 自写 IMK／Android：**AnySoftKeyboard 骨架（Apache-2.0）** ＋ JNI／Linux：**fcitx5 addon**（LGPL-2.1+） | 全部可闭源 ✅ |

> **优点**：全链可闭源商用，且用到目前**唯一授权明确可商用的注音专用 bigram 模型**。
> **代价**：平台壳要自己写（4 个平台），工作量最大。唯一 LGPL 义务是动态连结 libchewing。
> **为何不用 GPL 前端**：weasel/squirrel/trime 都是 GPL-3.0，一旦连结就必须开源整个产品。

---

### 🥈 路线 2：最快做出全平台 MVP（推荐给开源专案 / 验证阶段）

| 层 | 选择 | 授权 |
|---|---|---|
| 引擎 | **librime** ＋ **rime-bopomofo** 方案（大千式 + 台湾正体） | BSD-3-Clause ✅ / LGPL-3.0 ⚠️ |
| 词库 | **rime-terra-pinyin**（`terra_pinyin.dict.yaml`，1.8 MB）＋ 透过 `zhuyin.yaml` 转写为注音 | LGPL-3.0 |
| 语言模型 | **rime-essay 八股文**（`essay.txt` 5.8 MB） | LGPL-3.0 |
| 平台壳 | **现成即用**：`rime/weasel`(Win) + `rime/squirrel`(macOS) + `osfans/trime`(Android) + `fcitx5-rime`(Linux) | GPL-3.0 / GPL-3.0 / GPL-3.0 / LGPL-2.1+ |

> **优点**：**1–2 周即可在四个平台上线**，注音功能（声韵任意序、缩写、Shift 选字、破音字）已完备；生态最成熟（8,062 ★ 的 Weasel）。
> **代价**：前端壳几乎全是 GPL-3.0 → **只能做开源产品**。若日后要闭源，需重写全部前端（此时退回路线 1）。
> **关键细节**：RIME 的注音是「拼音词库 + 拼写代数转写」，不是原生注音词库——词频分布会与台湾使用者习惯有落差，需自行补词库。

---

### 🥉 路线 3：Apple 生态优先（MIT 全开绿灯）

| 层 | 选择 | 授权 |
|---|---|---|
| 引擎 | **McBopomofo 的 `Source/Engine/`**（`McBopomofoLM`、`ParselessLM`、`Mandarin`） | **MIT** ✅ |
| 词库 | `BPMFBase.txt`（720 KB 单字）＋ `BPMFMappings.txt`（5 MB 词，衍生自 libtabe **BSD**） | MIT ✅ / BSD ✅ |
| 语言模型 | McBopomofo 自建 LM（以 `Source/Data/Makefile` 重建）；或直接改用 libchewing v4 bigram（CC BY 4.0） | MIT ✅ / CC BY 4.0 ✅ |
| 平台壳 | macOS：**McBopomofo 本身即可直接闭源改造**（MIT）；Windows：**McBopomofoWeb（MIT）＋ PIME（LGPL-2.0）** | MIT ✅ / LGPL-2.0 ⚠️ |

> **优点**：**MIT 完全允许闭源商用、修改、再散布**；McBopomofo 是台湾使用者口碑最好的注音 IME，资料品质高。
> **代价**：核心与 macOS 高度耦合，**没有现成跨平台核心**；Windows/Android/Linux 需另外接（Windows 可走 McBopomofoWeb + PIME）。
> **替代方案**：若坚持「Swift 一份核心多平台」，可评估 `vChewing/vChewing-LibVanguard`（LGPL-3.0 **＋静态连结例外**），但仅 5 ★、仍在开发中，风险较高。

---

## 附录：本次调查未取得／需进一步确认清单

| 项目 | 状态 |
|---|---|
| `bopomofo4js` | **查无此套件**（npm registry: Not found）；提问中的名称可能有误，最接近者为 `timdream/jszhuyin`（MIT）与 npm `bopomofo`（AGPL-3.0） |
| 中研院平衡语料库 ASBC 授权原文 | 官网 https://asbc.iis.sinica.edu.tw/ 抓取时无法安全转换 → **未知，需进一步确认** |
| 中文词汇网路 CWN | repo 无授权档、官网已改版 → **未知，需进一步确认** |
| 教育部《一字多音审订表》《常用国字标准字体表》独立授权 | 未找到独立开放资料页 → **未知，需进一步确认** |
| `ButTaiwan/bpmfvs` 授权 | GitHub API 未侦测到授权档；McBopomofo 专案声称为 Apache-2.0 → **建议向上游确认** |
| 自然输入法预设键盘排列的公开规格 | 专有软体，无开源规格 → **未知，需进一步确认** |
| 全字库「注音属性档」的实际栏位格式 | 需下载 https://data.gov.tw/dataset/5961 后检视 |
| `libchewing-data/misc/swkb.dat`、`symbols.dat` 格式 | repo 内未文件化 → **未知，需进一步确认** |
| 旧版 libchewing 资料档名（chewing.dat / phone.cin / phrase.occ / tree.dat）与新版对应 | 新版 master 已无这些档名 → **对应关系未知，需进一步确认** |
| `fcitx-contrib/fcitx5-macos` 授权 | 未查证 |
