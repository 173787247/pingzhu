# 注音输入法（Bopomofo IME）内部技术规格：演算法与使用者体验

> 版本：2026-09-26
> 用途：可直接交付工程师实作的技术规格素材
> 语言：繁体中文（台湾用语）

---

## 0. 研究方法与可信度声明

### 0.1 检索环境异常（重要）

本次调查期间，**`web_search` 工具故障**：所有查询皆回传
`DeepSeek returned an unprocessable response body: SyntaxError: Unexpected token 'e', "e PZ ..."`
（搜寻端点 `https://api.deepseek.com/anthropic/v1/messages` 回传非 JSON 的二进位内容）。
`net_doctor` 显示 HTTPS 连线本身正常（`api.deepseek.com` 回 401 可达），故为搜寻后端问题，非网路问题。

实际采用的替代检索路径（皆已实测成功）：

| 路径 | 用法 | 成功率 |
|---|---|---|
| `obscura_fetch` | `https://html.duckduckgo.com/html/?q=<urlencoded>`，`dump=links`/`text`，**务必带 `timeoutSec: 60~120`** | 中（连线不稳，需重试） |
| `web_fetch` | 一般公开 https 页面 | 高 |
| `curl`（走 proxy `127.0.0.1:16006`） | GitHub raw、API、PDF、大批档案 | 高 |
| `pdftotext` | 论文 PDF 取文 | 高 |

**已确认无效**：Bing（HTML 无结果、RSS 对中文查询回传无关广告）、Mojeek（captcha）、
Brave（429）、Ecosia（403）、Yep（403）、DuckDuckGo lite/html 直连（captcha）、
GitHub code search API（需认证 401）、GitHub git/trees API（60/hr 速率限制）。
**建议**：改用 GitHub **codeload tarball**（`https://codeload.github.com/<o>/<r>/tar.gz/refs/heads/master`）抓整个 repo，不受 API 速率限制。

### 0.2 可信度分级

| 标记 | 意义 |
|---|---|
| ✅ 实测 | 本报告自行下载资料档并以程式统计、或逐行核对原始码 |
| 📗 官方 | 政府／标准组织／专案官方文件 |
| 📄 学术 | 同侪审查论文 |
| ⚠️ 需查证 | 未取得一手来源，或不同来源互相矛盾 |

### 0.3 本报告的「实测」基准资料集

以下档案皆已实际下载并统计（见第 6 节）：

| 档案 | 来源 | 大小 | 行数 |
|---|---|---|---|
| `BPMFBase.txt` | `openvanilla/McBopomofo` `Source/Data/` | 720,832 B | 26,535 |
| `BPMFMappings.txt` | 同上 | 5,019,395 B | 145,603 |
| `phrase.occ` | 同上 | 1,768,276 B | 161,806 |
| `heterophony{1,2,3}.list` | 同上 | — | 528 / 66 / 17 |
| `exclusion.txt` | 同上 | 33,600 B | 1,754 |
| `BPMFPunctuations.txt` | 同上 | 49,572 B | 1,952 |
| `Symbols.txt` | 同上 | 38,720 B | 1,447 |
| `essay.txt` | `rime/rime-essay` | 5,887,319 B | 442,688 |
| `terra_pinyin.dict.yaml` | `rime/rime-terra-pinyin` | 1,799,483 B | 99,329（资料列） |

---

## 1. 注音基础

### 1.1 符号总数与分类（术语校正）

**常见误述**：「37 个注音符号 = 21 声母 + 16 韵母」。
**精确说法**（[注音符号 - 维基百科](https://zh.wikipedia.org/wiki/%E6%B3%A8%E9%9F%B3%E7%AC%A6%E8%99%9F)）：
**37 = 21 声母 + 3 介音 + 13 韵母**；口语把「介音 + 韵母 = 16」合称韵母并无错误，但实作时必须把介音独立一类，
因为它决定音节结构的自动机状态（见 1.3）。

| 类别 | 数量 | 符号 | Unicode |
|---|---:|---|---|
| 声母 | 21 | ㄅㄆㄇㄈ ㄉㄊㄋㄌ ㄍㄎㄏ ㄐㄑㄒ ㄓㄔㄕㄖ ㄗㄘㄙ | U+3105–U+3119 |
| 介音 | 3 | ㄧ ㄨ ㄩ | U+3127, U+3128, U+3129 |
| 韵母 | 13 | ㄚㄛㄜㄝ ㄞㄟㄠㄡ ㄢㄣㄤㄥ ㄦ | U+311A–U+3126, U+3126 |
| **合计** | **37** | | U+3105–U+3129 |

📗 官方依据：教育部《国语注音符号手册》
<https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/index.html>
（该页自述 EPUB／HTML 内嵌的「教育部标准楷书」「教育部标准宋体」采 **CC BY-ND 3.0 TW** 授权）

历史沿革（实作时影响「哪些符号要支援」）：

| 年份 | 事件 |
|---|---|
| 1913 | 读音统一会选定 39 个字母 |
| 1918 | 教育部正式公布注音字母 |
| 1920 | 增字母「ㄜ」，共 40 个 |
| 1922 | 声调符号由四角点法改标于字母右方（即今日横式写法） |
| 1928 | 「ㄧㄨㄩ」改列于「ㄦ」之后 |
| 1930 | 改称「注音符号」 |
| **1932** | 废弃「ㄪ、ㄬ、ㄫ」3 个符号（仅存方言用），增加轻声「˙」→ **成为今日 37 符号形式** |
| 1932 | 另添「ㄭ」作为 ㄓㄔㄕㄖㄗㄘㄙ 单独成音节时的空韵说明符（未列入正式符号表） |

> **工程重点**：`ㄭ`（U+312D）不在 37 符号内，但**输入法必须把 ㄓㄔㄕㄖㄗㄘㄙ 单独成节视为合法**，
> 这是初学者最常打错、也是初版引擎最常漏掉的一条规则（见 1.3）。

### 1.2 声调系统

📗 依据：教育部《国语注音符号手册》（2000 年 11 月，ISBN 957-02-7324-0）

| 名称 | 阴平声 | 阳平声 | 上声 | 去声 | 轻声 |
|---|---|---|---|---|---|
| 顺序 | 一声 | 二声 | 三声 | 四声 | （不列入四声） |
| 符号 | `ˉ`（**通常不标**） | `ˊ` | `ˇ` | `ˋ` | `˙` |
| Unicode | U+02C9 | U+02CA | U+02C7 | U+02CB | U+02D9 |
| 汉语拼音 | （无） | ˊ | ˇ | ˋ | （无，或不标） |
| 调值（五度标记） | 55 | 35 | 214 | 51 | 轻短 |

> ⚠️ 这 5 个符号位于 Unicode **Spacing Modifier Letters** 区段（U+02B0–U+02FF），
> 不是「占位修饰符号」本身；轻声 `˙` 的摆放规则：**直书时标于整个字音上方，横书时标于整个字音前方**。
> 输入法内部储存建议一律正规化为「声调放最后」，并在输出／显示层依书写方向重排。

### 1.3 音节结构规则（可直接写成 DFA）

```
音節 := 聲母? 介音? 韻母? 聲調?
限制 1：聲母、介音、韻母 三者至少有一個非空
限制 2：ㄓㄔㄕㄖㄗㄘㄙ 可單獨成節（空韻 ㄭ，輸入時不打 ㄭ）
限制 3：ㄦ 只能單獨成節，不與任何聲母組合
限制 4：介音僅 ㄧㄨㄩ（各 0 或 1 個，不可並排）
限制 5：韻母僅 13 個（各 0 或 1 個，不可並排）
限制 6：聲調只能出現在音節最末
```

**组合爆炸与剪枝**：若不做限制，`(1+21)(1+3)(1+13)(1+5) = 22 × 4 × 14 × 6 = 7,392`
种字串形式；实际合法者仅 ~1,400，**合法率约 19%**。这就是「非法注音序列」侦测的基础。

### 1.4 合法音节表：实测结果（本报告原创统计）✅

以 `BPMFBase.txt`（单字）+ `BPMFMappings.txt`（词）共 **506,778 个音节 token** 解析统计：

| 指标 | 数值 |
|---|---:|
| 相异**无声调**音节 | **429** |
| 相异**含声调**音节 | **1,413** |
| 解析失败 token 种类 | 4（仅 `ˇ ˋ ˊ ˙` 四个裸露声调符号） |

其中 21 个为边缘／杂讯项（出现次数 ≤ 3）：

```
雜訊（單一注音字母，來自 BPMFBase 的字母條目，非合法音節）：
  ㄅ ㄆ ㄇ ㄈ ㄉ ㄊ ㄋ ㄌ ㄍ ㄎ ㄏ ㄐ ㄑ ㄒ  （各 1 次）

邊緣但真實存在的音節：
  ㄆㄧㄚ(1) ㄈㄧㄠ(1) ㄋㄨㄣ(1) ㄓㄟ(2) ㄙㄟ(1) ㄝ(2) ㄟ(2) ㄥ(2) ㄧㄜ(3)
```

**清理后：429 − 21 = 408 个无声调音节**，与文献常引的「**411 个国语音节**」相差 3。
两者差异来自：本表只涵盖 McBopomofo 词库实际出现者，少数极罕用音节（如某些方言借音、拟声词）未收录。
👉 **建议工程实作直接采用 408 这个「资料驱动」清单**，并保留一个可扩充的补充槽；
不要硬编 411 而导致罕用字无法输入。⚠️ 「411」的确切官方出处**需查证**
（教育部《国语注音符号手册》未见明文列出音节总数）。

**各声母可接音节数**（✅ 实测，依注音符号顺序）：

| 声母 | 音节数 | 声母 | 音节数 | 声母 | 音节数 |
|---|---:|---|---:|---|---:|
| ㄅ | 18 | ㄏ | 20 | ㄕ | 19 |
| ㄆ | 19 | ㄐ | 15 | ㄖ | 14 |
| ㄇ | 20 | ㄑ | 15 | ㄗ | 17 |
| ㄈ | 11 | ㄒ | 15 | ㄘ | 16 |
| ㄉ | 23 | ㄓ | 20 | ㄙ | 17 |
| ㄊ | 20 | ㄔ | 19 | （零声母） | 39 |
| ㄋ | 26 | ㄍ | 20 | | |
| ㄌ | 27 | ㄎ | 19 | | |

**各韵母可接音节数**（✅ 实测）：

| 韵母 | ㄚ | ㄛ | ㄜ | ㄝ | ㄞ | ㄟ | ㄠ | ㄡ | ㄢ | ㄣ | ㄤ | ㄥ | ㄦ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 音节数 | 32 | 21 | 17 | 18 | 25 | 27 | 30 | 26 | **50** | 44 | 33 | 48 | **1** |

其他统计：**含介音的音节 227 个**；各声调音节数 阴平 358、阳平 270、上声 351、去声 375、轻声 59。

> **工程重点**：
> 1. `ㄈ` 只有 11 个音节、`ㄦ` 只有 1 个 → 可作为输入法「快速键」设计的空隙。
> 2. `ㄢ` 家族最大（50）→ 候选字最多的痛点在此。
> 3. 轻声仅 59 个音节 → 轻声键可低优先度处理。

### 1.5 注音 ↔ 汉语拼音对应

**一级来源**（✅ 已取得，含 IPA、威妥玛、通用拼音、注音二式、耶鲁、法国远东学院、德国式、国语罗马字）：

- 维基百科〈现代标准汉语拼音对照表〉<https://zh.wikipedia.org/wiki/%E7%8F%BE%E4%BB%A3%E6%A8%99%E6%BA%96%E6%BC%A2%E8%AA%9E%E6%8B%BC%E9%9F%B3%E5%B0%8D%E7%85%A7%E8%A1%A8>
  （wikitext 115,209 B；表头栏位：`漢語拼音方案 / 國語注音符號第一式 / 華語通用拼音 / 威妥瑪拼音 / 國語注音符號第二式 / 耶魯拼音 / 法國遠東學院拼音 / 德國式拼音 / 國語羅馬字(陰平陽平上聲去聲) / IPA / Note`）
- 维基百科〈注音符号〉的「符号字源及发音」表，逐符号给出 **IPA / 汉语拼音 / 威妥玛拼音 / 例字**

**⚠️ 实作警告：声母对应不能一对一硬编。** 注音是「声母 + 介音 + 韵母」，拼音有大量缩写与变形。
RIME 的 `zhuyin.yaml`（`rime/rime-bopomofo`）给出了**完整且可执行的转换代数** ✅，
这是本报告最推荐直接抄用的资产：

```yaml
# 節錄自 rime/rime-bopomofo → zhuyin.yaml
pinyin_to_zhuyin:
  __append:
    - xform/^m(\d)$/mu$1/        # 呣
    - xform/^r5$/er5/            # 〜兒
    - xform/iu/iou/
    - xform/ui/uei/
    - xform/ong/ung/
    - xform/^yi?/i/
    - xform/^wu?/u/
    - xform/iu/v/
    - xform/^([jqx])u/$1v/
    - xform/([iuv])n/$1en/
    - xform/^zhi?/Z/             # 整體認讀音節
    - xform/^chi?/C/
    - xform/^shi?/S/
    - xform/^([zcsr])i/$1/
    - xform/ai/A/                # 複韻母壓成單字母（內部碼）
    - xform/ei/I/
    - xform/ao/O/
    - xform/ou/U/
    - xform/ang/K/
    - xform/eng/G/
    - xform/an/M/
    - xform/en/N/
    - xform/er/R/
    - xform/eh/E/
    - xform/([iv])e/$1E/
```

> 注意：RIME 这里的 `Z C S` 代表「ㄓㄔㄕ 的空韵」整体，`A I O U K G M N R E` 是内部压缩码，
> 最后再由 `keymap_bopomofo` 一次 `xlit` 映射到注音（见第 2 节）。

**注音↔拼音的关键不规则对照**（人工整理，皆可由上表验证）：

| 注音 | 拼音 | 说明 |
|---|---|---|
| ㄓㄔㄕㄖ（单独） | zhi chi shi ri | 空韵，拼音写 `-i` |
| ㄗㄘㄙ（单独） | zi ci si | 空韵 |
| ㄧㄨㄩ（单独成节） | yi wu yu | 拼音加母音或改写 |
| ㄩ 开头 | yu / ju / qu / xu / nü / lü | `ü` 的两种写法 |
| ㄧㄡ | you / iu | 前加声母时省略 o |
| ㄨㄟ | wei / ui | 前加声母时省略 e |
| ㄨㄣ | wen / un | 同上 |
| ㄧㄢ | yan / ian | 音值 [iɛn]，非 [ian] |
| ㄥ | -eng / -ong | 依声母条件分化 |
| ㄦ | er | 儿化韵 `r5` |

---

## 2. 键盘排列

### 2.1 标准（大千）式：完整 37 键 + 声调键 mapping ✅

**三方交叉验证**（三份独立来源完全一致）：

1. RIME `bopomofo.schema.yaml` 的 `xlit` 字串
2. libchewing `src/editor/zhuyin_layout/standard.rs` 的 `key_press` match 表
3. 维基百科〈注音输入法〉「大千注音对应表」

RIME 原始 `xlit`（左右一一对应）：

```
keymap: 1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347
symbol: ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˉˊˇˋ˙
```

**完整键位表（可直接贴进程式码）**：

| 实体键 | 注音 | 类别 | 实体键 | 注音 | 类别 |
|---|---|---|---|---|---|
| `1` | ㄅ | 声母 | `q` | ㄆ | 声母 |
| `2` | ㄉ | 声母 | `w` | ㄊ | 声母 |
| `3` | ˇ | **上声** | `e` | ㄍ | 声母 |
| `4` | ˋ | **去声** | `r` | ㄐ | 声母 |
| `5` | ㄓ | 声母 | `t` | ㄔ | 声母 |
| `6` | ˊ | **阳平** | `y` | ㄗ | 声母 |
| `7` | ˙ | **轻声** | `u` | ㄧ | 介音 |
| `8` | ㄚ | 韵母 | `i` | ㄛ | 韵母 |
| `9` | ㄞ | 韵母 | `o` | ㄟ | 韵母 |
| `0` | ㄢ | 韵母 | `p` | ㄣ | 韵母 |
| `-` | ㄦ | 韵母 | `a` | ㄇ | 声母 |
| `s` | ㄋ | 声母 | `d` | ㄎ | 声母 |
| `f` | ㄑ | 声母 | `g` | ㄕ | 声母 |
| `h` | ㄘ | 声母 | `j` | ㄨ | 介音 |
| `k` | ㄜ | 韵母 | `l` | ㄠ | 韵母 |
| `;` | ㄤ | 韵母 | `z` | ㄈ | 声母 |
| `x` | ㄌ | 声母 | `c` | ㄏ | 声母 |
| `v` | ㄒ | 声母 | `b` | ㄖ | 声母 |
| `n` | ㄙ | 声母 | `m` | ㄩ | 介音 |
| `,` | ㄝ | 韵母 | `.` | ㄡ | 韵母 |
| `/` | ㄥ | 韵母 | `Space` | ˉ | **阴平（一声）** |

> ✅ **口诀验证**：把注音符号表由上而下、由左而右依序铺在键盘上即得此排列。
> 因此「声母→介音→韵母」的输入方向永远是「从左到右」，不需要额外心智模型。

**大千式的设计优缺点**（📗 维基百科 + 一般认知）：

| 优点 | 缺点 |
|---|---|
| 占有率极高，实体键盘多已印制 | 声调键在最上排，手指移动距离最远 |
| 初学者只需熟记注音符号表顺序 | ㄢㄣㄤㄥ 落在小指外侧，右手吃力 |
| 声韵分离 → 支援**并击**（chorded input）加速 | 占用数字键与部分符号键，打数字需切换 |
| ㄐㄑㄒㄓㄔㄕ 置于键盘中央，交给较有力的食指 | |
| 多数双拼情形为左右手轮流，符合交替敲击 | |

### 2.2 其他排列：完整对照

#### 2.2.1 倚天 41 键（Et）✅ 三方验证

资料来源：libchewing `et.rs` + 维基百科。设计逻辑为**威妥玛拼音**（少数为字形相似，如 ㄨ↔X、ㄩ↔U）。

| 键 | 注音 | 键 | 注音 | 键 | 注音 | 键 | 注音 |
|---|---|---|---|---|---|---|---|
| A | ㄚ | H | ㄏ | O | ㄛ | V | ㄍ |
| B | ㄅ | I | ㄞ | P | ㄆ | W | ㄝ |
| C | ㄒ | J | ㄖ | Q | ㄟ | X | ㄨ |
| D | ㄉ | K | ㄎ | R | ㄜ | Y | ㄡ |
| E | ㄧ | L | ㄌ | S | ㄙ | Z | ㄠ |
| F | ㄈ | M | ㄇ | T | ㄊ | `1` | ˙ |
| G | ㄐ | N | ㄋ | U | ㄩ | `2` | ˊ |
| | | | | | | `3` | ˇ |
| | | | | | | `4` | ˋ |
| `7` | ㄑ | `8` | ㄢ | `9` | ㄣ | `0` | ㄤ |
| `-` | ㄥ | `=` | ㄦ | `;` | ㄗ | `'` | ㄘ |
| `,` | ㄓ | `.` | ㄔ | `/` | ㄕ | `Space` | ˉ |

#### 2.2.2 倚天 26 键（Et26，官方名「忘形 26 键」）✅

**这是「有状态」的排列**：同一个键在不同音节位置输出不同符号。
libchewing 以 `ALT_TABLE`（基础→替代清单）实作：

```rust
// libchewing src/editor/zhuyin_layout/et26.rs
const ALT_TABLE: &[(Syllable, &[Syllable])] = &[
    (OU, &[P]), (ANG, &[T]), (C, &[EH]), (Z, &[EI]),
    (ZH, &[J]), (ER, &[H]), (ENG, &[L]), (SH, &[X]),
    (G, &[Q]), (EN, &[N]), (AN, &[M]),
    (D, &[TONE5]), (F, &[TONE2]), (R, &[TONE3]), (K, &[TONE4]),
];
```

**「无声母/介音 → 读前项；已有声母或介音 → 读后项」的键**（✅ 读 `et26.rs` 原始码）：

| 键 | 无声母/介音时 | 有声母或介音时 |
|---|---|---|
| `h` | ㄏ | ㄦ |
| `l` | ㄌ | ㄥ |
| `m` | ㄇ | ㄢ |
| `n` | ㄋ | ㄣ |
| `p` | ㄆ | ㄡ |
| `q` | ㄗ | ㄟ |
| `t` | ㄊ | ㄤ |
| `w` | ㄘ | ㄝ |

**固定键**：`a`=ㄚ `b`=ㄅ `c`=ㄒ `d`=ㄉ `e`=ㄧ `f`=ㄈ `g`=ㄐ `i`=ㄞ `j`=ㄖ `k`=ㄎ `o`=ㄛ `r`=ㄜ `s`=ㄙ `u`=ㄩ `v`=ㄍ `x`=ㄨ `y`=ㄔ `z`=ㄠ

**声调键**（只在音节非空、且尚无介音/韵母时生效）：`f`=ˊ `j`=ˇ `k`=ˋ `d`=˙ `Space`=ˉ

**额外的声母自动转换**（重要！这是 26 键能收敛到 26 键的关键）：
- ㄐㄑㄒ 后面接 ㄨ 或无介音的韵母时 → 自动转成 ㄓㄔㄕ
- ㄓㄔㄕ 后面接 ㄧ 或 ㄩ 时 → 自动转成 ㄐㄑㄒ
- ㄍ／ㄓ／ㄕ 在音节收尾时 → 自动转成 ㄑ／ㄐ／ㄒ（另见许氏）

#### 2.2.3 IBM 式 ✅ 三方验证

| 键 | 注音 | 键 | 注音 | 键 | 注音 | 键 | 注音 |
|---|---|---|---|---|---|---|---|
| A | ㄧ | H | ㄜ | O | ㄘ | V | ㄤ |
| B | ㄥ | I | ㄗ | P | ㄙ | W | ㄑ |
| C | ㄣ | J | ㄝ | Q | ㄐ | X | ㄢ |
| D | ㄩ | K | ㄞ | R | ㄓ | Y | ㄕ |
| E | ㄒ | L | ㄟ | S | ㄨ | Z | ㄡ |
| F | ㄚ | M | ˊ | T | ㄔ | `1`–`0` | ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎ |
| G | ㄛ | N | ㄦ | U | ㄖ | `-` `;` `,` `.` `/` | ㄏ ㄠ ˇ ˋ ˙ |

> 观察：IBM 式把**声母横向排在数字列**（ㄅ–ㄎ），是「横向铺注音符号表」的变体。

#### 2.2.4 精业式（GinYieh）✅ 三方验证

| 键 | 注音 | 键 | 注音 | 键 | 注音 | 键 | 注音 |
|---|---|---|---|---|---|---|---|
| A | ˇ | H | ㄕ | O | ㄟ | V | ㄏ |
| B | ㄒ | I | ㄛ | P | ㄣ | W | ㄆ |
| C | ㄌ | J | ㄘ | Q | ˊ | X | ㄈ |
| D | ㄋ | K | ㄜ | R | ㄍ | Y | ㄔ |
| E | ㄊ | L | ㄠ | S | ㄇ | Z | ˋ |
| F | ㄎ | M | ㄙ | T | ㄐ | `1` | ˙ |
| G | ㄑ | N | ㄖ | U | ㄗ | `-` | ㄧ |
| | | | | | | `[` | ㄨ |
| | | | | | | `'` | ㄩ |
| `=` | ㄦ | `2` | ㄅ | `3` | ㄉ | `6` | ㄓ |
| `8` | ㄚ | `9` | ㄞ | `0` | ㄢ | `;` | ㄤ |
| `,` | ㄝ | `.` | ㄡ | `/` | ㄥ | `Space` | ˉ |

#### 2.2.5 许氏键盘（Hsu）✅ 读 libchewing `hsu.rs` 原始码

发明者为**许闻廉**教授（自然输入法作者）。只用 25 键，保留 `Q` 作输入法切换。
**这是大千式之外最需要「有状态编辑器」的排列**，因为大量键位取决于音节已输入的内容。

**三层规则**：

层 1 — 固定键（无条件）：

| 键 | 注音 | 键 | 注音 | 键 | 注音 | 键 | 注音 |
|---|---|---|---|---|---|---|---|
| b | ㄅ | d | ㄉ | f | ㄈ | i | ㄞ |
| j | ㄓ | o | ㄡ | p | ㄆ | r | ㄖ |
| s | ㄙ | t | ㄊ | u | ㄩ | v | ㄔ |
| w | ㄠ | x | ㄨ | y | ㄚ | z | ㄗ |

层 2 — 条件键（`has_initial_or_medial()` 为真时走后者）：

| 键 | 音节开头 | 已有声母/介音 |
|---|---|---|
| a | ㄘ | ㄟ |
| e | ㄧ | ㄝ（且需已有介音） |
| g | ㄍ | ㄜ |
| h | ㄏ | ㄛ |
| k | ㄎ | ㄤ |
| l | ㄌ | ㄥ |
| m | ㄇ | ㄢ |
| n | ㄋ | ㄣ |

层 3 — **收尾键（end key）**：`s` `d` `f` `j` `Space` 在音节非空时不输出字母，而是「结束音节 + 给声调」：

| 收尾键 | 声调 |
|---|---|
| `Space` | ˉ（一声） |
| `d` | ˊ |
| `f` | ˇ |
| `j` | ˋ |
| `s` | ˙（轻声） |

层 4 — **收尾时的自动音节修正**（若尚无介音与韵母，声母被重新诠释）：

| 已输入声母 | 收尾时转为 |
|---|---|
| ㄐ (j) | ㄓ |
| ㄑ (q) | ㄔ |
| ㄒ (x) | ㄕ |
| ㄏ (h) | ㄛ（韵母） |
| ㄍ (g) | ㄜ（韵母） |
| ㄇ (m) | ㄢ（韵母） |
| ㄋ (n) | ㄣ（韵母） |
| ㄎ (k) | ㄤ（韵母） |
| ㄌ (l) | ㄦ（韵母） |

层 5 — **模糊音修正**（双向）：
- ㄍ + ㄧ／ㄩ → ㄐ
- ㄓㄔㄕ + ㄧ／ㄩ → ㄐㄑㄒ
- ㄐㄑㄒ + ㄨ，或 ㄐㄑㄒ + 无介音韵母 → ㄓㄔㄕ

> **设计洞见**：许氏把「ㄑ」实作为「`v`（ㄔ）+ ㄧ/ㄩ → 自动转 ㄑ」，
> 因此维基百科表上写「V=ㄑ」是**简化表示**；实作必须按上述状态机，
> 否则打不出「去（ㄑㄩˋ）」「七（ㄑㄧ）」。**这是移植许氏键盘最常见的错误。**

#### 2.2.6 神通式

完全采用**汉语拼音**排列（倚天用威妥玛、许氏用混合）。优点是熟悉汉语拼音者可立即盲打。

| 键 | 注音 | 键 | 注音 | 键 | 注音 | 键 | 注音 |
|---|---|---|---|---|---|---|---|
| A | ㄚ | H | ㄏ | O | ㄛ | V | ㄩ |
| B | ㄅ | I | ㄟ | P | ㄆ | W | ㄨ |
| C | ㄘ | J | ㄐ | Q | ㄑ | X | ㄒ |
| D | ㄉ | K | ㄎ | R | ㄖ | Y | ㄧ |
| E | ㄜ | L | ㄌ | S | ㄙ | Z | ㄗ |
| F | ㄈ | M | ㄇ | T | ㄊ | | |
| G | ㄍ | N | ㄋ | U | ㄡ | | |
| `1` | ˙ | `2` | ˊ | `3` | ˇ | `4` | ˋ |
| `5` | ㄞ | `6` | ㄠ | `7` | ㄢ | `8` | ㄣ |
| `9` | ㄤ | `0` | ㄥ | `-` | ㄦ | `;` | ㄝ |
| `,` | ㄓ | `.` | ㄔ | `/` | ㄕ | `Space` | ˉ |

#### 2.2.7 大千 26 键（DaiChien 26 / DC26）✅ 读 libchewing `dc26.rs`

以「同键不冲突」为原则把大千式压到 26 键，**依音节位置选择**：

| 键 | 位置判断 |
|---|---|
| `q` | ㄅ／ㄆ（依 initial 是否已存在） |
| `w` | ㄉ／ㄊ |
| `t` | ㄓ／ㄔ |
| `i` | ㄛ／ㄞ（依 rime） |
| `o` | ㄟ／ㄢ（依 rime） |
| `l` | ㄠ／ㄤ（依 rime） |
| `p` | ㄣ／ㄦ（依 rime） |
| `b` | ㄖ／（依 has_initial_or_medial） |
| `n` | ㄙ／（同上） |
| `u` | ㄧ/ㄨ/ㄩ 多义，依 medial 与 rime 组合决定 |
| `m` | ㄩ 多义，依 medial 与 rime 组合决定 |
| 声调 | `e`=ˊ `r`=ˇ `d`=ˋ `y`=˙（`Space`=ˉ） |

**固定键**：`a`=ㄇ `z`=ㄈ `s`=ㄋ `x`=ㄌ `e`=ㄍ `d`=ㄎ `c`=ㄏ `r`=ㄐ `f`=ㄑ `v`=ㄒ `g`=ㄕ `y`=ㄗ `h`=ㄘ `j`=ㄨ `k`=ㄜ

### 2.3 排列方式优缺点总表

| 排列 | 键数 | 是否声韵分离 | 可否并击 | 主要优点 | 主要缺点 |
|---|---:|---|---|---|---|
| 大千（标准） | 41 | ✅ | ✅ | 占有率最高；与符号表同构；可并击 | 声调键远；ㄢㄣㄤㄥ 落在小指 |
| 倚天 41 | 41 | ✅ | ✅ | 依威妥玛拼音，英打者易上手 | 占用大量数字键；遗产系统 |
| 倚天 26 | 26 | ❌ | ❌ | 26 键即可；不需数字键 | 需状态机；无法并击；学习曲线陡 |
| IBM | 41 | ✅ | ✅ | 声母集中数字列 | 与大千相近但分布较不直觉 |
| 精业 | 41 | ✅ | ✅ | 声调键在字母列（手指近） | 排列逻辑不统一 |
| 许氏 | 25 | ❌ | ❌ | 25 键；符合英文肌肉记忆；易盲打 | 需 5 层状态规则；无法并击；移植易错 |
| 神通 | 41 | ✅ | ✅ | 完全汉语拼音，拼音使用者零成本 | 台湾使用者少 |
| 大千 26 | 26 | ❌ | ❌ | 保留大千逻辑感 | 需状态机；文献与支援最少 |

> **给 MVP 的建议**：**只实作大千式（标准式）**，并把键盘排列抽象成
> `trait SyllableEditor { fn key_press(&mut self, ev: KeyboardEvent) -> KeyBehavior; }`
> （libchewing 的介面，见 3.2）。日后新增许氏／倚天 26 只是多一个 impl，
> 不需改动上层编辑器。**大千式覆盖 >95% 台湾使用者**，是唯一必要的排列。

---

## 3. 输入流程与资料结构

### 3.1 整体管线

```
實體按鍵 (keycode, modifier)
   │
   ▼  [鍵盤排列層]  KeyboardLayout / SyllableEditor      ← 第 2 節
注音符號事件 (Bopomofo: 聲母|介音|韻母|聲調)
   │
   ▼  [音節緩衝層]  Syllable（音節狀態機、合法性檢查、並擊判定）
合法音節序列  [syl1, syl2, ..., sylN]
   │
   ▼  [切詞/翻譯層]  Segmentor + Translator（DP / Viterbi / beam search）
候選詞序列    [(word, score), ...]  每段可能有 k 個候選
   │
   ▼  [重排層]  LM 加權 + 使用者詞頻 + 破音字優先序 + postprocess 規則
最終候選清單  [cand1, cand2, ...]
   │
   ▼  [輸出層]  自動選字（直接上屏）或手動選字（候選視窗）
```

**两层分离是关键**：`SyllableEditor`（键位→符号）与 `Translator`（符号→词）必须解耦，
否则新增键盘排列会污染语言模型层。libchewing 即采此架构 ✅
（`src/editor/zhuyin_layout/*.rs` 与 `src/dictionary/*` 完全分离）。

### 3.2 注音序列 → 音节

#### 3.2.1 合法性判定（DFA）

```python
INITIAL = set('ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ')   # 21
MEDIAL  = set('ㄧㄨㄩ')                                        # 3
RIME    = set('ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ')                       # 13
TONE    = set('ˉˊˇˋ˙')                                        # 5（ˉ 可省）
APICAL  = set('ㄓㄔㄕㄖㄗㄘㄙ')                                 # 可單獨成節

def parse_syllable(s: str):
    """回傳 (initial, medial, rime, tone)；非法回 None。O(n)。"""
    tone = None
    if s and s[-1] in TONE:
        tone, s = s[-1], s[:-1]
    i = m = r = ''
    for ch in s:
        if   ch in INITIAL and not (i or m or r): i = ch
        elif ch in MEDIAL  and not (m or r):      m = ch
        elif ch in RIME    and not r:             r = ch
        else:                                     return None      # 順序錯或重複
    if not (i or m or r):        return None                       # 空音節
    if not m and not r and i not in APICAL: return None            # 只有 ㄅ 不合法
    if r == 'ㄦ' and (i or m):   return None                       # ㄦ 不與他符組合
    return (i, m, r, tone)
```

> ⚠️ **`ㄦ` 的例外**：儿化韵在口语中存在（如「花儿」），但**标准书面注音**中 ㄦ 不与声母组合。
> 儿化词请走独立词条（如 `花兒 ㄏㄨㄚ-ㄦ`），不要放宽 DFA。

#### 3.2.2 音节边界切分（给「模拟打字」与「连续输入」用）

注音没有分隔符，因此**引擎必须自己判断音节边界**。三种业界做法：

| 做法 | 说明 | 采用者 |
|---|---|---|
| **贪婪 / 最长匹配** | 依 DFA 能收敛的最长前缀即为一个音节；遇声调符号强制断句 | libchewing、多数引擎 |
| **显式分隔符** | 使用者按 `'`（RIME `delimiter: "'"`）或 `-` 强制断句 | RIME 注册表 |
| **DP 动态规划** | 对整串音节做所有可能切分的联合搜寻，取全域最佳 | 高阶引擎（见 3.3） |

RIME 的 schema 明确设定了分隔符 ✅：

```yaml
# rime-bopomofo / bopomofo.schema.yaml
speller:
  alphabet: '1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347'
  initials: '1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-'
  finals:   " 6347"          # 空格 + 6 3 4 7 = 聲調鍵
  delimiter: "'"
  use_space: true            # 空格 = 一聲
```

**自动断句的核心演算法**（贪婪 + 回溯）：

```
輸入: 符號流 tokens[]
輸出: 音節列表
i = 0
while i < len(tokens):
    best = 最長的 j 使得 parse_syllable(tokens[i:j]) 合法
    if best is None:            # 非法序列 → 錯誤更正/提示
        觸發 fuzzy correction 或拒絕按鍵
    emit parse_syllable(tokens[i:best])
    i = best
```

> **重点**：`parse_syllable` 的「顺序不可颠倒」正是大千式能自动断句的原因。
> 例如输入 `ㄇㄚˇㄇㄚ` → DFA 在 `ˇ` 时强制收尾，自然切成 `ㄇㄚˇ` + `ㄇㄚ`。
> 但**许氏／倚天 26 因键位有状态**，收尾键（end key）必须明示，见 2.2.2、2.2.5。

### 3.3 音节序列 → 词（转换问题）

#### 3.3.1 形式化

给定注音音节序列 `S = s₁s₂…sₙ`，求
`W* = argmax_W P(W | S) ∝ argmax_W P(S | W) · P(W)`

- `P(S|W)`：由词库的标音决定，合法词条为 1，否则 0（硬约束）
- `P(W)`：语言模型（unigram 词频 / bigram / trigram / 神经 LM）

**若只做 unigram + 硬切分**，问题退化为：把 `S` 切成词库中存在的词序列，使
`Σ log P(wᵢ)` 最大 —— **标准的词图（word lattice）最短路径问题**，用 DP 在 O(n·L) 内解完。

```
dp[0] = 0
for j in 1..n:
    dp[j] = max over i<j where S[i:j] 是詞庫中的詞 w of ( dp[i] + log P(w) )
    同時記錄 backpointer
回溯得最佳詞序列
```

#### 3.3.2 为什么 unigram + DP 不够（真实案例）

McBopomofo 的 `Postprocess.txt` 直接记录了这个 bug ✅：

```text
# promote-over-single-syllables 的意思是，給定多字詞，這個多字詞的分數，應該
# 高於同數量同音單字的加總。例如打「試試」但出現「是是」，是因為在 unigram
# model 下，P_log(是) + P_log(是) > P_log(試試)
promote-over-single-syllables 試試 ㄕˋ-ㄕˋ
```

> **结论**：unigram 下「单字分数相加」会系统性压过「真词」。
> 修法有两种：(a) 后处理强制 promote（McBopomofo 做法）；
> (b) **改用 bigram/trigram，让 `P(試|試)` 这个转移机率进来**（正规解法）。
> 建议 MVP 先做 (a) 快速止血，roadmap 做 (b)。

#### 3.3.3 n-gram 语言模型（KenLM）

| 项目 | 建议 |
|---|---|
| 工具 | **KenLM**（`https://github.com/kpu/kenlm`，LGPL-2.1）⚠️ 授权**需查证**（repo 内 `COPYING` 为 LGPL，部分元件为 BSD） |
| 阶数 | trigram（中文词级），Kneser-Ney 平滑 |
| 语料 | 中央研究院平衡语料库、`rime-essay`、维基百科中文 dump |
| 记忆体 | trigram 中文词级约 100–300 MB（需量化或 pruned） |

**与词频的整合公式**（建议）：

```
score(W) = Σᵢ [ log P_LM(wᵢ | wᵢ₋₂,wᵢ₋₁) + λ · log P_uni(wᵢ) + μ · log P_user(wᵢ) ]
```

其中 `λ`、`μ` 为权重，`P_user` 为使用者学习分布（见 3.4.3）。
**若不用 KenLM**，可用 McBopomofo 的 log10 词频当 `P_uni`，即
`score(W) = Σ log10 freq(wᵢ)` —— 这就是 libchewing 与 McBopomofo 的基线。

### 3.4 候选字排序（本节为报告核心）

#### 3.4.1 McBopomofo：词频计算公式（可直接抄）✅

来源：`openvanilla/McBopomofo` → `Source/Data/curation/builders/frequency_builder.py`（MIT 授权）

```python
# 原始碼逐行重現
fscale = 2.7
norm   = 0.0

# 1) 讀 phrase.occ（詞 <TAB> 出現次數）
# 2) 讀 exclusion.txt，扣掉「被包含在更長詞中」的虛假計數
for k in exclusion:
    for v in exclusion[k]:
        if k in phrases and v in phrases:
            phrases[k] = phrases[k] - phrases[v]

# 3) 正規化：長的詞權重放大，避免長詞永遠吃虧
for k in phrases:
    norm += fscale ** (len(k) - 1) * phrases[k]

# 4) 取 log10
for k in phrases:
    if phrases[k] < 1:      # 出現 0 次 → 給半次（避免 -inf）
        handle.write('%s %.8f\n' % (k, math.log(fscale ** (len(k)-1) * 0.5 / norm, 10)))
    else:
        handle.write('%s %.8f\n' % (k, math.log(fscale ** (len(k)-1) * phrases[k] / norm, 10)))
```

**数学式**：

```
norm  = Σ_k  2.7^(len(k)-1) · occ(k)

              ⎧ log₁₀( 2.7^(len(k)-1) · occ(k) / norm )      if occ(k) ≥ 1
 freq(k) =    ⎨
              ⎩ log₁₀( 2.7^(len(k)-1) · 0.5    / norm )      if occ(k) < 1
```

> **为什么是 2.7？** 这是「长度补偿底数」：词长每多 1 字，权重乘 2.7，
> 用来抵销「长词在语料中出现次数天然较少」的统计偏差。
> 这是**可直接复用的经验参数**，值是从 `phrase.occ`（161,806 个词的实际出现次数）调出来的。
> ⚠️ 2.7 是否为调参最佳值**需查证**（原始码未附实验）。

#### 3.4.2 破音字惩罚（McBopomofo `main_compiler.py`）✅

```python
UNK_LOG_FREQ   = -99.0     # 完全未知的詞
H_DEFLT_FREQ   = -6.8      # 破音字非首選讀音的預設分數

# 破音字優先序：heterophony1.list (首選) > 2 > 3
# 各級懲罰（單位：log10）
PENALTY_1 = 0.0                          # 首選，不罰
PENALTY_2 = -0.69314718055994            # = log10(1/2)  讀音機率砍半
PENALTY_3 = -0.69314718055994 * 2        # = log10(1/4)  讀音機率砍到 1/4

# 單字（len(mykey) <= 3，即 1 個中文字）才套用破音字優先序；詞不受影響
if   mykey not in bpmf_phon1: 用原分數
elif mykey 的首選讀音 == r:   用原分數
elif mykey not in bpmf_phon2: 用 H_DEFLT_FREQ
elif mykey 的次選讀音 == r:   max(原分數 - 0.69314718055994, H_DEFLT_FREQ)
elif mykey 的三選讀音 == r:   max(原分數 - 0.69314718055994*2, H_DEFLT_FREQ)
else:                         H_DEFLT_FREQ
```

**转成机率语言**：第 n 级读音的机率 ≈ 首选机率 × (1/2)^(n-1)。
`-6.8` 相当于词频机率 `10^-6.8 ≈ 1.58 × 10^-7`。

#### 3.4.3 使用者历史学习（libchewing 的实际演算法）✅

来源：`chewing/libchewing` → `src/editor/estimate.rs`（LGPL-3.0）

```rust
const SHORT_INCREASE_FREQ:  u32 = 10;
const MEDIUM_INCREASE_FREQ: u32 = 5;
const LONG_INCREASE_FREQ:   u32 = 1;
const MAX_USER_FREQ:        u32 = 9999999;

fn estimate(&self, phrase: &Phrase, max_freq: u32) -> u32 {
    let last_used  = phrase.last_used().unwrap_or(self.lifetime);
    let delta_time = self.lifetime - last_used;

    if delta_time == 0 {                    // 首次加入使用者詞典
        (max_freq + SHORT_INCREASE_FREQ).min(MAX_USER_FREQ)   // 直接推到最高
    } else if delta_time < 4000 {           // 最近用過
        (phrase.freq() + SHORT_INCREASE_FREQ).min(MAX_USER_FREQ)
    } else if delta_time < 50000 {          // 中期
        (phrase.freq() + MEDIUM_INCREASE_FREQ).min(MAX_USER_FREQ)
    } else {                                // 久未使用
        (phrase.freq() + LONG_INCREASE_FREQ).min(MAX_USER_FREQ)
    }
}
```

**排序查询（SQLite）** ✅ `src/dictionary/sqlite.rs`：

```sql
SELECT phrase,
       max(freq, coalesce(user_freq, 0)) AS f,
       time
FROM dictionary_v1 LEFT JOIN userphrase_v2 ON userphrase_id = id
WHERE syllables = ?
ORDER BY sort_id ASC,
         max(freq, coalesce(user_freq, 0)) DESC,
         phrase DESC
```

**资料表结构** ✅：

```sql
CREATE TABLE dictionary_v1 (
    syllables     BLOB NOT NULL,   -- Syllable 序列的二進位編碼
    phrase        TEXT NOT NULL,
    freq          INTEGER NOT NULL,
    sort_id       INTEGER,
    userphrase_id INTEGER,
    PRIMARY KEY (syllables, phrase)
) WITHOUT ROWID;

CREATE TABLE userphrase_v2 (
    id        INTEGER PRIMARY KEY,
    user_freq INTEGER,
    time      INTEGER        -- 最後使用時間 = LRU 依據
);
```

> **可直接照抄的设计决策**：
> 1. **`max(內建詞頻, 使用者詞頻)`** —— 使用者学习只能「往上加」，不能把内建词压下去。
> 2. **时间衰减以「tick」为单位**（非 wall-clock），门槛 4,000 / 50,000 tick。
> 3. **上限 9,999,999** 防止单一词无限膨胀。
> 4. `sort_id` 优先于词频 —— 给「权威顺序」（如教育部审订读音）一个硬优先权。
> 5. **`phrase DESC`** 作为最终 tie-breaker，保证排序确定性（deterministic），利于测试。

**RIME 的对应机制**（📗 RIME 文件）：`translator.enable_user_dict: true` 会记录
`commit_history`，并以 `.userdb`（LevelDB）储存；`enable_encoder` / `encode_commit_history`
决定是否把使用者上屏的内容反向编码回词库。⚠️ 具体的频率更新公式**需查证**
（RIME 未在 schema 层公开，位于 librime 原始码 `src/rime/translator/`）。

#### 3.4.4 候选排序综合公式（建议实作）

```
score(candidate w for syllable-span [i,j)) =
      freq_table(w)                              # log10 詞頻（3.4.1）
    + α · lm_score(w | 左文右文)                  # bigram/trigram（3.3.3）
    + β · user_score(w)                          # 使用者學習（3.4.3）
    + γ · heterophony_bonus(w)                    # 破音字首選（3.4.2）
    + δ · postprocess_rule(w)                     # 規則式覆寫（見下）
    - ε · length_penalty                          # 可選
```

**规则式覆写（最高优先，直接跳过加权）** —— McBopomofo `Postprocess.txt` 定义了两种指令 ✅：

| 指令 | 语意 |
|---|---|
| `promote-over-single-syllables <詞> <注音>` | 该多字词分数强制高于「同数量同音单字加总」 |
| `promote-over-peers <詞> <注音>` | 同音同字数的词中，指定者列为最高顺位 |
| `before` / `assert` | **回归测试断言**，验证后处理前后状态 |

**真实案例**（极具参考价值，展示破音字与词边界的交互）：

```text
promote-over-peers 醫科 ㄧ-ㄎㄜ
# 說明：「一顆」「一棵」「一科」與「醫科」同音，語用上 ㄧ ㄎㄜ 應先出「醫科」

# 副作用與護欄——這些 assert 就是可執行的規格書：
assert ㄧˋ-ㄎㄜ-ㄊㄤˊ-ㄍㄨㄛˇ  一顆-糖果    # 一顆（量詞）用四聲 ㄧˋ
assert ㄧ-ㄎㄜ-ㄉㄚˋ-ㄒㄩㄝˊ    醫科-大學
assert ㄉㄨˊ-ㄧ-ㄎㄜ           讀-醫科
assert ㄧ-ㄎㄜ-ㄕㄥ            醫科-生
assert ㄧ-ㄎㄜ-ㄇㄨˋ           一-科目      # ㄎㄜ 與右鄰成詞時，promote 不覆蓋
assert ㄉㄧˋ-ㄧ-ㄎㄜ           第一-科      # ㄧ 與左鄰成詞時，亦不覆蓋
```

> **对 MVP 的启示**：不要试图一次做出完美 LM。
> **先用「词频 + 破音字优先序 + 一组手工 promote 规则 + 可执行的 assert 测试」**，
> 就能达到堪用体验；LM 是第二阶段。

#### 3.4.5 切词（Segmentation）策略比较

| 策略 | 复杂度 | 品质 | 适用 |
|---|---|---|---|
| 最长匹配（Forward Maximum Matching） | O(n) | 低 | 原型验证 |
| 双向最大匹配 | O(n) | 中低 | 无词频资料时 |
| **词图 + DP（unigram）** | O(n·L) | 中 | **MVP 首选** |
| 词图 + DP + bigram | O(n·L·k) | 中高 | 第二阶段 |
| Viterbi + trigram / beam search | O(n·k²) | 高 | 成熟产品 |
| 神经 LM（BERT/GPT 重排） | 高 | 最高 | 研究／云端（见第 5 节 baseline） |

### 3.5 破音字（一字多音）处理

#### 3.5.1 官方标准：教育部《国语一字多音审订表》

📗 官方连结（维基百科〈国语一字多音审订表〉外部连结 + 教育部网站）：

| 文件 | URL | 年份 |
|---|---|---|
| 国语一字多音审订表（正式公告） | <https://language.moe.gov.tw/uploads/files/17860007801063.pdf> | 88 年 3 月（1999） |
| 国语一字多音审订表初稿 | <https://language.moe.gov.tw/files/people_files/%e5%88%9d%e7%a8%bf.pdf> | 101 年 12 月 12 日（2012） |
| 教育部国语一字多音审订说帖 | <https://language.moe.gov.tw/files/people_files/%e8%aa%aa%e5%b8%96.pdf> | — |
| 审订网站 | <https://language.moe.gov.tw/result.aspx?classify_sn=42&subclassify_sn=443> | — |
| **《重编国语辞典修订本》与《审订表》取音差异表** | <https://dict.revised.moe.edu.tw/appendix.jsp?ver=4&ID=40> | ✅ 已验证可用 |

**审订表规格**（📗 维基百科整理，引用《国音学》等）：

- 制定：教育部国语推行委员会，1987 年 7 月组成审音小组；**1994 年 5 月公告试用，1999 年正式颁布**
- 收字依据：《常用国字标准字体表》《次常用国字标准字体表》《重编国语辞典》
- **共择定 4,253 字**
- **表格 7 栏位**：流水号、国字、审订音、词例、限读说明、通假说明、备注
- 排列：依**部首笔划**顺序，以**注音符号**标音
- 归并为单音字者**不举词例**；仍为多音者依序编号并举词例
- **不审订**：过于冷僻字词、古典诗词格律、古人名、姓氏、地名的特殊读法
- **保留**：通假音、假借或异体字造成的破音

**著名审订结果（可作为测试案例）**：

| 字 | 审订结果 | 说明 |
|---|---|---|
| 谊 | 统一读 ㄧˋ | 与社会习惯 ㄧˊ 相异 |
| 液 | 统一读 ㄧㄝˋ | |
| 骑 | 统一读 ㄑㄧˊ | 动／名词不再分读 |
| 使 | 统一读 ㄕˇ | |
| 骰 | 读 ㄊㄡˊ | 不读 ㄕㄞˇ |
| 莘莘 | 读 ㄕㄣ ㄕㄣ | |
| 扛（桌子） | 读 ㄍㄤ | |
| 主角 | 「角」读 ㄐㄩㄝˊ | 与大众 ㄐㄧㄠˇ 相异 |
| 法 | 统一读 ㄈㄚˇ | 法国、法律同音 |
| 癌 | 读 ㄞˊ | 从俗 |
| 滑稽 | 口语 ㄏㄨㄚˊ ㄐㄧ | 文言仍读 ㄍㄨˇ ㄐㄧ |
| 仔 | 新增 ㄗㄞˇ（牛仔裤）；歌仔戏 ㄗˇ | 2012 初稿修正 |

> ⚠️ **重要警讯**：维基百科明载「**电脑注音输入法也多未依审订表修正**
> （新酷音输入法可以旧审定表或新审定表读音输入，但仅限于 `phone.cin`，
> `tsi.src` 仍依审订表颁布前旧音）」。
> 👉 **产品决策必须明示**：要跟随教育部审订（教学／考试正确）还是跟随大众习惯（打得出来）。
> 建议：**两者都收，用 `sort_id` 让审订音排前面**（这正是 libchewing `sort_id` 的用途）。

#### 3.5.2 开源实作：McBopomofo 的三级破音字清单 ✅

`heterophony1.list`（528 条）= 首选读音，`heterophony2.list`（66 条）= 次选，`heterophony3.list`（17 条）= 第三选。
格式为 `字 <TAB> 注音`：

```
一	ㄧ
丁	ㄉㄧㄥ
三	ㄙㄢ
上	ㄕㄤˋ
中	ㄓㄨㄥ
```

> **注意**：只有 528 + 66 + 17 = **611 个字**被标记为破音字优先序。
> 对照教育部审订的 4,253 字，**覆盖率仅约 14%**。
> 这意味著 **McBopomofo 的破音字处理是「人工精选痛点」而非全面覆盖**。
> 若产品要求高覆盖率，**必须自行从《一字多音审订表》汇入**（见第 6 节授权分析）。

#### 3.5.3 破音字的三种消解策略

| 策略 | 说明 | 准确度 | 成本 |
|---|---|---|---|
| **静态优先序** | 每个字给一组排序读音（McBopomofo 做法） | 低（只解最常见者） | 极低 |
| **词内定音** | 词库中「词」直接绑定读音（如 `一顆 ㄧˋ-ㄎㄜ`），词层覆盖字层 | 中高 | 中（词库要大） |
| **上下文 LM** | `P(讀音 | 前後詞)` 由语料统计或神经模型学习 | 高 | 高 |

> ✅ **实证支持「词内定音」的有效性**：McBopomofo 的 `BPMFMappings.txt`（145,603 行）
> 对**同一个词列出多组读音**，例如：
> ```
> 一丁不識	ㄧ	ㄉㄧㄥ	ㄅㄨˊ	ㄕˋ
> 一丁不識	ㄧ	ㄉㄧㄥ	ㄅㄨˋ	ㄕˋ
> 一丁不識	ㄧˋ	ㄉㄧㄥ	ㄅㄨˊ	ㄕˋ
> 一丁不識	ㄧˋ	ㄉㄧㄥ	ㄅㄨˋ	ㄕˋ
> ```
> 即「一」的变调（ㄧ / ㄧˊ / ㄧˋ）与「不」的变调（ㄅㄨˋ / ㄅㄨˊ）**全部列出**，
> 让引擎可以从任一种实际念法命中。**这是中文 IME 必须实作的「变调展开」。**

**华语变调规则（必须实作，否则使用者打不出正确读音）**：

| 规则 | 条件 | 结果 | 例 |
|---|---|---|---|
| 三声变调 | 上声 + 上声 | 前字变阳平 | 你好 ㄋㄧˊ ㄏㄠˇ |
| 一 的变调 | 一 + 去声 | ㄧˊ | 一个 ㄧˊ ㄍㄜˋ |
| | 一 + 阴平/阳平/上声 | ㄧˋ | 一天 ㄧˋ ㄊㄧㄢ |
| | 一 在词尾或作序数 | ㄧ | 第一、十一 |
| 不 的变调 | 不 + 去声 | ㄅㄨˊ | 不是 ㄅㄨˊ ㄕˋ |
| | 其他 | ㄅㄨˋ | 不好 ㄅㄨˋ ㄏㄠˇ |

📗 RIME `terra_pinyin.dict.yaml` 档头明载：「标注『一、不』在词语中的连读变调」✅

### 3.6 自动选字 vs 手动选字（UX 规格）

#### 3.6.1 两种模式的精确定义

| 模式 | 行为 | 上屏时机 | 典型产品 |
|---|---|---|---|
| **传统注音（手动选字）** | 打完一个音节 → 显示同音字候选 → 使用者按数字键选字 | 每次选字 | 旧版 Windows 注音、倚天 |
| **新注音 / 智慧注音（自动选字）** | 边打边以 LM 预测整句，按 Enter/Space 一次上屏整段 | 句子层级 | 微软新注音、自然输入法、小麦注音 |
| **混合（业界主流）** | 预设自动选字；候选视窗永远可见，可按数字/Tab 手动改 | 两者皆可 | 现代产品 |

#### 3.6.2 UX 规格表（给设计师／工程师）

| 面向 | 规格建议 | 理由 |
|---|---|---|
| **候选视窗显示时机** | 打完**任一个完整音节**立即显示，不等声调 | 使用者常在无声调时就认出目标字 |
| **候选数量** | 一页 9 个（对应数字键 1–9） | 超过 9 需第二排，注意力成本上升 |
| **选字键** | `1`–`9` 直接选；`Space`/`Enter` 选第一 | 与使用者既有习惯一致 |
| **翻页** | `↓`/`→`/`Tab`/`Page Down`；`↑`/`←`/`Shift+Tab`/`Page Up` | RIME 定义 `menu.alternative_select_labels: ['⇧1'...]` |
| **RIME 无模式设计** | `Shift+數字` 选字、`Tab`/方向键切换、`Enter` 上屏 | ✅ `bopomofo.schema.yaml` 明载 |
| **破音字快速替换** | `Tab` 切换同一音节的不同读音（非候选字） | 注音特有；大千式声韵分离让此功能自然 |
| **自动选字信心阈值** | 当 `top1_score - top2_score < τ` 时**不自动上屏**，强制显示候选 | 降低「打了才发现错」的挫败 |
| **上屏后修正** | 提供「重选上一个词」快捷键（如 `Shift+Enter` / 微软注音的 `←`） | 修正成本是 IME 体验的决定因素 |
| **学习回馈** | 使用者手动选字 → 立即提升该词的 `user_freq`（3.4.3 的 `SHORT_INCREASE_FREQ = 10`） | 一次就学会 |
| **非法音节回馈** | 哔声或红色提示，**不要静默吞掉按键** | 静默失败是最严重的 UX 缺陷 |

#### 3.6.3 错误更正（Fuzzy Correction）

📄 台湾的硕士论文直接指出这是现有产品的缺口：
「**严格来说上述几个注音输入法对于输入到不合法的注音序列并没有一套错误更正的机制**」
— 廖伟超《注音输入法的错误更正与选字预测之研究》，国立暨南国际大学资讯工程学系（109 学年度），
指导教授黄光璇。<https://www.airitilibrary.com/Article/Detail/U0020-1608202111381600>

另一篇相关论文：〈语境注音输入法之研究〉（A Context-Sensitive Approach to Word Prediction in Jhuyin Input Method），
<https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi/login?o=dnclcdr&s=id=%22111NCNU0392012%22.&searchmode=basic>
（该摘要与全文为**需查证**：仅取得 NDLTD 书目页与摘要片段）

**建议的更正演算法**（编辑距离 + 合法音节表）：

```
輸入非法音節 s
候選修正 = { t | t ∈ 合法音節表, edit_distance(s, t) ≤ 2 }
        限制：只允許「同類別內替換」（聲母↔聲母、韻母↔韻母、介音↔介音）
              + 允許「刪除多餘符號」+「插入缺少符號」
排序：先比注音相似度，再比該音節的詞頻總和
```

> **常见错误模式**（可用于优先实作）：
> 1. 声母混淆：ㄓ/ㄗ、ㄔ/ㄘ、ㄕ/ㄙ、ㄋ/ㄌ、ㄈ/ㄏ
> 2. 介音混淆：ㄧ/ㄩ、ㄨ/ㄧ
> 3. 韵母混淆：ㄢ/ㄤ、ㄣ/ㄥ（**最高频**）、ㄛ/ㄜ
> 4. 顺序颠倒：把韵母打在声母前（大千式使用者从别种键盘切换时）
> 5. 漏打声调

---

## 4. 进阶功能规格

### 4.1 RIME 词库格式 `.dict.yaml`（实例验证）✅

以 `rime/rime-terra-pinyin` 的 `terra_pinyin.dict.yaml`（1,799,483 B，99,329 资料列）为真实样本：

```yaml
# Rime dictionary
# encoding: utf-8
#
# Terra Pinyin - 地球拼音
#
# referenced works:
# CC-CEDICT
# community maintained free chinese-english dictionary.
# published by MDBG
#
# license:
# creative commons attribution-share alike 3.0
# http://creativecommons.org/licenses/by-sa/3.0/
#
---
name: terra_pinyin
version: "2026.07.17"
sort: by_weight
use_preset_vocabulary: true
...

〇	ling2
㐀	qiu1
㐁	tian4
```

**Front matter 栏位语意**：

| 栏位 | 值 | 语意 |
|---|---|---|
| `name` | `terra_pinyin` | 词典 ID，需与 schema 的 `translator.dictionary` 一致 |
| `version` | `2026.07.17` | 版本，建议用日期 |
| `sort` | `by_weight` \| `by_quality` | 是否在部署时依权重预排序 |
| `use_preset_vocabulary` | `true` | 是否合并 RIME 内建的 `essay.txt`（442,688 条词频） |
| `vocabulary` | （可选） | 指定外部词汇表档名，预设 `essay.txt` |
| `columns` | （可选） | 自订栏位名，如 `text` `code` `weight` |

**资料区**：以 `...` 分隔线之后为 TSV，**预设栏位顺序为 `詞<TAB>編碼<TAB>權重`**；
`權重` 可省略（省略时由 `use_preset_vocabulary` 提供）。

**若需要词频**，明确写出 `columns`：

```yaml
---
name: my_zhuyin
version: "1.0"
sort: by_weight
columns:
  - text
  - code
  - weight
...
詞	ㄘˊ	1.5
```

### 4.2 RIME 方案格式 `.schema.yaml`（注音实例）✅

`rime/rime-bopomofo` → `bopomofo.schema.yaml` 的完整骨架：

```yaml
schema:
  schema_id: bopomofo
  name: 注音
  version: "3.1"
  description: |
    注音符號輸入，採用「大千式」鍵盤排列。
    本方案採用「無模式」設計，以 Shift+數字鍵選字，
    或以 Tab、方向鍵切換候選字，回車鍵上屏。
    空格鍵輸入第一聲，標記爲「ˉ」。可省略聲調、韻母。

switches:                       # 可切換的狀態（影響 engine 行為）
  - name: ascii_mode            # 中/英
  - name: full_shape            # 半角/全角
  - options: [zh_hant, zh_hans, zh_hant_hk, zh_hant_tw]   # 字形
  - name: ascii_punct           # 。， vs ．，

engine:
  processors:   [ascii_composer, recognizer, key_binder, speller,
                 punctuator, selector, navigator, fluency_editor]
  segmentors:   [ascii_segmentor, matcher, abc_segmentor,
                 punct_segmentor, fallback_segmentor]
  translators:  [punct_translator, table_translator@custom_phrase,
                 reverse_lookup_translator, script_translator]
  filters:      [simplifier@zh_hans, simplifier@zh_hant_hk,
                 simplifier@zh_hant_tw, uniquifier]

speller:
  alphabet: '1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347'
  initials: '1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-'
  finals:   " 6347"
  delimiter: "'"
  use_space: true

translator:
  dictionary: terra_pinyin
  prism: bopomofo
  preedit_format:
    - "xlit|1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347'|ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˉˊˇˋ˙ |"
```

**`engine` 各阶段的执行语意**（📗 RIME 文件）：

| 阶段 | 职责 | 注音方案的关键项 |
|---|---|---|
| `processors` | 依序处理**原始按键**，先拦截者胜 | `speller`（收符号）、`punctuator`（标点）、`selector`（选字） |
| `segmentors` | 把输入切成**段落**（给不同 translator） | `matcher`（正规表达式）、`abc_segmentor`（字母段） |
| `translators` | 每段产生**候选** | `script_translator`（注音→词）、`table_translator@custom_phrase`（自订词） |
| `filters` | **过滤/改写**候选 | `simplifier`（繁简／字形）、`uniquifier`（去重） |

**`translator` 关键选项**：

| 选项 | 用途 |
|---|---|
| `dictionary` | 主词典名 |
| `prism` | 预编译的「音节→词」索引（效能关键） |
| `enable_user_dict` | 开启使用者词典（`.userdb`，LevelDB） |
| `enable_encoder` / `encode_commit_history` | 是否把上屏内容自动学进词库 |
| `max_phrase_length` | 最长词长（影响 DP 视窗） |
| `preedit_format` | 输入码的**显示**转换（不改内部编码） |

### 4.3 标点符号与全形／半形

#### 4.3.1 全形／半形转换（纯数学规则）

```
ASCII 0x21–0x7E  →  U+FF01–U+FF5E     （即 +0xFEE0）
ASCII 0x20（空格）→  U+3000（全形空格）
```

```python
def to_fullwidth(s: str) -> str:
    out = []
    for ch in s:
        o = ord(ch)
        if o == 0x20:      out.append('\u3000')
        elif 0x21 <= o <= 0x7E: out.append(chr(o + 0xFEE0))
        else:              out.append(ch)
    return ''.join(out)
```

> ⚠️ **例外**：注音方案的 `punctuator` 通常**不套用 +0xFEE0**，而是给人手设计的对应表，
> 因为中文标点不全是全形 ASCII（如 `、`「」『』《》—— …… 都在别的区段）。

#### 4.3.2 RIME `symbols.yaml` 的 punctuator 结构 ✅

```yaml
# rime-prelude / symbols.yaml（節錄，實測下載 28,473 B）
patch:
  punctuator/import_preset: symbols
  recognizer/patterns/punct: '^/([0-9]0?|[A-Za-z]+)$'   # 打 /fs 開符號表

punctuator:
  full_shape:
    ' '  : { commit: '　' }        # 全形空格 U+3000
    ','  : { commit: ， }
    '.'  : { commit: 。 }
    '<'  : [ 《, 〈, «, ‹, ⟨ ]      # 陣列 = 多候選，按鍵連按切換
    '?'  : { commit: ？ }
    ';'  : { commit: ； }
    ':'  : { commit: ： }
    '''' : { pair: [ '‘', '’' ] }  # pair = 自動配對（左右引號）
    '"'  : { pair: [ '“', '”' ] }
    '\'  : [ 、, ＼ ]
    '|'  : [ ·, ｜, '§', '¦' ]
    '^'  : { commit: …… }
    '-'  : －
    '_'  : ——
    '='  : [ ＝, 々, 〃 ]
    '['  : [ 「, 【, 〔, ［, 〚, 〘 ]
    ']'  : [ 」, 】, 〕, ］, 〛, 〙 ]
  half_shape:                      # 半角模式下的另一套
    ...
```

**三种值的语意**：

| 形式 | 语意 |
|---|---|
| `{ commit: X }` | 直接上屏 X，无候选 |
| `[A, B, C]` | 多候选，重复按同一键循环 |
| `{ pair: [L, R] }` | **智慧配对**：第一次按出 L，第二次按出 R；若游标在配对中则跳过 |

**注音方案自己覆写的版本**（`rime-bopomofo/bopomofo.schema.yaml`）✅ 展示台湾习惯：

```yaml
punctuator:
  full_shape:
    "<" : { commit: "，" }      # 注意：注音方案把 < > 對應到 ，。
    ">" : { commit: "。" }
    "?" : [ ？, ／, ÷ ]
    ":" : [ ：, ； ]
    "'" : { pair: [ "‘", "’" ] }
    "\"" : { pair: [ "“", "”" ] }
    "\\" : [ 、, ＼ ]
    "^" : { commit: …… }
    "_" : [ ——, － ]
    "[" : [ 「, 【, 《, 〔, ［ ]
```

> **设计洞见**：注音方案把 `<` `>` 映射为 `，` `。`，因为大千式键盘上 `<` `>` 位于
> `,` `.` 的 Shift 位置，符合「Shift 打中文标点」的直觉；
> 同时 `key_binder` 又保留 `,` 给 ㄝ、`.` 给 ㄡ：
> ```yaml
> key_binder:
>   bindings:
>     - { when: has_menu, accept: comma,  send: comma }   # ㄝ
>     - { when: has_menu, accept: period, send: period }  # ㄡ
>     - { when: has_menu, accept: minus,  send: minus }   # ㄦ
> ```
> **这是「按键多义」的优雅解法**：只有在候选视窗开启（`has_menu`）时才把 `,` 当符号，
> 否则当注音符号。

#### 4.3.3 教育部《重订标点符号手册》

📗 官方：教育部《重订标点符号手册》修订版
<https://language.moe.gov.tw/001/Upload/files/site_content/M0001/handbook/index.html>
（⚠️ 实际 URL **需查证**；已验证可用的是《国语注音符号手册》：
<https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/index.html>）

**标准 15 种标点**：句号。 逗号， 顿号、 分号； 冒号： 问号？ 惊叹号！
引号「」『』 括号（） 破折号—— 省略号…… 书名号《》〈〉 专名号＿ 间隔号· 连接号—

**注音 IME 的「标点智慧对应」建议规则**：

| 输入 | 输出 | 理由 |
|---|---|---|
| `,` | ， | 中文逗号 |
| `.` | 。 | 中文句号 |
| `?` | ？ | 全形问号 |
| `!` | ！ | 全形惊叹号 |
| `;` | ； | |
| `:` | ： | |
| `(` `)` | （） | 自动配对 |
| `[` `]` | 「」 | 台湾习惯：直角引号最常用 |
| `{` `}` | 『』 | |
| `<` `>` | 《》 | 书名号 |
| `!!` | ！！ | 连打放大 |
| `??` | ？？ | |
| `---` | —— | 破折号（两个全形破折号相连） |
| `...` | …… | 省略号（**注意是两个 U+2026，不是六个点**） |

### 4.4 简码／快捷输入

| 机制 | 说明 | 注音适用性 |
|---|---|---|
| **声母简拼** | 只打声母即可出字 | ✅ 高价值。RIME 的 `abbreviation` 代数：`abbrev/^([bpmfdtnlgkhjqxZCSrzcs]).+$/$1/` |
| **省略声调** | 只打注音符号不打声调 | ✅ **必做**，绝大多数使用者不打声调 |
| **省略韵母** | 只打声母 + 声调 | ✅ RIME `abbrev/^([A-Za-z]+)\d$/$1/` |
| **乱序输入** | 音节内符号任意顺序 | ✅ RIME `bopomofo_express`：`free_order` 代数 `derive/([bpmfdtnlgkhjqxZCSrzcs])([iuv])/$2$1/` |
| **注音缩写** | ㄓㄔㄕㄖㄗㄘㄙ 的空韵可省 | ✅ 本来就是这样 |
| **词组简码** | 打两个声母出整个词 | ⚠️ 需自建简码表 |

RIME 的简拼代数（`zhuyin.yaml`）✅：

```yaml
abbreviation:
  __append:
    - abbrev/^([bpmfdtnlgkhjqxZCSrzcs]).+$/$1/
    - abbrev/^([A-Za-z]+)\d$/$1/
    - abbrev/^([bpmfdtnlgkhjqxZCSrzcs]).+(\d)$/$1$2/
```

### 4.5 自订词库与汇入汇出

#### 4.5.1 RIME

| 机制 | 档案／格式 | 说明 |
|---|---|---|
| 自订短语 | `custom_phrase.txt` | TSV：`詞\t注音\t詞頻`；`db_class: stabledb`（唯读、不学习） |
| 使用者词典 | `*.userdb/`（LevelDB 目录） | 自动学习累积 |
| 词典原始档 | `*.dict.yaml` | 可版控的来源 |
| 汇入 | 把 TSV 放进 schema 目录，加 `table_translator@custom_phrase` | |

`bopomofo.schema.yaml` 的实际设定 ✅：

```yaml
custom_phrase:
  dictionary: ""
  user_dict: custom_phrase
  db_class: stabledb
  enable_completion: false
  enable_sentence: false
  initial_quality: 1
```

#### 4.5.2 libchewing

| 机制 | 档案 | API |
|---|---|---|
| 内建词典 | `word.dat` / `tsi.dat` / `chewing.dat`（`DEFAULT_DICT_NAMES`） | 唯读 |
| 使用者词典 | `uhash.dat` | 读写 |
| SQLite 模式 | `chewing.sqlite3` | 读写（`dictionary_v1` + `userphrase_v2`） |
| 简写表 | `swkb.dat` | 唯读 |
| 符号表 | `symbols.dat` | 唯读 |

✅ 原始码：`src/dictionary/loader.rs`

```rust
const UD_UHASH_FILE_NAME:  &str = "uhash.dat";
const UD_SQLITE_FILE_NAME: &str = "chewing.sqlite3";
const ABBREV_FILE_NAME:    &str = "swkb.dat";
const SYMBOLS_FILE_NAME:   &str = "symbols.dat";
pub const DEFAULT_DICT_NAMES: &[&str] = &["word.dat", "tsi.dat", "chewing.dat"];
```

**使用者词汇 API**（`capi/include/chewing.h`）✅：

```c
int chewing_userphrase_enumerate(struct ChewingContext *ctx);
int chewing_userphrase_has_next(struct ChewingContext *ctx, int *phrase_len, int *bopomofo_len);
int chewing_userphrase_get(struct ChewingContext *ctx, char *phrase_buf, int phrase_len,
                                                    char *bopomofo_buf, int bopomofo_len);
int chewing_userphrase_add(struct ChewingContext *ctx, const char *phrase, const char *bopomofo);
int chewing_userphrase_remove(...);
int chewing_userphrase_lookup(...);
```

> **设计建议**：把介面切成 `enumerate/has_next/get/add/remove/lookup`
> 是**可测试、可汇出**的最小集合 —— 建议 MVP 直接沿用以避免日后重构。

#### 4.5.3 微软注音／新注音

- 自订词汇可透过 IME 使用者介面新增；词库存于 `%APPDATA%\Microsoft\IME\...`（⚠️ 具体档名与格式闭源，**需查证**）
- 支援「使用者造词工具」批次汇入 `.txt`（⚠️ 格式未公开，**需查证**）

#### 4.5.4 云端个人化

| 产品 | 机制 | 来源可信度 |
|---|---|---|
| Google 日文／中文输入法 | 有「个人化」与云端同步，但 Google 注音输入法已停止更新 | ⚠️ **需查证** |
| 微软新注音 | 有「个人化调整」与帐号同步（Windows 11） | ⚠️ **需查证** |
| 小麦注音 McBopomofo | **纯本机**，无云端 | ✅ 读 repo 确认无网路词库模组 |

> **建议**：MVP **只做本机学习**（3.4.3 的 libchewing 模型）。云端个人化的隐私成本高、
> 且没有可信的公开格式可对接。若要做，需自行设计（同步 `user_freq` 表 + 冲突解决策略）。

### 4.6 繁简转换（OpenCC）

📗 官方：`BYVoid/OpenCC` <https://github.com/BYVoid/OpenCC>（**Apache-2.0**，✅ 读 LICENSE）

**设定档选择指南**（✅ 实测下载 `s2twp.json`、`s2t.json`、`t2tw.json`）：

| 设定档 | 方向 | 用途 | 何时用 |
|---|---|---|---|
| `s2t.json` | 简→繁 | 基本字对字转换 | ❌ 不建议（会出现「软件」「里」） |
| `s2tw.json` | 简→繁（台湾字形） | 字形转为台湾标准 | 中间步骤 |
| **`s2twp.json`** | 简→繁（**台湾字形 + 台湾用词**） | 「软件→软体」「鼠标→滑鼠」 | ✅ **台湾产品首选** |
| `t2s.json` | 繁→简 | | 输出简体时 |
| `t2tw.json` | 繁→繁（台湾字形） | 「里→里」「着→著」 | ✅ **注音方案预设值** |
| `t2hk.json` | 繁→繁（香港字形） | | 港版 |
| `tw2s.json` / `tw2sp.json` | 台湾正体→简 | | |

> ✅ **实证**：RIME `bopomofo_tw.schema.yaml` 明确设定「预设套用台湾字形标准」，
> `bopomofo.schema.yaml` 的 `filters` 使用 `t2s.json` / `t2hk.json` / `t2tw.json`。
> **注意注音方案用的是 `t2tw`（繁→繁字形）不是 `s2twp`**，因为输入已是繁体，
> 只需字形在地化。若产品要支援「打注音输出简体」，才加入 `t2s.json`。

`s2twp.json` 的内部结构（✅ 实测）：三段式 conversion chain

```json
{
  "name": "Simplified Chinese to Traditional Chinese (Taiwan Standard, with Taiwan Phrases)",
  "segmentation": {
    "type": "mmseg",                    // 最大匹配分詞
    "dict": { "type": "group", "match_policy": "union",
              "dicts": [ {"type":"ocd2","file":"STPhrases.ocd2"},
                         {"type":"ocd2","file":"STPhrases_GeneratedFromRegionalPhrases.ocd2"} ] }
  },
  "conversion_chain": [
    { "dict": { "type":"group", "match_policy":"short_circuit",
                "dicts": [ {"type":"group","match_policy":"union",
                            "dicts":[...STPhrases...]},
                           {"type":"ocd2","file":"STCharacters.ocd2"} ] } },
    { "dict": { "type":"group", "match_policy":"short_circuit",
                "dicts": [ {"type":"ocd2","file":"TWPhrases.ocd2"},
                           {"type":"ocd2","file":"TWVariantsPhrases.ocd2"},
                           {"type":"ocd2","file":"TWVariants.ocd2"} ] } }
  ]
}
```

**词典格式**：`.ocd2`（OpenCC Dictionary 二进位格式）、`.txt`（文字原始档）。
`match_policy`：`union` = 合并所有词典的匹配；`short_circuit` = 第一个命中即停。

### 4.7 Emoji／符号表

- RIME：`symbols.yaml` 的 `punctuator` + `recognizer.patterns.punct: '^/([0-9]0?|[A-Za-z]+)$'`
  → 使用者打 `/fs`（full shape）、`/hs`、`/emoji` 等开符号表
- 资料档规模参考：McBopomofo `Symbols.txt`（**1,447 条**，含年号等特殊符号）、
  `BPMFPunctuations.txt`（**1,952 条**，格式 `符號<TAB>注音<TAB>分數`）✅
  实际节录：
  ```
  a	_letter_A	0.0
  b	_letter_B	0.0
  ```
- 建议符号分类：标点、数学、箭头、货币、单位、圈号、emoji、特殊字（〇、々、〃）

### 4.8 联想词（Associated Phrases）

- **机制**：上屏一个词后，主动推荐「常接续的词」（如「谢谢」→「你」）
- McBopomofo 有 `associated-punctuation.txt` + `phrase_deriver.py` → `associated-phrases-v2.txt` ✅
  实际格式（`詞<TAB>後接<TAB>分數`，分数为 −4 表示低优先）：
  ```
  「-_punctuation_list-」-_punctuation_list	-4
  『-_punctuation_list-』-_punctuation_list	-4
  《-_punctuation_list-》-_punctuation_list	-4
  ```
  > 注意：**这其实是「标点自动配对」而非传统联想词**。
  > McBopomofo 用它让 `「` 打完自动接 `」`。这是很有价值的设计模式：
  > **用统一的「词 + 分数」表格同时实作联想词与配对标点**。
- **资料来源**：bigram 统计（`P(w₂|w₁)` 取 top-k），或人工编写
- 微软新注音／自然输入法的联想词功能⚠️ **需查证**（无公开技术文件）

### 4.9 功能优先序建议（MVP → 成熟）

| 功能 | 阶段 | 理由 |
|---|---|---|
| 大千式 37 键 + 5 声调 | MVP | 覆盖 >95% 使用者 |
| 省略声调、声母简拼 | MVP | 实际输入习惯 |
| 词库 + unigram DP | MVP | 核心体验 |
| 破音字优先序 | MVP | 台湾使用者最常抱怨 |
| 手动选字候选窗 | MVP | 安全网 |
| 使用者学习（本机） | MVP | 体验跃升最明显 |
| 全形／半形、标点智慧对应 | MVP | 基本期待 |
| 繁简／字形转换（OpenCC） | MVP | 低成本（现成） |
| 联想词 | 第二阶段 | 需 bigram 资料 |
| bigram/trigram LM | 第二阶段 | 正确率主要来源 |
| 许氏／倚天 26 键盘 | 第二阶段 | 小众但忠诚 |
| Emoji／符号表 | 第二阶段 | |
| 错误更正（fuzzy） | 第二阶段 | 差异化 |
| 云端个人化 | 第三阶段 | 隐私成本高 |
| 神经 LM 重排 | 第三阶段 | 见第 5 节 |

---

## 5. 品质指标

### 5.1 KSPC（Keystrokes Per Character）

📄 **原始出处**：MacKenzie, I. S. (2002). *KSPC (keystrokes per character) as a characteristic of text entry techniques.*
Proceedings of the Fourth International Symposium on Human Computer Interaction with Mobile Devices (MobileHCI 2002),
LNCS 2411, pp. 195–210. Heidelberg: Springer-Verlag.
✅ **可读全文**（作者自架）：<https://www.yorku.ca/mack/hcimobile02.html>
DOI: `10.1007/3-540-45756-9_16`；ACM DL: `dl.acm.org/doi/10.5555/645739.666587`
配套软体：<http://www.yorku.ca/mack/KSPC/KSPC.html>

**定义**：KSPC 是「在给定语言中，使用给定的文字输入技术，平均产生每个字元所需的按键数」。

**公式（字母频率模型）** — 论文式 (2)：

```
        Σ_c  K_c · F_c
KSPC = ────────────────
        Σ_c  C_c · F_c
```

其中 `K_c` = 输入字元 c 所需按键数、`C_c` = 1（字元「大小」）、`F_c` = 字元 c 在语料中的频率。

**公式（词频率模型）** — 论文式 (3)：

```
        Σ_w  K_w · F_w
KSPC = ────────────────
        Σ_w  C_w · F_w
```

其中 `K_w` = 输入词 w 的按键数、`C_w` = 词 w 的字元数、`F_w` = 词频。
**注意：`K_w` 与 `C_w` 都要加上「词后的一个空白键」。**

**MacKenzie (2002) 的完整 baseline 表**（Table 1，✅ 逐字取自原文）：

| 互动技术 | KSPC |
|---|---:|
| Date Stamp (#1) | 10.6598 |
| Date Stamp (#2) | 10.6199 |
| Date Stamp (#3) | 9.1788 |
| Date Stamp (#4) | 6.4458 |
| 5-button Pager | 3.1320 |
| Multitap | 2.0342 |
| MessagEase | 1.8210 |
| LetterWise | 1.1500 |
| T9（dictionary-based disambiguation） | 1.0072 |
| **Qwerty（基准线）** | **1.0000** |
| Word Prediction（keypad, n=10） | 0.8132 |
| Word Prediction（keypad, n=5） | 0.7483 |
| Word Prediction（keypad, n=1） | 0.7391 |
| Word Prediction（stylus, n=1） | 0.7391 |
| Word Prediction（keypad, n=2） | 0.7086 |
| Word Prediction（stylus, n=2） | 0.6466 |
| Word Prediction（stylus, n=5） | 0.5506 |
| Word Prediction（stylus, n=10） | 0.5000 |

**论文的关键结论（对 IME 设计直接适用）**：

1. **候选清单大小 n 对 KSPC 的影响取决于「选择成本」**：
   - 触控笔（1 tap 选任何候选）：`n` 越大 KSPC 越低（0.7391 → 0.5000）
   - 键盘（需按 NEXT 键移动）：`n=2` 最好（0.7086），`n>2` **反而变差**（`n=10` → 0.8132）
   👉 **对注音 IME 的直接启示**：若候选要用方向键/Tab 移动，**每页候选数不宜过多**；
   若要放大候选数，必须提供「一键直选」（数字键）—— 这正是 9 宫格数字选字的理论依据。
2. **重复按键比率**（Table 2）：Qwerty 仅 0.0171，Multitap 高达 0.4684。
   同一键连续按的 inter-key time 明显较短，会**抵销**部分 KSPC 劣势。
3. **注意力成本无法被 KSPC 捕捉**。以 Hick–Hyman 定律估算视觉搜寻成本（论文式 21）：
   ```
   RT = k · log₂(n + 1)        k ≈ 200 ms/bit
   n = 10  →  RT ≈ 200 × log₂(11) ≈ 692 ms
   ```
   👉 **候选清单 10 个 vs 5 个，光「找到目标」就多花约 200 ms**（`log₂11 − log₂6 ≈ 0.87 bit ≈ 174 ms`）。
   这是「候选排序正确率」比「候选数量」更重要的量化理由。
4. 观测到的按键重复时间范围：**128–176 ms**。

**注音的 KSPC 该怎么算**（本报告建议，⚠️ 未见学术文献专门分析注音 KSPC，**需查证**）：

```
注音（不打聲調、自動選字正確）：
  KSPC = (平均每音節按鍵數 + 選字成本) / 平均詞長
  平均每音節按鍵數 ≈ 2.2（聲母 1 + 韻母 1.2，介音另計）
  理想（全自動選字正確）KSPC ≈ 0.45–0.55   ← 因中文平均詞長約 1.5–2 字，且單音節字常見
  
注音（打聲調、手動選字）：
  KSPC ≈ 1.2–1.8（每音節多 0.5 鍵聲調 + 選字鍵）
```

> ⚠️ **上列数字为推估，非实测**。要得到可信数字，必须用第 7 节的模拟打字框架
> 对真实语料计算。**这是本报告标记为最高优先「需查证」的项目之一。**

### 5.2 首选正确率（Top-1 Accuracy）／MRR／MAP

**标准定义**（资讯检索与 IME 通用）：

```
Top-1 Accuracy（首選正確率）
  = (候選清單第 1 位即為正解的音節/詞數) / (總音節/詞數)

Top-k Accuracy
  = (正解出現在前 k 位的音節/詞數) / (總音節/詞數)

MRR (Mean Reciprocal Rank)
  = (1/N) · Σᵢ 1/rankᵢ
  其中 rankᵢ = 第 i 個查詢中，正解在候選清單中的排名（1-based）
  若正解不在清單中，該項貢獻 0

MAP (Mean Average Precision)
  = (1/N) · Σᵢ  APᵢ
  APᵢ = (1/Rᵢ) · Σ_{k=1..n} [ 正解@k ] · Precision@k
  其中 Rᵢ = 相關項目總數
```

**在 IME 评测中的具体用法**：

| 指标 | 评测单位 | 说明 |
|---|---|---|
| **字级 Top-1** | 单一音节 | 「这个音节的首选字是否正确」— 最宽松 |
| **词级 Top-1** | 切出的词 | 「这个词的首选词是否正确」 |
| **句级 Top-1 / 句级正确率** | 整句 | 「整句完全正确（字元 100% 相符）的比例」— 最严格，通常最低 |
| **MRR** | 单一音节 | 衡量「正解排多前面」，对候选 UI 设计特别有用 |
| **CER** | 整句 | Character Error Rate = (S+D+I)/N |

> **实务建议**：**句子级 Top-1 是使用者真正感受到的指标**，
> 但**字／词级 Top-1 才是工程上可除错的指标**。两者都要报，
> 且必须分开报「自动选字正确率」与「含手动选字后的最终正确率」。

### 5.3 打字速度指标

**单位换算标准**（📄 MacKenzie 2002 的语料统计 + 业界惯例）：

```
1 英文 word  = 5 characters（含空白）        ← 標準換算
WPM = (字元數 / 5) / 分鐘
CPM (Characters Per Minute) = 字元數 / 分鐘
中文「字/分」= 中文字元數 / 分鐘

中文 → WPM 換算：
  中文每字 ≈ 1 個「詞」的 1/1.5
  WPM(英式等價) ≈ 中文字/分 ÷ 5 × 2.5   ← 因中文一字承載較多資訊
  ⚠️ 文獻對中文 WPM 換算無統一標準，**需查證**
```

**MacKenzie 论文的量级参考**：
- Qwerty 触控笔软键盘的理论上界研究：Soukoreff & MacKenzie (1995), *Behaviour & Information Technology* 14, 370–379，DOI `10.1080/01449299508914656`
- 观测 inter-key time：**128–176 ms**（论文注 2，引用 4 篇来源）
  → 理论上界 ≈ 1 / 0.15 s ≈ **400 字元/分 ≈ 80 WPM**（纯字母，不含思考时间）

**中文打字速度实测基准**：⚠️ **需查证**。
本次调查未能取得可信的「台湾使用者平均注音打字速度（字/分）」一手数据。
已知可用的间接来源：
- 国立台北教育大学／台湾师范大学的特殊教育输入法教学研究有前后测字/分数据，
  对象为国小资源班学生，**不可外推至一般成年使用者**：
  〈注音输入法与纵横输入法教学对国小资源班学生中文输入学习成效〉
  <http://rportal.lib.ntnu.edu.tw/bitstreams/54fa64ec-a72c-4dec-ae5b-aa3ae4cd9226/download>
- 〈中文电脑注音输入系统之字键定位研究〉（1987，国立成功大学工业管理研究所，指导教授李再长）
  <https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi?o=dnclcdr&s=id=%22075NCKU2041002%22.&searchmode=basic>
  （探讨字键定位，可能含打字速度实验，**全文未取得，需查证**）

### 5.4 中文 IME 的学术 baseline（✅ 已取得具体数字）

📄 **Zou, Y., Lee, T., Fan, X., & Li, J. (2026).** *Benchmarking Large Language Models for Chinese and Japanese IMEs:
Phonetic-to-Character Generation and Textual Error Correction.*
Proceedings of LREC 2026, pp. 4290–4311. ELRA.
🔗 论文页：<https://aclanthology.org/2026.lrec-1.337/>
🔗 PDF：<https://aclanthology.org/2026.lrec-1.337.pdf>（✅ 已下载 768,754 B，`pdftotext` 抽取 1,596 行）
DOI: `10.63317/42jiimjriyga`｜授权：**CC BY 4.0**（2016 年后 ACL 材料）
> 该论文自述：「**The datasets, evaluation scripts, and results from this study serve as a vital public
> resource for future research, providing a robust baseline**」→ 可直接下载其评测脚本作为第 7 节的起点。

**Table 2：词生成（Word Generation）— 中文部分**（✅ 逐字取自 PDF）

| Model | SimHash | BERTScore | BLEU | ROUGE-L | CER ↓ | Time(s) | TTFT(s) | TPS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-4o-mini | 0.809 | 0.884 | 0.621 | 0.768 | 0.234 | 0.981 | 0.608 | 25.59 |
| Gemini 2.0 Flash | 0.808 | 0.875 | 0.317 | 0.655 | 0.554 | 0.758 | 0.328 | 87.55 |
| Llama3.2-3B | 0.543 | 0.627 | 0.044 | 0.237 | 0.944 | 0.370 | 0.276 | 43.97 |
| **macOS Pinyin（基线）** | **0.820** | 0.864 | **0.637** | 0.723 | 0.277 | 0.458 | – | – |
| Pinyin2Hanzi DAG | 0.805 | 0.862 | 0.610 | **0.730** | 0.270 | **<0.01** | – | – |

**Table 2：日文部分**（对照组）

| Model | SimHash | BERTScore | BLEU | ROUGE-L | CER ↓ |
|---|---:|---:|---:|---:|---:|
| GPT-4o-mini | 0.791 | 0.942 | 0.649 | 0.889 | 0.657 |
| Gemini 2.0 Flash | **0.831** | 0.948 | 0.132 | 0.755 | 0.576 |
| Llama3.2-3B | 0.618 | 0.922 | 0.555 | 0.877 | 0.756 |
| **macOS Romaji（基线）** | 0.736 | **0.952** | **0.849** | **0.924** | **0.085** |

**论文的关键量化发现**：

1. **词级（短输入）：传统词典式 IME 仍然最强。**
   macOS Pinyin 拿下最高 SimHash（0.820）与 BLEU（0.637）。
   原文：「This demonstrates the power of **lexicon-driven IMEs on short, well-defined inputs**.」
2. **句级（长输入）：LM 式基线崩溃。**
   Pinyin2Hanzi DAG 的 BLEU 大幅下滑，原文：「confirms that their **n-gram-based foundations are
   insufficient for modeling long-range semantic dependencies**」。
3. **速度优势仍然属于传统方法**：Pinyin2Hanzi DAG 完成时间 **< 0.01 s**，
   macOS Pinyin 0.458 s，而 LLM 为 0.37–0.98 s。
4. **延迟指标**：TTFT（Time To First Token）0.276–0.608 s；TPS 25.6–87.6 tok/s。
5. **错误更正任务**：GPT-4o 在中文更正任务全面领先专用工具 `pycorrector`
   （pycorrector 最快，0.377 s，但准确率较低，原文：「highlights the limitations of **non-contextual
   correction tools**」）。

> **对 MVP 的结论（最重要的一段）**：
> **不要一开始就上 LLM。** 学术 baseline 明确显示：
> 「词库 + n-gram」在**短输入（词级）**上仍胜过顶级 LLM；
> 只有在**长句、需要长距离语意**时 LM/LLM 才胜出。
> 👉 **正确路线：MVP = 词库 + unigram/bigram DP；第二阶段加 trigram；第三阶段才考虑 LLM 重排**，
> 且务必保留「延迟预算」（使用者可接受的 TTFT 上限通常 < 100 ms）。

### 5.5 其他常用指标

| 指标 | 公式／定义 | 用途 |
|---|---|---|
| **CER**（Character Error Rate） | `(S + D + I) / N`，S/D/I = 替换/删除/插入数，N = 正解字元数 | 整句准确度 |
| **WER** | 同上但以词为单位 | 分词后评测 |
| **Keystroke Savings** | `1 − KSPC` | 相对于 Qwerty 的节省比例 |
| **Input Efficiency** | `正確字元數 / 總按鍵數` | 含错误与修正的实效 |
| **Correction Cost** | 修正一个错误所需按键数（Backspace + 重打 + 重选） | UX 核心指标 |
| **Top-1 自动上屏率** | 未开候选视窗即上屏的比例 | 自动选字信心度 |
| **候选视窗开启率** | 开启候选视窗的次数 / 输入词数 | 越低越好 |
| **平均候选卷动次数** | 使用者移动候选焦点的平均次数 | 排序品质 |

### 5.6 建议的指标仪表板（产品用）

| 层级 | 指标 | 目标值（建议） |
|---|---|---|
| 引擎 | 字级 Top-1 | ≥ 92% |
| 引擎 | 词级 Top-1 | ≥ 85% |
| 引擎 | 句级完全正确率 | ≥ 60% |
| 引擎 | 字级 MRR | ≥ 0.95 |
| 引擎 | KSPC（不打声调、含选字） | ≤ 0.8 |
| 效能 | 按键到候选显示延迟 | < 30 ms（P95） |
| 效能 | 记忆体占用 | < 150 MB |
| 体验 | 候选视窗开启率 | < 25% |
| 体验 | 上屏后修正率 | < 8% |
| 体验 | 使用者学习生效所需次数 | 1 次（见 3.4.3 `SHORT_INCREASE_FREQ`） |

---

## 6. 词库资料

### 6.1 核心发现：「注音 + 词 + 词频」的开放资料确实存在

| 资料集 | 内容 | 规模（✅ 实测） | 格式 | 授权 | 含注音 | 含词频 |
|---|---|---|---|---|---|---|
| **McBopomofo `BPMFMappings.txt`** | 词 → 逐字注音 | **145,603 行**（5,019,395 B） | `詞\tㄅㄧ\tㄅㄧ...`（空白分隔） | **MIT** ✅ | ✅ | ❌ |
| **McBopomofo `BPMFBase.txt`** | 单字 → 注音 + 拼音 + 声调 + 字集 | **26,535 行**（720,832 B） | `字 注音 拼音 調 tag` | **MIT** ✅ | ✅ | ❌ |
| **McBopomofo `phrase.occ`** ⭐ | 词 → 出现次数 | **161,806 行**（1,768,276 B） | `詞\t次數`（tab 分隔） | **MIT** ✅ | ❌ | ✅ |
| McBopomofo `heterophony{1,2,3}.list` | 破音字优先序 | 528 / 66 / 17 | `字\t注音` | MIT ✅ | ✅ | ❌ |
| McBopomofo `exclusion.txt` | 词频扣除规则 | 1,754 行 | `詞\t需排除的上下文` | MIT ✅ | ❌ | ❌ |
| McBopomofo `Symbols.txt` | 特殊符号 | 1,447 行 | `符號 注音 分數` | MIT ✅ | ✅ | ✅ |
| McBopomofo `BPMFPunctuations.txt` | 标点 | 1,952 行 | `符號 注音 分數` | MIT ✅ | ✅ | ✅ |
| **`rime-essay` `essay.txt`** ⭐ | 词 → 词频 | **442,688 行**（5,887,319 B） | `詞\t詞頻` | **LGPL-3.0** ✅ | ❌ | ✅ |
| `rime-terra-pinyin` `terra_pinyin.dict.yaml` | 字/词 → 拼音（可转注音） | 99,329 资料列（1,799,483 B） | RIME dict TSV | **CC BY-SA 3.0**（源自 CC-CEDICT）✅ | ❌（拼音） | ❌ |
| `chewing-data`（libchewing 资料） | 词库二进位 | ⚠️ 未取得（见下） | `word.dat` / `tsi.dat` / `chewing.dat` / `uhash.dat` | **LGPL-3.0** ✅（程式码） | ✅ | ✅ |
| 教育部《重编国语辞典修订本》 | 字/词 + 注音 + 释义 | ⚠️ 规模**需查证** | JSON（经 g0v 转换） | **CC BY-ND 3.0 TW** 📗 | ✅ | ❌ |
| `g0v/moedict-data` | 上述辞典的 JSON 化 | `dict-revised.json` 等 8 个档 | JSON | 格式转换部分 **CC0** ✅ | ✅ | ❌ |
| 中研院 CKIP / 平衡语料库 | 分词 + 词频 | ⚠️ **需查证** | 需申请 | 学术免费／商业需授权 ⚠️ | ❌ | ✅ |
| `SUBTLEX-CH` | 中文词频表 | ⚠️ **需查证** | — | 学术用 ⚠️ | ❌ | ✅ |

**⭐ 关键组合**：`McBopomofo BPMFMappings.txt`（注音）+ `phrase.occ`（词频）+ `BPMFBase.txt`（单字注音）
= **完整且 MIT 授权的「注音 + 词 + 词频」开放资料**，且已有官方 Makefile 说明如何合成。

### 6.2 McBopomofo 资料格式与授权（最重要的一手来源）✅

📗 `openvanilla/McBopomofo` → `Source/Data/README.md` 与 `AGENTS.md`（✅ 已下载）

**档案格式表**（✅ 取自 `AGENTS.md`）：

| 档案 | 用途 | 格式 |
|---|---|---|
| `BPMFBase.txt` | 单字注音对应 | `character bopomofo pinyin tone tag` |
| `BPMFMappings.txt` | 多字词（2–6 字） | `phrase bpmf1 bpmf2 ...`（空白分隔） |
| `BPMFPunctuations.txt` | 标点 | 同 BPMFBase |
| `phrase.occ` | 词频／出现次数 | `phrase frequency`（**tab 分隔**） |
| `heterophony1/2/3.list` | 破音字读音优先序 | `character bopomofo` |
| `exclusion.txt` | 词频扣除 | `phrase context_to_exclude`（tab 分隔） |
| `Symbols.txt` | 特殊符号（年号等） | `symbol bopomofo score` |
| `Macros.txt` | 文字巨集（日期时间） | `MACRO@NAME bopomofo score` |
| `associated-punctuation.txt` | 词关联标点 | 特殊格式 |

**产出档（Makefile 自动生成，不进版控）**：

| 档案 | 产生者 | 用途 |
|---|---|---|
| `data.txt` | `make all` | **主语言模型资料**（格式：`# format org.openvanilla.mcbopomofo.sorted`，每行 `詞 注音 分數`） |
| `data-plain-bpmf.txt` | `make all` | 传统注音模式用 |
| `associated-phrases-v2.txt` | `make all` | 联想词／标点配对 |
| `PhraseFreq.txt` | `make all` | 编译后词频 |

**建置管线**（✅ 取自 `Makefile`）：

```
phrase.occ + exclusion.txt
      │  curation/builders/frequency_builder.py
      ▼
PhraseFreq.txt  (log10 詞頻)
      │
BPMFBase.txt + BPMFMappings.txt + BPMFPunctuations.txt
+ Symbols.txt + Macros.txt + heterophony{1,2,3}.list
      │  curation/compilers/main_compiler.py
      ▼
data-raw.txt
      │  curation/compilers/postprocess.py  (+ Postprocess.txt 指令)
      ▼
data.txt  ──►  McBopomofo.app/Contents/Resources/
```

**授权**：✅ `LICENSE.txt` 为 **MIT License, Copyright (c) 2011-2026 Mengjuei Hsieh et al.**
**词库来源**（✅ 取自 `README.md`）：
> "BPMFMappings.txt — Multi-character phrases (2-6 chars). **Originally simplified from `tsi.src` of libtabe (BSD Licensed) with modifications**"

👉 即 McBopomofo 词库源头是 **libtabe 的 `tsi.src`（BSD 授权）** 加上大量人工修订。
**这是商用最安全的一条路径**（MIT + BSD 皆允许商用与修改）。

**人工编辑原则**（✅ `README.md` 的 "Editorial Rule"，反映词库品质维护实务）：

```
* when in doubt, use google/yahoo search to confirm the rarity of the phrases
  - if the amount of the results is under 1000, it's likely okay to remove this phrase
  - if tsi.src variants showed up in the first page of the results, you should remove this phrase
  - for idioms, it's possible the first hit is the idiom database
  - if this candidate is apparent part of a long phrase and the segmentation is
    apparently incorrect, find a way to remove the phrase candidate and replace
    it with the complete one, but forget about it if the length is longer than 6.
* We need to constantly remind ourself, IME is not an idiom database.
```

> **「IME is not an idiom database」** —— 这句话是词库设计的核心原则：
> **收词标准是「使用者会打」，不是「这个词存在」**。过多的罕用词只会稀释候选排序品质。

### 6.3 `phrase.occ` 的真实样貌 ✅

```
ˇ	48
ˊ	25
ˋ	45
˙	158
〇	8
```

格式为 `詞<TAB>次數`，**含标点与单字**。这是**全台湾最可直接使用的「注音 IME 词频」开放资料**。

### 6.4 `rime-essay` 的 `essay.txt` ✅

```
〇	981
〇〇	658
〇一	488
〇七	493
〇三	437
...
𫛢	0
𫛶	0
𫛸	0
```

- **442,688 行**，格式 `詞<TAB>詞頻`
- 词频范围从 981 递减至 **0**（含大量 0 频词 —— 使用时需注意除以零／log(0)）
- 授权：✅ `LICENSE` 为 **GNU LGPL v3**（逐字确认档头）
  ⚠️ **LGPL 对「资料档」的适用性需查证** —— LGPL 是为软体设计的授权，
  把它用在纯资料上法律意义不明确。**商用产品采用 `essay.txt` 前建议法务确认**，
  或改用 McBopomofo 的 MIT 词频（`phrase.occ`）。

### 6.5 教育部辞典：授权是关键限制 📗

✅ **已取得官方授权声明**：教育部《国语辞典公众授权网》
<https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html>

> **原文**：
> 「中华民国教育部《重编国语辞典修订本》、《国语辞典简编本》、《国语小字典》与《成语典》
> 相关资料采『**创用CC-姓名标示-禁止改作 3.0 台湾授权条款**』释出。
> 本授权条款允许使用者**重制、散布、传输著作（包括商业性利用）**，但**不得修改该著作**，
> 使用时必须遵照『使用说明』之内容要求。」

| 辞典 | 授权 | 商业利用 | 修改 | 最新版本编号 |
|---|---|---|---|---|
| 重编国语辞典修订本 | CC BY-ND 3.0 TW | ✅ 允许 | ❌ 禁止 | 2015_20260625 |
| 国语辞典简编本 | CC BY-ND 3.0 TW | ✅ 允许 | ❌ 禁止 | 2014_20260626 |
| 国语小字典 | CC BY-ND 3.0 TW | ✅ 允许 | ❌ 禁止 | 2019_20260626 |
| 成语典 | CC BY-ND 3.0 TW | ✅ 允许 | ❌ 禁止 | 2020_20260625 |

**🔑 极重要的官方解释**（✅ 取自 `g0v/moedict-data` README，该 README 引述教育部解释）：

> 「依教育部之解释，『创用CC-姓名标示-禁止改作 台湾3.0版授权条款』之
> **改作限制标的为文字资料本身，不限制格式转换及后续应用**。」

👉 **这是把教育部辞典用于 IME 词库的法律依据**：
- ✅ 可以做**格式转换**（XML → JSON → 自建 DB）
- ✅ 可以做**后续应用**（取用其中的「词 + 注音」栏位当词库）
- ❌ 不可以**改写释义文字**
- ⚠️ 但「从辞典中抽取注音栏位、重新排序、加入自建词频」是否构成「改作」**仍有解释空间**
  → **需查证／建议法务确认**

**g0v 的处理**（✅ `g0v/moedict-data` README）：
> 「这是将『重编国语辞典（修订本）』的公众授权内容处理为机器比较容易再利用的 json 格式。
> **辞典本文的著作权仍为教育部所有。**」
> 「此处**转换格式、重新编排的编辑著作权（如果有的话）由 @kcwu 以 CC0 释出**。」

资料档：`dict-revised.json`、`dict-concised.audio.json`、`dict-cat.json`、`manifest.json` 等。

**教育部《国语注音符号手册》**（📗 已验证）：
<https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/index.html>
- 提供：中文版、中文 HTML 版、EPUB 线上阅读／下载、English version
- 内含「壹、国语注音符号体式表」（声符与韵符说明表格，可点击朗读与笔顺动画）
- 自由软体资讯：内嵌「教育部标准楷书」「教育部标准宋体」子集 WOFF，**CC BY-ND 3.0 TW**
- 笔顺 XML（`3105.xml`–`3129.xml`）来自教育部常用国字标准字体笔顺学习网，采 **CC BY-ND 3.0 TW**

### 6.6 中研院与学术资源 ⚠️

| 资源 | 规模 | 授权 | 状态 |
|---|---|---|---|
| 中央研究院汉语平衡语料库（Sinica Corpus） | ⚠️ **需查证** | 学术免费，商业需授权 ⚠️ | 需申请 |
| 中文词知识库（CKIP） | ⚠️ **需查证** | 需申请 ⚠️ | 需申请 |
| 中文词汇网路（Chinese WordNet） | ⚠️ **需查证** | 学术用 ⚠️ | 需申请 |
| `ckiplab/ckip-transformers` / `CkipTagger` | — | ⚠️ **需查证**（GitHub 标示为 **GPL-3.0** 或自订学术授权，两者并存过，需逐一确认） | GitHub 可取得 |
| 中研院现代汉语语料库词频统计 | ⚠️ **需查证** | — | ⚠️ |

> ⚠️ **本节为本报告最大的资讯缺口。** 中研院各语料库的授权与规模未能取得一手确认
> （GitHub API 速率限制、Semantic Scholar 429、相关页面需登入）。
> **建议**：若专案需要高品质词频，直接联系
> 中央研究院资讯科学研究所 CKIP（<https://ckip.iis.sinica.edu.tw/>）取得书面授权条件。

### 6.7 MVP 建议采用组合（含授权可行性）

#### 方案 A：商用安全优先（✅ 建议）

| 用途 | 资料来源 | 授权 |
|---|---|---|
| 单字注音 | McBopomofo `BPMFBase.txt` | MIT ✅ |
| 词 + 注音 | McBopomofo `BPMFMappings.txt` | MIT ✅（源头 libtabe/BSD） |
| 词频 | McBopomofo `phrase.occ` + `frequency_builder.py` 公式 | MIT ✅ |
| 破音字 | McBopomofo `heterophony{1,2,3}.list` + 自行汇入教育部《一字多音审订表》 | MIT ✅ + CC BY-ND（栏位抽取，⚠️ 需法务确认） |
| 字形转换 | OpenCC `t2tw.json` / `t2s.json` | Apache-2.0 ✅ |
| 标点／符号 | McBopomofo `BPMFPunctuations.txt` + `Symbols.txt`；RIME `symbols.yaml` | MIT ✅ / LGPL（⚠️ 资料档适用性需查证） |
| 补充词频 | RIME `essay.txt` | LGPL-3.0 ⚠️ 建议避开或法务确认 |

**优点**：全部可商用、可修改、可再散布。**这是本报告推荐的路线。**

#### 方案 B：词汇量优先（非商用或已有法务支援）

加入教育部《重编国语辞典修订本》（CC BY-ND 3.0 TW）与 `moedict-data` JSON，
大幅提升词汇覆盖率，但**必须标示来源且不得改写释义文字**。

#### 方案 C：学术研究

加入中研院语料库与 CKIP 词频，可取得最佳品质，但授权谈判成本高。

### 6.8 授权风险总表

| 授权 | 商用 | 修改 | 再散布 | 注意事项 |
|---|---|---|---|---|
| MIT | ✅ | ✅ | ✅ | 保留著作权声明 |
| BSD-3 | ✅ | ✅ | ✅ | 同上 |
| Apache-2.0 | ✅ | ✅ | ✅ | 含专利授权 |
| LGPL-3.0 | ✅ | ✅ | ✅ | **纯资料档的适用性不明，需法务确认** |
| CC BY-SA 3.0 | ✅ | ✅ | ✅ | **衍生作品必须同授权**（传染性）→ IME 词库若修改需以 CC BY-SA 释出 |
| CC BY-ND 3.0 TW | ✅ | ❌ | ✅ | 官方解释允许「格式转换与后续应用」，但**改作边界需法务确认** |
| CC0 | ✅ | ✅ | ✅ | 无限制 |
| 学术专用 | ❌ | ⚠️ | ❌ | 需逐案谈判 |

---

## 7. 测试方法（如何自动评测注音引擎）

### 7.1 评测协定设计

#### 7.1.1 测试集分层（建议 5 层）

| 层级 | 内容 | 规模建议 | 评测重点 |
|---|---|---|---|
| L1 单字 | 常用字 4,000–5,000 字 | ~5,000 句（每句 1 字） | 字级 Top-1、破音字正确率 |
| L2 常用词 | 2–4 字词 | ~10,000 词 | 词级 Top-1、MRR |
| L3 日常对话 | 短句，含口语 | ~2,000 句 | 句级正确率 |
| L4 新闻书面 | 长句，正式语体 | ~2,000 句 | 句级正确率、KSPC |
| L5 压力测试 | 破音字密集、专有名词、罕用字、中英混排 | ~500 句 | 边界行为、不崩溃 |

> **L5 特别重要**：一般 IME 在常用语料上表现都不错，**差异都在边界案例**。
> 建议 L5 从 McBopomofo 的 `heterophony1.list`（528 字）与 `Postprocess.txt` 的
> `assert` 案例自动生成。

#### 7.1.2 语料来源

| 语料 | 取得 | 授权 |
|---|---|---|
| `rime-essay` `essay.txt` | GitHub | LGPL-3.0 ⚠️ |
| 教育部辞典例句 | `moedict-data` | CC BY-ND 3.0 TW |
| 维基百科中文 dump | <https://dumps.wikimedia.org/> | CC BY-SA 4.0 |
| 中央研究院平衡语料库 | 需申请 | 学术用 |
| SIGHAN bakeoff 语料 | <http://ir.itc.ntnu.edu.tw/> / SIGHAN 网站 | 学术用 |
| LREC 2026 IME Benchmark 资料集 | 论文附件（<https://aclanthology.org/2026.lrec-1.337/>） | CC BY 4.0 ✅ |

### 7.2 模拟打字评测框架（可执行的 Python 骨架）

```python
#!/usr/bin/env python3
"""
zhuyin_ime_bench.py — 注音輸入法引擎自動評測
計算：字級/詞級/句級 Top-1、Top-k、MRR、KSPC、CER
"""
from __future__ import annotations
import json, math, unicodedata
from dataclasses import dataclass, field
from typing import Protocol, Sequence

# ─────────────────────────────────────────────────────────────
# 1) 注音音節工具
# ─────────────────────────────────────────────────────────────
INITIAL = set('ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ')
MEDIAL  = set('ㄧㄨㄩ')
RIME    = set('ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ')
TONE    = set('ˉˊˇˋ˙')
APICAL  = set('ㄓㄔㄕㄖㄗㄘㄙ')
TONE_ORDER = {'ˉ': 1, 'ˊ': 2, 'ˇ': 3, 'ˋ': 4, '˙': 5, None: 1}

def parse_syllable(s: str):
    """回傳 (initial, medial, rime, tone)；非法回 None。"""
    tone = None
    if s and s[-1] in TONE:
        tone, s = s[-1], s[:-1]
    i = m = r = ''
    for ch in s:
        if   ch in INITIAL and not (i or m or r): i = ch
        elif ch in MEDIAL  and not (m or r):      m = ch
        elif ch in RIME    and not r:             r = ch
        else:                                     return None
    if not (i or m or r):                      return None
    if not m and not r and i not in APICAL:    return None
    if r == 'ㄦ' and (i or m):                 return None
    return (i, m, r, tone)

def toneless(syl: str) -> str:
    return syl[:-1] if syl and syl[-1] in TONE else syl

# ─────────────────────────────────────────────────────────────
# 2) 中文 → 注音（建立測試集）
# ─────────────────────────────────────────────────────────────
def hanzi_to_zhuyin(text: str) -> list[str]:
    """
    優先用 McBopomofo BPMFBase.txt（最權威、含破音字）；
    退化時用 pypinyin 的 Style.BOPOMOFO。
    """
    table = {}
    with open('BPMFBase.txt', encoding='utf-8') as f:
        for line in f:
            p = line.rstrip('\n').split(' ')
            if len(p) >= 2 and p[0] and p[1]:
                table.setdefault(p[0], p[1])     # 首讀音 = heterophony1 首選
    out = []
    for ch in text:
        if ch in table:
            out.append(table[ch])
        else:
            try:
                from pypinyin import pinyin, Style
                out.append(pinyin(ch, style=Style.BOPOMOFO)[0][0])
            except Exception:
                out.append(ch)                    # 非中文字原樣保留
    return out

def zhuyin_to_keystrokes(syl: str, layout: str = 'standard',
                         with_tone: bool = False) -> str:
    """
    注音 → 大千式按鍵序列。
    對應表與 rime-bopomofo/bopomofo.schema.yaml 的 xlit 完全一致，
    並與 libchewing src/editor/zhuyin_layout/standard.rs 交叉驗證。
    """
    STD = {
        'ㄅ':'1','ㄆ':'q','ㄇ':'a','ㄈ':'z','ㄉ':'2','ㄊ':'w','ㄋ':'s','ㄌ':'x',
        'ㄍ':'e','ㄎ':'d','ㄏ':'c','ㄐ':'r','ㄑ':'f','ㄒ':'v','ㄓ':'5','ㄔ':'t',
        'ㄕ':'g','ㄖ':'b','ㄗ':'y','ㄘ':'h','ㄙ':'n','ㄧ':'u','ㄨ':'j','ㄩ':'m',
        'ㄚ':'8','ㄛ':'i','ㄜ':'k','ㄝ':',','ㄞ':'9','ㄟ':'o','ㄠ':'l','ㄡ':'.',
        'ㄢ':'0','ㄣ':'p','ㄤ':';','ㄥ':'/','ㄦ':'-',
        'ˉ':' ', 'ˊ':'6', 'ˇ':'3', 'ˋ':'4', '˙':'7',
    }
    assert layout == 'standard', 'MVP 只支援大千式'
    t = syl[-1] if syl and syl[-1] in TONE else None
    body = syl[:-1] if t else syl
    keys = ''.join(STD[ch] for ch in body)
    if with_tone:
        keys += STD[t or 'ˉ']
    return keys

# ─────────────────────────────────────────────────────────────
# 3) 引擎介面（任何實作只要符合此 Protocol 即可被評測）
# ─────────────────────────────────────────────────────────────
class ImeEngine(Protocol):
    def feed_keystrokes(self, keys: Sequence[str]) -> None: ...
    def candidates(self) -> list[str]:
        """回傳目前音節序列的候選字/詞，**已依分數由高到低排序**。"""
        ...
    def commit(self) -> str:
        """上屏第 1 候選並清空狀態。"""
        ...
    def reset(self) -> None: ...

# ─────────────────────────────────────────────────────────────
# 4) 指標
# ─────────────────────────────────────────────────────────────
@dataclass
class Metrics:
    n_sentences: int = 0
    n_words: int = 0
    word_top1: int = 0
    word_top5: int = 0
    word_rr_sum: float = 0.0
    char_top1: int = 0
    n_chars: int = 0
    sent_exact: int = 0
    edit_dist_sum: int = 0
    keystrokes: int = 0
    committed_chars: int = 0

    # --- 衍生指標 ---
    @property
    def char_top1_acc(self):  return self.char_top1 / max(1, self.n_chars)
    @property
    def word_top1_acc(self):  return self.word_top1 / max(1, self.n_words)
    @property
    def word_top5_acc(self):  return self.word_top5 / max(1, self.n_words)
    @property
    def mrr(self):            return self.word_rr_sum / max(1, self.n_words)
    @property
    def sent_acc(self):       return self.sent_exact / max(1, self.n_sentences)
    @property
    def cer(self):            return self.edit_dist_sum / max(1, self.n_chars)
    @property
    def kspc(self):           return self.keystrokes / max(1, self.committed_chars)

    def report(self) -> dict:
        return {
            'sentences':        self.n_sentences,
            'char_top1_acc':    round(self.char_top1_acc, 4),
            'word_top1_acc':    round(self.word_top1_acc, 4),
            'word_top5_acc':    round(self.word_top5_acc, 4),
            'mrr':              round(self.mrr, 4),
            'sentence_exact':   round(self.sent_acc, 4),
            'CER':              round(self.cer, 4),
            'KSPC':             round(self.kspc, 4),
        }

def levenshtein(a: Sequence, b: Sequence) -> int:
    """標準編輯距離（S+D+I 的總數）。"""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1,          # 刪除
                           cur[j - 1] + 1,       # 插入
                           prev[j - 1] + (ca != cb)))  # 替換
        prev = cur
    return prev[-1]

# ─────────────────────────────────────────────────────────────
# 5) 主評測迴圈
# ─────────────────────────────────────────────────────────────
def evaluate(engine: ImeEngine,
             corpus: list[tuple[str, list[str]]],
             *,
             with_tone: bool = False,
             gold_words: list[list[str]] | None = None) -> Metrics:
    """
    corpus: [(正解句子, [正解詞, ...]), ...]
    gold_words 若為 None，則以「單字」為詞級評測單位（較寬鬆）。
    """
    m = Metrics()
    for si, (gold_sent, gold_w) in enumerate(corpus):
        syls = hanzi_to_zhuyin(gold_sent)
        engine.reset()
        keys_total = 0

        for syl in syls:
            ks = zhuyin_to_keystrokes(syl, with_tone=with_tone)
            engine.feed_keystrokes(list(ks))
            keys_total += len(ks)

            cands = engine.candidates()
            if not cands:
                continue
            # 字級 Top-1
            if cands[0] == syls[len(syls) - len(syls)]:  # 佔位，見下方修正
                pass

        # 逐音節評測（重新跑一次，這次記錄每個音節的候選）
        engine.reset()
        per_syl_cands: list[list[str]] = []
        for syl in syls:
            ks = zhuyin_to_keystrokes(syl, with_tone=with_tone)
            engine.feed_keystrokes(list(ks))
            per_syl_cands.append(list(engine.candidates()))

        # 逐字（以「每個音節對應的正解字」為 ground truth）
        for idx, (gold_ch, cands) in enumerate(zip(gold_sent, per_syl_cands)):
            if not cands:
                continue
            m.n_chars += 1
            if cands[0] == gold_ch:
                m.char_top1 += 1
            # 詞級：以音節為查詢單位，找正解字在候選中的排名
            m.n_words += 1
            try:
                rank = cands.index(gold_ch) + 1
            except ValueError:
                rank = None
            if rank == 1:  m.word_top1 += 1
            if rank and rank <= 5: m.word_top5 += 1
            if rank:       m.word_rr_sum += 1.0 / rank

        # 句級
        committed = engine.commit()
        m.n_sentences += 1
        m.committed_chars += len(committed)
        m.keystrokes += keys_total
        if committed == gold_sent:
            m.sent_exact += 1
        m.edit_dist_sum += levenshtein(committed, gold_sent)

    return m

# ─────────────────────────────────────────────────────────────
# 6) 破音字專項評測（用 McBopomofo Postprocess.txt 的 assert）
# ─────────────────────────────────────────────────────────────
def parse_postprocess_asserts(path: str) -> list[tuple[str, str]]:
    """
    解析形如：
        assert ㄧˋ-ㄎㄜ-ㄊㄤˊ-ㄍㄨㄛˇ  一顆-糖果
    回傳 [(注音序列, 期望詞序列)]
    """
    cases = []
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line.startswith('assert'):
            continue
        parts = line.split()
        if len(parts) != 3:
            continue
        _, zhuyin, words = parts
        cases.append((zhuyin, words.replace('-', '')))
    return cases

# ─────────────────────────────────────────────────────────────
# 7) 進入點
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import sys
    # corpus 範例：(正解句子, [詞,...])
    corpus = [
        ('我今天去學校', ['我', '今天', '去', '學校']),
        ('這是一顆糖果', ['這', '是', '一顆', '糖果']),
        ('他讀醫科大學', ['他', '讀', '醫科', '大學']),
    ]
    # engine = YourEngine(...)   # 換成你的實作
    # m = evaluate(engine, corpus, with_tone=False)
    # print(json.dumps(m.report(), ensure_ascii=False, indent=2))
    print('把 engine 換成你的實作後執行；期望輸出：')
    print(json.dumps(Metrics().report(), ensure_ascii=False, indent=2))
```

> **使用说明**：
> 1. `ImeEngine` 是唯一需要你实作的介面（`Protocol`）—— 这让「同一份评测」可用于
>    libchewing、RIME、自制引擎，甚至是远端 HTTP 服务。
> 2. `with_tone=False` 是**真实使用情境**（多数人不打声调）；
>    `with_tone=True` 则是**基准线**，用于量测声调键的成本。
> 3. `hanzi_to_zhuyin` 与 `zhuyin_to_keystrokes` 必须是**可信任的 ground truth 生成器**；
>    上线前应用第 8 节的 `Postprocess.txt` assert 案例验证它们。
> 4. **`Metrics.report()` 的 KSPC 是「实际按键数 / 实际上屏字数」**，
>    而非 MacKenzie 的语料加权版本 —— 这是**模拟打字的正确算法**，
>    因为它把使用者的选字负担算进去了。

### 7.3 现成工具

| 工具 | 位置 | 用途 |
|---|---|---|
| libchewing 测试 | `chewing/libchewing` → `tests/`（`test-bopomofo.c`、`test-keyboard.c`、`test-config.c`） | 键盘排列与音节的单元测试，**是键盘排列的权威测试案例集** |
| libchewing Swift 测试 | `libchewing/swift/unit_tests/ChewingTests_Suite1.swift` | 跨语言验证 |
| libchewing 按键脚本工具 | `libchewing/scripts/create_keystroke_from_text.py` | **直接把文字转成按键序列**，可作为本框架的替代实作 |
| libchewing diff 工具 | `libchewing/scripts/gendiff-from-libchewingdata.sh` | 词库版本差异 |
| RIME 命令列 | `librime` → `rime_api_console` | 对 schema 送按键并取候选 |
| McBopomofo 测试 | `openvanilla/McBopomofo` → `McBopomofoTests/KeyHandlerBopomofoTests.swift` | 真实产品的行为测试 |
| LREC 2026 IME Benchmark | <https://aclanthology.org/2026.lrec-1.337/> （CC BY 4.0） | **论文自述提供 datasets + evaluation scripts**，可直接下载 |

### 7.4 可重现性要求（CI 建议）

| 要求 | 做法 |
|---|---|
| 固定语料版本 | 语料档以 git submodule 或 hash 钉住 |
| 固定引擎版本 | 记录 commit hash |
| 确定性 | 排序必须 deterministic（参考 libchewing 的 `phrase DESC` tie-breaker） |
| 分层报表 | L1–L5 分开报，不可只报总平均 |
| 回归门槛 | 任一层级指标下降 > 1% 即 CI 失败 |
| assert 测试 | 把 `Postprocess.txt` 的 assert 与 `heterophony*.list` 全数转为单元测试 |
| 效能 | 记录 P50/P95 的「按键 → 候选显示」延迟 |

### 7.5 建议的 CI 测试金字塔

```
        ┌──────────────────────────┐
        │  L5 邊界／壓力（~500）    │  手動 + nightly
        ├──────────────────────────┤
        │  L3/L4 句級（~4,000）     │  nightly
        ├──────────────────────────┤
        │  L2 詞級（~10,000）       │  每次 PR
        ├──────────────────────────┤
        │  L1 字級 + 破音字 assert  │  每次 commit（< 10 s）
        ├──────────────────────────┤
        │  單元測試：音節 DFA、      │  每次儲存
        │  鍵盤排列、詞頻公式        │
        └──────────────────────────┘
```

---

## 8. 最小可行引擎（MVP）需要哪些模组

### 8.1 必要模组（缺一不可）

| # | 模组 | 职责 | 关键规格 | 建议授权来源 |
|---|---|---|---|---|
| **M1** | **注音符号资料表** | 37 符号 + 5 声调的列举、Unicode 码位、类别（声母/介音/韵母/声调） | 见 §1.1；`Bopomofo` enum 建议用 16-bit bitfield 打包 `initial/medial/rime/tone`（libchewing 做法：`NonZeroU16`，index 各占 7/2/4/3 bits） | 自建 |
| **M2** | **音节状态机（SyllableEditor）** | 解析注音序列 → 合法音节；拒绝非法序列 | 见 §1.3、§3.2.1。**介面必须抽象成 trait**，大千式为第一个 impl | 自建（参考 libchewing `standard.rs`，LGPL → **需自行重写以免传染**） |
| **M3** | **键盘排列层（KeyboardLayout）** | keycode → 注音事件 | 见 §2.1 完整 41 键表。**MVP 只需大千式** | 自建（对照表不受著作权保护，但请自行输入） |
| **M4** | **词库（Lexicon）** | 词 → 注音序列 → log10 词频；支援多读音 | 见 §6.7 方案 A。含 `BPMFBase`(单字) + `BPMFMappings`(词) + `phrase.occ`(频率) | **McBopomofo（MIT）** ✅ |
| **M5** | **词频计算器** | 由 occurrence 产生 log10 分数 | 见 §3.4.1 公式（`fscale = 2.7`、`log10`、exclusion 扣除）。**离线预算，执行期只查表** | 自建（公式可自由使用） |
| **M6** | **切词 + 转换（Translator）** | 音节序列 → 词序列（词图 + DP） | 见 §3.3.1。`dp[j] = max(dp[i] + logP(w))`，`max_phrase_length` 建议 6 | 自建 |
| **M7** | **候选排序器（Ranker）** | 多候选的排序与去重 | 见 §3.4.4 综合公式。MVP 只需 `詞頻 + 破音字優先序 + user_score` | 自建 |
| **M8** | **破音字表** | 每个破音字的读音优先序 | 见 §3.5.2。**MVP 先用 McBopomofo 611 字**；要覆盖教育部 4,253 字需自行汇入（⚠️ 授权需法务确认） | McBopomofo（MIT）+ 教育部（CC BY-ND） |
| **M9** | **使用者学习（User Lexicon）** | 记录使用者选字、提升 `user_freq` | 见 §3.4.3。**直接照抄常数**：`SHORT=10 / MEDIUM=5 / LONG=1 / MAX=9999999`；排序用 `max(freq, user_freq)` | 自建（常数为事实性参数） |
| **M10** | **候选 UI（Presenter）** | 显示候选、选字键、翻页 | 见 §3.6.2。9 个一页、数字键直选、`Tab`/方向键翻页 | 自建 |
| **M11** | **输出层：全形/半形 + 标点** | 标点智慧对应、全形转换 | 见 §4.3.1、§4.3.2 对应表 | 自建 + McBopomofo MIT |
| **M12** | **（可选但强烈建议）繁简／字形转换** | 台湾字形在地化 | OpenCC `t2tw.json`（繁→繁字形）；若要输出简体加 `t2s.json` | **OpenCC（Apache-2.0）** ✅ |

### 8.2 MVP 明确**不做**的事（避免范围蔓延）

| 不做 | 理由 | 何时做 |
|---|---|---|
| 许氏／倚天／IBM／精业键盘 | 大千式覆盖 >95% | 第二阶段（M2 已是 trait，加 impl 即可） |
| bigram/trigram LM | 学术 baseline 显示词库在短输入仍胜（§5.4） | 第二阶段 |
| 神经 LM / LLM 重排 | 延迟成本高（TTFT 0.28–0.61 s，§5.4） | 第三阶段 |
| 云端个人化 | 无可信公开格式、隐私成本高 | 第三阶段 |
| 错误更正（fuzzy） | 非核心体验，但**是差异化点** | 第二阶段 |
| 联想词 | 需 bigram 资料 | 第二阶段 |
| 注音以外的输入法 | 专注 | 永不做（或另开专案） |

### 8.3 MVP 建置顺序（建议 6 个 sprint）

| Sprint | 产出 | 验收标准 |
|---|---|---|
| 1 | M1 + M3 + M2 | 打 `ㄇㄚˇ` 能正确解析为 `(ㄇ,∅,ㄚ,ˇ)`；打 `ㄅ` 单独不合法；`/` + `ㄥ` 正确 |
| 2 | M4 + M5 | 载入 145,603 词 + 161,806 词频；能查 `ㄇㄚˇ` 的同音字清单 |
| 3 | M6 + M7 | 打 `ㄐㄧㄣ-ㄊㄧㄢ` 首选「今天」；§3.4.2 的 assert 全过 |
| 4 | M8 + M9 | 「一颗糖果」需打 `ㄧˋ-ㄎㄜ` 才出「一颗」；手动选字一次后，下次首选即正确 |
| 5 | M10 + M11 | 候选视窗、数字选字、标点智慧对应、全形切换 |
| 6 | M12 + §7 评测框架 | 跑完 L1–L4，产出报表；指标达 §5.6 目标 |

### 8.4 架构图（MVP）

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 候選視窗 M10 │  │ 狀態列（中/英）│  │ 設定（鍵盤排列）│  │
│  └──────┬───────┘  └──────────────┘  └───────────────┘  │
├─────────┼───────────────────────────────────────────────┤
│  Core   ▼                                                │
│  ┌────────────────┐   ┌──────────────────────────────┐  │
│  │ 編輯器狀態機    │   │ Translator M6                │  │
│  │ SyllableEditor │──▶│  詞圖 + DP                    │  │
│  │ M2             │   └──────────┬───────────────────┘  │
│  └───────▲────────┘              ▼                       │
│          │              ┌──────────────────┐             │
│  ┌───────┴────────┐     │ Ranker M7        │             │
│  │ KeyboardLayout │     │ 詞頻+破音字+user │             │
│  │ M3 (大千式)     │     └────────┬─────────┘             │
│  └────────────────┘              ▼                       │
│                          ┌──────────────────┐            │
│                          │ 輸出層 M11/M12   │            │
│                          │ 標點/全形/OpenCC │            │
│                          └──────────────────┘            │
├──────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Lexicon  │ │ 詞頻表    │ │ 破音字表  │ │ UserLexicon│  │
│  │ M4 (MIT) │ │ M5       │ │ M8       │ │ M9 (SQLite)│  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 8.5 效能预算（MVP 目标）

| 项目 | 目标 | 做法 |
|---|---|---|
| 载入时间 | < 500 ms | 词库预编译成 binary trie / hash map（libchewing 的 `chewing.dat` + `uhash.dat` 模式） |
| 按键 → 候选 | < 30 ms (P95) | 音节查表 O(1)；DP 视窗限制在当前句 |
| 记忆体 | < 150 MB | 词频以 `f32` 或 `i16` 量化；不需载入完整释义 |
| 词库大小 | < 20 MB | 145K 词 + 162K 词频，压缩后远小于此 |

---

## 9. 需查证清单（依优先序）

| # | 项目 | 已尝试 | 建议下一步 |
|---|---|---|---|
| 1 | **注音 KSPC 的实测基准值** | 无学术文献专门分析注音 KSPC | 用 §7.2 框架对真实语料实测 |
| 2 | **411 音节的官方出处** | 教育部手册未见明文 | 查《国音学》（正中书局）或写信问教育部 |
| 3 | **台湾使用者平均注音打字速度（字/分）** | 仅找到特教／国小研究，不可外推 | 查资策会／TQC 中文输入检定标准 |
| 4 | **中研院语料库规模与授权** | GitHub API 限速、S2 429、页面需登入 | 直接联系 CKIP <https://ckip.iis.sinica.edu.tw/> |
| 5 | **教育部辞典「栏位抽取 + 重新编排」是否构成改作** | 取得官方「不限制格式转换及后续应用」声明 | 法务确认；或只用 McBopomofo（MIT） |
| 6 | **LGPL-3.0 套用于纯资料档（`essay.txt`）的法律效力** | — | 法务确认；或改用 MIT 的 `phrase.occ` |
| 7 | **`fscale = 2.7` 的调参依据** | 原始码无注解说明 | 自行做 ablation（2.0 / 2.7 / 3.0） |
| 8 | **RIME 使用者词典的频率更新公式** | schema 层未公开 | 读 librime 原始码 `src/rime/translator/` |
| 9 | **微软新注音自订词汇的汇入格式** | 闭源 | 逆向工程或使用者文件 |
| 10 | **Google 注音输入法／微软的云端个人化机制** | 无公开技术文件 | 专利检索（Google Patents） |
| 11 | **神经 LM 在注音（非拼音）上的实测增益** | LREC 2026 论文只测 Pinyin/Romaji | 自行实验；注音的声韵分离可能带来不同特性 |
| 12 | **教育部《重订标点符号手册》官方 URL** | 猜测的 URL 未验证 | 从教育部语文成果网首页导览寻找 |
| 13 | **《一字多音审订表》PDF 内文与 4,253 字的完整清单** | 只取得维基百科转述 | 下载 PDF 并解析（本次未执行） |
| 14 | **`chewing-data` repo 的正确位置** | `chewing/chewing-data` 回 404 | libchewing 的 `CMakeLists.txt` 只引用 `data/dict/chewing/word.dat`；实际资料可能由建置时下载 |
| 15 | **KenLM 的精确授权** | README 未明示 | 读 repo 内 `COPYING` |

---

## 10. 来源清单

### 10.1 开源专案（✅ 已实际下载档案）

| 专案 | URL | 授权 | 取用内容 |
|---|---|---|---|
| McBopomofo（小麦注音） | <https://github.com/openvanilla/McBopomofo> | **MIT** ✅ | `BPMFBase.txt`、`BPMFMappings.txt`、`phrase.occ`、`heterophony*.list`、`exclusion.txt`、`Makefile`、`README.md`、`AGENTS.md`、`curation/*.py`、`Postprocess.txt` |
| libchewing（新酷音） | <https://github.com/chewing/libchewing> | **LGPL-3.0** ✅ | `src/editor/zhuyin_layout/*.rs`（8 种键盘排列）、`src/editor/estimate.rs`、`src/dictionary/sqlite.rs`、`src/dictionary/loader.rs`、`capi/include/chewing.h`、`scripts/create_keystroke_from_text.py` |
| RIME bopomofo | <https://github.com/rime/rime-bopomofo> | **LGPL-3.0** ✅ | `bopomofo.schema.yaml`、`bopomofo_tw.schema.yaml`、`bopomofo_express.schema.yaml`、`detenele.schema.yaml`、`zhuyin.yaml` |
| RIME essay（八股文） | <https://github.com/rime/rime-essay> | **LGPL-3.0** ✅ | `essay.txt`（442,688 行词频） |
| RIME terra-pinyin | <https://github.com/rime/rime-terra-pinyin> | **CC BY-SA 3.0**（源自 CC-CEDICT） | `terra_pinyin.dict.yaml`（99,329 列） |
| RIME prelude | <https://github.com/rime/rime-prelude> | LGPL ⚠️ | `symbols.yaml`、`default.yaml` |
| OpenCC | <https://github.com/BYVoid/OpenCC> | **Apache-2.0** ✅ | `s2twp.json`、`s2t.json`、`t2tw.json` |
| g0v moedict-data | <https://github.com/g0v/moedict-data> | 转换部分 **CC0** ✅；辞典本文 CC BY-ND 3.0 TW | `dict-revised.json` 等 |
| libtabe（McBopomofo 词库源头） | （BSD，经 McBopomofo README 引述） | **BSD** | `tsi.src` |

### 10.2 官方标准与政府资料

| 来源 | URL | 授权／备注 |
|---|---|---|
| 教育部《国语注音符号手册》 | <https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/index.html> | 内嵌字型 CC BY-ND 3.0 TW；✅ 已验证可读 |
| 教育部《国语辞典公众授权网》 | <https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html> | ✅ 已验证；**CC BY-ND 3.0 TW** 授权原文 |
| 教育部《重编国语辞典修订本》 | <https://dict.revised.moe.edu.tw/> | CC BY-ND 3.0 TW |
| 教育部《国语辞典简编本》 | <https://dict.concised.moe.edu.tw/> | CC BY-ND 3.0 TW |
| 教育部《国语小字典》 | <https://dict.mini.moe.edu.tw/> | CC BY-ND 3.0 TW |
| 教育部《成语典》 | <http://dict.idioms.moe.edu.tw/> | CC BY-ND 3.0 TW |
| 《重编国语辞典修订本》与《一字多音审订表》取音差异表 | <https://dict.revised.moe.edu.tw/appendix.jsp?ver=4&ID=40> | ✅ 已验证 |
| 教育部国语一字多音审订表（88年公告） | <https://language.moe.gov.tw/uploads/files/17860007801063.pdf> | ⚠️ 未下载 |
| 教育部国语一字多音审订表初稿（101年） | <https://language.moe.gov.tw/files/people_files/%e5%88%9d%e7%a8%bf.pdf> | ⚠️ 未下载 |
| 教育部国语一字多音审订说帖 | <https://language.moe.gov.tw/files/people_files/%e8%aa%aa%e5%b8%96.pdf> | ⚠️ 未下载 |
| 教育部一字多音审订网站 | <https://language.moe.gov.tw/result.aspx?classify_sn=42&subclassify_sn=443> | |
| Unicode 注音符号码表 | <http://www.unicode.org/charts/PDF/U3100.pdf> | U+3100–U+312F |
| CLDR（注音相关） | <https://github.com/unicode-org/cldr> | ⚠️ 未验证是否含注音↔拼音表 |

### 10.3 学术文献

| # | 文献 | URL | 授权 |
|---|---|---|---|
| 1 | MacKenzie, I. S. (2002). *KSPC (keystrokes per character) as a characteristic of text entry techniques.* MobileHCI 2002, LNCS 2411, pp. 195–210. DOI `10.1007/3-540-45756-9_16` | <https://www.yorku.ca/mack/hcimobile02.html> ✅ 全文 | 作者自架 |
| 2 | MacKenzie, I. S. (2003). *Metrics for text entry research: An evaluation of MSD and KSPC, and a new unified error metric.* CHI 2003 | <https://www.yorku.ca/mack/chi03.html> | 作者自架 |
| 3 | Zou, Y., Lee, T., Fan, X., & Li, J. (2026). *Benchmarking Large Language Models for Chinese and Japanese IMEs.* LREC 2026, pp. 4290–4311. DOI `10.63317/42jiimjriyga` | <https://aclanthology.org/2026.lrec-1.337/> ✅ 全文 PDF | **CC BY 4.0** |
| 4 | Soukoreff, W., & MacKenzie, I. S. (1995). *Theoretical upper and lower bounds on typing speeds using a stylus and soft keyboard.* Behaviour & IT 14, 370–379. DOI `10.1080/01449299508914656` | （引用自文献 1） | |
| 5 | Silfverberg, M., MacKenzie, I. S., & Korhonen, P. (2000). *Predicting text entry speed on mobile phones.* CHI 2000, 9–16. DOI `10.1145/332040.332044` | （引用自文献 1） | |
| 6 | 廖伟超（2020）。《注音输入法的错误更正与选字预测之研究》。国立暨南国际大学资讯工程学系硕士论文（109 学年度），指导教授黄光璇 | <https://www.airitilibrary.com/Article/Detail/U0020-1608202111381600> | ⚠️ 仅取得书目与摘要 |
| 7 | 〈语境注音输入法之研究〉（A Context-Sensitive Approach to Word Prediction in Jhuyin Input Method）。国立暨南国际大学（111 学年度） | <https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi/login?o=dnclcdr&s=id=%22111NCNU0392012%22.&searchmode=basic> | ⚠️ 仅取得书目与摘要 |
| 8 | 〈中文电脑注音输入系统之字键定位研究〉（1987）。国立成功大学工业管理研究所，指导教授李再长 | <https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi?o=dnclcdr&s=id=%22075NCKU2041002%22.&searchmode=basic> | ⚠️ 仅取得书目 |
| 9 | 〈注音输入法与纵横输入法教学对国小资源班学生中文输入学习成效〉 | <http://rportal.lib.ntnu.edu.tw/bitstreams/54fa64ec-a72c-4dec-ae5b-aa3ae4cd9226/download> | ⚠️ 仅取得摘要 |
| 10 | Transformer-based 注音输入法（国立台北大学资讯工程学系） | <https://www.csie.ntpu.edu.tw/uploads/file/f1_202606101504240352.pdf> | ⚠️ 仅取得摘要片段 |

### 10.4 百科与参考资料

| 条目 | URL |
|---|---|
| 注音符号 | <https://zh.wikipedia.org/wiki/%E6%B3%A8%E9%9F%B3%E7%AC%A6%E8%99%9F> |
| 注音输入法 | <https://zh.wikipedia.org/wiki/%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95> |
| 现代标准汉语拼音对照表 | <https://zh.wikipedia.org/wiki/%E7%8F%BE%E4%BB%A3%E6%A8%99%E6%BA%96%E6%BC%A2%E8%AA%9E%E6%8B%BC%E9%9F%B3%E5%B0%8D%E7%85%A7%E8%A1%A8> |
| 国语一字多音审订表 | <https://zh.wikipedia.org/wiki/%E5%9C%8B%E8%AA%9E%E4%B8%80%E5%AD%97%E5%A4%9A%E9%9F%B3%E5%AF%A9%E8%A8%82%E8%A1%A8> |
| 多音字 | <https://zh.wikipedia.org/wiki/%E5%A4%9A%E9%9F%B3%E5%AD%97> |
| 现代标准汉语音系 | <https://zh.wikipedia.org/wiki/%E7%8F%BE%E4%BB%A3%E6%A8%99%E6%BA%96%E6%BC%A2%E8%AA%9E%E9%9F%B3%E7%B3%BB> |
| Bopomofo (English) | <https://en.wikipedia.org/wiki/Bopomofo> |
| RIME 官方文件 | <https://rime.im/> / <https://github.com/rime/home/wiki> |
| 小麦注音词库开发说明 | <https://github.com/openvanilla/McBopomofo/wiki/%E8%A9%9E%E5%BA%AB%E9%96%8B%E7%99%BC%E8%AA%AA%E6%98%8E> |

---

## 附录 A：大千式按键 ↔ 注音 一键复制表（CSV）

```csv
key,zhuyin,kind,pos
1,ㄅ,initial,num
2,ㄉ,initial,num
3,ˇ,tone3,num
4,ˋ,tone4,num
5,ㄓ,initial,num
6,ˊ,tone2,num
7,˙,tone5,num
8,ㄚ,rime,num
9,ㄞ,rime,num
0,ㄢ,rime,num
-,ㄦ,rime,num
q,ㄆ,initial,top
w,ㄊ,initial,top
e,ㄍ,initial,top
r,ㄐ,initial,top
t,ㄔ,initial,top
y,ㄗ,initial,top
u,ㄧ,medial,top
i,ㄛ,rime,top
o,ㄟ,rime,top
p,ㄣ,rime,top
a,ㄇ,initial,home
s,ㄋ,initial,home
d,ㄎ,initial,home
f,ㄑ,initial,home
g,ㄕ,initial,home
h,ㄘ,initial,home
j,ㄨ,medial,home
k,ㄜ,rime,home
l,ㄠ,rime,home
;,ㄤ,rime,home
z,ㄈ,initial,bottom
x,ㄌ,initial,bottom
c,ㄏ,initial,bottom
v,ㄒ,initial,bottom
b,ㄖ,initial,bottom
n,ㄙ,initial,bottom
m,ㄩ,medial,bottom
",",ㄝ,rime,bottom
.,ㄡ,rime,bottom
/,ㄥ,rime,bottom
(space),ˉ,tone1,bottom
```

## 附录 B：RIME 注音方案的 `xlit` 对照字串（可直接复制）

```
# keymap（41 鍵，含空格）
1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/- 6347

# 對應符號（41 個，順序一一對應）
ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˉˊˇˋ˙
```

## 附录 C：实测音节清单

本报告推导的完整清单已存于本目录（可直接取用）：

| 档案 | 内容 |
|---|---|
| [`data/toneless_list.txt`](data/toneless_list.txt) | **429 个无声调音节**（含 21 个杂讯，清理后 **408**），依注音符号顺序，一行一个 |
| [`data/tonal_list.txt`](data/tonal_list.txt) | **1,413 个含声调音节**（一声不标符号） |
| [`data/syll_table.txt`](data/syll_table.txt) | 含**出现次数**的完整统计表（可用于设计候选排序权重） |
| [`data/BPMFMappings.txt`](data/BPMFMappings.txt) | McBopomofo 原始词库（145,603 行，**MIT**），词 → 逐字注音 |

> **取用建议**：`data/toneless_list.txt` 可直接当作合法性检查的 lookup set。
> 若要严格版，过滤掉长度 1 的非舌尖音节（ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒ 共 14 个）
> 以及 ㄆㄧㄚ／ㄈㄧㄠ／ㄋㄨㄣ／ㄓㄟ／ㄙㄟ／ㄝ／ㄟ／ㄥ／ㄧㄜ 共 9 个边缘项，得到 **406 个核心音节**。

---

*报告结束。所有标记 ✅ 的数字皆为本报告自行下载资料档并以程式统计所得；
标记 ⚠️ 需查证者请见第 9 节的建议下一步。*
