# 接手这个项目 —— 从这里开始

> **给新会话的第一份文件。** 如果你是刚被叫来接手的 agent，读完这一页再动手。
>
> 项目：**跨平台注音（Bopomofo / Zhuyin）输入法**
> 位置：`/home/rchua/GO/pingzhu`
> 语言：**全程用中文回复。**

---

## 一、现在接着干什么

### 1.1 数字键那件 —— ✅ 已完成（2026-09-29）

**★ 先读这份，它写清了当初的状态、判据、以及结案过程：**

```
docs/HANDOFF-数字键.md
```

当时是：**数字键的语义**（注音键 ↔ 选字键）改到一半，
TypeScript 66/66 通过，**Rust 差异测试还没跑** —— 那正是被打断的那一步。

```bash
cd /home/rchua/GO/pingzhu
export PATH="$HOME/.cargo/bin:$PATH"

git diff                                     # 看当前改动（4 个文件未提交）
cd engine && node --test                     # 应 66/66
cd ../core-rs && cargo test --release        # ★ 差异测试，1529 例
```

**★ 已经跑完了 ✗ 结果在下面，不必再跑一次 ✓**

```
TS 66/66 · Rust 29/29（26 单测 ＋ 差异 1529 例 ＋ 交互 152 例 ＋ fuzz 冒烟）
提交：35b9239（行为改动）· 2762f6b（交接文件）· 8a3cf21（更正）
```

**接手时实际撞到的三件事**（都不在原文档预期内 ✗）：

1. **差异测试红了 3 处，不是 2 处** —— 漏了 `ne3cl3`
2. **`scenarios.tsv` 那份 fixture 文档根本没提到** —— 只改断言不可能全绿
3. **§5 那条线索是错的** —— `grep v0.6.0` 返回空（它是 tag 不是提交信息），
   而截断处读反了原意：v0.6.0 是把数字键规则**做错**了，不是做好了。
   结论：**六个实作不需要动。**

### 1.2 macOS 签章那件 —— ★ 进行中，卡在付款（2026-09-29）

**★ 这是另一条线 ✗ 与数字键无关 ✓** —— 也正因为无关，
`docs/HANDOFF-数字键.md` 里**一个字都没有** ✗，别去那里找 ✓

**现在的状态：**

| 步骤 | 状态 |
|---|---|
| 在 Mac mini 上发现系统不列出平注 | ✅ |
| 六个变量逐个排除，定位到「签章必须是 Apple 签发的」 | ✅ 实测 |
| 刷脸身份验证 | ✅ 昨天过了 |
| **付费入会（Developer Program）** | ❌ **卡在付款** ← 这里 |
| 拿 Developer ID 证书 → `notarize.sh` → `install.sh` | 待付款之后 |

**要读的是 `macos/README.md`** ✗ 不是 `docs/` ✓ —— 实测表格与结论都在那里：

```
| ad-hoc，呼叫 API（从 app 内部） | ✗ noErr，系统列出 0 个   ← 0.9.1 |
| Apple 签发 ＋ 公证 ＋ 呼叫 API  | ← 还没测，这是 notarize.sh  |
```

**★ 结论已经写在文档里了：横竖都得要开发者签章 ✗
不必再论证「免费能不能绕」✓ —— 那条路两个半边都实测过了（README 有）。**

### ★ 现在的实际卡点：等一台镜头能用的 iPhone（预计 10/8）

入会要**扫脸身份验证** ✗，而这一步**只能在 iPhone 上用 Developer App 做** ✓
—— **Mac mini 没有镜头** ✓。手边那台 iPhone **镜头坏了** ✗，所以要等换机。

**★ 这不是能加速的等待 ✗ 但卡的位置很清楚 ✓：**

```
✅ 扫脸验证本身      —— 在一台正确的机器上成功过一次
❌ 付款             —— 中国区 Apple ID ＋ 美版机
                      ★ Developer App 才是微信／支付宝那条路 ✗
                        网页端那条实测过不去 ✓
⏸ 换一台好 iPhone    —— 预计 10/8 到公司
→ 之后：Developer ID 证书 → notarize.sh → install.sh
```

**★ 这九天里这条线动不了 ✓ 但 1.1（引擎）已完成 ✓ 所以不必再碰 ✓**

付款之后的命令（**帐号自己填** —— 公开仓库不写个人邮箱）：

```bash
export PINGZHU_APPLE_ID="you@example.com"   # 会员归属的那个 Apple ID
export PINGZHU_TEAM_ID="…"                  # 证书括号里那 10 个字符
export PINGZHU_NOTARY_PASSWORD="xxxx-xxxx-xxxx-xxxx"
bash macos/notarize.sh                      # 签章 ＋ 公证，一条命令
```

**★ 0.9.1 的 release artifact 是 09-28 建的 ✗ 不含 09-29 的引擎改动 ✓
（`composing()` 由 `ㄕㄨ [2]` 改成 `ㄕㄨ [ㄉ]`）。要一起验就从原始码建 ✓**

### 1.3 资料层那件 —— ★ 进行中（2026-10-01 派出四位研究员）

**背景（一句话）**：使用者是**台湾与海外的注音使用者**，所以资料层要**台湾正体字
语域**。现用资料继承自 McBopomofo（MIT），其字频根源是 libtabe 的 `tsi.src`
（旧台湾语料），而它在「見／建」这类排序上是可疑的 ✓

**★ 已确认的问题**：同读 ㄐㄧㄢˋ 的 `見` 与 `建`，现用资料认为 `建` 更常用，
但**现行** libchewing data、`chewing_v4` 的 unigram、以及台湾国教院汉字表
都认为 `見` 更常用 ✓

**★ 四个来源的实测数字（2026-10-01 逐一核实，不是转述）**：

| 来源 | 見 | 建 | 見/建 |
|---|---|---|---|
| **平注现用**（McBopomofo 衍生 LM） | −3.456 | **−3.333** | ✗ 反了 |
| `tsi.csv` 现行 libchewing（频次栏） | 25,457 | 15,457 | 1.65× |
| `tsi_unigram.arpa`（chewing_v4） | −3.372 | −3.589 | 見 高 |
| `bigram_p50.arpa` unigram 段 | −3.566 | −3.660 | 見 高 |
| 国教院《台湾华语文能力基准汉字表》 | 1,334/百万 | 628/百万 | **2.12×** |

**★ 所以：平注继承的是旧版 `tsi.src` 的排序，现行上游已经修过来了 ✓**
（`tsi.csv` 里 `見,25457` 与 `件,25456` 只差 1，像是手工微调而非语料重算 ——
这条序的来历仍不明 ✓）

**★ 已实测、且是结论的东西**（这些不必重做）：

| 结论 | 出处 |
|---|---|
| 大千式与倚天式键位与 libchewing 逐键一致（41 键、0 分歧） | `research/tools/keymap-compare.mjs` |
| 按键代价 = **0.086 额外键/例**（空白送出 91.39%） | 见下「验收标准」 |
| libchewing v4 bigram 数字属实，但**不能直接拿来用** | `research/tools/bigram-trial.mjs` ＋ `docs/04` |

**★ 台湾公家资源的授权现况**（研究员 1 查证，`research/05`）：

```
✅ 国教院开放宣告：无偿、非专属、得再授权、可开发各种产品，免书面授权
   ⚠️ 但 coct 子网域页尾写「版权所有 All rights reserved」← 与宣告冲突
   → 要用就先发函 corpus@mail.naer.edu.tw 取一纸确认（比事后补救便宜）
✅ 教育部四部辞典：CC BY-ND 3.0 TW，明示「包括商业性利用」
   ⚠️ 但 17 栏里没有任何频率栏位 ← 解决读音与释义，不解决「谁更常用」
❌ 中研院全体系（ASBC 等）：协议第五条明文禁止「字/词频统计」入商业产品
❌ ACLCLP、国科会 NDAP、各大学语料库：限非商业
❌ 工研院：查不到任何开放语言资源（研究员扫过官网所有 href、API 回 404）
```

**★ 中研院那条是红线，而且封死了「只散布统计结果」这条规避路线** ✓
协议第五条逐字把「词汇库、**字/词频统计**、词类统计」列为「直接衍生资料」
一并禁止 ✓ 所以「自己统计、只提交结果」对这份资料**不行** ✓

**★ 授权陷阱（务必注意）**：libchewing-data 是**逐目录多授权** ✗
`dict/chewing/`（5.2 MB 主词库）是 **LGPL-2.1-or-later** ✓
`dict/moe/` 是 **CC BY-ND 3.0 TW** ✓
**只有 `dict/chewing_v4/` 才是 CC BY 4.0** ← 我们用的 bigram 在这个目录里 ✓
详见 `docs/04-data-and-licensing.md` 的专节 ✓

**★ 四位研究员的产出**（派出时各自独立、无写冲突）：

```
research/05-tw-institutional-corpora.md   台湾公家与研究机构（工研院、中研院、国教院、教育部…）
research/06-cn-nlp-corpora.md             中国搜索引擎与 NLP 机构（百度、搜狗、腾讯、清华、北大、中科院、哈工大…）
research/07-character-frequency-sources.md 字词频表与相关产品（wordfreq、SUBTLEX-CH、RIME、libpinyin…）
research/08-data-licensing-review.md      授权合规审查：什么能进这个公开仓库
```

### ★ 验收标准（这一节最要紧，别搞错）

**资料层改动的验收标准是「按键代价下降」，不是「首选正确率上升」** ✓

```
使用者要的字符 → 必须能用按键打到（候选表里有）      ← 硬需求
不用管它排第几 → 排第一省一个键，排第十多按一个键    ← 软成本
```

**所以：任何资料替换，验收看「0.086 键/例」是否下降，且没有新增打不到的字 ✓**

**不要用「首选正确率」当标准** ✗ —— 那 258 例同音歧义里有多少是「该改的」，
**无从判断**：两份资料一份偏向高频虚词（`吧`、`把`、`比`），一份偏向内容词，
两种口径都说得通 ✓ 按它验收会把口径差异误读成进步或退步 ✓

---

## 二、已经有的东西 —— 别重做

### 2.1 四份深度调研（5,048 行，09-26 完成）

**★ 在 `research/`，不在 `docs/`。两份都读，别只读 docs。**

| 文件 | 行数 | 内容 |
|---|---|---|
| `research/01-iqt-natural-ime.md` | 642 | 竞品：台湾自然输入法（IQT）全解析 |
| `research/02-opensource-stack.md` | 483 | 可复用的开源元件 + 授权条款 |
| `research/03-platform-ime-frameworks.md` | 1417 | 四平台接入（Windows / macOS / Android / HarmonyOS NEXT） |
| `research/04-zhuyin-ime-internals.md` | **2506** | ★ 最强的一份：引擎内部、算法、UX |

**`04` 里有几件直接能用的东西：**

```
· 合法音节表 —— 从 506,778 个 token 实测出来的
    429 个无声调（清理后 408）· 1,413 个含声调
    ★ 与文献常引的 411 相差 3
· 大千式键位表 —— 三方交叉验证过（RIME xlit / libchewing / 维基）
· 两个可直接抄的公式
    词频   log10(2.7^(len-1) × occ / norm)      ← McBopomofo, MIT
    学习   +10/+5/+1，上限 9999999，排序 max(内建, user)  ← libchewing
· MIT 开放数据
    BPMFMappings.txt (145,603) · phrase.occ (161,806) · BPMFBase.txt (26,535)
· 教育部辞典 = CC BY-ND 3.0 TW，官方说明不限制格式转换与后续应用
```

### 2.2 设计文档（9 份，在 `docs/`）

```
01-competitive-analysis.md      02-architecture.md        03-platform-matrix.md
04-data-and-licensing.md        05-roadmap.md             06-engine-design.md
07-research-tooling.md          08-self-built-data.md     09-zhuyin-vs-pinyin.md
```

### 2.3 已验证的键位（用真引擎跑出来的，不是猜的）

```
gj        → 書
gjbj4     → 輸入
su3cl3    → 你好
ji394su3  → 我愛你
w96j0     → 台灣
```

大千式要点：`g = ㄕ`，`j = ㄨ`，所以 `gj = ㄕㄨ`。
**`sj` 打不出「书」** —— `s = ㄋ`，`sj = ㄋㄨ` → 奴/努/女。

---

## 三、项目结构

```
pingzhu/
  core-rs/      Rust 核心（引擎）
  engine/       TypeScript 规格（参照实现）
  docs/         设计文档 + 交接文档
  research/     ★ 四份深度调研（5,048 行）
  data/         数据
  android/      Android 前端
  harmonyos/    HarmonyOS 前端
  demo/  dist/
```

**★ `core-rs` 和 `engine` 之间有 1,529 例**差异测试**钉住行为一致。
只改一边它会红 —— 那是它的设计目的，不是故障。**

---

## 四、纪律（这个项目自己的，不是通用建议）

```
① 每条结论带来源 URL —— 没依据的不写，不填"大概"
② ★ 用真引擎验证，不凭记忆
   原会话的写法：「我用真引擎验证过 ✓（不是凭记忆 ✓）」
③ 差异测试红了先看是哪一边 —— 它钉的是"两边一致"，不是"某一边对"
④ 改断言之前先想清楚：是代码错了，还是断言记录了旧行为
```

---

## 五、为什么会有这份文件

原会话（`跨平台注音输入法Original`）跑到 **turn 221 之后被 DeepSeek API
以 `Content Exists Risk` 拒绝，此后每一轮都失败**，连两个字的消息也发不出去。
触发点没定位到，但历史里带着它。

**★ 所以把状态落成了文件。文件比会话活得久。**

四个 subagent 当时写的调研也是一样 —— 会话归档了，但
`research/` 里那 5,048 行还在。**这就是"先落盘，再深挖"的意思。**
