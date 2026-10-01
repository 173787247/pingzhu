# 07 · 中文「字頻表／詞頻表／斷詞詞典」來源調查

> **调查目的**：为注音输入法（台湾正体语域）的四张表找**能直接拿来用、或能交叉验证**的资料来源。
> 四张表＝读音表、词库、词频表、**字频表**（★ 决定同音字排序）。
>
> **调查日期**：2026-10-01
> **调查方法**：直接抓原始档（GitHub / Codeberg 的 `raw` 路径、官方下载页、PDF 原文）、
> 读 LICENSE 与授权页**原文**、下载资料档**实际解析**。凡实测者标注「本仓库实测」。
> 检索工具：`web_search`（内建）。**`research/tools/s.py` 已失效**（DuckDuckGo lite 端点回传
> 空壳页面、0 结果），本次调查全程未使用。
>
> **相关文件**：`05-tw-institutional-corpora.md`（台湾公家机关）、`06-cn-nlp-corpora.md`（大陆语料）、
> `08-data-licensing-review.md`（法律分析）。本文专注**频次资料的来源与数值对照**，法律推论请见 08。

---

## 〇、结论摘要

### 0.1 一句话

**真正能同时满足「开源、可商用、台湾正体语域、且对『見 vs 建』给出与台湾官方一致答案」的，
只有 `libchewing-data` v4（CC BY 4.0）一份。** 国教院的《汉字表》《三等七级词表》资料品质最好
（官方、含书面／口语双频次、词表还自带注音），但授权存在**院级开放宣告 与 子系统页尾／TAIC 标注
之间的张力**，必须先厘清才能进产品。

### 0.2 总表

| 来源 | 授权（读自原文） | 商用 | 改作 | 台湾正体适用性 | 含实际频次数字 | URL |
|---|---|---|---|---|---|---|
| **libchewing-data v4** | **CC BY 4.0**（`LICENSES/CC-BY-4.0.txt`；`chewing_v4/README.md` 自述） | ✅ | ✅ | **★ 高**（台湾 web 语料，16 GiB） | ✅（unigram 对数机率） | [codeberg](https://codeberg.org/chewing/libchewing-data) |
| **McBopomofo**（现用） | **MIT**（`LICENSE.txt`） | ✅ | ✅ | 高（台湾维护） | ✅（对数机率） | [GitHub](https://github.com/openvanilla/McBopomofo) |
| **国教院《汉字表》** | **国教院《政府网站资料开放宣告》**：无偿、非专属、得再授权、可改作、可开发产品 | ✅※ | ✅※ | **★ 最高**（台湾官方语料） | ✅ 书面／口语 每百万字 | [下载页](https://bcoct.naer.edu.tw/download/tech_report/) |
| **国教院《三等七级词表》** | 同上 | ✅※ | ✅※ | **★ 最高**；**14,420 词全带注音** | ✅ 书面／口语 每百万字 | 同上 |
| **Unihan `kHanyuPinlu`** | **Unicode License v3**（permissive） | ✅ | ✅ | 低（1986 大陆简体语料） | ✅ 括号内计数 | [Unicode](https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip) |
| **wordfreq** | 程式 **Apache-2.0**；**资料 CC BY-SA 4.0** | ✅ | ⚠️ **ShareAlike 传染** | **✗ 低**（271 个繁体字被合并） | ✅ Zipf | [GitHub](https://github.com/rspeer/wordfreq) |
| **SUBTLEX-CH** | 论文 **CC BY**；资料「freely available for research purposes」；wordfreq 另取得作者邮件许可 | ⚠️ 需向作者确认 | ⚠️ | **✗ 极低**（简体字幕，`見` 只出现 1 次） | ✅ 计数／每百万／CD | [PLOS ONE](https://doi.org/10.1371/journal.pone.0010729) |
| **Jun Da 字频表** | **「research and teaching/learning purposes only. Any commercial use … prior written permission」** | ❌ **明文禁止** | ❌ | ✗ 低（GB 编码＝简体） | ✅ | [版权页](https://lingua.mtsu.edu/chinese-computing/copyright.html) |
| **FineFreq** | GitHub **无 LICENSE**；HuggingFace 卡 **CC BY 4.0** | ⚠️ 依 HF 卡 | ⚠️ | **✗ 低**（大陆网络语域，方向与台湾相反） | ✅ 逐字计数 | [GitHub](https://github.com/Bin-2/FineFreq) |
| **Google Books Ngrams 中文** | 「may be freely used for any purpose」（仅请注明出处） | ✅ | ✅ | ✗ 极低（**只有 `chi_sim`＝简体**） | ✅ n-gram 计数 | [info](https://books.google.com/ngrams/info) |
| **中研院平衡语料库** | 协议**第五条**：字/词频统计**「不得包含或引用於任何商业产品中」** | ❌ | ❌ | 高但不可用 | ✅ | [协议 PDF](https://aclclp.org.tw/doc/wlawf_agr_c_g.pdf) |
| **教育部四部辞典** | **CC BY-ND 3.0 TW**（官方原文：**包括商业性利用**，但不得修改） | ✅ | ❌ | 高 | ✗（无频次） | [公眾授權網](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html) |
| **《国语一字多音审订表》** | **未找到独立授权声明**（不在公眾授權網四部辞典之列） | 未核实 | 未核实 | 高（破音字标准） | ✗ | [MOE PDF](https://language.moe.gov.tw/files/people_files/%E5%9C%8B%E8%AA%9E%E4%B8%80%E5%AD%97%E5%A4%9A%E9%9F%B3%E5%AF%A9%E8%A8%82%E8%A1%A8.pdf) |
| **CC-CEDICT** | **CC BY-SA 4.0**（读自档案表头 `#! license=`） | ✅ | ⚠️ ShareAlike | 中（含 `(Tw)` 条目） | ✗ | [mdbg](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) |
| **萌典 / moedict-data** | 无 LICENSE 档；README 自述：原始＝MOE CC BY-ND 3.0 TW，**格式转换层由 @kcwu 以 CC0 释出** | ⚠️ | ⚠️ | 高 | ✗ | [GitHub](https://github.com/g0v/moedict-data) |
| **OpenCC** | **Apache-2.0**（`LICENSE` 原文） | ✅ | ✅ | 简繁转换唯一选择 | ✗ | [GitHub](https://github.com/BYVoid/OpenCC) |
| **RIME `rime-essay`** | **LGPL-3.0**；`AUTHORS`：资料精炼自 Chewing(LGPL)、OpenCC(Apache)、Android Pinyin IME(Apache)、萌典(CC0) | ⚠️ LGPL 用于资料效力不明 | ⚠️ | 中 | ✅（权重） | [GitHub](https://github.com/rime/rime-essay) |
| **RIME 官方拼音方案** | `luna-pinyin` / `terra-pinyin` **LGPL-3.0**；`pinyin-simp` **Apache-2.0** | ⚠️ | ⚠️ | 中 | 部分 | [GitHub](https://github.com/rime/rime-luna-pinyin) |
| **雾凇拼音 rime-ice** | **GPL-3.0**（README 第 463 行「GPL-3.0 (only) License.」） | ⚠️ 传染 | ⚠️ | 中 | ✅ | [GitHub](https://github.com/iDvel/rime-ice) |
| **铱注音 iridium-bpmf** | **MPL-2.0**；2023/10/10 起词库**改由 McBopomofo (MIT) 转换** | ✅ | ✅ | **★ 高**（台湾使用习惯） | 继承 McBopomofo | [GitHub](https://github.com/andy0130tw/iridium-bpmf) |
| **fcitx5-table-extra** | **GPL-3.0-or-later**（`LICENSES/GPL-3.0-or-later.txt`）；**无注音表** | ⚠️ 传染 | ⚠️ | ✗ | — | [GitHub](https://github.com/fcitx/fcitx5-table-extra) |
| **fcitx5-chewing** | **LGPL-2.1-or-later**（`LICENSES/LGPL-2.1-or-later.txt`） | ⚠️ | ⚠️ | 高 | — | [GitHub](https://github.com/fcitx/fcitx5-chewing) |
| **libpinyin** | **GPL-3.0**（`COPYING`）；`data/opengram.license`：词典部分条目来自 android-pinyin-ime(Apache-2.0) | ⚠️ 传染 | ⚠️ | 中 | ✅ n-gram | [GitHub](https://github.com/libpinyin/libpinyin) |
| **jieba** | **MIT**（`LICENSE`）；但 wordfreq 自述其词表 **「provenance we don't really know」** | ✅ 程式 | ✅ | 中（简体词表） | ✅ 词频 | [GitHub](https://github.com/fxsjy/jieba) |
| **CNS 11643 全字库** | **政府资料开放授权条款第 1 版**（＋字形 OFL-1.1） | ✅ | ✅ | 高（含注音属性） | ✗ | [授权页](https://www.cns11643.gov.tw/pageView.jsp?ID=59) |
| **小鹤音形** | **查不到官方开源仓库与授权文件** | 未核实 | 未核实 | 未知 | 未知 | — |

※ 国教院授权见 §3.3 的张力说明。

### 0.3 三个特别任务的短答

| 问题 | 短答 |
|---|---|
| **wordfreq 的 Oversimplified 损害了什么？** | 全表 3,275 条繁体→简体映射中，**128 个简体目标汇聚了 >1 个繁体来源，共 271 个繁体字被合并**。实测：`裡`＝`里`（皆 6.09）、`麵`＝`面`（5.11）、`隻`＝`只`（5.94）、`臺`＝`台`＝`檯`＝`颱`（5.40）、`乾`＝`幹`＝`干`（5.52）、`髮`＝`發`（5.52）。**同一个注音底下的两个候选字会拿到完全相同的分数**——这正是我们要解决的问题本身，而它把问题抹平了。对「見 vs 建」它答**見胜**（5.59 vs 4.89，约 5×），因为 `見→见` 是**一对一映射**，没有失真；但这是巧合，不是设计。 |
| **Jun Da 字频表能不能判断繁体字常用度？** | **不能，而且不能商用。** 版权页原文：「provided here for **research and teaching/learning purposes only**. Any commercial use of the lists should have **prior written permission** from the author.」语料为 1998 年版 110 MB 现代中文（六份网络杂志＋西游丝电子图书馆电子书），**GB 编码**，作者自述「Most, if not all of them, were written by users of **simplified Chinese**」、「opportunistic and biased」、「biased towards formal written Chinese」。 |
| **有没有开源、可商用、且明确是台湾繁体的字频表？** | **有，但只有一份是干净的**：`libchewing-data` v4（CC BY 4.0）。**资料最好的是国教院**（台湾官方语料、书面＋口语双频次、词表自带注音），其院级《政府网站资料开放宣告》明确允许无偿改作与开发产品，但**同一批档案所在的 bcoct 子系统页尾写「版权所有 All rights reserved」，同一语料在 TAIC 上又标「仅授权 AI 训练使用」**——这个张力必须先解决（详见 §3.3）。 |

---

## 一、★「見 vs 建」六来源实测对照

这是本次调查的核心。**六个来源对同一个问题给出了两个相反的答案**，而且分歧不是随机噪声，
是**语域差异**——这比「哪个来源对」重要得多。

### 1.1 对照表

| 来源 | 授权 | `見` | `建` | 谁赢 | 倍数 |
|---|---|---|---|---|---|
| **国教院《汉字表》**（书面，每百万字） | 国教院开放宣告 | **1334**（序 159，第1级） | 628（序 874，第4级） | **見** | 2.1× |
| **国教院《汉字表》**（口语，每百万字） | 同上 | 505 | 523 | 建（几乎平手） | 1.04× |
| **Unihan `kHanyuPinlu`** | Unicode License v3 | **3613**（2832+446+335） | 1732 | **見** | 2.1× |
| **libchewing-data v4** `tsi_unigram.arpa` | CC BY 4.0 | **-3.3724** | -3.5890 | **見** | 1.65× |
| **wordfreq** `zh`（Zipf） | 资料 CC BY-SA 4.0 | **5.59**（`见` 同值） | 4.89 | **見** | ~5× |
| **McBopomofo**（本仓库现用 `data/bopomofo-lm.tsv`） | MIT | -3.456 | **-3.333** | **建** | 1.32× |
| **SUBTLEX-CH** `SUBTLEX-CH-CHR.tsv`（原表） | 见 §3.6 | **1**（0.02/百万） | 9772（208.62/百万） | 建 | 9772× |
| SUBTLEX-CH（合并 `見`+`见`） | 同上 | 85,724 | 9772 | 見 | 8.8× |
| **FineFreq** `cmn_Hani`（2013–2024） | GitHub 无／HF CC BY 4.0 | 98,171,021 | **1,072,870,186** | **建** | 10.9× |
| FineFreq（合并 `見`+`见`） | 同上 | 544,958,186 | 1,072,870,186 | 建 | 2.0× |

### 1.2 这张表告诉我们什么

1. **「見 比 建 常用」确实是台湾官方语料的结论** —— 国教院《汉字表》书面频次 1334 vs 628。
   用户的前提成立。
2. **但它不是语言的绝对事实，是语域的函数。**
   - 台湾官方语料（国教院）：見 胜
   - 1986 大陆《现代汉语频率词典》（Unihan 转引）：見 胜
   - 混语料词频（wordfreq）：見 胜
   - **2013–2024 大陆网络语料（FineFreq）：建 胜，且领先 2×**
   - **1990 年代大陆字幕（SUBTLEX-CH）：`見` 这个字形几乎不存在（1 次）**
3. **所以判断标准不能是「哪个数字对」，而是「哪个语料和我们的使用者同一个语域」。**
   我们的使用者是台湾与海外注音用户，写台湾正体 → **国教院语料是对齐的**；
   FineFreq 的 2013–2024 Common Crawl 中文几乎全是大陆简体网页，**不对齐**。
4. **注意口语与书面分裂**：国教院表里 見/建 在**书面**是 2.1×，在**口语**是 1.04×（几乎平手）。
   对一个输入法来说，书面频次才是正确权重（用户打的是书面文本）。

### 1.3 为什么本仓库现用的 McBopomofo 是「建」在前

`data/bopomofo-lm.tsv` 实测：

```
ㄐㄧㄢˋ	建	-3.333
ㄐㄧㄢˋ	見	-3.456
```

McBopomofo 的片语清单自述衍生自 **libtabe `tsi.src`（BSD）**（见 `Source/Data/README.md`，
`docs/04-data-and-licensing.md` 已记录）。libtabe 是 1990 年代台湾的专案，语料更旧。
**这不是 bug，是资料老化。**

---

## 二、特别任务详细回答

### 2.1 wordfreq 的「Oversimplified」到底损害了什么

#### （a）官方怎么说

`README.md`「Multi-script languages」节原文：

> Chinese text is converted internally to a representation we call **"Oversimplified Chinese"**,
> where all Traditional Chinese characters are replaced with their Simplified Chinese equivalent,
> ***even if* they would not be written that way in context**. This representation lets us use a
> straightforward mapping that matches both Traditional and Simplified words, unifying their
> frequencies when appropriate, and does not appear to create clashes between unrelated words.
>
> Enumerating the Chinese wordlist will produce some unfamiliar words, because **people don't
> actually write in Oversimplified Chinese**, and because in practice Traditional and Simplified
> Chinese also have different word usage.

源码 `wordfreq/chinese.py` 也自陈：

> This is **far too simple to be a proper Chinese-to-Chinese "translation"**; it will sometimes
> produce **nonsense words** by simplifying characters that would not be simplified in context,
> or by simplifying words that would only be used in a Traditional Chinese locale.

#### （b）损害有多大 —— 本仓库实测

从 `wordfreq/data/_chinese_mapping.msgpack.gz` 解出（键为码位整数）：

```
mapping 条目总数                    : 3275
其中 source != target 的            : 3275
简体目标接收 >1 个繁体来源的「真合并」: 128
卷入这些合并的繁体字数              : 271
```

最大的几组：

```
坛 <- 墰 壇 壜 罈 罎          台 <- 檯 臺 颱          历 <- 厤 曆 歷
干 <- 乾 幹 榦               面 <- 麪 麫 麵          只 <- 祇 隻 只（隐含）
蒙 <- 懞 濛 矇               採 <- 埰 寀 採          彙 <- 匯 彙 滙
```

**这 271 个字，在注音输入法里全都是在同一个注音底下的不同候选字。**

#### （c）实测：合并后拿到的分数

```python
from wordfreq import zipf_frequency as z
```

| 配对 | zipf | 结果 |
|---|---|---|
| `見` / `建` | 5.590 / 4.890 | diff（未合并） |
| `见` / `見` | 5.590 / 5.590 | **SAME** ← 简繁确实是同一个字号 |
| `裡` / `里` | 6.090 / 6.090 | **SAME** ✗ 不同字 |
| `麵` / `面` | 5.110 / 5.110 | **SAME** ✗ 不同字 |
| `隻` / `只` | 5.940 / 5.940 | **SAME** ✗ 不同字 |
| `臺` / `台` / `檯` / `颱` | 5.400 ×4 | **SAME** ✗ 四个不同字 |
| `乾` / `幹` / `干` | 5.520 ×3 | **SAME** ✗ 三个不同字 |
| `髮` / `發` | 5.520 / 5.520 | **SAME** ✗ 不同字 |
| `麼` / `么` | 5.640 / 5.640 | **SAME** ✗ 不同字 |
| `著` / `着` | 5.000 / 6.220 | diff ← **单向映射的漏洞** |

**两点必须说清楚：**

- **合并是单向的、不完整的。** `著→着` 不在映射表里（`著` 本身也是简体合法字），
  所以 `著`（5.00）与 `着`（6.22）**没有**被合并。这造成同一个「ㄓㄜ」音下，
  传统字形的分数被压得比简体字形低 1.22 Zipf（约 16×）。**对台湾用户这是错的。**
- **「見 vs 建」这一题，wordfreq 的答案是可信的**，因为 `見→见` 是**一对一**映射，
  合并只是把不同字形的同一字号加起来，没有把两个字混为一谈。
  但这是**运气**：换成 `裡 vs 里` 就完全失效。

#### （d）许可证层面的额外问题

- `LICENSE.txt` 原文：Apache-2.0，**但**「This license applies to the **code only**.
  See NOTICE.md for particular details about the licensing of the code and the data.」
- `NOTICE.md` 原文：资料档以 **CC BY-SA 4.0** 散布。
- `NOTICE.md` 另载：SUBTLEX 的散布许可是「I (Robyn Speer) have obtained permission **by e-mail**
  from Marc Brysbaert ... to be used for **any purpose, not just for academic use**, under these
  conditions: ①需署名 SUBTLEX 作者 ②须保持 SUBTLEX 是免费可得资料的清晰性。**These terms are
  similar to the Creative Commons Attribution-ShareAlike license.**」
- README 明文拒绝转成 CSV：「**No.** The CSV format does not have any space for attribution or
  license information, and therefore does not follow the CC-By-SA license.」
- 上游清单（README「Sources and supported languages」）：Wikipedia、OPUS OpenSubtitles 2018、
  SUBTLEX（含 SUBTLEX-CH）、NewsCrawl 2014、GlobalVoices、Google Books Ngrams 2012、OSCAR、
  Twitter、**Jieba 词表（作者自述「whose provenance we don't really know」）**。
- 该专案另有 `SUNSET.md`；README 开头：「The word frequencies are a **snapshot of language usage
  through about 2021** ... the data is unlikely to be updated again.」

**结论**：wordfreq 对我们是**双重不可用**——技术上是 Merged-Simplified 语域，法律上是 CC BY-SA
（ShareAlike 传染，详见 `08-data-licensing-review.md` §相应章节）。

### 2.2 Jun Da 字频表

| 项 | 内容 |
|---|---|
| **名称／维护者** | Chinese Text Computing，**Jun Da（笪骏）**，Middle Tennessee State University |
| **授权（原文）** | 「The author of the content of these webpages maintains the copyright to the various character frequency/digram lists presented on this web site. They are provided here for **research and teaching/learning purposes only**. **Any commercial use of the lists should have prior written permission from the author.**」<br>来源：<https://lingua.mtsu.edu/chinese-computing/copyright.html>（页尾：Copyright 1998-2026, 最后更新 2010-09-16） |
| **商用** | ❌ **明文需要事先书面许可** |
| **规模** | 1998 版语料 110 MB，切出 **>4,500 万字**；列表含古汉语／现代汉语／现代文学／信息类／总表 +《现代汉语常用字表》字频列表 + 新闻类与小说类 bigram |
| **内容形式** | 单字字频（**含实际频次**）、双字组频率、音素与音节频率 |
| **取得方式** | <https://lingua.mtsu.edu/chinese-computing/statistics/index.html>（Excel / tab-delimited 下载） |
| **语料（原文）** | 1998 版技术说明：六份网络杂志（新语丝 XYS、华夏文摘 HXWZ、枫华园 FHY、华德通讯 HDTX、计算机世界 CW、神州学人 CHISA，1991–1998）＋**西游丝电子图书馆（Xi Yu Si Electronic Library）电子书全集** |
| **繁体？** | ✗ **全部 GB 编码**。作者自述第 5 点：「All the texts are GB encoded. **Most, if not all of them, were written by users of simplified Chinese.** This is especially true for those e-magazines whose intended audience are overseas Chinese from mainland China.」 |
| **偏误（作者自述）** | 标题直接写「**An opportunistic and biased corpus**」：①只为公开可得而选 ②**只收编辑过的书面文本，不收论坛等非正式文本**→「biased towards **formal written Chinese**」③西游丝藏书「can be considered a 'best seller' list rather than a distributed and balanced collection」 |
| **年代** | 1998 版（技术说明更新 2000-10-22）；另有 2004 更新版。现站技术报告页写「**Under preparation!**」，实际内容指向论文 PDF |
| **★ 对台湾正体字的适用性** | **✗ 低**。GB 编码＋大陆海外中文杂志＋正式书面语，语域与台湾 2020 年代正体书写差两代人。**且授权已排除商用，无需进一步讨论技术适用性。** |

### 2.3 有没有开源、可商用、且明确是台湾繁体的字频表

**有。分三档：**

| 档 | 来源 | 授权 | 台湾语域 | 字频？ |
|---|---|---|---|---|
| **A. 干净可用** | **libchewing-data v4** | **CC BY 4.0**（`LICENSES/CC-BY-4.0.txt`；`chewing_v4/README.md`：「This work is licensed under CC BY 4.0.」） | ✅ 自述台湾 web 语料 16 GiB | ✅ 147,742 条 1-gram（含 **18,769 个单字**） |
| **B. 品质最好但授权待厘清** | **国教院《汉字表》/《三等七级词表》** | 院级《政府网站资料开放宣告》：无偿、非专属、**得再授权**、可**改作**、可**开发各种产品或服务**、须注明出处<br>⚠️ **但** bcoct 子系统页尾「版权所有 All rights reserved」、同一语料在 TAIC 标「仅授权 AI 训练使用」 | ✅✅ 台湾官方语料，且《词表》**14,420 词全带注音** | ✅ 书面／口语「每百万字」 |
| **C. 可作交叉验证** | **Unihan `kHanyuPinlu`** | **Unicode License v3**（permissive，明确可商用） | ✗ 1986 大陆语料 | ✅ 3,799 字带括号计数 |

**C 档的一个重要警告（本仓库实测）**：Unihan 的 `kHanyuPinlu` **在繁简之间是复制的**。
在 2,562 组「繁简双方都有 kHanyuPinlu」的配对中，**2,546 组的数值完全相同**，只有 16 组不同
（那 16 组是真的不同字，如 `了`/`瞭`、`几`/`幾`、`复`/`覆`、`气`/`氣`、`着`/`著`）。
例：`U+898B 見` 与 `U+89C1 见` 都是 `jiàn(2832) xiàn(446) jian(335)`。

→ **Unihan 并没有给繁体字独立的统计**，它的 `見` 数字其实是简体 `见` 的数字。
所以它能用来问「这个**语素**常不常用」，**不能**用来问「繁体字形 `見` 在繁体语料里有多常用」。
覆盖面也只有 3,799 字（国教院是 3,100 字、libchewing 单字 18,769 条）。

**结论**：**A 档是唯一「今天就能进产品」的**；B 档资料最好但法务要先过；C 档只当第三方验证。

---

## 三、逐项资源

### 3.1 libchewing-data v4 ★ 推荐

| 项 | 内容 |
|---|---|
| **名称／维护者** | libchewing-data，chewing 专案（新酷音）；已从 GitHub 迁至 Codeberg |
| **授权** | **CC BY 4.0**。本仓库实测：repo 根目录 `LICENSES/` 内**只有** `CC-BY-4.0.txt`（17,023 bytes，完整条文）；`dict/chewing_v4/README.md` 末节「## License / This work is licensed under CC BY 4.0.」 |
| **能否商用／改作** | ✅ 皆可，需署名 |
| **规模** | 见下表 |
| **内容形式** | **词级 unigram + bigram 对数机率**；unigram 内含**单字条目**，可当字频用；另有 `tsi_dict.csv`（词＋注音）、`static_words.txt`、`rare_dict.csv` |
| **取得** | <https://codeberg.org/chewing/libchewing-data>（raw: `/raw/branch/main/...`，**分支是 `main` 不是 `master`**）；crates.io `chewing` |
| **年代与语域** | `chewing_v4/README.md`：「trained on **~16 GiB of web-crawled Chinese text** and validated on a **711,645-sentence** held-out set」；台湾团队维护 |
| **★ 台湾正体适用性** | **★ 高。** 原生注音、台湾语料、且对「見 vs 建」给出与国教院一致的答案（見胜） |

档案实测（本仓库 + 上游 README）：

| 档案 | 大小 |
|---|---|
| `bigram_p50.arpa` | 150,068,322 B = 150 MB |
| `tsi_unigram.arpa` | 4,027,013 B（**ngram 1 = 147,742**） |
| `tsi_dict.csv` | 4,986,281 B |
| `static_words.txt` | 1,259,598 B |
| `rare_dict.csv` | 23,800 B |

上游自评（`chewing_v4/README.md` 表）：unigram-only 基线 **92.57%**；bigram `keep_frac` 1.0（34 MB）
**96.11%**，0.1（5.5 MB）**94.87%**。**注意：这是上游自己的评测（16 GiB 语料、711,645 句留出集、
他们的 lattice），与本专案 `bench.mjs` 的数字不可直接比较。**

**★ 使用前必读**：`docs/04-data-and-licensing.md` 已记录本仓库的实验结论——
libchewing 的语汇表 111,601 条 vs 本仓库 169,604 条，**差异过大**，
`research/tools/bigram-trial.mjs` 的自检只过 159/257，
因此**不能只换 bigram，必须连同 unigram 一起换**，或拿它当语料另行统计。
**但单字频次（unigram 中的单字条目）可以独立取用**——本次实测即证明这一点。

### 3.2 McBopomofo（本专案现用）

| 项 | 内容 |
|---|---|
| **授权** | **MIT**。本仓库实测 `LICENSE.txt`：「MIT License / Copyright (c) **2011-2026 Mengjuei Hsieh et al.**」 |
| **上游链** | 片语清单衍生自 **libtabe `tsi.src`（BSD）** |
| **规模（本仓库 `data/stats.json`）** | 片语 169,604；相异读音 131,048；含字音节 1,397；总字数 26,315 |
| **★ 台湾适用性** | 高（台湾团队维护、原生注音），**但字频资料陈旧**（见 §1.3） |
| **URL** | <https://github.com/openvanilla/McBopomofo> |

**第三方佐证**：RIME 的台湾注音方案 **铱注音 `andy0130tw/iridium-bpmf`（MPL-2.0）** README 原文：

> 本方案曾經內附一份來自地球拼音 `terra-pinyin` 的字典檔。自 **2023/10/10** 內建詞庫**改使用由小麥注音輸入法（McBopomofo, MIT 授權）經程式轉換而來的詞庫**。此詞庫由臺灣人維護，且定期有開發者編修及貢獻，作者評估其**讀音、詞彙、詞頻品質**等方面，認為較適合做為預設詞庫檔。

→ 一个独立的台湾注音方案作者，在对比后选择了 McBopomofo 的词库。**这佐证了本专案当初的选择**，
但也说明**整个台湾注音生态都缺一份新的字频表**——铱注音同样继承了这个弱点。

### 3.3 国教院《臺灣華語文能力基準》漢字表／三等七級詞表 ★ 资料最好

| 项 | 内容 |
|---|---|
| **名称／发布机关** | 国家教育研究院（NAER），語文教育及編譯研究中心；檔名日期 111-09-20（2022-09-20，xlsx 内建时间戳 `2022-09-20T06:02:25Z`） |
| **授权** | **院级**《政府网站资料开放宣告》（<https://www.naer.edu.tw/PageDoc?fid=324>）原文：「國家教育研究院全球資訊網上刊載之所有資料與素材，其得受著作權保護之範圍，以**無償、非專屬，得再授權**之方式提供公眾使用，使用者得**不限時間及地域，重製、改作、編輯、公開傳輸**或為其他方式之利用，**開發各種產品或服務**（簡稱加值衍生物），此一授權行為**不會嗣後撤回**，使用者亦無須取得本機關之書面或其他方式授權；然使用時，**應註明出處**。」<br>例外条款：「部分的影音、圖像、樂譜、**專人專案撰文**或其他著作，經機關**特別聲明須經同意方可使用**」 |
| **⚠️ 授权张力** | ① 檔案實際所在的 `bcoct.naer.edu.tw` 所屬系統 `coct.naer.edu.tw` 頁尾寫「〈華語語料庫與能力基準整合應用系統〉**國家教育研究院版權所有** ©2023 National Academy for Educational Research, R.O.C. **All rights reserved**」，且該站無「政府網站資料開放宣告」連結<br>② **同一份《臺灣華語文語料庫》教材在數位發展部「臺灣主權 AI 訓練語料庫」(TAIC) 上標示「僅授權 AI 訓練使用」**，授權條款為「臺灣主權 AI 訓練語料授權條款-第 1 版」（<https://taic.moda.gov.tw/datasets/e271070a-b17f-4975-9d7b-897b91911254>）<br>③ 院級宣告的例外條款「專人專案撰文」是否涵蓋這兩份表，未見明文 |
| **规模（本仓库实测）** | **漢字表**：`臺灣華語文能力基準漢字表_111-09-20.xlsx`，123,482 B，**3,100 字**<br>**三等七級詞表**：`國教院三等七級詞表.xlsx`，1,976,025 B，**14,420 詞**，13 個工作表 |
| **内容形式（★ 实测栏位）** | **漢字表**：`序號 / 漢字 / 等別 / 級別 / 書面字頻（每百萬字） / 口語字頻（每百萬字）`<br>**三等七級詞表**：`序號 / 詞語 / 等別 / 級別 / 情境 / 書面字頻(每百萬字) / 口語字頻(每百萬字) / 簡編本系統號 / 參考注音 / 參考漢語拼音`<br>★ **14,420/14,420 筆全部帶「參考注音」**（例：`愛` → `ㄞˋ`；`爸爸/爸` → `ㄅㄚˋ ˙ㄅㄚ / ㄅㄚˋ`） |
| **取得** | <https://bcoct.naer.edu.tw/download/tech_report/>（漢字表 Word/Excel；三等七級詞表 ods/Excel；另有基礎詞彙表、語法點表、類詞綴表） |
| **年代与语域** | 2022；**台湾华语文语料库**（书面语、口语、中介语、华英双语四类）；**正体字** |
| **★ 台湾正体适用性** | **★ 最高**。这是全台湾唯一「官方＋正体＋含实际频次＋词表带注音」的组合 |

**★ 两个必须知道的使用限制（本仓库实测）**：

1. **漢字表只收 3,100 字**，且**异体字被合并成同一列**。共 33 个合并条目：
   `台／臺`（序 36）、`裡／裏`（127）、`麵／麪`（430）、`著／着`（488）、`鑑／鑒`（3081）、
   `真／眞`、`床／牀`、`雞／鷄`、`舉／擧`、`污／汙`、`卻／却`、`強／强`、`群／羣`…
   → **這張表無法回答「臺 vs 台」「裡 vs 裏」「著 vs 着」誰該排前面。**
   本專案的 `data/README` 若要用它，這 33 組必須另行處理。
2. **《三等七級詞表》的「參考注音」是詞層級的**（`爸爸/爸` 給兩種），
   不是逐字讀音表；破音字仍需搭配《一字多音審訂表》或教育部辭典。

**★ 判断**：这是**最该争取**的来源。建议路径：
① 先以「國教院全球資訊網《政府網站資料開放宣告》」為授權依據，
② 但因 ①②③ 三處張力，**在正式散布進商業產品前，向國教院（語文教育及編譯研究中心）
取得一封書面確認**（`onile@mail.naer.edu.tw`，見萌典 README 轉錄的聯絡資訊）。
在此之前，可**內部使用作交叉驗證**，不要散布。

### 3.4 Unihan `kHanyuPinlu`

| 项 | 内容 |
|---|---|
| **维护者** | Unicode Consortium（資料源自《現代漢語頻率詞典》） |
| **授权** | **Unicode License v3**。<https://www.unicode.org/copyright.html> 原文：「All Unicode Data Files and Unicode Software are subject to the terms and conditions of the free and open-source **Unicode License v3**」 |
| **商用** | ✅ 明确允许（permissive，無 ShareAlike） |
| **规模** | `Unihan.zip` 8,340,649 B。`Unihan_Readings.txt` 中 **3,799 字**帶 `kHanyuPinlu`（全檔 291,259 筆資料行） |
| **内容形式** | 每字每讀音的**括號計數**，如 `U+898B kHanyuPinlu jiàn(2832) xiàn(446) jian(335)`。另有 `kMandarin`（拼音）、`kXHC1983`、`kHanyuPinyin`（44,355／11,072／34,130 字） |
| **取得** | <https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip> |
| **★ 台湾正体适用性** | **低**。語料為 1986 年大陸《現代漢語頻率詞典》（簡體為主）。**且繁簡數值互相複製**（2,546/2,562 對相同），所以「繁体字的独立频次」实际上不存在 |

**★ 结论**：**不能当台湾字频主力**，但它是**授权最干净、可自由散布**的第三方验证点。
若某天需要「一个完全无争议的数字来佐证方向」，它是可用的。

### 3.5 wordfreq

见 §2.1。补充事实：

| 项 | 内容 |
|---|---|
| **维护者** | Robyn Speer（Luminoso） |
| **版本** | 本仓库实测 `pip install wordfreq[cjk]` → **3.1.1**（jieba 0.42.1、langcodes 3.5.1、msgpack 1.2.3） |
| **资料档** | `data/large_zh.msgpack.gz` 1,773,909 B；`data/small_zh.msgpack.gz` 179,188 B；`data/_chinese_mapping.msgpack.gz` 16,831 B；`data/jieba_zh.txt` 491,198 B；`data/jieba_zh_orig.txt` 5,071,852 B |
| **已停止更新** | README：「snapshot of language usage **through about 2021** ... the data is unlikely to be updated again」；repo 另有 `SUNSET.md` |
| **★ 台湾正体适用性** | **✗ 低**（見 §2.1(c)） |

### 3.6 SUBTLEX-CH

| 项 | 内容 |
|---|---|
| **作者／年份** | Cai, Qing & Marc Brysbaert, **2010**，PLOS ONE 5(6): e10729，DOI [10.1371/journal.pone.0010729](https://doi.org/10.1371/journal.pone.0010729) |
| **授权（论文原文）** | 「**Copyright: © 2010 Cai, Brysbaert. This is an open-access article distributed under the terms of the Creative Commons Attribution License**, which permits unrestricted use, distribution, and reproduction in any medium, provided the original author and source are credited.」→ **CC BY** |
| **授权（资料本身）** | 摘要原文：「The word frequencies are **freely available for research purposes**.」<br>wordfreq `NOTICE.md` 另载：Brysbaert **邮件许可**「to be used for **any purpose, not just for academic use**」，條件為署名＋保持「SUBTLEX 是免費可得資料」的清晰性 |
| **★ 商用判断** | **论文是 CC BY，但资料表本身只写「research purposes」**。wordfreq 拿的是**另行邮件许可**。→ 我们要商用，**必须自己向作者取得许可，或确认现行下载页的授权声明**。<br>（原始下载页 `crr.ugent.be/programs-data/subtitle-frequencies/subtlex-ch` 本次实测 **HTTP 404**；镜像 `lexique.org/databases/SUBTLEX-CH/` 可用但**未见授权声明**） |
| **规模** | 語料 **46.8M 字 / 33.5M 詞**；**5,936 個相異字**；**99,121 個相異詞** |
| **内容形式** | `SUBTLEX-CH-CHR`（Character / CHRCount / CHR/million / logCHR / CHR-CD / CHR-CD% / logCHR-CD）、`SUBTLEX-CH-WF`、`SUBTLEX-CH-WF_PoS`。**含實際計數** |
| **取得** | 官方 Supporting Information: <https://doi.org/10.1371/journal.pone.0010729.s002>（1.76 MB ZIP）；鏡像 <http://lexique.org/databases/SUBTLEX-CH/> |
| **★ 语域** | **简体字幕。** 论文原文：「We got permission to download all the subtitle files from **two of the biggest websites in China mainland providing subtitles in Simplified Chinese**」。檔案本身是 **GB18030 編碼**（本仓库实测 `file` 判定 ISO-8859，以 gb18030 解碼成功） |
| **★ 台湾正体适用性** | **✗ 极低。** 本仓库实测：`見` 在整个 4,680 万字语料里**只出现 1 次**（0.02/百万），`间` 60,047 次而 `間` 只有 3 次，`里` 190,694 次而 `裡` 只有 1 次。**若直接拿这张表排繁体同音字，`見` 会被排到最后。** |

**★ 这是本次调查最有警示价值的一个发现**：一个被广泛引用、看起来「中文字频权威」的资料集，
在繁体字形上实际上是**空的**。任何拿 SUBTLEX-CH 当繁体字频的做法都会严重出错。

### 3.7 FineFreq

| 项 | 内容 |
|---|---|
| **作者／年份** | Binbin Xu（EuroMov Digital Health in Motion, Univ Montpellier / IMT Mines Ales），arXiv:2512.09701v1，**2025-12-10** |
| **授权** | ⚠️ **不一致**：GitHub `Bin-2/FineFreq` **無 LICENSE 檔**（GitHub API `license: None`）；HuggingFace `lgi2p/finefreq` 卡 `license: cc-by-4.0` |
| **规模** | 96.6 兆字，1900+ 語言，2013–2025，源自 FineWeb v1.4 / FineWeb2 v2.1.0。**`cmn_Hani`：81,717 個相異字元、946,699,852,091 字（2013–2024）**。另有 `yue_Hani`、`wuu_Hani`、`lzh_Hani`、`hak_Hani` |
| **内容形式** | 逐字元 `total_frequency_all_time` ＋ **逐年份** `year_2013_frequency` … `year_2024_frequency` ＋ Unicode 分類／名稱。**含實際計數** |
| **取得** | <https://github.com/Bin-2/FineFreq>（`csv/cmn_Hani.csv`，11,275,831 B）、<https://huggingface.co/datasets/lgi2p/finefreq> |
| **★ 台湾正体适用性** | **✗ 低。** Common Crawl 的中文網頁以大陸簡體為主；實測 `建` 10.7 億 > `見` 9,820 萬（**與國教院結論相反**）。<br>優點：可做**逐年份趨勢分析**；缺點：語域與台灣不對齊，且授權標示不一致 |

### 3.8 Google Books Ngrams 中文

| 项 | 内容 |
|---|---|
| **授权（原文）** | 「Ngram Viewer graphs and data **may be freely used for any purpose**, although acknowledgement of Google Books Ngram Viewer as the source, and inclusion of a link to <https://books.google.com/ngrams>, **would be appreciated**.」→ 寬鬆、可商用、署名為「appreciated」而非強制 |
| **★ 中文部分** | **只有 `chi_sim`**。info 頁原文：「Chinese / chi_sim / **Books predominantly in simplified Chinese.**」版本：`Chinese 2019` = `googlebooks-chi-sim-20200217`；`Chinese 2012` = `googlebooks-chi-sim-all-20120701` |
| **★ 台湾正体适用性** | **✗ 极低。繁體根本沒有資料集。** |
| **URL** | <https://books.google.com/ngrams/info>；下載 <https://storage.googleapis.com/books/ngrams/books/datasetsv3.html> |

### 3.9 Leeds Internet Corpus / Leeds 语料

| 项 | 内容 |
|---|---|
| **授权** | wordfreq `NOTICE.md` 将其列為「data derived from the following **Creative Commons-licensed** sources: The Leeds Internet Corpus, from the University of Leeds Centre for Translation Studies (<http://corpus.leeds.ac.uk/list.html>)」——**但未寫明是哪一種 CC** |
| **取得** | **本次實測 `corpus.leeds.ac.uk` 回傳 HTTP 000（連線失敗），無法讀到授權原文。** |
| **★ 判断** | **未核实。** 在讀到原始授權聲明之前不要使用。 |

### 3.10 中研院（Sinica / CKIP）★ 明文禁止

| 项 | 内容 |
|---|---|
| **名称** | 中央研究院詞庫小組「平衡語料庫詞集及詞頻統計」 |
| **授权（原文，最關鍵）** | 《平衡語料庫詞集及詞頻統計授權使用協議書-團體》（<https://aclclp.org.tw/doc/wlawf_agr_c_g.pdf>，本仓庫實測 pdftotext 取得全文）：<br>「一、本語料之電子型式，組成內容型式與詞類標記，著作權屬中央研究院詞庫小組。智慧財產權屬中央研究院所有，並授權乙方進行**非營利性研究授權**。」<br>「四、牽涉上述第一項及第二項著作內容之任何引用之**商業行為應與著作權所有人另定約規定之**。」<br>「五、**本語料內之部份或全部內容，及其直接衍生資料（即詞彙庫，字/詞頻統計，詞類統計，語法規律）不得包含或引用於任何商業產品中。**」<br>「七、甲方使用本語料以 **10 人為限**」 |
| **★ 商用** | ❌ **明文禁止**，且第五條**直接點名「字/詞頻統計」不得進入商業產品** |
| **★ 对我们** | **不可用，沒有任何解釋空間。** 即使本專案是開源免費，協議第一條定位為「非營利性研究授權」、第三條「針對使用上述著作內容進行**研究**之授權」，散布一份給不特定使用者的輸入法資料層不落在範圍內。<br>**只能當外部驗證時「看一眼方向」，不能把數字抄進產品。** |
| **CKIP 工具** | 新一代開源工具（`ckiplab/ckip-transformers` 等）為 **GPL-3.0**；傳統斷詞**詞庫**（含詞頻）為**商業授權**（官網自述已授權碩網科技、資策會、淩網科技）。**GPL 是程式碼授權，不是資料授權**，且這些是斷詞工具不是字頻表，對「見 vs 建」無直接幫助 |

### 3.11 教育部辞典家族与《一字多音审订表》

| 项 | 内容 |
|---|---|
| **授权（★ 官方原文）** | <https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html> 原文：「中華民國教育部《重編國語辭典修訂本》、《國語辭典簡編本》、《國語小字典》與《成語典》相關資料採『**創用CC-姓名標示-禁止改作 3.0 臺灣授權條款**』釋出。<br>**本授權條款允許使用者重製、散布、傳輸著作（包括商業性利用），但不得修改該著作**，使用時必須遵照『使用說明』之內容要求。」 |
| **商用／改作** | ✅ **商用明確允許**；❌ **不得修改**（ND） |
| **各典规模／特色** | 《重編國語辭典修訂本》：歷史語言辭典，兼收現代及傳統音讀，版本 `2015_20260929`<br>《國語辭典簡編本》：**「收詞以字詞頻統計結果為依據」**、「所收的字音，**參照教育部公布之《國語一字多音審訂表》**，並經審音委員會審訂決議」，版本 `2014_20260626`<br>《國語小字典》：「**基本上參照《國語一字多音審訂表》取音**」，版本 `2019_20260929`<br>《成語典》：版本 `2020_20260929` |
| **★ 对破音字的价值** | **《簡編本》與《小字典》的字音就是《一字多音審訂表》的落地版本**，且授權可商用。→ **要拿台灣標準破音字讀音，走這兩部辭典比直接找《審訂表》更安全。** |
| **《國語一字多音審訂表》本体** | PDF: <https://language.moe.gov.tw/files/people_files/%E5%9C%8B%E8%AA%9E%E4%B8%80%E5%AD%97%E5%A4%9A%E9%9F%B3%E5%AF%A9%E8%A8%82%E8%A1%A8.pdf>（233,251 B，本仓庫實測可下載）。內容：88 年 3 月公告版為**現行規範**（教科書審定與全國語文競賽字音標準皆據此）；101-12-12 公告初稿為徵求意見版。<br>**★ 授權：該表不在「公眾授權網」四部辭典之列，本次未能找到獨立授權聲明 →「未核實」。** |
| **★ 台湾正体适用性** | ★ 高（台灣官方標準） |
| **萌典 / g0v moedict** | `g0v/moedict-data` **無 LICENSE 檔**（本仓庫實測）。但 `README.md` 自述：「這是將『重編國語辭典（修訂本）』的**公眾授權內容**處理為機器比較容易再利用的 json 格式。辭典本文的著作權仍為教育部所有。」「依教育部之解釋，『創用CC-姓名標示-禁止改作 臺灣3.0版授權條款』之**改作限制標的為文字資料本身，不限制格式轉換及後續應用**。」「此處轉換格式、重新編排的**編輯著作權（如果有的話）由 @kcwu 以 CC0 釋出**。」<br>`g0v/moedict-webkit` README 明載：「除前述資料檔之外，本目錄下的所有其他檔案，由作者 **唐鳳** 在法律許可的範圍內，拋棄該著作依著作權法所享有之權利…宣告將該著作貢獻至公眾領域（**CC0 1.0**）」，並列出「教育部國語辭典公眾授權網」<https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/><br>**★ 更正**：`docs/04-data-and-licensing.md` 目前寫「g0v/moedict-data｜無授權檔｜❌ 無授權＝保留所有權利」——**這個判斷需要修正**：repo 確實沒有 LICENSE 檔，但 README 明確聲明了 CC0（轉換層）與 CC BY-ND 3.0 TW（原始辭典本文）。 |
| **台灣閩南語常用詞辭典、台灣客家語辭典** | **本次實測 `twblg.dict.edu.tw` 回傳 HTTP 000（連線失敗），未能讀到授權原文 →「未核實」。** 建議另找管道確認（教育部語文成果網或公眾授權網）。 |

### 3.12 CC-CEDICT

| 项 | 内容 |
|---|---|
| **维护者** | 社群維護，由 MDBG 發佈 |
| **授权（★ 讀自檔案表頭）** | 下載 `cedict_1_0_ts_utf-8_mdbg.txt.gz`（3,977,840 B），檔頭原文：<br>`# License:`<br>`# Creative Commons Attribution-ShareAlike 4.0 International License`<br>`# https://creativecommons.org/licenses/by-sa/4.0/`<br>檔內 metadata：`#! license=https://creativecommons.org/licenses/by-sa/4.0/` |
| **★ 版本不一致（要注意）** | `https://cc-cedict.org/wiki/` 頁面仍寫「licensed under a Creative Commons **Attribution-Share Alike 3.0** License」。→ **以檔案表頭與 MDBG 頁面（皆為 4.0）為準**，wiki 頁未更新。 |
| **规模** | `#! entries=125163`；`#! date=2026-10-01T07:35:40Z` |
| **内容形式** | `繁體 简体 [pin1 yin1] /definitions/`。**含繁簡雙欄與拼音讀音，無頻次。** 含台灣特有詞（標 `(Tw)`） |
| **★ 商用** | ✅ 可商用，但 **ShareAlike** — 若把 CEDICT 內容併入我們的詞庫，衍生的詞庫可能需以 BY-SA 釋出。**對閉源／專有產品是實質風險。** |
| **★ 台湾正体适用性** | 中（繁簡並列、含台灣詞，但主體是大陸普通話詞彙；無頻次） |
| **URL** | <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>、<https://cc-cedict.org/wiki/> |

### 3.13 OpenCC

| 项 | 内容 |
|---|---|
| **授权** | **Apache-2.0**（`LICENSE` 原文：「Apache License / Version 2.0, January 2004 / http://www.apache.org/licenses/」） |
| **★ 对输出层够不够用** | 本专案已用 `TSCharacters.txt` / `TSPhrases.txt`（见 `data/fetch-source.sh` 与 `data/build-ts.mjs`）。**結論：對「輸出層」夠用**——它做的是簡繁字形轉換，正是輸出層需要的。<br>**但對「輸入層／字頻層」完全沒用**：OpenCC **不含任何頻次資料**，無法回答同音字排序。 |
| **★ 一个陷阱** | `rime-ice` README 第 372 行提到：「默認 OpenCC 的選項 `traditionalize/opencc_config: s2t.json` 是**香港繁體**」。→ **若用 OpenCC 做簡→繁，預設可能得到香港用字而非台灣用字**。台灣正體應確認使用 `s2tw`／`s2twp` 系列設定。 |
| **URL** | <https://github.com/BYVoid/OpenCC> |

### 3.14 RIME / 中州韵生态

| 项目 | 授权（讀自 raw LICENSE） | 备注 |
|---|---|---|
| `rime/librime` | **BSD-3-Clause**（「Copyright (c) 2014, RIME Developers / All rights reserved.」） | 引擎寬鬆 |
| `rime/rime-essay` | **LGPL-3.0**（`LICENSE` 7,651 B 為 LGPL v3 全文） | `essay.txt` 5,887,319 B，格式 `詞<TAB>權重`（如 `〇 981`） |
| `rime/rime-luna-pinyin` | **LGPL-3.0** | 官方拼音方案 |
| `rime/rime-terra-pinyin` | **LGPL-3.0**；`terra_pinyin.dict.yaml` 表頭自述：「**referenced works: CC-CEDICT** … license: **creative commons attribution-share alike 3.0**」 | ★ **地球拼音的詞庫源自 CC-CEDICT（BY-SA）**，再套 LGPL → **雙重 copyleft 疊加** |
| `rime/rime-pinyin-simp` | **Apache-2.0** | 並非所有官方方案都是 LGPL |

**★ `rime-essay` 的資料來源（`AUTHORS` 原文）**：

> Gong Chen, Kunki Chiu, ksqsf : **(LGPL)**
> refined data from **Chewing / 新酷音 (LGPL)**, **opencc (Apache-2.0)**,
> **Android Pinyin IME (Apache-2.0)** and **moedict.tw／萌典 (CC0 1.0)** — `essay.txt`

→ 這解釋了 `docs/04-data-and-licensing.md` 為何說 RIME 的 `essay.txt` 被標為 LGPL。
**LGPL 是為函式庫程式碼設計的授權，套用在純資料檔上「衍生作品」如何認定沒有定論**
（本專案既有判斷，我同意）。**我們的對策：避開。**

**★ 台灣注音方案**
| 方案 | 授權 | 備註 |
|---|---|---|
| `andy0130tw/iridium-bpmf`（銥注音） | **MPL-2.0** | 台灣使用習慣為準；**2023/10/10 起詞庫改由 McBopomofo（MIT）轉換** |
| `biopolyhedron/rime-zhuyin` | **無 license** | 1★，不可用 |
| `mksinicus/rime-zhupin` | Unlicense | 拼音＋注音混合，4★ |
| `houtacheng/rime-bopomo-onion-mixed` | NOASSERTION | 需人工審閱 |

### 3.15 雾凇拼音 `iDvel/rime-ice`

| 项 | 内容 |
|---|---|
| **授权** | **GPL-3.0**。`LICENSE` 為 GPL v3 全文（35,149 B）；`README.md` 第 463 行：「**GPL-3.0 (only) License.**」 |
| **★ 商用** | GPL-3.0 是**程式碼**授權，但 README 明寫「(only)」，且詞庫檔案在 repo 內。**對專有產品是傳染風險。** |
| **规模** | 未逐一實測（repo 較大）；README 自述詞庫可「詞庫共建」 |
| **★ 台湾正体适用性** | 中（簡體拼音方案為主，繁體輸出靠 OpenCC `s2t.json`＝**香港繁體**） |

### 3.16 fcitx5 系列

| 项目 | 授权 | 注音？ |
|---|---|---|
| `fcitx/fcitx5-table-extra` | **GPL-3.0-or-later**（`LICENSES/GPL-3.0-or-later.txt`） | **✗ 無注音表。** `tables/` 實測含：array30（行列）、boshiamy（嘸蝦米）、cangjie3/5（倉頡）、cantonese/jyutping、quick3/5（速成）、scj6（正碼）、stroke5（筆畫）、t9、wu/wubi/wubi98（五筆）、zhengma（鄭碼） |
| `fcitx/fcitx5-table-other` | 未讀 LICENSE | 只有其他語言（am/ar/bn/gu/hi/…），無中文注音 |
| `fcitx/fcitx5-chewing` | **LGPL-2.1-or-later**（`LICENSES/LGPL-2.1-or-later.txt`） | 是（新酷音前端），但**只是前端殼，不含資料** |

**★ 結論**：fcitx5 生態**沒有可用的注音字頻資料**。注音的表若要找，還是得回到 libchewing-data。

### 3.17 libpinyin

| 项 | 内容 |
|---|---|
| **授权** | **GPL-3.0**（`COPYING` 35,147 B 全文） |
| **资料授权（★ 讀原文）** | `data/opengram.license` 開頭：「The open-gram dictionary contains some entries from android-pinyin-ime, which is distributed under **Apache License Version 2.0**」→ 該檔案的其餘部分是 Apache-2.0 全文 |
| **规模／内容** | `data/` 目錄下有 `CMakeLists.txt`、`Makefile.am`、`opengram.license`、`table.conf.in`；**模型檔本身不在 repo**（由 `libpinyin-data` 之類的獨立套件／發行版打包）。未實測模型大小 |
| **★ 台湾正体适用性** | 低（拼音方案，簡體詞庫為主） |
| **URL** | <https://github.com/libpinyin/libpinyin> |

### 3.18 jieba 与其他断词工具

| 项目 | 授权 | 备注 |
|---|---|---|
| `fxsjy/jieba` | **MIT**（`LICENSE`「The MIT License (MIT) / Copyright (c) 2013 Sun Junyi」） | **★ 但 `dict.txt` 的來源不明。** wordfreq README 原文：「in Chinese, we import a free wordlist that comes with the Jieba word segmenter, **whose provenance we don't really know**」。→ **可以拿來斷詞，但不該拿它的詞頻當權威。** |
| `pkuseg` / `thunlp/THULAC` / `hankcs/HanLP` / `ckiplab/ckip-transformers` | 未逐一實測（本次範圍外） | 詳見 `06-cn-nlp-corpora.md` |

**★ 對本專案**：`jieba` 與其他斷詞器是**取得詞頻的手段**（拿語料自己統計），
不是**字頻表的來源**。要自建字頻表，斷詞器是工具鏈的一環。

### 3.19 CNS 11643 全字库

| 项 | 内容 |
|---|---|
| **授权（★ 官方原文）** | <https://www.cns11643.gov.tw/pageView.jsp?ID=59>：「本網站授權方式包括：**1. 政府資料開放授權條款-第1版**。本網站以**無償及非專屬**授權方式授權使用者得**不限時間及地域，重製、編輯、公開傳輸或為其他利用方式，開發各種產品或服務**（以下簡稱加值產品），但授權範圍**不包含商標權及專利權**。使用者公開發行、公開展示或其他利用本網站相關字型、資料、元件或程式所產生之加值產品，應以適當方式**註明來源出處**（數位發展部，CNS11643中文標準交換碼全字庫網站…）」<br>「2. **開放字型授權條款 OFL-1.1**」（供字型） |
| **★ 商用／改作** | ✅ 皆可（OGDL-1.0） |
| **内容** | 全字集字形、屬性資料；站上有「**注音查詢**」功能。`docs/04-data-and-licensing.md` 已記錄其授權清單明列「字型屬性檔：注音」——**本次未重新實測該屬性檔的實際欄位與涵蓋率，沿用既有「待複核」標記**。 |
| **★ 台湾正体适用性** | 高（台灣官方標準字碼），但**是字集／字形資源，不是字頻資源**。 |

---

## 四、查不到 / 未核实清单

| 项目 | 状态 |
|---|---|
| **Leeds Internet Corpus 授權原文** | `corpus.leeds.ac.uk` 本次回傳 **HTTP 000**。wordfreq 只說是「Creative Commons-licensed」未寫版本。**未核實。** |
| **《臺灣閩南語常用詞辭典》授權** | `twblg.dict.edu.tw` 回傳 **HTTP 000**。**未核實。**（該辭典不在教育部「公眾授權網」四部辭典之列，需另找授權聲明） |
| **《國語一字多音審訂表》獨立授權** | 找到官方 PDF，但**未見授權聲明**。**未核實。**（替代路徑：用《簡編本》《小字典》，其字音即依該表審訂且授權明確） |
| **國教院授權的最終解釋** | 院級《政府網站資料開放宣告》 vs. bcoct 子系統頁尾「版權所有」 vs. TAIC「僅授權 AI 訓練使用」→ **三方張力未解，需向國教院取得書面確認** |
| **小鶴音形（flypy）官方授權** | **查不到官方開源倉庫與授權文件。** 檢索只找到第三方接掛（`guider/baidu-flypy`、`OverflowCat/rime-hokping`、`yjyao/gboard-flypy`）與 `kancloud.cn` 上的官方說明文件。**其最終使用者條款原文未核實。** |
| **SUBTLEX-CH 現行官方下載頁授權** | `crr.ugent.be/programs-data/subtitle-frequencies/subtlex-ch` 回傳 **HTTP 404**（`http://` 為 503）。僅能由 PLOS 論文與 wordfreq NOTICE 推知。**需向作者確認現行條款。** |
| **`fcitx5-table-other` 授權** | 未讀 LICENSE |
| **`rime/rime-double-pinyin`、`rime/rime-stroke`、`rime/rime-cangjie` 等官方方案授權** | 未逐一實測（已抽樣 luna / terra / pinyin-simp 三種，結果不一致：LGPL-3.0 / LGPL-3.0 / Apache-2.0）→ **採用前必須逐個讀 LICENSE** |
| **《現代漢語常用字表》《通用規範漢字表》** | 未深入核實其著作權狀態（皆為大陸國務院／語委文件） |
| **FineFreq 授權不一致的解釋** | GitHub 無 LICENSE、HuggingFace 標 CC BY 4.0 → **未核實何者為準** |

---

## 五、★ 明确建议

### 5.1 如果只能改一处

**把同音字排序的字频来源，从「McBopomofo（libtabe 继承）」改为「libchewing-data v4 的 unigram 单字条目」。**

**理由（三条，皆有实测支撑）：**

1. **授权干净且确定**：`libchewing-data` 根目录 `LICENSES/` 只有 `CC-BY-4.0.txt`，
   `chewing_v4/README.md` 明写「This work is licensed under CC BY 4.0.」→
   **可商用、可改作、只需署名，且无 ShareAlike。** 这是本次调查中**唯一**同时满足
   「开源＋可商用＋可改作＋台湾语域」的字频来源。
2. **它答对了我们关心的那一题**：`見 -3.3724` vs `建 -3.5890` → 見 胜，**与国教院《汉字表》
   （1334 vs 628）方向一致**，而两者是**互相独立**的资料（一个是 16 GiB 台湾 web 语料，
   一个是国教院官方华语文语料库）。
3. **它是台湾团队维护、原生注音的**，不需要简繁转换，也就不会踩到 wordfreq 那 271 个合并字。

**风险（必须一起读）：**

- **词表差异极大**：libchewing 语汇表 111,601 条 vs 本仓库 169,604 条。
  `docs/04-data-and-licensing.md` 已实测：`bigram-trial.mjs` 的自检只过 159/257，
  **只换 bigram 而保留原词表，任何差异都无法归因。**
  → **本次建议只针对「单字频次」的取用**（unigram 中的单字条目，实测有 18,769 条），
  **不涉及整份词表迁移**。整份迁移是另一次工程，需连同 unigram 一起换。
- **单字频次是「词级 unigram 里的单字」**，不是纯字频统计。对单字词与词首字会偏高，
  对只出现在词中的字会偏低。**建议先做一次回归：拿它的单字条目 vs 国教院 3,100 字，
  看排序相关性，再决定要不要用、用多少。**
- CC BY 4.0 要求**署名并标示是否修改**。我们的字频表若由其衍生，需在 `NOTICE` 中加注。

### 5.2 如果要做一次真正的替换（推荐的两阶段）

**阶段一（现在可做，零授权风险）：交叉验证，不改代码**

把三个来源并排跑一遍，只在**报告**里比对，不进产品：

| 验证源 | 授权 | 为什么可以现在就用 |
|---|---|---|
| **国教院《汉字表》**（3,100 字，书面＋口语每百万字） | 院级开放宣告 | 作为**基准真值**，内部比对 |
| **Unihan `kHanyuPinlu`**（3,799 字） | Unicode License v3 | **授权最无争议**，可自由散布 |
| **libchewing-data v4 unigram**（18,769 单字） | CC BY 4.0 | 可自由散布 |

**具体做法**：取本专案 `data/bopomofo-chars.tsv` 里每一个读音的所有候选字，
用三个来源分别排序，看**第一候选**的一致率。这能直接量出「换来源会改动多少」
——比争论哪个来源对更有效。

**阶段二（要法务／对外确认）：把国教院资料纳入**

国教院《汉字表》＋《三等七级词表》是**全台湾唯一**「官方＋正体＋实际频次＋词表带注音
（14,420/14,420 笔）」的组合，品质明显高于任何社群资料。**它的价值值得花力气去确认授权。**

**建议动作**：向国家教育研究院语文教育及编译研究中心
（`onile@mail.naer.edu.tw`，见萌典 README 转录）去函确认：
① 《臺灣華語文能力基準漢字表》《三等七級詞表》是否适用院级《政府网站资料开放宣告》；
② 「得再授權、得改作、開發各種產品或服務」是否涵盖**商业输入法产品**；
③ 与 TAIC「僅授權 AI 訓練使用」的标注如何并存。

**在回函之前**：只用内部验证，**不散布**。

### 5.3 明确不要用的（及理由）

| 来源 | 不要用的理由 |
|---|---|
| **wordfreq** | ①技术：128 组合并、271 个繁体字被抹平（实测 `裡`＝`里`、`麵`＝`面`、`臺`＝`台`＝`檯`＝`颱`），且合并单向不完整（`著` 5.00 vs `着` 6.22）②法律：资料 CC BY-SA 4.0 ③已停止更新（~2021 快照） |
| **Jun Da** | 「Any commercial use … prior written permission」明文禁止；语料是 1998 年 GB 编码简体书面语 |
| **中研院平衡语料库／CKIP 词频** | 协议第五条**直接点名「字/词頻统计」不得进入商业产品**；且限 10 人使用 |
| **SUBTLEX-CH（原表直接用）** | 简体字幕语料，`見` 全语料只出现 **1 次**。**这是最容易踩的坑**——它看起来是权威中文字频表，对繁体字形却是空的 |
| **Google Books Ngrams 中文** | 只有 `chi_sim`，**没有繁体资料集** |
| **FineFreq** | 语域是 2013–2024 Common Crawl 大陆简体网页（`建` 10.7 亿 > `見` 9,820 万，**方向与台湾相反**）；且 GitHub 无 LICENSE、HF 标 CC BY 4.0，标示不一致 |
| **雾凇拼音 rime-ice** | GPL-3.0 (only) |
| **RIME 官方方案（luna/terra）** | LGPL-3.0 用在纯资料档上效力不明；`terra-pinyin` 更是 CC-CEDICT(BY-SA) + LGPL 双重叠加 |
| **rime-essay** | 同上，且资料链含 Chewing(LGPL) |
| **CC-CEDICT（并入词库）** | CC BY-SA 4.0，ShareAlike 会传染到我们的词库。**若只是离线参考、不散布衍生表，可另议** |
| **fcitx5-table-extra** | GPL-3.0-or-later，且**根本没有注音表** |

### 5.4 一句话给决策者

> 我们不需要新的语言模型，也不需要新的词库——
> **我们只需要把「同音字谁排第一」这一层的数字，从 1990 年代的 libtabe 换成
> libchewing v4 的 CC BY 4.0 unigram；同时把国教院的《汉字表》争取下来当台湾语域的权威基准。**
> 前者今天就能做，后者值得写一封信去问。

---

## 附录 A · 本次调查的实测命令与结果摘要

环境：WSL Ubuntu 24.04，`python3`，隔离虚拟环境 `/tmp/wfvenv`（**未写入仓库**）。

```bash
# wordfreq 实测（venv 装在 /tmp，不碰仓库）
python3 -m venv /tmp/wfvenv
/tmp/wfvenv/bin/pip install "wordfreq[cjk]"     # → wordfreq 3.1.1, jieba 0.42.1
/tmp/wfvenv/bin/python -c "
from wordfreq import zipf_frequency as z
for w in ['見','建','见','裡','里','麵','面','隻','只','臺','台','檯','颱']:
    print(w, round(z(w,'zh'),4))
"
# 見 5.59 / 建 4.89 / 见 5.59  → 見 與 见 同值
# 裡 6.09 = 里 6.09 / 麵 5.11 = 面 5.11 / 隻 5.94 = 只 5.94 / 臺 5.40 = 台 = 檯 = 颱

# wordfreq 合併映射統計
/tmp/wfvenv/bin/python -c "
import gzip,msgpack,collections
m=msgpack.load(gzip.open('.../_chinese_mapping.msgpack.gz'),raw=False,strict_map_key=False)
mm={chr(k):v for k,v in m.items() if isinstance(k,int) and isinstance(v,str)}
diff={k:v for k,v in mm.items() if k!=v}
tgt=collections.defaultdict(list)
for k,v in diff.items(): tgt[v].append(k)
multi={v:ks for v,ks in tgt.items() if len(ks)>1}
print(len(mm), len(multi), sum(len(v) for v in multi.values()))
"
# → 3275 映射 / 128 個真合併 / 271 個繁體字受影響

# libchewing-data v4 unigram 實測
curl -sL "https://codeberg.org/chewing/libchewing-data/raw/branch/main/dict/chewing_v4/tsi_unigram.arpa" -o tsi_uni.arpa
grep -E "^[-0-9.]+ (見|建|件|健|間|的|是)$" tsi_uni.arpa
# → 建 -3.589048691767284 / 見 -3.372377712578914

# 國教院檔案解析（stdlib zipfile+xml，無外部依賴）
python3 xlsx.py 臺灣華語文能力基準漢字表_111-09-20.xlsx   # 3100 字，含書面/口語每百萬字頻
python3 xlsx.py 國教院三等七級詞表.xlsx                  # 14420 詞，10 欄，全帶參考注音

# SUBTLEX-CH 實測（GB18030 編碼）
python3 -c "print(open('SUBTLEX-CH-CHR.tsv','rb').read().decode('gb18030'))" | grep -P "^(見|建|见)\t"
# → 見 1 (0.02/M) ; 建 9772 (208.62/M) ; 见 85723 (1830.08/M)

# Unihan 實測
curl -sLO https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip && unzip Unihan.zip Unihan_Readings.txt
grep -P "^U\+898B\t" Unihan_Readings.txt | grep kHanyuPinlu   # → jiàn(2832) xiàn(446) jian(335)
grep -P "^U\+5EFA\t" Unihan_Readings.txt | grep kHanyuPinlu   # → jiàn(1732)

# FineFreq 實測
curl -sLO https://raw.githubusercontent.com/Bin-2/FineFreq/main/csv/cmn_Hani.csv
# → 見 98,171,021 / 见 446,787,165 / 建 1,072,870,186（總 9.467e11）
```

## 附录 B · 术语与陷阱速查

| 术语 | 含义 | 对我们的影响 |
|---|---|---|
| **Oversimplified Chinese** | wordfreq 把**所有**繁体字转成简体再查表 | 128 组合并、271 字被抹平 |
| **异体字合并** | 国教院表把 `台／臺` 写在同一列 | 无法区分异体字优先序（33 组） |
| **繁简复制** | Unihan 把简体的计数抄给繁体 | 繁体没有独立统计（2,546/2,562 对相同） |
| **語料語域** | 简体字幕 / 大陆网页 / 台湾官方语料 | `見 vs 建` 的答案在两个方向上都有 |
| **ShareAlike (BY-SA)** | 衍生作品须以相同条款释出 | CC-CEDICT、wordfreq、SUBTLEX(条件类似) 都有 |
| **ND (NoDerivatives)** | 不得修改 | 教育部四部辞典：可商用、不可改 |
| **LGPL 用于资料档** | 为函式库程式码设计的授权套在纯文字上 | 衍生范围无定论，本专案避开（rime-essay 等） |
