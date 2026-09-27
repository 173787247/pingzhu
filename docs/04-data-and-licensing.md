# 04 · 资料来源与授权合规

> 输入法专案最容易死的地方不是演算法，是授权。这份文件把每一个可用零件、每一份资料的
> 授权状态列清楚，并标明哪些是**本仓库实测查证**、哪些是**待复核**。

> 📌 **先读这一句**：本文分析的是「**用什么最省事**」，不是「**没有它能不能做**」。
> 注音所需的四张表（读音、词库、词频、简繁）**全部可以自建**，
> 来源包括 Unicode Unihan（Unicode License）与自建语料管线。
> 详见 [08-self-built-data.md](08-self-built-data.md)——**读完那篇再读这篇，结论会完全不同。**

## 本专案目前实际使用的来源

| 来源 | 用途 | 授权 | 查证方式 |
|---|---|---|---|
| [openvanilla/McBopomofo](https://github.com/openvanilla/McBopomofo) `Source/Data/` | 词库、单字表、破音字优先序、符号表 | **MIT**（Copyright © 2022 and onwards The McBopomofo Authors） | 本仓库以 GitHub API 读取 `license.spdx_id` = `MIT`；资料目录 README 自述 |
| [openvanilla/McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) `src/McBopomofo/WebData.ts` | 编译后语言模型（13.4 万条，含对数机率） | **MIT** | 同上 |
| McBopomofo 的 `BPMFMappings.txt` 上游 | 片语清单 | 衍生自 **libtabe `tsi.src`（BSD）** | McBopomofo `Source/Data/README.md` 自述 |
| McBopomofo `src/Mandarin/BopomofoKeyboardLayout.ts` | 大千式／IBM／倚天键位表 | **MIT** | 本仓库逐行核对键位，并以 `su3cl3 → 你好`、`ji394su3 → 我愛你` 验证 |

**结论**：目前使用的每一个位元都可追溯、皆为宽松授权、皆允许商用与闭源连结。
逐项声明见仓库根目录 [NOTICE](../NOTICE)。

## 生态全景：可用的引擎

| 专案 | 语言 | 授权 | 状态 | 评估 |
|---|---|---|---|---|
| [chewing/libchewing](https://codeberg.org/chewing/libchewing)（新酷音） | **Rust** | **LGPL-2.1-or-later** | 活跃（2026-09-25），已从 GitHub 迁至 Codeberg | 核心重写为 Rust，附 C API、官方 Swift Package；crates.io `chewing` 0.14.0-alpha.2 |
| [rime/librime](https://github.com/rime/librime)（中州韵） | C++ | **BSD-3-Clause** | 活跃，4,628★ | 引擎宽松，但官方前端全是 GPL-3.0 |
| [openvanilla/McBopomofo](https://github.com/openvanilla/McBopomofo)（小麦注音） | Swift | **MIT** | 极活跃，840★ | 引擎与资料全 MIT，但**与 macOS 深度耦合，无可携核心** |
| [openvanilla/McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) | TypeScript | **MIT** | 活跃 | 网页技术实作，可跑 ChromeOS／Windows（透过 PIME） |
| [timdream/jszhuyin](https://github.com/timdream/jszhuyin) | JavaScript | **MIT** | 235★ | 纯 JS 自动选字注音输入法，可作为演算法对照 |
| [hiroshiyui/GuilelessBopomofo](https://github.com/hiroshiyui/GuilelessBopomofo)（朴实注音键盘） | Kotlin | **GPL-3.0** | 133★ | Android 注音键盘，以 libchewing 为引擎 |
| [EasyIME/PIME](https://github.com/EasyIME/PIME) | C++ | **NOASSERTION**（授权档非标准条文） | 1,474★ | Windows 输入法框架，需人工审阅条文 |

### 各平台外壳的授权地雷

| 平台 | 专案 | 授权 | 风险 |
|---|---|---|---|
| Windows | [rime/weasel](https://github.com/rime/weasel) 小狼毫 | **GPL-3.0** | 传染，不可用于宽松授权产品 |
| Windows | PIME | NOASSERTION | 需人工审阅 |
| Windows | Microsoft `Windows-classic-samples`（含官方 TSF 范例） | **MIT** | ✅ 正当的 TSF 参考来源 |
| macOS | [rime/squirrel](https://github.com/rime/squirrel) 鼠须管 | **GPL-3.0** | 传染 |
| macOS | McBopomofo / OpenVanilla | **MIT** | ✅ 可参考 |
| Android | [osfans/trime](https://github.com/osfans/trime) 同文 | **GPL-3.0** | 传染 |
| Android | [AnySoftKeyboard](https://github.com/AnySoftKeyboard/AnySoftKeyboard) | **Apache-2.0** | ✅ 可作骨架参考 |
| Linux | fcitx5 / fcitx5-chewing | **LGPL-2.1-or-later** | 动态连结可接受 |
| Linux | [fcitx/fcitx5-chewing](https://github.com/fcitx/fcitx5-chewing) | 无授权档（API 回报 `NONE`） | ⚠️ 无授权档＝保留所有权利 |

**本专案的对策**：五个平台的外壳全部自己写（Windows TSF 以 Microsoft MIT 范例为参考，
macOS IMK 以 MIT 的 McBopomofo 为参考，Android 以 Apache-2.0 的 AnySoftKeyboard 为骨架参考），
**不引入任何 GPL-3.0 外壳**。

## 生态全景：可用的资料

| 资料 | 授权 | 可否商用 | 可否改作 | 备注 |
|---|---|---|---|---|
| [libchewing-data](https://codeberg.org/chewing/libchewing-data) | **CC BY 4.0** | ✅ | ✅ | 本仓库实测：`LICENSES/CC-BY-4.0.txt`；v4 新增注音专用 bigram |
| 教育部《重编国语辞典修订本》等四部辞典 | **CC BY-ND 3.0 TW** | ✅ | ❌ **禁改作** | 《简编本》另有「额外授权声明」允许字码改换 |
| [CNS 11643 全字库](https://www.cns11643.gov.tw/) | **政府资料开放授权条款第 1 版（OGDL-1.0）** | ✅ | ✅ | 授权清单明列「字型属性档：注音」，可涵盖全字集 |
| [OpenCC](https://github.com/BYVoid/OpenCC) 简繁转换 | **Apache-2.0** | ✅ | ✅ | 简繁转换的唯一选择 |
| CWN 中文词汇网路 | **无授权档** | ❌ | ❌ | 无授权＝保留所有权利 |
| g0v/moedict-data | **无授权档** | ❌ | ❌ | 同上 |
| bpmfvs（注音 IVS 字型规格） | **无授权档** | ❌ | ❌ | 同上 |
| 繁化姬 | 闭源服务，条款限制 | — | — | 不使用 |

### 教育部辞典「禁改作」的实际边界

CC BY-ND 的「ND」听起来像死刑，但范围比字面上窄。g0v 的 `moedict-data` README 引述
教育部的解释：**改作限制的标的是「文字资料本身」，不限制格式转换及后续应用**。

libchewing 的 `dict/moe/` 就是走这条路（附完整的 ATTRIBUTE 声明）。实务上的界线：

| 可以做 | 不可以做 |
|---|---|
| 改变编码／格式（XML → TSV） | 修改个别条目的释义文字 |
| 抽取栏位、重新编排 | 把正体字条目转成简化字 |
| 与其他资料合并运算 | 删改或衍生释义内容 |
| 用于输入法候选（只取「词」与「读音」） | — |

**本专案目前的策略是不使用教育部辞典**：McBopomofo 的词库已足够，
且它的授权链（MIT ← BSD）比 CC BY-ND 更干净。若未来需要更完整的词条覆盖，
再依法务确认的范围接入。

### 一个法律效力不明的坑

**LGPL 套用在纯资料档上的效力并不明确。** RIME 的 `essay.txt`（词频资料）
被标为 LGPL-3.0，但 LGPL 是为**函式库程式码**设计的授权，套用在纯文字资料上
「衍生作品」如何认定没有定论。

**本专案的对策**：避开它。同样的注音词频资料，McBopomofo 的
`BPMFMappings.txt` + `phrase.occ` 是 **MIT**，libchewing-data 是 **CC BY 4.0**，
两者的授权都比「LGPL 用在资料档」清楚。**没有必要为了省一点事去踩一个没有判例的坑。**

### 待复核项目

以下来自桌面研究、尚未由本仓库独立验证，采用前必须自行确认：

- 教育部辞典「额外授权声明」的**确切适用范围**（哪些改动不算「改作」）
- CNS 11643「注音属性档」的**实际栏位与涵盖率**
- libchewing-data v4 bigram 语言模型的**档案大小与实测准确率**
  （桌面研究称 150 MB，可裁至 5.5 MB；准确率 92.57% → 96.11%）

## 为什么选择 McBopomofo 而不是 libchewing 当起点

| 面向 | McBopomofo | libchewing |
|---|---|---|
| 授权 | **MIT**（最宽松） | LGPL-2.1（动态连结可行，但有义务） |
| 注音资料 | ✅ 原生注音，13 万条含对数机率 | ✅ 原生注音，含 bigram |
| 可携核心 | ❌ 与 macOS 耦合 | ✅ Rust 核心 + C API + Swift Package |
| 拿来当参考 | ✅ 可读、有测试、有 AGENTS.md 文件 | ✅ 但 Rust 重写仍在 alpha |

**现在的选择**：以 McBopomofo 的**资料**起步（MIT、立即可用、已验证），
以自己的**引擎**为主体（见 [02-architecture.md](02-architecture.md)）。

**未来的选择**：当需要 bigram 脉络模型时，评估接入 libchewing-data v4（CC BY 4.0，
可商用可改作）。届时若考虑直接用 libchewing 的 Rust 核心，LGPL-2.1 的动态连结义务
需要法务确认——这是一条**明确可行但需要决策**的路，不是阻碍。

## 上游资料的清理与再散布

`data/build.mjs` 产生的 `data/bopomofo-lm.tsv` 与 `data/bopomofo-chars.tsv`
是 McBopomofo 资料的**衍生作品**，因此以相同 MIT 条款再散布。
本专案对这些档案不主张任何额外限制。

`data/vendor/` 内的上游原始档**不进版控**（4.3 MB），由 `data/fetch-source.sh` 取得，
并在 [NOTICE](../NOTICE) 中记录档名与杂凑前缀以供追溯。
