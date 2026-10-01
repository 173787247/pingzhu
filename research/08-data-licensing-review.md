# 08 · 资料授权合规审查（第二轮，2026-10-01）

> 本文是 [docs/04-data-and-licensing.md](../docs/04-data-and-licensing.md) 的**第二轮、更严格**版本。
> 第一轮问的是「用什么最省事」，这一轮只问一件事：**我们到底能把什么放进这个公开仓库？**
> 每条结论都附来源 URL；授权条款一律读原文。**查不到的写「查不到」。**

---

## 一句话结论

**现用资料（McBopomofo，MIT）干净可用，但文档里「libchewing-data ＝ CC BY 4.0」的说法是错的**——
它底下的 `dict/chewing/*.csv` 档头自述 **LGPL-2.1-or-later**、`dict/moe/` 是 **CC BY-ND 3.0 TW**，
真正 CC BY 4.0 的只有 `dict/chewing_v4/`；照现有文档去接词库会直接把 LGPL 资料带进 MIT 公开仓库。
**最紧迫的风险有两个：一是 libchewing-data 的授权标注错误（尚未发生但已被写进文档），
二是仓库已散布 OpenCC 衍生档 `data/ts-conversion.tsv` 却没有附 Apache-2.0 全文（已经发生）。**

> ⚠️ **我不是律师。** 本文是工程侧的合规调研，不是法律意见。
> 凡标注「此为法律判断」之处，商用前应交法务复核——第三节列了清单。

---

## （一）判定标准：什么样的资料能进这个仓库？

### 1.1 三级分类

判准的底层逻辑只有一句话：**程序授权与资料授权是两件事，且「能不能散布」与「能不能商用」是两个独立的门。**
四个门全过才能进：**① 可商用 ② 可改作 ③ 可再散布 ④ 可再授权（sublicense）**。
第 ④ 项最常被忽略——若上游只授权「你自己用」，我们就没有权利把它放进公开仓库让别人下载。

#### A. 明确可以进（四门全过，义务仅为保留声明）

| 授权 | 可否商用 | 可否改作 | 可否再散布 | 义务 | 来源 |
|---|---|---|---|---|---|
| **MIT** | ✅ | ✅ | ✅ | 保留版权声明**与许可全文** | 原文已读 |
| **Apache-2.0** | ✅ | ✅ | ✅ | 保留声明、**附许可副本**、标明改动、专利授权 | 原文已读 |
| **BSD（2/3-Clause）** | ✅ | ✅ | ✅ | 保留版权声明与免责声明 | — |
| **CC0 / 公众领域** | ✅ | ✅ | ✅ | 无 | — |
| **Unicode License V3** | ✅ | ✅ | ✅ | 声明随副本或**关联文档**出现即可 | [unicode.org/license.txt](https://www.unicode.org/license.txt) |
| **CC BY 4.0** | ✅ | ✅ | ✅ | 署名七要件（见下） | [legalcode](https://creativecommons.org/licenses/by/4.0/legalcode) |
| **data.gov.tw OGDL 1.0** | ✅ | ✅ | ✅ **得再转授权** | 「显名声明」 | [data.gov.tw/license](https://data.gov.tw/license) |

**Unicode License V3 原文**（已读）：

> Permission is hereby granted, free of charge, … to deal in the **Data Files** or Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, and/or sell copies … provided that either (a) this copyright and permission notice appear with all copies … or (b) this copyright and permission notice appear in associated Documentation.

→ 明确涵盖**资料档**（不只是程序），且署名可以放在关联文档（我们的 `NOTICE`）。**Unihan 可以进。**

**data.gov.tw OGDL 1.0 原文**（已读，两处关键）：

> 二、授与权利　(一) 各机关所提供之开放资料，授权使用者**不限目的**、时间及地域、非专属、不可撤回、免授权金进行利用……包括重制、散布、公开传输、编辑、**改作**……
> (二) 使用者**得再转授权**他人为前项之利用。
> 四、版本更新及授权转换　(二) 本条款与「创用CC授权 姓名标示 4.0 国际版本」**相容**。

→ 「不限目的」＝可商用；「得再转授权」＝我们可以放进公开仓库；且**与 CC BY 4.0 相容**（义务等同 CC BY 4.0）。
**台湾政府资料开放平台上的语言资料可以进**，义务是按附件格式做显名声明：

```
提供机关／单位 [年份] [开放资料释出名称与版本号]
此开放资料依政府资料开放授权条款 (Open Government Data License) 进行公众释出，
使用者于遵守本条款各项规定之前提下，得利用之。
政府资料开放授权条款： https://data.gov.tw/license
```

> ★ 顺带一提：OGDL 自己在定义里就做了「事实／表达」的区分——
> 「(五) **资讯**：指**不受著作权法保护之纯粹纪录**，并随同开放资料一并提供者。」
> 这是台湾官方文件自己承认「纯纪录资料不受著作权保护」的直接依据。

#### B. 可以有条件进

**CC BY 4.0——署名怎么给才对？**

CC BY 4.0 §3(a) 原文列了**七项**必须保留的内容（已读）：

1. 创作者（或指定受署名者）的识别
2. **版权声明**
3. 指向本许可的声明
4. 指向免责声明的声明
5. 指向授权素材的 URI／超连结（在合理可行范围内）
6. **若你修改过，必须标明**，并保留先前修改的标示
7. **标明素材依本许可授权，并附许可全文或连结**

§3(a)(2) 补充：可以用任何合理方式满足，例如「提供一个含有上述资讯的资源连结」。

→ **正确做法**：在 `NOTICE` 里为每一份 CC BY 4.0 资料开一节，含〔来源专案名 + 版权行 + 许可名 + 连结 + 版本／取得日期 + **我们改了什么**〕。
「我们改了什么」最常被漏——docs/04 已提过 libchewing 的 ATTRIBUTE 有写，我们若接 `dict/chewing_v4/` 也必须写。

**CC BY-SA 4.0——share-alike 会不会污染我们的 MIT 程序？**

先看原文（[CC BY-SA 4.0 legalcode](https://creativecommons.org/licenses/by-sa/4.0/legalcode)，已读）：

> **§1 Adapted Material** means material … derived from or based upon the Licensed Material and in which the Licensed Material is translated, altered, arranged, transformed, or otherwise modified **in a manner requiring permission** under the Copyright and Similar Rights held by the Licensor.
> **§3(b) ShareAlike.** In addition to the conditions in Section 3(a), **if You Share Adapted Material You produce**, the following conditions also apply. (1) The Adapter's License You apply must be a Creative Commons license with the same License Elements…
> **§4 Sui Generis Database Rights.** … (b) if You include all or a substantial portion of the database contents **in a database in which You have Sui Generis Database Rights**, then **the database** in which You have Sui Generis Database Rights (**but not its individual contents**) is **Adapted Material**, including for purposes of Section 3(b)

三条推论：

1. **ShareAlike 只作用于「你产出的改作物」，不作用于独立程序。**
   把 BY-SA 资料档放进一个仓库，不会让 MIT 的 `engine/` 变成 BY-SA ——那些是我们独立创作的程序，不是该资料的改作物。**「污染整个仓库」的说法不成立。**
2. **但 §4(b) 是真正的风险**：若我们把 wordfreq 资料库的**实质性部分**搬进我们自己的资料档（例如 `bopomofo-lm.tsv`），
   则在承认欧盟数据库权的法域下，**我们那张资料档本身**会被认定为 Adapted Material，因而**必须**以 CC BY-SA 4.0（或相容许可）释出。程序不受影响，但资料档要换授权。
3. **CC 授权自己说：不需要许可的利用，不受该授权管辖**（legalcode 前言已读）：
   > If the licensor's permission is not necessary for any reason–for example, because of any applicable exception or limitation to copyright–then **that use is not regulated by the license**.

   → 若字频数字本身不受著作权保护（见 1.3），则 CC BY-SA **根本不适用**于这批数字。但这只解决**版权**问题，**解决不了合约问题**（见 1.4）。

**实务结论**：CC BY-SA 4.0 的资料**技术上可以进**（单独一档、单独标 BY-SA 4.0、完整署名），
但会带来两件长期麻烦：① 我们的仓库不再是单一 MIT；② 下游商用者要额外判断哪一档是什么授权。
**本专案的目标是「可商用、干净」，因此判定为「不建议进」——不是因为不合法，是因为不值得。**

#### C. 绝对不能进

| 类型 | 判准 | 为什么 |
|---|---|---|
| **仅限学术研究** | 条款写「限学术研究」或「非营利」 | 可商用门直接不过，无补救 |
| **需洽询／需签约** | 必须填写申请书、盖章、限定人数 | 无「得再转授权」，公开仓库散布即违约 |
| **禁止移转第三人** | 条款写「不得移转给第三人」 | 再散布门不过 |
| **LGPL／GPL 的资料部分** | 档头或 README 标 LGPL/GPL | 效力不明且传染性风险；见 §2.2 实测 |
| **来源不明** | 无档头声明、README 未载来源、维护者自己也说不清 | 无法履行任何署名义务，也无法担保无侵权 |
| **无授权声明** | 仓库无 LICENSE | 保留所有权利（默认著作权） |
| **爬取内容** | 从网站抓取、无授权说明 | 同上，且可能违反该站条款 |

#### D. 条件式可进但**本专案不应进**

**CC BY-ND（禁止改作）** —— 见 §2.6 对教育部辞典的实测。判准是：

- ND 只允许**原样再散布**。格式转换（XML→TSV）通常可辩为「不涉及更改内容之调整行为」。
- **但「合并运算」的高风险在于**：把 A 资料的词条与 B 资料的读音合并成新条目，已接近「改作」。
- 且**若上游另有「额外授权声明」，那份声明才是真正的边界**，比 CC 的通用文本更具体、更严格。

### 1.2 事实性资料 vs 受版权保护的汇编：界线在哪？

这一节全部引用**已读原文**，不凭感觉。

#### ① 台湾：著作权法（[全国法规资料库](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=J0070017)）

**第 9 条**（已读）—— 这是回答「字频数字本身受不受保护」最直接的条文：

> 下列各款**不得为著作权之标的**：
> 一、宪法、法律、命令或公文。
> 二、中央或地方机关就前款著作作成之翻译物或编辑物。
> 三、标语及通用之符号、名词、公式、**数表**、表格、簿册或时历。
> 四、单纯为传达事实之新闻报导所作成之语文著作。
> 五、依法令举行之各类考试试题及其备用试题。

→ ★ **「数表」明文列为不得为著作权之标的。** 一份「词 → 出现次数」的统计表，性质上就是数表。
**在台湾法下，字频数字本身不受著作权保护。**——此为法律判断，应交法务确认。

**第 10-1 条**（已读）：

> 依本法取得之著作权，其保护**仅及于该著作之表达，而不及于其所表达之思想、程序、制程、系统、操作方法、概念、原理、发现**。

**第 7 条**（已读）：

> 就资料之**选择及编排**具有创作性者为**编辑著作**，以独立之著作保护之。
> 编辑著作之保护，对其所收编著作之著作权**不生影响**。

→ 三条合起来构成完整的界线：
**编辑著作的保护要件是「选择及编排的创作性」，保护范围只及于那个选择与编排，不及于被收编的资料本身。**

#### ② 美国：Feist Publications v. Rural Telephone Service, 499 U.S. 340 (1991)

来源：[Cornell LII 全文](https://www.law.cornell.edu/supremecourt/text/499/340)（已读）。判决要旨原文：

> **Since facts do not owe their origin to an act of authorship, they are not original and, thus, are not copyrightable.**
> … copyright protection extends only to those components of the work that are original to the author, **not to the facts themselves**. This **fact/expression dichotomy** severely limits the scope of protection in fact-based works.
> A compilation is not copyrightable per se, but is copyrightable only if its facts have been "selected, coordinated, or arranged in such a way that the resulting work as a whole constitutes an original work of authorship." § 101
> Lower courts that adopted a **"sweat of the brow"** or "industrious collection" test … misconstrued the 1909 Act and eschewed the fundamental axiom of copyright law that **no one may copyright facts or ideas**.
> Even a compilation that is copyrightable receives only limited protection, for the copyright **does not extend to facts contained in the compilation**. § 103(b).

→ **「我花了很多力气统计」不产生著作权**（sweat of the brow 被明确否定）。
**只要「选择与编排」没有创作性，整份字频表就不受保护。**

#### ③ 欧盟：这是「事实免费」论**不成立**的法域

Directive 96/9/EC（[legislation.gov.uk 保留欧盟法全文](https://www.legislation.gov.uk/eudr/1996/9)，已读）**第 7 条**：

> 1. Member States shall provide for a right for the maker of a database which shows that there has been **qualitatively and/or quantitatively a substantial investment** in either the **obtaining, verification or presentation** of the contents to prevent **extraction and/or re-utilization** of the whole or of a **substantial part** … of the contents of that database.
> 4. The right … shall apply **irrespective of the eligibility of that database for protection by copyright** or by other rights. Moreover, it shall apply **irrespective of eligibility of the contents** of that database for protection by copyright or by other rights.
> 5. The **repeated and systematic** extraction and/or re-utilization of **insubstantial parts** … implying acts which conflict with a normal exploitation of that database … shall not be permitted.

→ **欧盟另有「资料库制作人特殊权利」（sui generis database right），它与著作权无关，
即使内容（字频数字）本身不受著作权保护，只要制作者在「取得／验证／呈现」上有实质性投资，该资料库仍受保护。**
第 5 项更进一步：**反复、系统地抽取「非实质部分」也可能被禁止**——这正好封住了「我只取一点点」的抗辩。

**对我们的意义**：一份字频表在美国／台湾可能完全免费，在欧盟可能受保护。
我们的产品是跨平台、可商用的，**必须按最严格的法域设计**。
这也解释了为什么 CC BY-SA 4.0 要专门写 §4 数据库条款。

#### ④ 小结：界线怎么划

| | 不受保护（可用） | 受保护（要许可） |
|---|---|---|
| **单笔事实** | 「的」出现 1,234,567 次 | — |
| **数表本身** | 台湾 §9(1)(3) 明列为不得为著作权之标的 | — |
| **选择与编排** | 按字数／笔画机械排序 | 有创作性的分类、筛选、注释体系 |
| **欧盟资料库权** | 未达「实质性投资」门槛 | 在取得／验证／呈现上有实质性投资 |
| **合约** | — | **任何标的上都能另行约定**（见下） |

### 1.3 ★ 版权 vs 合约：这是最重要的一条区分

**「字频是事实，所以不受版权保护」不能推出「我可以用它」。**

版权只是一组权利；**上游可以另外用合约限制你**。
中研院语料库的授权协议书就是活例子（§2.7 已读原文）：它不靠著作权，靠的是**你签了协议书**。
「直接衍生资料（字/词频统计）不得包含或引用于任何商业产品」——**即使字频数字本身不可著作权，
签了这份协议的人仍然受合约拘束**。

→ **判准**：
- 若资料**只有著作权问题** → 套 §1.2 的界线，事实可自由使用。
- 若资料**取得途径附带了合约**（申请书、协议书、网站条款、点击同意）→ **合约优先**，与版权分析无关。
- 若资料是**公开下载、无任何条款** → 退回著作权分析。

**这就是为什么「自己在本地从合法语料统计」这条路的成败，完全取决于「合法语料」的合约怎么写。**

---

## （二）逐项审查表

图例：**✅ 可进** ／ **🟡 有条件可进** ／ **❌ 不可进** ／ **⚠️ 现况有缺口**

| # | 项目 | 实测授权 | 可进仓库？ | 理由 | 来源 URL |
|---|---|---|---|---|---|
| 1 | **McBopomofo `WebData.ts`**（现用） | **MIT** | ✅ | 见 §2.1 | [LICENSE.txt](https://raw.githubusercontent.com/openvanilla/McBopomofoWeb/main/LICENSE.txt) |
| 2 | **libchewing-data `dict/chewing/*.csv`** | **LGPL-2.1-or-later** | ❌ | 档头自述，非 CC BY 4.0 | [tsi.csv](https://codeberg.org/chewing/libchewing-data/raw/branch/main/dict/chewing/tsi.csv) |
| 3 | **libchewing-data `dict/chewing_v4/*`** | **CC BY 4.0** | 🟡 | 可商用可改作，需完整署名 | [v4 README](https://codeberg.org/chewing/libchewing-data/raw/branch/main/dict/chewing_v4/README.md) |
| 4 | **libchewing-data `dict/moe/`** | **CC BY-ND 3.0 TW** | ❌ | ND ＋ 简体禁令，与本专案冲突 | [ATTRIBUTE.md](https://codeberg.org/chewing/libchewing-data/raw/branch/main/dict/moe/ATTRIBUTE.md) |
| 5 | **OpenCC `TSCharacters/TSPhrases.txt`** | **Apache-2.0** | ✅⚠️ | 档头自述 Apache-2.0；**缺许可全文** | [TSCharacters.txt](https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt) |
| 6 | **wordfreq 资料** | **CC BY-SA 4.0** | ❌ | 作者明文禁止转出成 CSV；SUBTLEX 许可不传递 | [README](https://raw.githubusercontent.com/rspeer/wordfreq/master/README.md) |
| 7 | **SUBTLEX-CH** | 原站已下线，无公开授权 | ❌ | 取得管道消失；许可只给 wordfreq | [crr.ugent.be](https://crr.ugent.be/) |
| 8 | **教育部辞典（簡編本）** | **CC BY-ND 3.0 TW** ＋额外授权声明 | ❌ | 音读不得修改、**不得转为简化字** | [公眾授權使用說明 PDF](https://codeberg.org/chewing/libchewing-data/raw/branch/main/dict/moe/sources/conciseddict_10312.pdf) |
| 9 | **中研院语料库（ASBC）** | 非营利学术授权协议书 | ❌ | 明文禁商用、禁移转、**禁衍生词频入商业产品** | [个人协议书](https://aclclp.org.tw/doc/wlawf_agr_c.pdf) |
| 10 | **SIGHAN Bakeoff 资料集** | 同上模板 | ❌ | 同上，第五条一字不差 | [bakeoff_agr_c.pdf](https://aclclp.org.tw/doc/bakeoff_agr_c.pdf) |
| 11 | **jieba 自带 `dict.txt`** | 仓库 MIT，**资料出处不明** | ❌ | 无档头、README 未载来源 | [dict.txt](https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt) |
| 12 | **THUOCL（清华）** | MIT ＋ 自述可商用 | 🟡 | 条款核实通过；语料来源为 CSDN／新浪／搜狗 | [README](https://raw.githubusercontent.com/thunlp/THUOCL/master/README.md) |
| 13 | **中文维基百科 dump** | CC BY-SA 4.0 ＋ GFDL | 🟡 | 可商用；统计结果有 share-alike 争议 | [dumps legal](https://dumps.wikimedia.org/legal.html) |
| 14 | **人民日报标注语料库** | 有偿、限定大学研究所 | ❌ | 无开放授权，需洽购 | [富士通公告](https://info.archives.global.fujitsu/cn/about/resources/news/press-releases/2001/0829.html) |
| 15 | **data.gov.tw 语言资料** | **OGDL 1.0** | ✅ | 不限目的、得再转授权、与 CC BY 4.0 相容 | [data.gov.tw/license](https://data.gov.tw/license) |
| 16 | **Unicode Unihan** | **Unicode License V3** | ✅ | 明确涵盖 Data Files | [license.txt](https://www.unicode.org/license.txt) |
| 17 | CNS 11643 全字库 | 未复核 | — | **本次未查证**，见 §3.4 | — |
| 18 | CWN / g0v moedict-data / bpmfvs | 无授权档 | ❌ | 无授权＝保留所有权利 | （docs/04 已列） |

---

### §2.1 McBopomofo `WebData.ts`——MIT 覆盖资料本身吗？

**结论：覆盖，但有一个文档层面的弱点。**

已读来源：

- [`McBopomofoWeb/LICENSE.txt`](https://raw.githubusercontent.com/openvanilla/McBopomofoWeb/main/LICENSE.txt)：
  `MIT License / Copyright (c) 2022 and onwards The McBopomofo Authors`，标准 MIT 全文。
- GitHub API 回报 `license.spdx_id = MIT`，路径 `LICENSE.txt`。
- [`McBopomofoWeb/README.md`](https://raw.githubusercontent.com/openvanilla/McBopomofoWeb/main/README.md) §软件授权（原文）：

  > 本专案采用 MIT License 释出，使用者可自由使用、散播**本软体**，惟散播时必须**完整保留版权声明及软体授权**。

**判读**：MIT 授权档置于仓库根目录、无任何「仅限程序码」的限缩语句，且 README 用「本软体」概括整个专案。
**资料档与程序码同受 MIT 覆盖。**——此为法律判断。

**弱点（实测）**：我逐字读了 `data/vendor/WebData.ts` 与 `WebDataPlain.ts` 的开头——
**两个档都没有任何档头注释、没有版权行、没有授权声明、没有来源说明**，直接就是
`export const webData = JSON.parse(\`...\`)`。授权完全来自仓库根的 `LICENSE.txt`。

**上游链条（已核实）**：[`McBopomofo/Source/Data/README.md`](https://raw.githubusercontent.com/openvanilla/McBopomofo/master/Source/Data/README.md) 原文写明：

> `BPMFMappings.txt`  Multi-character phrases (2-6 chars)
> **Originally simplified from `tsi.src` of libtabe (BSD Licensed) with modifications**

→ 我们 `NOTICE` 里写的「McBopomofo 词组表源自 libtabe `tsi.src`（BSD）」**属实**。
但要注意链条长度：`libtabe(BSD) → McBopomofo BPMFMappings.txt → McBopomofoWeb WebData.ts → 我们的 bopomofo-lm.tsv`。
**每一层的版权声明我们都要保留。**

> ⚠️ 提醒：`McBopomofo` 与 `McBopomofoWeb` 的预设分支是 **`master`**，不是 `main`。
> `data/fetch-source.sh` 用的是 `McBopomofoWeb` 的 `main`（目前有效），但引用 McBopomofo 本体时要注意。

### §2.2 libchewing-data——「CC BY 4.0」是错的（★ 本次最重大发现）

**这是本次审查最重要的更正。** docs/04 第 57 行写：

> | libchewing-data | **CC BY 4.0** | ✅ | ✅ | 本仓库实测：`LICENSES/CC-BY-4.0.txt`；v4 新增注音专用 bigram |

**实测结果：`LICENSES/CC-BY-4.0.txt` 的存在不能代表整份仓库。** 我直接读每个 CSV 的档头：

| 档案 | 档头 `dc:license`（原文） |
|---|---|
| `dict/chewing/tsi.csv`（5.2 MB 主词库） | **`LGPL-2.1-or-later`** |
| `dict/chewing/word.csv` | **`LGPL-2.1-or-later`** |
| `dict/chewing/mini.csv` | **`LGPL-2.1-or-later`** |
| `dict/chewing/alt.csv` | **`LGPL-2.1-or-later`** |
| `dict/chewing_v4/tsi_dict.csv` | 无档头 → 依该目录 README 为 **CC BY 4.0** |
| `dict/chewing_v4/static_words.txt`、`rare_dict.csv`、`*.arpa` | 无档头 → **CC BY 4.0** |
| `dict/moe/moe_dict_concised.csv` | **`CC-BY-ND-3.0-TW`** |

`tsi.csv` 档头逐字：

```
# dc:title,內建詞庫,
# dc:rights,Copyright (c) 2025 libchewing Core Team,
# dc:license,LGPL-2.1-or-later,
# dc:identifier,2025.11.17,
```

**其他佐证**：

- Codeberg API 回报该仓库 `license: None`（没有可识别的顶层授权档）。
- 树状清单中**只有** `LICENSES/CC-BY-4.0.txt` 一个授权档，**没有** `REUSE.toml`、没有 `.reuse/dep5`、**没有任何 SPDX 档头**。
- 所有 `CMakeLists.txt` 都无授权标注。
- [`README.md`](https://codeberg.org/chewing/libchewing-data/raw/branch/main/README.md)（11,431 bytes）**逐字比对：全文没有任何一个「授權」「licen」「copyright」「版權」「著作權」字串**（grep 结果为空）。它是一份词库编辑教学文件。
- `LICENSES/CC-BY-4.0.txt` 经比对为标准 CC BY 4.0 法律条文（17,023 bytes），但**没有任何机制把它绑定到特定档案**。
- [`dict/chewing_v4/README.md`](https://codeberg.org/chewing/libchewing-data/raw/branch/main/dict/chewing_v4/README.md) 是唯一明确表态的地方：
  > ## License
  > This work is licensed under CC BY 4.0.

**判定**：

- `dict/chewing/*.csv` → **❌ 不可进**。这是 LGPL-2.1-or-later，不是 CC BY 4.0。
  讽刺的是，docs/04 第 27 行已经把「libchewing 本体 LGPL-2.1」列为「只读不抄」而排除——
  **但它的资料层同样是 LGPL，而文档没发现。**
- `dict/chewing_v4/*` → **🟡 有条件可进**。这是真正 CC BY 4.0 的部分，也是 docs/04 想接的东西。
- `dict/moe/` → **❌ 不可进**（见 §2.4）。

> ★ **额外风险提示**：`dict/chewing_v4/README.md` 自述 bigram 是「trained on ~16 GiB of **web-crawled** Chinese text」。
> 上游把成果标为 CC BY 4.0，但**爬取语料的来源与授权并未说明**。
> 统计模型（bigram 机率）通常被视为事实性产物、风险低于原始语料，但这是一个**残留不确定性**，
> 我们无法替上游担保。若要接，应在 `NOTICE` 里如实写出「语料为 web-crawled，来源未载明」。

### §2.3 libchewing-data `dict/moe/` 的 ATTRIBUTE——已找到并核实

docs/04 第 71 行说「libchewing 的 `dict/moe/` 就是走这条路（附完整的 ATTRIBUTE 声明）」。
**核实结果：ATTRIBUTE.md 确实存在，883 bytes，内容完整。** 原文（已读全）：

> ## 《国语辞典简编本》
> - **来源**：中华民国教育部（Ministry of Education, R.O.C.）《国语辞典简编本》
> - **版本**：2014（资料更新日期：2025-12-29）
> - **网址**：http://dict.concised.moe.edu.tw/
> - **授权**：创用 CC－姓名标示－禁止改作 台湾 3.0 版（CC BY-ND 3.0 TW）
> - **原始资料存放位置**：
>   * `sources/dict_concised_2014_20251229.zip` - 《国语辞典简编本》文字资料库
>   * `sources/conciseddict_10312.pdf` - 《国语辞典简编本》公众授权使用说明
> 本专案因实务需要，对于本资料之原始资料加以变更「轻声标注位置」、「ㄦ化音前缀空白」、「部份注音组合间补足空白分隔」，其更动符合〈公众授权使用说明〉当中「**额外授权声明**」之规定。

→ ① **ATTRIBUTE 存在且具体**，连改动项目都逐条列出（符合 CC BY 4.0/3.0 的「标明修改」义务）。
→ ② 它**没有**复制〈公众授权使用说明〉全文，而是把原始 PDF 一并放进 `sources/`。
   这可能是「保留本使用说明」的一种合规做法，但**是否足够有疑义**——见 §2.4。
→ ③ libchewing 把「变更轻声标注位置」主张为「不涉及更改个别条目所有内容之调整行为」。
   **教育部原文把「音读」列入不得修改的项目**，「轻声标注位置」是否算动到音读，**是真正的解释争议点**。
   我们不应把 libchewing 的自我判断当成已确立的合规模板。

### §2.4 教育部辞典——CC BY-ND 3.0 TW 与「额外授权声明」

**docs/04 把这一项列为「待复核」。本次已取得并读了原始 PDF**：
`dict/moe/sources/conciseddict_10312.pdf` = 《国语辞典简编本》公众授权使用说明（已用 pdftotext 抽取全文）。

**一、授权方式及范围**

> (二) 教育部《国语辞典简编本》采用「创用 CC－姓名标示－禁止改作 台湾 3.0 版授权条款」释出。
> (三) 「姓名标示」部分请标示如下：
>     中华民国教育部（Ministry of Education, R.O.C.）。《国语辞典简编本》（版本编号：　　）网址： http://dict.concised.moe.edu.tw /
> (四) **额外授权声明**：
>     依本著作权利人中华民国教育部之声明，任何使用者皆得依照「创用 CC－姓名标示－禁止改作 台湾 3.0 版授权条款」之规定，使用《国语辞典简编本》之资料与素材。
>     使用者对于《国语辞典简编本》个别条目的**词目、部首、笔画、字形、音读及释义等内容不得为任何修改，或转为简化字**。
>     惟依教育部所提供对照表内容作**字码改换**，或**不涉及更改《国语辞典简编本》个别条目所有内容之调整行为**，可不被认定构成上述禁止修改条款之拘束范围。

**二、使用者承诺事项**

> 使用者利用教育部公众授权之《国语辞典简编本》资料与素材，**无论再散布与否，都必须完整保留本使用说明**，并确认资料版本讯息；如发现原始内容错误或遗漏，应同意无偿提供完整资讯予教育部于研究及修订之参考。

**三、停止提供**（政策变更、侵害第三人权利时得随时停止）

**判定：❌ 不可进（对本专案而言）**

理由三条，逐条对应我们的实际需求：

1. **「不得转为简化字」是明文禁令，而我们有简体输出模式。**
   仓库里已经有 `data/ts-conversion.tsv`（OpenCC 简繁表）。任何把 MOE 词条送进简繁转换的管线，
   **直接违反**额外授权声明的这一句。这不是解释问题，是明文。
2. **「音读」列入不得修改的项目。** 输入法要用的正是「词」与「音读」。
   我们若为了注音格式做任何调整（轻声位置、变调处理、儿化音），都落入争议区。
   libchewing 主张它的三项改动合规，但那是**它的解释**，不是教育部的认定。
3. **「无论再散布与否，都必须完整保留本使用说明」** —— 这是一项**超出 CC BY-ND 标准义务**的要求。
   标准 CC BY-ND 只要求保留版权声明与许可；这里要求保留**整份使用说明**。
   若要合规，必须在仓库里放这份 PDF 或逐字全文。

**ND 的实际边界**（综合原文，非猜测）：

| 可以做 | 不可以做 |
|---|---|
| 字码改换（**限教育部提供的对照表**） | 改为简化字 |
| 不涉及更改条目所有内容的调整行为 | 修改词目／部首／笔画／字形／**音读**／释义 |
| 原样再散布（附完整使用说明） | 与其他资料合并运算产生新条目 |

→ **「字频统计算不算改作？」** 对 MOE 辞典而言问题不成立：这是一部**辞典**，不是语料库，
它的条目文字本身受保护。若要从它统计什么，那已经是**建立衍生资料库**，远超过「不涉及更改条目内容」。
**不要走这条路。**

### §2.5 OpenCC——Apache-2.0 确实覆盖资料档

已读来源：

- [`OpenCC/LICENSE`](https://raw.githubusercontent.com/BYVoid/OpenCC/master/LICENSE)：标准 Apache License 2.0 全文。
- [`TSCharacters.txt`](https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt) 档头逐字：

  ```
  # Open Chinese Convert (OpenCC) Dictionary
  # File: TSCharacters.txt
  # Format: key	value(s) (values separated by spaces)
  # License: Apache-2.0 (see LICENSE)
  ```

- [`TSPhrases.txt`](https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSPhrases.txt) 档头完全相同。
- [`OpenCC/README.md`](https://raw.githubusercontent.com/BYVoid/OpenCC/master/README.md) §License 许可协议：`Apache License 2.0`。
- **NOTICE 档不存在**（`https://raw.githubusercontent.com/BYVoid/OpenCC/master/NOTICE` → HTTP 404）。

**判定：✅ Apache-2.0 明确覆盖资料档**（档头自己写的，不需要推论）。**可商用、可改作、可再散布。**

**但仓库有缺口（⚠️ 已发生）**：Apache-2.0 §4(a) 要求

> You must give any other recipients of the Work or Derivative Works **a copy of this License**.

我们实测：

- 仓库**没有** `LICENSES/` 目录、**没有任何** Apache-2.0 全文档。
- `NOTICE` 第 70–71 行只写了 `Licensed under the Apache License, Version 2.0` ＋一个 URL。
- `data/ts-conversion.tsv`（34,552 bytes，OpenCC 衍生档）**已经 commit 进仓库**。

→ **「一个超连结」不等于「一份副本」。** 这是一个**已经散布出去**的合规缺口。
修正成本极低（放一份 Apache-2.0 全文进 `LICENSES/Apache-2.0.txt`），建议立即处理。

（Apache-2.0 §4(d) 要求保留上游 NOTICE 档的内容——但 OpenCC 没有 NOTICE 档，故本项不适用。）

### §2.6 wordfreq——share-alike 对我们的影响

已读来源：[`LICENSE.txt`](https://raw.githubusercontent.com/rspeer/wordfreq/master/LICENSE.txt)、
[`NOTICE.md`](https://raw.githubusercontent.com/rspeer/wordfreq/master/NOTICE.md)、
[`README.md`](https://raw.githubusercontent.com/rspeer/wordfreq/master/README.md)。

**LICENSE.txt 原文结尾**：

> This license applies to the **code only**. See NOTICE.md for particular details about the licensing of the code and the data.

**NOTICE.md 原文**：

> `wordfreq` is freely redistributable under the Apache license … and it **includes data files that may be redistributed under a Creative Commons Attribution-ShareAlike 4.0 license**.

**★★ README.md 里有一段直接针对我们这种用法的话**：

> ## Can I convert wordfreq to a more convenient form for my purposes, like a CSV file?
> **No.** The CSV format does not have any space for attribution or license information, and therefore **does not follow the CC-By-SA license**. Even if you tried to include the proper attribution in a header or in another file, someone would likely just strip it out.

→ **作者本人在 README 里明确说了「不行」。** 我们想做的事（把词频抽成 TSV 进仓库）正是这段话所禁止的形态。
这不只是条款解释，是**权利人的明确意思表示**，在争议中对我们极为不利。

**SUBTLEX 的许可覆盖到我们再散布吗？——不覆盖。** NOTICE.md 原文：

> I (Robyn Speer) **have obtained permission by e-mail from Marc Brysbaert to distribute these wordlists in wordfreq**, to be used for any purpose, not just for academic use, under these conditions:
> - **Wordfreq and code derived from it** must credit the SUBTLEX authors.
> - It must remain clear that SUBTLEX is freely available data.
> These terms are similar to the Creative Commons Attribution-ShareAlike license.

→ **许可的相对人是 wordfreq，不是公众。** 它没有变成一份对世人的公开授权。
我们从 wordfreq 拿到 SUBTLEX-CH 的数字，是**转手取得**；该许可的条件句写的是「Wordfreq 及由其衍生的程序」，
我们既非 wordfreq 也不是它的衍生程序。**这是一条断掉的授权链。**

**中文部分的额外问题**——README 原文自承：

> Miscellaneous word frequencies: in Chinese, we **import a free wordlist that comes with the Jieba word segmenter, whose provenance we don't really know**

→ wordfreq 的中文词频**有一部分来自 jieba，而连 wordfreq 作者都不知道出处**。

**判定：❌ 不可进。**

**「share-alike 会不会污染 MIT 程序？」的回答**（分三层）：

1. **程序不会被污染。** CC BY-SA 的 ShareAlike 只作用于 §1 定义的「Adapted Material」，
   即「以需要许可的方式翻译、改动、编排、转换或修改」该素材所得的产物。
   我们独立创作的 `engine/`、`core-rs/` 不是 wordfreq 的改作物，**不因此变成 BY-SA**。
   CC 自己也说：「若不需要许可（例如落入著作权的例外），该利用不受本授权管辖」。
2. **资料档会被污染（这才是真风险）。** CC BY-SA 4.0 §4(b) 原文：
   若你把资料库内容的**实质性部分**放进你自己的资料库，则**你的那个资料库**（不含其中的个别内容）
   构成 Adapted Material，因而必须依 §3(b) 以 CC BY-SA 4.0（或相容许可）释出。
   → 一旦接了 wordfreq，我们的词频档就不能再宣称 MIT。
3. **仓库整体授权会变复杂。** 我们目前是「单一 MIT」的干净状态（README 与 LICENSE 都这么宣称）。
   引入一份 BY-SA 资料档后，必须改成「逐档授权」，下游商用者要自己判断哪一档能用。
   **对一个以「可商用」为卖点的专案，这是负值。**

**但请注意**：以上第 1–2 点讨论的是**版权**。就算承审法院认为字频数字不受著作权保护、CC 授权根本不适用
（§1.2 的依据），**§1.3 的合约分析仍然独立成立**——作者在 README 里说了不准转 CSV。
**别用「事实不受保护」去绕过权利人的明文表态。**

### §2.7 中研院语料库（ASBC）——★ 本次最明确的「不可进」

**这是本次审查中条款最致命的一项。** 我取得并读了**两份原始协议书 PDF**（ACLCLP 是实际授权单位）：

- [个人版](https://aclclp.org.tw/doc/wlawf_agr_c.pdf)：平衡语料库词集及词频统计授权使用协议书-个人
- [团体版](https://aclclp.org.tw/doc/wlawf_agr_c_g.pdf)：平衡语料库词集及词频统计授权使用协议书-团体
- [英文版](http://aclclp.org.tw/doc/asbc_agr_e.pdf)：Contract for Licensing Academia Sinica Balanced Corpus

**中文个人版原文（关键四条）**：

> 一、本语料之电子型式，组成内容型式及结构与词类标记，著作权属**中央研究院词库小组**。智慧财产权属中央研究院所有，并授权社团法人中华民国计算语言学学会进行**非营利性研究授权**。
> 四、牵涉上述第一项及第二项著作内容之任何引用之**商业行为应与著作权所有人另定约**规定之。
> **五、本语料内之部份或全部内容，及其直接衍生资料（即词汇库，字/词频统计，词类统计，语法规律）不得包含或引用于任何商业产品中。**
> 六、本人**不得将本语料之全部或部份移转给第三人**。

**英文版**：

> 1. The Sinica Corpus can **only be used in academic research and cannot be used in profit-generating or commercial activities**.
> 2. The undersigned party **will not transfer all or any part of this corpus to third party**.

**团体版**同样是第五条，另加「七、甲方使用本语料以 **10 人**为限」。

**判定：❌ 不可进。且这一条直接回答了「只散布统计结果」的问题。**

**★ 第五条明文把「字/词频统计」列为「直接衍生资料」，一并禁止用于商业产品。**
我们想问的「我自己统计、只散布结果、不散布原始语料」——**中研院的协议早就预见了这个做法并明文禁止**。
这不是解释空间，是逐字列举。

而且还有第 1 项（限学术、禁商用）与第 6 项（禁移转第三人）两道独立的门，任一道都足以否决。
公开仓库散布 = 移转给第三人。

**这不是版权问题，是合约问题**（§1.3）。即使字频数字按台湾著作权法 §9(1)(3) 不受保护，
**签了这份协议的人仍然受第五条拘束。**

### §2.8 SIGHAN Bakeoff 资料集

已读：[`bakeoff_agr_c.pdf`](https://aclclp.org.tw/doc/bakeoff_agr_c.pdf)
（《SIGHAN Bakeoff 2012 繁体中文剖析资料集 授权使用协议书》）。

**与 ASBC 是同一份模板，条款编号一字不差**：

> 一、…著作权属**中央研究院词库小组**；智慧财产权属中央研究院所有，并授权中华民国计算语言学学会进行**非营利之学术研究授权**。
> 四、…任何引用之**商业行为应与著作权所有人另定约**规定之。
> **五、本资料库内之部份或全部内容，及其直接衍生资料（即词汇库，字/词频统计，词类统计，语法规律）不得包含／引用于任何商业产品中。**
> 六、本人**不得将此资料库之全部或部份移转给第三人**。

**判定：❌ 不可进。** 理由与 §2.7 完全相同。

（英文版 `bakeoff_agr_e.pdf` 本次取得时服务端回报 HTTP 503，**未取得**；但因中文版格式完整，不影响结论。）

### §2.9 jieba 自带词表

已读来源：

- [`jieba/LICENSE`](https://raw.githubusercontent.com/fxsjy/jieba/master/LICENSE)：
  `The MIT License (MIT) / Copyright (c) 2013 Sun Junyi`，标准 MIT 全文。
- [`jieba/jieba/dict.txt`](https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt) 开头**逐字**：

  ```
  AT&T 3 nz
  B超 3 n
  c# 3 nz
  ```

  → **没有任何档头注释、没有版权行、没有授权声明、没有来源说明。**
- [`jieba/README.md`](https://raw.githubusercontent.com/fxsjy/jieba/master/README.md)：
  说明了 `dict.txt` 的**格式**（词语 词频 词性），也说明了如何替换词典，
  但**全文没有任何一处交代 `dict.txt` 的来源或语料出处**（已 grep 语料／来源／corpus／人民日报，无相关段落）。
- **第三方旁证**：wordfreq 的作者（同为再散布者）在其 README 里写：
  > in Chinese, we import a free wordlist that comes with the Jieba word segmenter, **whose provenance we don't really know**

**判定：❌ 不可进（来源不明）。**

**推理链**：MIT 授权是著作权人对其**自己拥有权利的作品**所给的许可。
但 `dict.txt` 里的词频数字**从何统计而来，仓库完全没有交代**。
Sun Junyi 授出 MIT 时，**未必拥有（或未必能证明拥有）这批词频的权利**——
一个著作权人无法就其不拥有的素材有效授权。
这不是说 jieba 有问题，而是说：**我们无法从现有文件建立一条可追溯的授权链**，
而 §1.1-C 的判准把「来源不明」列为绝对不可进。

**若要用，需要一份上游从未提供的溯源文件。** 在拿到之前不动。

> 注：网路常见说法指 jieba 词表源自某语料库，但**我查不到 jieba 仓库内的任何声明支持这一点**，
> 依纪律不写入本文。**「查不到」。**

### §2.10 THUOCL（清华）——「声称可商用」核实结果

**核实结论：声称属实。** 已读 [`THUOCL/README.md`](https://raw.githubusercontent.com/thunlp/THUOCL/master/README.md) §开源协议 原文：

> 1. THUOCL 面向国内外大学、研究所、企业、机构以及个人免费开放，**可用于研究与商业**。
> 2. 欢迎对该工具包提出任何宝贵意见和建议。请发邮件至 thunlp@gmail.com。
> 3. 如果您在 THUOCL 基础上发表论文或取得科研成果，请您在发表论文和申报成果时声明「使用了清华大学开放中文词库」，并按如下格式引用：
>    中文： 韩世依, 张钰晖, 马云山, 涂存超, 郭志芃, 刘知远, 孙茂松. THUOCL：清华大学开放中文词库. 2016.

仓库根目录另有 [`LICENSE`](https://raw.githubusercontent.com/thunlp/THUOCL/master/LICENSE)：`MIT License / Copyright (c) 2018 THUNLP`。

**但语料来源需要单独看**。README 自述词频统计语料库为：

> 1. **CSDN 博客** 时间：2014.07-2016.07 文档数：3785976
> 2. **新浪新闻** 时间：2008.01-2016.11 文档数：8421097
> 3. **搜狗语料** 文档数：729008561

**判定：🟡 有条件可进。**

- ✅ 条款层面：授权明文包含商业使用，MIT 覆盖，署名要求清楚（学术引用格式已给出）。
- ⚠️ 残留风险：**词表是从 CSDN、新浪新闻、搜狗语料统计而来的**。
  THUOCL 能授出的，是它对这张表所拥有的权利；它**不能**替 CSDN／新浪／搜狗担保。
  搜狗语料尤其常见于「仅限研究」的授权语境。**「表本身干净」不等于「统计来源干净」。**
- ⚠️ 结构限制：THUOCL 是「词 ＋ DF 值」，**没有注音**。要用在注音输入法，读音必须另找来源，
  而那个来源又有自己的授权——**这会变成一个新的授权链问题。**
- 建议：若要接，只取 THUOCL 的**词与 DF**，在 `NOTICE` 里如实写出语料来源，并把它当**补充**而非**基底**。

### §2.11 中文维基百科 dump

已读来源：

- [`dumps.wikimedia.org/legal.html`](https://dumps.wikimedia.org/legal.html)（Wikimedia 官方 dump 授权说明），原文：

  > all information on Wikimedia projects may be freely shared, copied, remixed, and used for **any purpose (including commercial purposes!)** in perpetuity.
  > ## Text
  > Except as discussed below, all original textual content is licensed under the **GNU Free Documentation License (GFDL)** and the **Creative Commons Attribution-Share-Alike 4.0 License**. Some text may be available only under the Creative Commons license; see our Terms of Use for details.
  > ## Exceptions → **Wikidata**: Copyrights of structured data in the main, Property, Lexeme, and EntitySchema namespaces are **waived using the Creative Commons Zero (CC0)** public domain dedication.

  该页同时声明：**「This is a high-level guide only. Where this information conflicts with specific information in the Wikimedia Foundation Terms of Use … Those terms are controlling.」**
- [`Wikipedia:Copyrights`](https://en.wikipedia.org/wiki/Wikipedia:Copyrights)：确认 `License text (CC BY-SA 4.0, GFDL)`，并载明
  > Everyone already has permission to edit and reuse article text under open content licenses by the authors, as long as their use complies with the licensing terms, gives proper attribution, and **licenses any changes under the same terms**.

**判定：🟡 有条件可进。** 商用明确许可。争点在 share-alike。

**「统计字频后散布结果，算不算改作？要不要 share-alike？」**

这里要分两层，**并且必须诚实说这是不确定的**：

**第一层（著作权）**：若我们产出的只是一张「字 → 次数」的表，且其**选择与编排无创作性**，
依台湾著作权法 §9(1)(3)（数表不得为著作权之标的）与 §10-1（保护仅及表达），
以及 Feist 的 fact/expression dichotomy，这张表**不受著作权保护**。
而 CC 授权自己说：「若不需要许可……该利用不受本授权管辖」。
→ 在这个进路下，**share-alike 不触发**。

**第二层（风险）**：这个进路**不是没有争议**：
- 我们做的是**全量抽取**（整个 dump 的每一个字），不涉及「选择」，但「编排」与统计方法可能被主张有创作性。
- **CC BY-SA 4.0 §4(b)** 明确处理资料库：若把资料库内容的**实质性部分**放进我们的资料库，
  我们的那个资料库就是 Adapted Material → 必须 BY-SA。**我们的字频表算不算「我们的资料库」？有可能。**
- 欧盟 sui generis database right 独立于著作权存在（Directive 96/9/EC §7(4)）。
- **维基百科是众人协作、逐页有编辑历史的作品集合**，「统计结果不是改作」的主张在实务上未必被接受。

→ **这是法律判断，且我明确说：我不确定。** 见 §3.4 法务清单。

**给工程的安全做法**（不必先解决法律争议）：

1. **优先改用 Wikidata**——主命名空间的**结构化资料是 CC0**，完全绕开 share-alike。
   （但注意：`legal.html` 也声明 ToU 优先，且 Wikidata 的标签／描述在部分命名空间是 CC BY-SA 4.0。）
2. 若坚持用维基百科文字 dump：**把统计表独立成一个档案**，在 `NOTICE` 里：
   标明「本档依 CC BY-SA 4.0 释出」、附署名、附 dump 版本日期与来源 URL、
   说明「由中文维基百科 dump 统计而成，已修改（原为文章，此处为统计结果）」。
   **宁可多标一个 BY-SA，不要少标。** 多标无害，少标是违约。
3. 绝不把维基统计结果与 `bopomofo-lm.tsv`（MIT）**混在同一档**——那会让整档的授权状态不明。

### §2.12 人民日报语料、SIGHAN bakeoff

**SIGHAN bakeoff**：见 §2.8，**❌ 不可进**。

**人民日报标注语料库**：已读来源为[富士通中国官方新闻稿（2001-08-29，存档页）](https://info.archives.global.fujitsu/cn/about/resources/news/press-releases/2001/0829.html)，原文：

> 北京大学计算语言学研究所和富士通研究开发中心有限公司，**得到人民日报社新闻信息中心的许可**，从1999年4月起，共同制作1998年全年2600万汉字的「人民日报标注语料库」。
> …首先在**大学、研究所等限定的范围内**，从2001年8月28日起，**有偿公开**现已完成的1998年上半年的「人民日报标注语料库」（约1,300万字＝约730万词）。公开范围将逐步扩大。
> 据了解，半年「人民日报标注语料库」的光碟由**人民日报新闻信息中心负责销售**，1300万字高质量的现代汉语标注语料库的售价只有人民币2000元。

**判定：❌ 不可进。**

三条独立的否决理由：
1. **有偿**——需付费购买，且销售方是人民日报社。
2. **限定范围**——「大学、研究所等限定的范围内」，非公开授权。
3. **无开放授权**——全文未出现任何开放许可（CC／MIT／Apache 等），默认即保留所有权利。

另注：**新时代人民日报语料库（NEPD）**（[corpus.njau.edu.cn](http://corpus.njau.edu.cn/)）是另一份资料，
**本次未查证其授权条款**——不要把它与 1998 年这份混为一谈。

### §2.13 台湾政府资料开放平台（data.gov.tw）

见 §1.1-A，已读 [data.gov.tw/license](https://data.gov.tw/license) **全文**（政府资料开放授权条款第 1 版，中华民国 104 年 7 月 27 日订定）。

**判定：✅ 可进**（四项门全过，且**明文允许再转授权**）。

关键条款已在 §1.1-A 引用，此处补两点工程上要注意的：

1. **「不限目的」= 可商用**，且「非专属、不可撤回、免授权金」。
2. **必须做显名声明**，格式固定（附件所示）。
   第三条(二) 原文警告：
   > 使用者利用依本条款提供之开放资料，及后续之衍生物，应以符合附件所示「显名声明」要求之方式，明确标示原资料提供机关之相关声明；**未尽显名标示义务者，视为自始未取得开放资料之授权。**

   → **「自始未取得授权」是很重的后果**：不是「补标就好」，而是回头认定你从来没被授权过。**必须一开始就标对。**
3. **注意例外**：并非 data.gov.tw 上所有资料集都用 OGDL。
   个别机关可能指定其他条款（第六条免责声明、第四条(一)也保留了机关订明特定版本的空间）。
   **每一份资料集都要单独看它的授权栏位**，不要假定整个平台一致。

### §2.14 CNS 11643 全字库（本次未复核）

docs/04 第 59 行称 CNS 11643 采「政府资料开放授权条款第 1 版（OGDL-1.0）」且授权清单明列「字型属性档：注音」。

**本次未能查证**：我没有取得 `cns11643.gov.tw` 的授权清单原文。

→ **状态：未核实。** 若 OGDL-1.0 确实适用，则依 §2.13 它是 ✅ 可进，
但**必须先读到该站的授权声明原文**再引用。**不要照抄 docs/04 的这一行当作已核实。**

---

## （三）具体建议与风险

### 3.1 若我们要换字频来源，怎样做才既合法又能散布？

**核心原则：把「资料」与「统计结果」分开处理，因为两者的法律地位不同。**

**方案一（推荐）：换到干净的上游，而不是清洗脏的上游。**

按 §1.1 的四门标准，可用的组合是：

| 层 | 建议来源 | 授权 | 备注 |
|---|---|---|---|
| 读音（注音） | **Unihan**（Unicode License V3）或**自建** | ✅ | 明确涵盖 Data Files，署名放 NOTICE 即可 |
| 词条基底 | **McBopomofo**（现用，MIT） | ✅ | 已经验证，别动 |
| bigram／词频补充 | **libchewing-data `dict/chewing_v4/`**（CC BY 4.0） | 🟡 | 需完整署名七要件；语料来源未载明 |
| 简繁 | **OpenCC**（Apache-2.0） | ✅ | 补上许可全文即可 |
| 政府语言资料 | **data.gov.tw OGDL-1.0** | ✅ | 按附件格式做显名声明 |
| 补充词表 | **THUOCL**（MIT ＋ 自述可商用） | 🟡 | 无注音，需另配读音；语料来源要如实写 |

**方案二：只散布衍生表并附署名。**

对**允许改作**的来源（CC BY 4.0、Apache-2.0、MIT），这可行，义务是：

1. 依 CC BY 4.0 §3(a) 的**七项**逐项满足（尤其**第 6 项「标明你改了什么」**最常被漏）。
2. 放在 `NOTICE` 里，**逐档一节**，而不是笼统一段。
3. **分档授权**：在 `NOTICE` 里明确写出「本档为 MIT／本档为 CC BY 4.0」，
   并修改 README 的授权叙述，不要再用「整份专案 MIT」一句话带过。

对**禁止改作或禁止商用**的来源（ASBC、SIGHAN、人民日报、MOE 辞典），**不可行**，
理由见 §2.7、§2.8、§2.12、§2.4——**它们的禁制是合约性的，不因「结果只是统计数字」而消失。**

### 3.2 「自己在本地从合法语料统计，只把统计结果提交进仓库」可行吗？

**可行，且这是本专案最干净的路——但「合法语料」的定义比想像中窄。** 逐类回答：

| 语料类型 | 本地统计 → 只提交结果 | 说明 |
|---|---|---|
| **中研院 ASBC** | ❌ **不行** | 协议第五条**明文把「字/词频统计」列为「直接衍生资料」，禁止用于商业产品**（§2.7） |
| **SIGHAN bakeoff** | ❌ **不行** | 同一条款，一字不差（§2.8） |
| **人民日报语料** | ❌ **不行** | 有偿＋限定范围，无开放授权（§2.12） |
| **MOE 辞典** | ❌ **不行** | ND ＋ 不得转简体 ＋ 音读不得修改（§2.4） |
| **wordfreq** | ❌ **不行** | 作者明文禁止转 CSV；SUBTLEX 许可不传递（§2.6） |
| **公有领域 / CC0 语料** | ✅ **可以** | 无义务 |
| **CC BY 4.0 语料** | ✅ **可以** | 完整署名（七要件） |
| **OGDL-1.0 政府语料** | ✅ **可以** | 显名声明 |
| **中文维基百科 dump** | 🟡 **可以但需谨慎** | 建议该档直接标 CC BY-SA 4.0（§2.11） |
| **自有语料 / 自有授权语料** | ✅ **可以** | 无义务 |

**★ 关键洞察**：ASBC 与 SIGHAN 的协议**第 5 条就是专门为「我自己统计、只散布结果」这个想法写的**。
它们把「词汇库、字/词频统计、词类统计、语法规律」逐项列举为「直接衍生资料」，一并禁止。
**这条抗辩路线已经被上游预先封死。**

**署名义务怎么处理（对可用的来源）**：

1. **统计脚本一并 commit**（例如 `data/build-freq.mjs`），里面写清楚：
   语料名称、版本／取得日期、来源 URL、统计方法、以及**输出的授权**。
   脚本本身就是最好的溯源文件。
2. **不要 commit 原始语料**——`data/vendor/` 已经 `.gitignore` 了（实测 `.gitignore` 第 2 行 `data/vendor/`），
   **这个做法是对的，继续保持**。原始语料不进版控，只进衍生结果。
3. **在 `NOTICE` 里为该档开一节**，内容：来源专案名 ＋ 版权行 ＋ 许可名 ＋ 连结 ＋
   **「我们修改了：由原始语料统计为字频表」**这一句（CC BY 4.0 §3(a)(1)(B) 的「indicate if You modified」）。
4. **若某档是 BY-SA**：单独一档、单独标 BY-SA 4.0、绝不与 MIT 档混合。

### 3.3 ★ 我们目前可能已经踩到或即将踩到的坑

#### 坑 1（已发生）：OpenCC 衍生档已散布，但没有 Apache-2.0 全文

- **事实**：`data/ts-conversion.tsv`（34,552 B）已 commit；`NOTICE` 只给了 URL。
  实测仓库**没有** `LICENSES/` 目录、**没有任何** Apache-2.0 全文。
- **违反**：Apache-2.0 §4(a) 要求「give … **a copy of this License**」。
- **风险等级**：中。**技术性违约，修正成本极低**，但若不修，下游商用者会拿到一份不完整的授权。
- **修法**：新增 `LICENSES/Apache-2.0.txt`（OpenCC LICENSE 全文），在 `NOTICE` 里指向它。

#### 坑 2（已写在文档里，尚未发生）：`docs/04` 对 libchewing-data 的授权标注错误

- **事实**：docs/04 第 57 行称整份 libchewing-data 是 **CC BY 4.0**；
  第 91、141 行据此推荐它作为 McBopomofo 的替代。
  但实测 `dict/chewing/*.csv` 是 **LGPL-2.1-or-later**，`dict/moe/` 是 **CC BY-ND 3.0 TW**。
- **风险等级**：**高**。这是**尚未发生但已被写进决策文件**的错误。
  下一个人照 docs/04 去接 `tsi.csv`，就会把 LGPL-2.1-or-later 的 5.2 MB 词库 commit 进 MIT 公开仓库。
- **讽刺之处**：docs/04 第 27 行已经正确地排除了「libchewing **本体** LGPL-2.1」，
  却没发现**它的资料层也是 LGPL**——同一个专案、同一个授权，只是换了目录。
- **修法**：更正 docs/04 第 57、91、141 行，改为逐目录列出：
  `dict/chewing/` = LGPL-2.1-or-later（❌）、`dict/chewing_v4/` = CC BY 4.0（🟡）、`dict/moe/` = CC BY-ND 3.0 TW（❌）。

#### 坑 3（已发生，程度较轻）：MIT 的「许可全文」义务是否满足，有疑义

- **事实**：`LICENSE` 是 MIT，但版权行写的是 **grandocean**（我们自己）。
  `NOTICE` 里对 McBopomofo 只写了
  `Copyright (c) 2022 and onwards The McBopomofo Authors.` ＋ `Licensed under the MIT License.`
  ——**没有附上 MIT 的许可段落本体**。
- **可能的违反**：MIT 的条件是「The above copyright notice **and this permission notice** shall be included in all copies」。
  「this permission notice」指的是 MIT 的整段授权文字，不只是版权行。
  目前 McBopomofo 的版权行与 MIT 的授权文字**分别在不同档案、挂在不同版权人之下**。
- **风险等级**：低—中。实务上同一散布物内含两份文件常被认为足够，
  但**严格解释下，版权行与许可文字应当成对出现**。
- **修法**：在 `NOTICE` 的 McBopomofo 段落里，直接内嵌 MIT 全文（10 行，成本极低）。
  顺便把 libtabe 的 BSD 声明也补成全文。

#### 坑 4（即将发生）：教育部辞典的「不得转为简化字」与我们的简体输出模式

- **事实**：我们有 `data/ts-conversion.tsv` 与简繁输出功能；
  MOE 额外授权声明明文「**……不得为任何修改，或转为简化字**」（§2.4）。
- **风险等级**：高（**若**未来接 MOE 资料）。
  docs/04 第 82 行说「若未来需要更完整的词条覆盖，再依法务确认的范围接入」——
  **这个方向有明文地雷**。若要接，任何经过简繁转换的路径都必须切断。
- **修法**：在 docs/04 里把这一条写成**硬性禁令**，而不是「依法务确认」。

#### 坑 5（需持续警戒）：CC BY 4.0 的「标明修改」义务

- 我们现用资料是 MIT，暂无此问题。但**一旦接入 `dict/chewing_v4/`**，
  CC BY 4.0 §3(a)(1)(B) 要求「indicate if You modified the Licensed Material **and retain an indication of any previous modifications**」。
  把 ARPA 转成 TSV、裁剪 `keep_frac`、与自有词表合并——**每一项都要写出来**。
- libchewing 的 `dict/moe/ATTRIBUTE.md` 是**好范本**（逐条列出三项改动）。

#### 坑 6（结构性）：仓库目前宣称「单一 MIT」，与引入 CC 资料不相容

- `README.md` 与 `LICENSE` 目前让读者以为整份仓库是 MIT。
- 一旦有任何 CC BY／CC BY-SA 资料档进入，**必须改成逐档授权**，
  并让 `NOTICE` 成为权威的授权地图。
- 建议：在 `NOTICE` 开头加一句总纲——
  「本仓库程序码为 MIT；`data/` 下的个别资料档另有授权，**逐档列明如下**」。

### 3.4 建议交由法务复核的清单

以下结论**超出工程判断范围**，且我已明确标注不确定处：

1. **台湾著作权法 §9(1)(3)「数表」的射程。**
   一份「词 → 次数」的统计表，是否当然落入「数表」而不得为著作权之标的？
   **这是我的法律判断，不是定论。** 应交法务确认 §9 在资料库情境下的适用。
2. **维基百科 dump 统计结果的定性。**
   全量统计是否构成 CC BY-SA 4.0 §1 的「Adapted Material」？是否触发 §4(b) 的资料库条款？
   **我明确不确定。** 这是本报告中最需要法务意见的一项。
3. **欧盟 sui generis database right 对我们产品的适用性。**
   若在欧洲销售，我们的字频表是否构成对上游资料库的「extraction / re-utilization」？
   第 7 条第 5 项（反复抽取非实质部分）的边界在哪？
4. **ASBC／SIGHAN 协议第 5 条的合约效力范围。**
   若我们**从未签署**该协议，而以其他途径取得资料，第五条是否仍能拘束我们？
   （涉及第三人效力与侵权干扰问题——**我无从判断**。）
5. **libchewing `dict/moe/` 的自我认定是否成立。**
   libchewing 主张「变更轻声标注位置」属于「不涉及更改个别条目所有内容的调整行为」。
   但教育部原文把「**音读**」列入不得修改项。**这是解释争议，不是事实问题。**
6. **上游「授权标注错误」的责任分配。**
   若上游把 LGPL 资料标成 CC BY 4.0（或反过来），
   依错误标注而使用的下游使用者，责任如何分配？**这是法律问题。**
7. **`docs/04` 中关于 CNS 11643 的叙述未经本次核实**（见 §2.14），引用前须自行查证原文。

### 3.5 待办（按优先级）

| 优先级 | 动作 | 成本 |
|---|---|---|
| **P0** | 更正 `docs/04` 对 libchewing-data 的授权标注（坑 2） | 低（改三行） |
| **P0** | 补 `LICENSES/Apache-2.0.txt`（坑 1） | 极低（放一个档） |
| **P1** | 在 `NOTICE` 内嵌 MIT / BSD 全文（坑 3） | 极低 |
| **P1** | 在 `docs/04` 把 MOE「不得转简体」写成硬性禁令（坑 4） | 低 |
| **P2** | 在 `NOTICE` 开头加「逐档授权」总纲（坑 6） | 低 |
| **P2** | 把本报告的判定标准（§1.1）抽成 `docs/` 的检核清单，未来接入任何资料前先过一遍 | 中 |
| **P3** | 核实 CNS 11643 授权原文（§2.14） | 中 |

---

## 附录：本次实际读取的原始文件清单

**已读原文（授权档／声明）**

- McBopomofoWeb `LICENSE.txt`、`README.md`
- McBopomofo `Source/Data/README.md`（默认分支 `master`）
- libchewing-data `dict/chewing/{tsi,word,mini,alt}.csv` 档头、`dict/moe/moe_dict_concised.csv` 档头、
  `dict/chewing_v4/{README.md,tsi_dict.csv,static_words.txt,rare_dict.csv}`、
  `dict/moe/ATTRIBUTE.md`、`LICENSES/CC-BY-4.0.txt`、`README.md`、各 `CMakeLists.txt`
- `dict/moe/sources/conciseddict_10312.pdf`（《国语辞典简编本》公众授权使用说明，pdftotext 全文）
- OpenCC `LICENSE`、`README.md`、`data/dictionary/{TSCharacters,TSPhrases}.txt` 档头
- wordfreq `LICENSE.txt`、`NOTICE.md`、`README.md`
- jieba `LICENSE`、`README.md`、`jieba/dict.txt` 档头
- THUOCL `LICENSE`、`README.md`
- Unicode `license.txt`
- CC BY 4.0 legalcode、CC BY-SA 4.0 legalcode
- data.gov.tw 政府资料开放授权条款第 1 版（全文）
- 台湾著作权法 §7、§9、§10-1（全国法规资料库）
- Feist Publications v. Rural Telephone Service, 499 U.S. 340 (1991)（Cornell LII）
- Directive 96/9/EC 第 3、5、7 条及前言（legislation.gov.uk 保留欧盟法）
- ACLCLP：ASBC 个人版／团体版／英文版授权协议书、SIGHAN Bakeoff 2012 授权协议书
- Wikimedia `dumps.wikimedia.org/legal.html`、`Wikipedia:Copyrights`
- `crr.ugent.be`（Brysbaert 的网站下线公告）
- 富士通中国 2001-08-29 新闻稿（人民日报标注语料库）

**尝试但未取得**

- `https://eur-lex.europa.eu/...CELEX:31996L0009`（多次尝试均回应 HTTP **202** 且内容为空，
  改由 legislation.gov.uk 的保留欧盟法版本取得第 7 条原文）
- `http://aclclp.org.tw/doc/bakeoff_agr_e.pdf`（HTTP **503**）
- `https://crr.ugent.be/programs-data/subtitle-frequencies/subtlex-ch`（HTTP **404**，原站已下线）
- CNS 11643 授权清单（**未查证**，见 §2.14）

**使用过但不适用于本文的检索工具**

- `research/tools/s.py`（DuckDuckGo lite）本次所有查询均回传 0 笔结果，**已改用其他途径**。
  若后续要再用，需先确认该端点的可用性。
