# 台湾「自然输入法」（IQT 网际智慧）产品线竞品研究报告

> 研究对象：自然输入法（自然智慧型中文输入系统）、网际智慧股份有限公司（IQ Technology Inc.）
> 官网：[https://www.text.tw/](https://www.text.tw/)（产品线）、[https://www.iqt.ai/](https://www.iqt.ai/)（公司／多产品线）
> 报告产出时间：2026 年 9 月（以站上最新资料为准）

---

## 0. 研究方法与限制（请先读）

**本报告的`web_search` 工具在本次研究中全程故障**，无法使用。错误如下（多次重试皆相同）：

```
DeepSeek returned an unprocessable response body: SyntaxError: Unexpected token 'e', "e - ..." is not valid JSON
The web search request used endpoint "https://api.deepseek.com/anthropic/v1/messages".
```

`net_doctor` 显示 HTTPS 探测正常（`https://api.deepseek.com/` 回 401），因此**问题出在 web-search 外挂所使用的那个 endpoint／回应格式，而非网路断线**。这需要使用者到「Settings > Plugins > Plugin configuration > Web search」更改 Endpoint，或设定 `DEEPSEEK_SEARCH_BASE_URL`；本报告作者为子代理，权限内无法修改此设定，**建议交由上层处理**。

因此本研究改用替代路径，实际可用的来源管道如下（皆已验证）：

| 管道 | 状态 | 备注 |
|---|---|---|
| `web_fetch` 工具 | ✅ 可用 | 走 Windows proxy；**内容会被截断**，长页面需另寻方法 |
| 自建 `curl` 抓取 + 纯文字化 | ✅ 可用 | 本报告主要工具，可完整取得页面 |
| Wikipedia API（`action=query&prop=extracts`） | ✅ 可用 | 需加 `exlimit=max`，且会限流 |
| **Wayback Machine（web.archive.org）** | ✅ 可用 | 取回旧版官网、被封锁的论坛页面的关键手段 |
| PTT 网页版（`ptt.cc`） | ✅ 可用 | 可直接抓文章与看板搜寻 |
| iTunes Search／Lookup API | ✅ 可用 | 查台湾 App Store 上架状况与评分 |
| Google／Bing／Brave／Ecosia／Startpage／Qwant／Mojeek／Yahoo TW／Baidu／Sogou／DuckDuckGo | ❌ 全数被挡 | 主因是**代理 IP 信誉不佳**（`s.jina.ai` 回报 `bad network reputation (AS36352)`），验证码／429／302 回圈 |

**重要副作用**：`lite.duckduckgo.com` 在本次研究初期可用（成功取得约 20 笔有效结果），随后即被 DuckDuckGo 反机器人验证封锁。所有「搜寻引擎式」的探索都受限，本报告因此**偏向以官方站、Wayback 档案、PTT 讨论与 Wikipedia 等一手／可验证来源为主**，并在查不到时明确标示「未能查证」。

**标示惯例**：`【官方】`＝ IQT／教育部等发布者自述；`【第三方】`＝ 媒体、部落客、社群、维基百科；`【未證實】`＝ 仅见于论坛、无法交叉验证的说法；`未能查證`＝ 本次研究找不到可靠来源。

---

## 1. 产品史：从国音输入法到 V13

### 1.1 起源与定位

【官方，存档】自然输入法全名「自然智慧型中文输入系统」，1990 年由**中央研究院资讯科学研究所许闻廉博士**发明，早期称为「**国音输入法**」。原始技术文件为许闻廉、陈克健于 1993 年发表的〈「自然」智慧型输入系统的语意分析─脉络会意法〉。
- 存档官方沿革页（2018 撷取）：[iq-t.com/PRODUCTS/version.asp](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)
- 1993 年论文（存档）：[脉络会意法 PDF](https://web.archive.org/web/20061015034341/http://iasl.iis.sinica.edu.tw/webpdf/paper-1993-c02.pdf)

【官方】该页自述：以「全句语意分析」为原则，用**样式比对（pattern matching）**建立字词出现的环境特征，而非单纯字频／词频统计；经**八百万字报纸语料**测试，平均正确率达 **95%**。这是自然输入法数十年来的技术主轴（「**脉络会意法**」）。【第三方】维基百科亦转引同一说法：[自然输入法 - 维基百科](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)

【官方，2018 存档】该页同时声称「目前使用者约达到 **150 万人**」。此为 2018 年官方数字，**现况未能查证**。

### 1.2 版本演进年表

以下年表以【官方，2018 存档沿革页】为主干（1990–2005），2009 年之后以【第三方】维基百科与【官方】现行版本更新纪录补足。

| 年份 | 版本 | 环境 | 重大功能／事件 | 来源 |
|---|---|---|---|---|
| 1990 | 国音输入法 | DOS | 许闻廉开发；全句语意分析、自动辨认同音字 | [官方存档](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp) |
| 1993 | 国音输入法 V2.11 | DOS | 获第一届十大杰出中文资讯产品奖 | 同上 |
| 1994 | 自然注音输入法 V3.1 | Windows 3.1 | 以「全句语意分析」依上下文选取同音字 | 同上 |
| 1996 | 自然输入法 V4.0（Open Chinese 开放式中文输入系统） | Windows 95 / NT | 首次以「Open Chinese」为名 | 同上 |
| 1998 | 自然输入法 V5.0 | Windows 98 / NT 4.0 | 法务部长颁奖表扬 | 同上 |
| 1999 | 自然新注音、自然输入法 99（V5.04） | — | 教育部长颁奖表扬 | 同上 |
| 2001 | 自然输入法 V6.0 | Windows Me / 2000 | 强化语意分析；融合注音、仓颉、拼音、语音、容错 | [官方存档](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)、[维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 2002 | 自然输入法 V6.5 | — | 荣获海华奖；为支援 Windows XP 改为全 32 位元 | 同上 |
| 2003 | 自然输入 2003（V7.0） | Windows XP | 行政院研考会颁奖；新增 **Big5E 外字**、罕见字、**日文平假名／片假名**、Unicode 输出、简体字输出、通用拼音／汉语拼音／注音／点字码输出、部首查询、语音朗读 | [维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 2004 | 自然输入 2003（V7.5） | — | 荣获**教育部金学奖** | [官方存档](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)、[iqt.ai/intro](https://www.iqt.ai/intro) |
| 2005 | 自然输入 8（V8.0）**华语教学加强版** | Windows 2000 / XP / 2003 | 主推华语听说拼写与教学；侨委会**海华奖**；支援各国 Windows 不必改 locale；新增音标、一字多音、同音字词、近音字、部首笔画、成语、发声；可输出正体／简体／音标 | [维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)、[iqt.ai/intro](https://www.iqt.ai/intro) |
| 2009 | 自然输入 9（V9.0） | Vista / Windows 7（限 32 位元） | 提升选字正确率；支援数十种线上游戏（魔兽争霸、天堂、天龙八部）自订虚拟宝物名词；支援 Windows Live Messenger／Yahoo! Messenger；100+ 表情符号、1000+ 特殊符号 | [维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 2013 | 新自然输入法 **V10.0** | Windows 7 / 8 Desktop + Metro | **云端词库备份还原**；分「**注音版（免费）**」与「**专业版（付费）**」 | 同上 |
| 2013 | V10.1 | Windows 8 | 支援平板模式（Win10 平板模式下仍需外接键盘） | 同上 |
| 2014 | 自然输入法 **Mac 版** | macOS | 首次跨出 Windows | 同上 |
| 2016 | 自然输入法 **V11** | Win 7 / 8 / 8.1 / 10、OS X 10.10+ | 大版本更新 | 同上 |
| 2020 | 自然输入法 **V12** | Windows 10 1607+、macOS Mojave 10.14+ | 数字快打、符号 2.0、词语管理 2.0 | 同上 |
| 2021 | V12（更新） | macOS Big Sur 11.0、Apple Silicon M1 | **改采订阅制**（年／季／月缴、自动续订），同时提供 V12 注音免费版 | 同上 |
| 2023 | 自然输入法 **V13** | Windows 11、Windows 10 1903+、macOS Catalina 10.15+ | **长句联想**、**英文联想**、**智慧中英切换**；提供**买断序号版**与订阅；另有 **V13 Lite 版（仅 Windows）** | 同上 |
| 2025 | V12 停止维护更新 | — | 【官方】「V12 已于 2025 年停止维护更新」 | [text.tw/releasenotes](https://www.text.tw/releasenotes) |
| 2026 | V13 安全性更新 | Windows / macOS | 2026/09/08 释出「因应资安规范进行安全性强化」版本 | [text.tw/releasenotes](https://www.text.tw/releasenotes) |

**停止维护时程【官方】**：V11 已于 **2022 年**停止维护更新；V12 已于 **2025 年**停止维护更新。
来源：[text.tw/releasenotes](https://www.text.tw/releasenotes)

**官方贩售政策【官方】**：「于 2023.09.06 起，官网仅贩售自然输入法 V13。目前 V11 已停止维护更新，不提供技术支援。」
来源：[text.tw/compare](https://www.text.tw/compare)

**公司沿革**：`text.tw` 页尾为「Copyright © 1995-2026 IQ Technology Inc.」【官方】，可推得 IQT 以 1995 年为公司起算年。公司登记细节本次**未能查证**（未查经济部商业司）。

### 1.3 在台湾输入法史上的地位

【第三方】维基百科将其定位为**台湾最早期、也是少数商业化的「智慧型」注音输入法**，与微软新注音、新酷音、Yahoo!奇摩输入法并列为注音输入法的四大代表。其历史意义在于：

1. **把「自动选字」变成商品**：在 1990 年代微软新注音尚未成熟时，以「脉络会意法」提供可用于实务的注音自动选字，是台湾注音输入法从「逐字选字」走向「整句输入」的关键推手。
2. **许氏键盘的发明地**：许氏键盘由许闻廉所创，以 25 键、声韵不分离的方式降低手指移动，是台湾自制键盘排列中最广为人知的一种（[维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)）。
3. **司法体系的实质标准**：太易资讯（大易输入法公司）原开发的「追音输入法」，后由**司法院委托网际智慧重新开发**为「司法院智慧型输入法」，2017 年已发展到**第四代**，支援 Windows 10/11、Unicode 6.0、司法院造字。**官方明言「每一套『司法院智慧型输入法』都包含了一套『自然输入法软体』在里面」**（[text.tw/chasew](https://www.text.tw/chasew)）。这是自然输入法技术进入公部门核心文书流程的直接证据。
4. **华语教学用途**：V8.0 起主打华语教学（音标、拼音输出、发声），并获教育部金学奖、侨委会海华奖（[iqt.ai/intro](https://www.iqt.ai/intro)）。

---

## 2. 现行版本、平台、`text.tw` 定位、价格与授权

### 2.1 最新版号与作业系统支援

【官方】现行最新版本（截至 2026 年 9 月）：

| 平台 | 版号 | 释出日 | 系统需求 | 备注 |
|---|---|---|---|---|
| Windows | **V13.1.1.35084（64Bit）** | 2026/09/08 | Windows 11、Windows 10 **1903 或以上**（**不支援 S 模式**）；x86 / x64 / **ARM64** | 提供 SHA256 校验码 `C3FC00...6A87` |
| macOS | **13.2.1（35084）** | 2026/09/08 | **macOS Catalina 10.15 或以上**；Intel / Apple Silicon 原生（Universal） | **「不支援 iOS、iPadOS」**；提供移除工具与 SHA256 |
| Windows（Lite 免费版） | **V13.1.1.34834（64Bit）** | 2026/09/08 | Windows | 需登入订阅平台帐号才能启用 |

来源：[text.tw/download](https://www.text.tw/download)、[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin)、[text.tw/releasenotes](https://www.text.tw/releasenotes)

**Windows on Arm**：V13.1.1 版号 34952 标示「**重大更新！支援 Windows on Arm 作业系统！** 支援 Arm64 架构应用程式」（[text.tw/releasenotes](https://www.text.tw/releasenotes)）。

**Mac 用户另有移除工具**：因 macOS 输入法移除较麻烦，官方单独提供移除工具（[text.tw/download](https://www.text.tw/download)）。

### 2.2 支援平台结论：**只有 Windows 与 macOS**

| 平台 | 是否支援 | 依据 |
|---|---|---|
| Windows | ✅ | [text.tw/download](https://www.text.tw/download) |
| macOS | ✅ | 同上 |
| **Linux** | ❌ **无官方版本** | 官网全站未见 Linux 版；本次研究未找到任何官方 Linux 发行版 |
| **Android** | ❌ **目前无** | 官网无 Android 下载；Google Play 未见「自然输入法」；历史上的行动产品为 **IQQI 智能输入法**（见下） |
| **iOS / iPadOS** | ❌ **官方明确排除** | 下载页明文「不支援 iOS、iPadOS」 |
| Web／云端输入法 | ❌ | `text.tw` 是产品官网，非网页版输入法（见 2.3） |

**行动装置的历史【官方】**：IQT 曾推出 **「IQQI 智能输入法」**（含「快注音」「快注音 Pro」「音乐精灵」），2011–2014 年间获远传 S 市集 APP 星光大赏「年度最佳 APP」「Smart TV 特别奖」、经济部工业局黄金企鹅奖、资讯月百大创新产品金质奖、云端创新奖「最佳 OpenData 应用奖」（[iqt.ai/intro](https://www.iqt.ai/intro)）。

**【第三方实测】IQQI 目前在台湾 App Store 已查无此 App**：以 iTunes Search API 查询 `IQQI`（`country=tw`）回传 7 笔结果，**无任何 IQT／IQQI 产品**。以 `自然輸入法` 查询回传 8 笔，亦**无自然输入法 App**（结果为可可键盘、简繁转换器、超注音、莱姆输入法、百度输入法等无关 App）。→ **可合理判定 IQT 目前没有在台湾 App Store 上架任何输入法 App。**

### 2.3 `text.tw` 到底是什么服务？

**结论：`text.tw` 是「自然输入法」产品线的官方网站与线上商店入口，不是 AI 写作服务、不是云端输入法、也不是网页版注音。**

【官方】证据：

1. `text.tw` 标题为「自然输入法｜个人化 AI 智慧输入，让打字更简单」，站上内容为产品功能、价格、下载、操作手册、授权管理、客服（[text.tw](https://www.text.tw/)）。
2. 网站实际上以 **Strikingly** 架站服务托管（HTML 注解 `<!-- Powered by Strikingly.com 4 (1) -->`），非自建复杂应用。
3. 网站上「AI」一词是**行销用语**，指输入法的「AI 语意核心处理技术」自动选字，而非生成式 AI 写作工具。官方文案：「采用独特 AI 语意核心处理技术」「在台研发，维护更新近 30 年」（[text.tw/subscription](https://www.text.tw/subscription)）。
4. 真正的交易与帐号系统在**子网域**：
   - 订阅平台：`https://service.iqt.ai`
   - 买断序号线上购买：`https://onlineshop.iqt.ai`
   - 客服中心：`https://support.iqt.ai`（Zendesk）
   - 另有 `https://iqservice.zendesk.com/hc/zh-tw`
5. `text.tw` 同时承载**追音输入法／自然输入法追音版**（[text.tw/chasew](https://www.text.tw/chasew)）。

> 注意：`iqt.ai` 才是公司官网，且该公司已转型为多产品线 AI 公司：自然输入法（`text.tw`）、**VoAI 绝好声创**（`voai.ai`，AI 语音／有声书）、**XComply 快合规**（`xcomply.ai`／`textcomply.com`，广告合规检核）（[iqt.ai/intro](https://www.iqt.ai/intro)）。**输入法已非公司唯一主力**。

### 2.4 价格与授权方式

【官方】零售价格（`iqt.ai/price`，`text.tw/subscription` 一致）：

| 方案 | 授权 | 价格 | 期限 | 可安装 |
|---|---|---|---|---|
| 买断序号（专业版） | 1 人 2 台 | **NT$2,800** | 永久，限购买当时版本 | Windows 或 Mac，共 2 台 |
| 买断序号（专业版） | 1 人 3 台 | **NT$3,900** | 永久 | 共 3 台 |
| 付费订阅 | 1 人 2 台 | **月缴 NT$129** | 1 个月 | 2 台 |
| 付费订阅 | 1 人 2 台 | **季缴 NT$329** | 3 个月 | 2 台 |
| 付费订阅 | 1 人 2 台 | **年缴 NT$899** | 1 年 | 2 台 |
| 付费订阅 | 1 人 3 台 | **年缴 NT$1,299** | 1 年 | 3 台 |
| 付费订阅 | 1 人 4 台 | **年缴 NT$1,649** | 1 年 | 4 台 |
| **V13 Lite 版** | 个人 | **免费** | — | 仅 Windows |

来源：[iqt.ai/price](https://www.iqt.ai/price)、[text.tw/subscription](https://www.text.tw/subscription)

**试用**【官方】：
- **不绑卡**：下载专业版直接试用 **14 天**。
- **绑卡订阅**：完成注册与绑卡可免费试用 **30 天**，次月才扣款。
来源：[text.tw/download](https://www.text.tw/download)、[text.tw/subscription](https://www.text.tw/subscription)

**订阅 vs 买断的官方差异**【官方】（[text.tw/subscription](https://www.text.tw/subscription)）：

| 项目 | 买断序号 | 付费订阅 |
|---|---|---|
| 付款方式 | 线上刷卡、ATM 转帐、便利商店缴款 | **仅信用卡绑定扣款** |
| 更新与支援 | 未来公告停止更新与技术支援后即不再提供 | 订阅期间持续升级最新版 + 优先技术支援 |
| 使用期限 | 终身使用「本版本所支援的作业系统」 | 订阅期间；**订阅结束则无法继续使用** |
| 离线使用 | **可离线**（适合资安严格环境） | 需一般连网 |
| 装置管理 | 需自行解除安装或联络客服才能释放授权 | 有后台可自行登出装置 |

**授权绑定机制**【官方】（[text.tw/devices](https://www.text.tw/devices)）：
- **序号用户**：以序号在电脑上注册成功即占用一台授权。换机需**先解除安装旧机**；若电脑重灌／损毁无法移除，须**寄信给客服**（提供授权用户名称、注册 email、产品序号）由后台移除。
- **订阅用户**：可自行至 `service.iqt.ai` → 「装置管理」登出不再使用的装置，**不需客服介入**。这是订阅制的主要便利性卖点。
- 常见问题：「授权到期」多为扣款失败，重新登出再登入即可。

**Lite 免费版的限制**【官方】（[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin)）：
- **仅限个人使用**；公家机关、公司团体等公用场合不在授权范围，须用专业版或订阅版。
- **必须注册为网际智慧订阅平台会员**才能安装使用。
- **仅提供「标准注音」键盘**，不含许氏、倚天、仓颉等。
- **不支援 Mac、不支援离线使用**。
- **无技术客服、不定期更新、部分功能锁定**。

**重要时程【官方】**：**2026 年 10 月 15 日起，旧版本将无法登入订阅帐号**，订阅用户须于该日前更新（[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin)、[Facebook 官方贴文](https://www.facebook.com/IQGoing/)）。这是强制升级的机制。

**团体／教育／政府授权**【官方】：
- 教育授权 **NT$6,600 起**，依国中小（12 班以下／13–29 班／30 班以上）、高中职全校、大专校院分级（[text.tw/group-licensing](https://www.text.tw/group-licensing)；该页表格为 JS 渲染，部分数字未能完整读取）。
- 企业：**10 人起**，可选永久或一年授权（同上）。
- **政府采购共同供应契约**：**114 年第四次电脑软体共同供应契约采购（案号 1140204，契约期间 114/10/30 ~ 115/11/20）**，项次包含：
  - 394 自然输入法 V13 专业版－国中小全校授权（12 班以下）**$13,140**
  - 395 国中小全校授权（30 班以上）**$23,009**
  - 398 高中职全校授权 **$24,884**
  - 397 大专院校电脑教室 100 台授权 **$41,492**
  来源：[iqt.ai/gov-licensing](https://www.iqt.ai/gov-licensing)
- 教育部「校园数位内容与教学软体」登录认证（2022 年，产品：自然输入法、文字MP3专业版）【官方】：[iqt.ai/intro](https://www.iqt.ai/intro)、[iqt.ai/school](https://www.iqt.ai/school)

### 2.5 相关产品线：追音输入法与教育部台语输入法

**（A）追音输入法／自然输入法追音版**【官方】（[text.tw/chasew](https://www.text.tw/chasew)）：
- 为**法院法官、书记官**的司法领域中文输入需求设计，**最早由开发大易输入法的太易资讯股份有限公司开发**。
- 后由**司法院委托网际智慧重新开发**，名为「**司法院智慧型输入法**」。因经费有限，IQT **采用自然输入法语意核心与输入法框架客制化**。2017 年开发**第四代**，支援 Windows 10/11、Unicode 6.0、司法院造字、法院常用文书。
- 「司法院智慧型输入法」**仅授权司法院及所属机关**。2022 年 6 月 IQT 另推出商业版「**自然输入法追音版**」线上贩售（不支援司法院造字、静默安装／移除）。
- 技术特征：**31 键代表 42 个注音符号**（37 基本 + 5 声调）；**每字 3 键、任意顺序**（如「水」ㄕㄨㄟˇ → 只按 `b`＋`,`）；声调左右手各一组。官方称熟练后「**一分钟输入 200 字是很正常的**」【官方说法，未经第三方验证】。
- 官方也坦言输入法维护困境：「作业系统、应用软体、防毒软体、浏览器都会一直更新……应用程式更新后，输入法也要被动去更新支援，**这是输入法维护管理上最麻烦的地方**」——这段自述是理解整个输入法产业痛点的一手材料。

**（B）教育部台湾台语输入法**【官方】（[教育部语文成果入口网](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)）：
- 依「**台湾台语罗马字拼音方案**（台罗）」输入拼音打出台湾台语汉字；内建常用词自动排序、自动完成、连续拼音输入、词库管理、**上下文预测**。
- 提供桌机版（Windows / macOS 共用核心，页面附 PDF 载点）与行动 App。
- 页面显示版本「**115.4.27**」（民国 115 年＝2026 年）的修正项目。
- **App Store 上架**：`教育部臺灣台語輸入法`，发行者 **Ministry of Education, Republic of China (Taiwan)**，v**1.0.7**（2026-08-28），评分 **4.62／45 笔**；主打功能含**语音辨识**（汉字模式／台罗模式）、内建台湾台语汉字字型与「文字转图」避免豆腐字、万用符号、多种键盘布局、手动汇入汇出。**并取得数位发展部数位产业署「行动应用 App 基本资安检测基准」合格证明（字号 MAS-3016-11400164）**。
  → [App Store 连结](https://apps.apple.com/tw/app/id6743423554)
- **IQT 的角色**：`iqt.ai` 官网导览列以「台湾台」连结至上述教育部页面，且 IQT 隐私权政策页尾把「**台湾台语输入法（教育部专案）**」列为其产品之一（[iqt.ai/privacy](https://www.iqt.ai/privacy)）。→ **可判定为 IQT 承接之教育部委外专案**（App Store 发行者挂名教育部）。
- **客语（台湾客语）输入法：未能查证**是否有 IQT 参与；本次仅找到教育部的「台湾客语辞典」（[hakkadict.moe.edu.tw](https://hakkadict.moe.edu.tw/)），非 IQT 产品。

---

## 3. 核心功能清单

以【官方】[text.tw/product-all](https://www.text.tw/product-all)（「自然输入法 V13 完整功能」）为主，并以【第三方】vChewing 唯音技术文件与部落客评测交叉补充。官方在页面上以 ⭐ 标示「经过使用者调查，用户离不开自然输入法原因」。

### 3.1 输入法方案（可打哪些码）

【官方】支援 **注音（标准键盘、许氏键盘、倚天键盘、倚天 26 键）、汉语拼音、通用拼音、仓颉（三代、五代）、简易（速成）**，并可**自行新增惯用输入法**。
【第三方】vChewing 技术文件补充：v13 内建输入法为「注音（标准／许氏／倚天／倚天 26）、汉语拼音、通用拼音、仓颉、简易（速成）」，且**可用「汇入 .cin」建立自订输入法**（[vChewing 技术文件](https://vchewing.github.io/manual/onboarding_goingime.html)）。

### 3.2 选字与学习（⭐ 核心卖点）

| 功能 | 说明 | 来源 |
|---|---|---|
| ⭐ 人工智慧聪明选字 | 「拥有独特人工智慧语意处理技术，输入即自动调整至最接近的文意」 | [官方](https://www.text.tw/product-all) |
| ⭐ 聪明自动学习 | 「**打过 1 次即记忆，打过 3 次即永久记忆**」；学习后存入「使用者词库」永久储存 | [官方](https://www.text.tw/product-all)、[维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| ⭐ 快捷键加词 | 以快捷键新增词汇，避免打出错字 | [官方](https://www.text.tw/product-all) |
| 手动强制断词 | 词界判断错误时，游标移到应断开处按 **Tab** 强制断词 | 同上 |
| 近音表选字 | 输入后按 **↑** 显示同音字／相似符号（解决 ㄗ/ㄓ、ㄣ/ㄥ 不分） | 同上 |
| 部首笔划表 | 近音表状态下按 **Ctrl+↑** 切换部首笔画表，再按一次切换至网站查询 | 同上 |
| 显示对应码 | 中文输入时同步显示该字注音、拼音或仓颉码 | 同上 |
| 打字同步发音 | 边打边听，利于校稿与教学 | 同上 |

### 3.3 输出与中英处理

| 功能 | 说明 | 来源 |
|---|---|---|
| ⭐ 智慧中英切换（**V13 独占**） | 自动切换英文模式，输入空白／任意符号／倒退键即回中文模式。**官方注明：本功能仅支援标准注音** | [官方](https://www.text.tw/product-all) |
| ⭐ 英文联想 | 英文单字联想快打，官方例：`vocabulary` 只要输入 `vby` | 同上 |
| ⭐ 数字快打 | 中文数字、千分位逗号、计算机、日期格式、时间格式等 | 同上 |
| 成语快打 | 中文模式按 **`,`+`,`** 启动，输入成语任两字首音查询 | 同上 |
| 记忆首码快打 | 输入前三码注音首码，带出曾输入过的长句或文章 | 同上 |
| 快打模式 | 加速输入模式（偏好设定内选项） | 同上、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 轻松打出简体字 | 注音、仓颉也能打简体；繁简一键切换 | 同上 |
| 汉字及拼码输出 | 多种输出组合，适合老师制作华语教材；**v13 共 10 种输出组合**（正体／简体／注音码／通用拼音码／汉语拼音码等），可自订常用输出码 | 同上、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 护照拼音 | 支援输出护照拼音与中文教学用途 | [官方](https://www.text.tw/product-all) |
| 自订预设中英文 | 可设定开机预设输入法为中文或英文 | 同上 |
| 中英切换设定键 | 可选 **CapsLock** 或 **Shift**；官方特别注明「**Mac 也能用 shift 切换中英**」 | 同上 |
| 空白键快速选字 | 空白键三种模式：输入空白／快速切换常用字（候选前五字）／开启候选列表 | 同上 |

**【第三方重要注记】** vChewing 文件指出：**「智慧中英切换」与「英文联想」互斥**——开启前者，后者就没有作用（[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html)）。

### 3.4 词库与个人化

| 功能 | 说明 | 来源 |
|---|---|---|
| ⭐ 个人词库 | 记忆个人专属词汇，智慧选字自动增加，也可手动增删 | [官方](https://www.text.tw/product-all) |
| ⭐ 文字范本 | 快速输出重复性高的文字片语（可为一篇文、一篇法条） | 同上 |
| ⭐ 长句联想 | 自动推荐常打长句（约 7 字以上），输入前 1–2 字即可选取整句 | 同上、[中研院贩售页](https://going-web2.iis.sinica.edu.tw/) |
| ⭐ 符号表 | 内建 **48 组**，可自订扩充至 **500 组**，可自行编排顺序 | 同上 |
| 词语随身包 | 汇出／汇入个人所有词语资料，方便换电脑或重装 | 同上 |
| ⭐ CSV 汇出汇入 | 大量编辑词库及文字范本 | 同上 |
| ⭐ 云端同步／词库共享 | 「个人词库带著走，到哪都能同步」 | 同上 |
| 暂存词批次汇入 | 暂存词批次汇入个人词库成为永久词 | 同上 |
| 容量上限【第三方】 | 专业版支援 **20,000 笔个人词库、2,000 笔文字范本、20,000 笔英文词库、500 组符号表、8 种输入法切换、10 种输出码切换** | [重灌狂人](https://briian.com/5943/going-free.html) |

### 3.5 介面与其他

- **暗黑模式**、**工具列大小**（含 150×150 尺寸）、**字体缩放**（输入视窗与候选视窗字体大小；上限曾调整为 128）、**隐藏工具列至系统列**（打游戏、做简报不干扰）— [官方](https://www.text.tw/product-all)、[text.tw/releasenotes](https://www.text.tw/releasenotes)
- **操作手册**：Windows 版与 Mac 版分开提供（[text.tw/helpguide](https://www.text.tw/helpguide)）
- **v13 起工具列功能整合至 Windows 语言列**，可右键开启功能选单（[text.tw/releasenotes](https://www.text.tw/releasenotes)）

### 3.6 无障碍（Accessibility）

**部分证实，但官方未设专属无障碍专区。**

| 证据 | 来源 |
|---|---|
| 版本更新纪录出现「切换中英文时 **NVDA** 不会发出声音提示」的修正项 → 表示支援 **NVDA 萤幕报读器** | [text.tw/releasenotes](https://www.text.tw/releasenotes) |
| 打字同步发音、工具列语音提示、朗读复制文章（Mac 快捷键 ⌥⌘V 开始／⌥⌘S 停止） | [官方](https://www.text.tw/product-all)、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 字体缩放、大输入框、工具列大小可调（对高龄使用者友善，社群称「打字匡超级大」） | [官方](https://www.text.tw/product-all)、[Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005) |
| 萤幕键盘、朗读复制文章、语音提示（专业版功能） | [重灌狂人](https://briian.com/5943/going-free.html) |

**「符合无障碍规范认证」：未能查证**（未见官方无障碍标章或政府无障碍认证文件）。

### 3.7 客语／台语／粤语／日文等附加输入

| 语言 | 结论 | 依据 |
|---|---|---|
| **台语（台湾台语）** | ✅ **有**，但是**独立产品**（教育部委外专案），非自然输入法内建功能 | [教育部页面](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)、[App Store](https://apps.apple.com/tw/app/id6743423554) |
| **客语** | ❌／**未能查证** IQT 有客语输入法 | 仅找到教育部台湾客语辞典 |
| **粤语** | ❌ **未能查证** 自然输入法内建粤语 | — （对照：gcin 内建「带调粤拼」） |
| **日文** | ⚠️ **历史上有**：V7.0（2003）新增日文平假名／片假名（透过 Big5E 外字）；**现行 V13 是否仍有：未能查证** | [维基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 韩文 | ❌ 无（对照：gcin 内建 hangul） | — |

---

## 4. 技术推测与公开资讯

### 4.1 语言模型／断词／词库（含一项重大第三方揭露）

**核心技术【第三方，转引官方论文】「脉络会意法」**：不用单纯字频／词频统计，而是依「人类理解系统」假设，用**样式比对（pattern matching）**建立字、词出现的**环境特征**，再以统计决定各模板的强度与边际效用。经 800 万字报纸语料测试，平均正确率 95%。
来源：[维基百科](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)、[1993 论文存档](https://web.archive.org/web/20061015034341/http://iasl.iis.sinica.edu.tw/webpdf/paper-1993-c02.pdf)

**⭐ 重大第三方技术揭露：自然输入法 v10–v13 使用的注音引擎**

来自另一个开源注音输入法 **vChewing 唯音**的官方技术文件（以自然输入法 v13.2.1 为对照基准），指出：

> 「本文提及的自然输入法版本为所有使用**姜天戬烟草注音引擎**版本的自然输入法。截至本文最后一次更新时，已确认至少自然输入法 **v10 & v11 & v12 & v13** 使用该引擎（及与此对应的资料架构）。以 v13.2.1 的 App Bundle 为例：内含烟草引擎模组 **`Modules/OVIMTobacco`** 与 **`PhTab/`** 对照表，其**输入法本体则是 OpenVanilla 框架的产物**。」

来源：[vChewing — 写给自然输入法的使用者](https://vchewing.github.io/manual/onboarding_goingime.html)

**这代表什么**（本报告推论，非官方说法）：
1. 自然输入法近十余年的**注音输入层并非完全自研**，而是架在台湾开源输入法框架 **OpenVanilla** 与「烟草（Tobacco）」注音引擎之上；IQT 的价值主要在**语意选字层、词库资料、UX 与商业支援**。
2. 「烟草引擎」一词源自 **Tobacco**／OVIMTobacco 模组；此命名与 vChewing 作者（姜天戬）相关。
3. 这也解释了为何 vChewing 能提供从自然输入法**汇出使用者词库**的工具（见下）。

**【未经 IQT 官方确认】**：以上为第三方对 App Bundle 结构的逆向观察，IQT 官网从未提及 OpenVanilla 或烟草引擎。**属高可信度但非官方证实的技术情报**。

**使用者资料存放位置与格式【第三方，可自行验证】**：

| 平台 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/GOING{版本號}/UserData/Going{版本號}/profile.db` |
| Windows | `%appdata%\Going{版本號}\profile.db` |

- 为**未加密的 SQLite 资料库**。
- `profile` 资料表栏位：`keystrokes`（注音读音，以 `-` 分隔）、`pattern`（汉字词语）、`hits`（使用次数）、`isCustom`（是否自订）、`timestamp`。
- 社群工具 **NCIUserDBKit**（FOSS，Swift／C# 双版本）可将 `isCustom == 1` 的自订词条汇出，用于搬迁至其他输入法。
- 自然输入法自行汇出的「**PersonalPack.gox**」为**私有格式**，第三方工具不处理（可能有著作权考量）。

来源：[vChewing 技术文件](https://vchewing.github.io/manual/onboarding_goingime.html)

> **资安意涵**：使用者词库以**明文 SQLite** 储存，代表本机上任何可读取该档案的程式（含恶意软体）都能取得使用者的**完整自订词汇与输入习惯**。这是一个**未被官方揭露、由第三方实测发现**的隐私设计特性。**是否为漏洞见仁见智**（本机档案本来就可被同使用者权限的程式读取），但对高敏感环境（如司法、政府）值得注意。

### 4.2 是否云端？——本地为主，云端为辅（且需登入）

| 层面 | 是否云端 | 依据 |
|---|---|---|
| 选字／断词运算 | **本机**（烟草引擎 + 本机 profile.db） | [vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 词库云端备份／还原 | ✅ 有，**需登入**（官方称「IQ 云备份」） | [官方功能页](https://www.text.tw/product-all)、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 云端词库同步 | ✅ 有（官方标示「⭐ 云端同步 词库共享」） | [官方](https://www.text.tw/product-all) |
| 订阅授权验证 | ✅ 需要（订阅制须登入帐号；**买断序号可完全离线**） | [text.tw/subscription](https://www.text.tw/subscription) |
| **每周连网要求** | ⚠️ 旧免费版（V11 注音版）**每周必须至少连网一次** | 【第三方】[免费资源网路社群](https://free.com.tw/going-input-v11-free/) |
| 订阅强制升级 | ⚠️ **2026/10/15 起旧版本无法登入订阅帐号** | [官方](https://www.text.tw/freeware-zhuyin) |

**重要区分**：**买断序号版可离线使用**（官方明言「若资安环境较严格……需要在未连网环境下使用，则请选择买断序号」）。这对政府／司法采购是关键卖点。

### 4.3 隐私争议与资料搜集

**（A）官方隐私权政策（修订日期 2025 年 12 月 31 日）**【官方】[iqt.ai/privacy](https://www.iqt.ai/privacy)

搜集的资讯（明文列举）：
- 使用者提供：姓名、生日、性别、单位、职称、联络方式、交易资料、**软硬体环境**等可识别资讯。
- 使用服务时取得：**Cookies、操作纪录（功能点击、偏好设定、使用时间及次数）、IP 位址、浏览器类型、语言与地区、硬体型号及软体版本**。并注明「若您拒绝提供这些资讯，则可能无法使用本服务之部分功能」。
- 信用卡：由第三方金流（如绿界科技）直接处理，IQT 仅取得部分卡号。

**云端备份与去识别化利用（最需注意的一段）**：
> 「为提供您更顺畅的跨装置使用体验，本公司之部分产品提供云端备份服务。如果您使用我们的云端备份服务，**备份资料将于加密后上传至我们的云端伺服器**。我们可能会不定期将云端伺服器中的资料以**去识别化**之方式整理为『**综合性非个人资讯**』（即有关用户的、被分组的资讯……例如**群体用户偏好设定、常用词、常用符号**等）做为**产品改善更新的依据**。」

**跨境传输**：
> 「您使用本服务即视为您同意本公司可以为本服务营运之目的，将您的个人资讯之处理与利用，使用包含**台湾及国外（除中国大陆地区外）**之合法云端服务厂商之伺服器。」

**其他用途**：包含**广告行销宣传、评估广告行销效益、用户满意度调查**（可来信 `services@iqt.ai` 拒绝行销）。第三方分享仅限去识别化「综合性非个人资讯」，且**可能跨国进行**。法源为《个人资料保护法》，跨境传输依个资法第 21 条办理。

**适用范围**：`iqt.ai`、`text.tw`、`voai.ai`、`xcomply.ai`、`textmp3.pro`、`ainowcast.com` 等网域；产品含**自然输入法系列产品**、VoAI 系列、快合规系列、文字MP3 系列、IQ-TTS、哈英文、快文宝、EmojiBurger 等。

**（B）免费版的匿名资料搜集**【第三方】[免费资源网路社群](https://free.com.tw/going-input-v11-free/)（描述 V11 注音免费版）：
> 「自然输入法免费版仅限于个人和家用，**每周必须至少连网一次**，而使用时会**匿名收集使用词库等相关资讯**，用以改善输入法本身的智慧型选字准确性。免费版免序号，且可永久使用没有期限。」

此为部落客描述，**与官方隐私权政策的「去识别化／综合性非个人资讯」条款方向一致**，可视为相互印证。**V13 Lite 是否采同样机制：未能查证**（官方 Lite 说明页未提资料搜集）。

**（C）键盘侧录疑虑**【本报告评估】：
- 本次研究**未找到任何具体指控自然输入法键盘侧录的报导、判决或资安通报**。→ **未能查证有任何侧录事件**。
- 但**结构性风险存在且未被官方否认**：输入法本质上能取得所有按键；自然输入法有云端备份与帐号登入；使用者词库为**明文 SQLite**；隐私政策明示会搜集「功能点击、使用时间及次数」等操作纪录并用于行销与产品改善。
- **对照组**：开源竞品会把「不联网」当卖点。例如莱姆输入法 App Store 描述明言：「**隐私优先——您输入的文字保留在装置上。莱姆没有任何伺服器会搜集您的按键、学习词汇或个人词库。**」（[App Store](https://apps.apple.com/tw/app/id6784694460)）vChewing 亦标榜「没有云端功能、也不联网」（[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html)）。→ **这是自然输入法在资安敏感客群的结构性弱点。**

### 4.4 资安事件与政府采购争议

| 项目 | 结论 | 依据 |
|---|---|---|
| 已知资安事件（外泄、后门、通报） | **未能查证**（本次未找到任何公开纪录） | — |
| 政府采购争议 | **未能查证**（未找到争议报导） | — |
| 政府采购现况 | ✅ **正常在架**：114 年第四次共同供应契约（案号 1140204，契约期间 114/10/30 ~ 115/11/20） | [iqt.ai/gov-licensing](https://www.iqt.ai/gov-licensing) |
| 官方资安作为 | ✅ 2026/09/08 版本明示「**因应资安规范进行安全性强化**」；发布安装档 **SHA256** 供校验；提供**离线注册／离线反注册**流程 | [text.tw/releasenotes](https://www.text.tw/releasenotes)、[text.tw/download](https://www.text.tw/download)、[iqt.ai/reg](https://www.iqt.ai/reg)、[iqt.ai/unreg](https://www.iqt.ai/unreg) |
| 资安检测认证 | ⚠️ 目前仅见**教育部台湾台语输入法**（App）取得数位发展部「行动应用 App 基本资安检测基准」合格（**MAS-3016-11400164**）；**自然输入法本身是否取得同等认证：未能查证** | [App Store 描述](https://apps.apple.com/tw/app/id6743423554) |
| 离线部署能力 | ✅ 买断序号版可离线；政府／企业／教育另有团体授权与正式授权书 | [text.tw/subscription](https://www.text.tw/subscription)、[text.tw/group-licensing](https://www.text.tw/group-licensing) |

**【未证实，但值得记录的一项传闻】**：2017 年 PTT Mac 版有使用者 `lordmi` 推文称：
> 「这家的技术交接感觉有问题，**自从火灾烧掉原始码之后，几乎每一代都是打掉重写**」

来源：[PTT MAC 板 M.1504083004](https://www.ptt.cc/bbs/MAC/M.1504083004.A.65F.html)

**本报告立场**：这是**单一论坛匿名说法，本次研究无法以任何官方或媒体来源交叉验证**（未找到 IQT 火灾、原始码遗失的报导）。它与另一项可观察事实**方向一致**——V10 的 bug 未修就推出 V11（同串讨论），且 vChewing 观察到 v10–v13 的资料架构延续；但**不能因此认定火灾属实**。**标记为未证实传闻**；若需在报告中引用，务必注明仅为论坛说法。

---

## 5. 台湾注音／中文输入法市场全景

### 5.1 总览对照表

| 名称 | 开发者／维护者 | 平台 | 开源 | 计价 | 目前状态 | 最后更新 | 来源 |
|---|---|---|---|---|---|---|---|
| **自然输入法 V13** | 网际智慧 IQT | Windows、macOS | ❌ 闭源商业 | 买断 2,800／3,900；订阅 129/月～1,649/年；Lite 免费 | ✅ 活跃（2026/09 安全性更新） | 2026/09/08 | [text.tw](https://www.text.tw/) |
| **微软注音（新注音）** | Microsoft | Windows（内建） | ❌ 闭源内建 | 随 Windows 免费 | ✅ 活跃（随 OS 更新） | 随 Windows 11 | [维基](https://zh.wikipedia.org/wiki/%E5%BE%AE%E8%BB%9F%E6%96%B0%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95) |
| **新酷音 TSF 版（Windows）** | kanru 等社群 | Windows | ✅ GPL-3.0-or-later | 免费 | ✅ **非常活跃** | **v26.1.1.0（2026/01/11）** | [PTT](https://www.ptt.cc/bbs/IME/M.1768090631.A.C70.html)、[GitHub](https://github.com/chewing/windows-chewing-tsf/releases/tag/v26.1.1.0) |
| **新酷音／libchewing（Linux 等）** | chewing 社群 | Linux、macOS、BSD、Solaris 等 | ✅ GPL | 免费 | ✅ 维护中（**GitHub 已标示 Migrated to Codeberg**） | — | [维基](https://zh.wikipedia.org/wiki/%E6%96%B0%E9%85%B7%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)、[GitHub](https://github.com/chewing/libchewing) |
| **Yahoo!奇摩输入法** | Yahoo!奇摩 | Windows、macOS | ✅ 已开源（`yahoo/KeyKey`） | 免费 | ❌ **2013/01/15 停止开发并终止官网下载**，原始码释出 | 1.1.2535（2013 前） | [维基](https://zh.wikipedia.org/wiki/Yahoo!%E5%A5%87%E6%91%A9%E8%BC%B8%E5%85%A5%E6%B3%95) |
| **小麦注音 McBopomofo** | OpenVanilla 社群 | macOS、Linux、Web、Chrome OS | ✅ 开源 | 免费 | ✅ **活跃** | **3.1.1（2026/09/02）** | [官网](https://mcbopomofo.openvanilla.org/) |
| **呒虾米 Boshiamy** | 行易有限公司（刘重次） | Windows 等（含 Android LIME 授权、iOS iAccess 授权） | ❌ 闭源商业 | 付费（价格**未能查证**） | ⚠️ 商业维护中（近年讨论度低） | **未能查证** | [维基](https://zh.wikipedia.org/wiki/%E5%98%B8%E8%9D%A6%E7%B1%B3%E8%BC%B8%E5%85%A5%E6%B3%95) |
| **大新仓颉** | **未能查证** | Windows 等 | ❌ | 付费 | **未能查证**（无独立维基条目） | **未能查证** | [维基：简快码](https://zh.wikipedia.org/wiki/%E7%B0%A1%E5%BF%AB%E7%A2%BC) |
| **RIME 中州韵引擎** | 佛振（lotem） | 跨平台 | ✅ BSD-3-Clause（librime） | 免费 | ✅ 活跃 | librime 持续发布 | [维基](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B7%9E%E9%9F%BB%E8%BC%B8%E5%85%A5%E6%B3%95%E5%BC%95%E6%93%8E)、[GitHub](https://github.com/rime/librime) |
| ├ 小狼毫 Weasel | RIME 官方 | Windows | ✅ | 免费 | ✅ 活跃 | — | 同上 |
| ├ 鼠须管 Squirrel | RIME 官方 | macOS | ✅ | 免费 | ✅ 活跃 | — | 同上 |
| ├ 中州韵 ibus-rime | RIME 官方 | Linux | ✅ | 免费 | ✅ 活跃 | — | 同上 |
| ├ Trime 同文输入法 | 第三方 | Android | ✅ | 免费 | ✅ | — | 同上 |
| ├ XIME | Stackie Jia | macOS | ✅ | 免费 | — | — | 同上 |
| **gcin** | Edward Liu（廖承庆） | Linux、Windows、Android | ✅ | 免费 | ✅ 仍在开发 | 见 gcin 更动纪录 | [维基](https://zh.wikipedia.org/wiki/Gcin) |
| **hime** | 2011/12/13 自 gcin 分岔的社群 | Linux | ✅ | 免费 | ⚠️ 分岔后活跃度较低 | **未能查证** | [维基](https://zh.wikipedia.org/wiki/Gcin) |
| **Google 注音输入法（Android）** | Google | Android | ❌ | 免费 | ❌／**未能查证**（被 Gboard 取代；zh 维基无独立条目） | **未能查证** | — |
| **Gboard（注音）** | Google | Android、iOS | ❌ | 免费 | ✅ Android 活跃；**iOS 版明显停滞（v2.3.19，2022/05/02）** | Android 持续／iOS 2022 | [维基](https://zh.wikipedia.org/wiki/Gboard)、iTunes Lookup |
| **超注音** | Chih Chao Yu | Android（主力）、iOS | ❌ | 付费／免费版 | ✅ 活跃 | **iOS v2.4.0（2026/09/23）**，评分 3.30／47 | [App Store](https://apps.apple.com/tw/app/id983145797) |
| **莱姆输入法 LIME** | YI-PIN LEE | Android、iOS | ✅ 自由开源 | 免费 | ✅ 活跃 | **iOS v6.1.38（2026/08/10）**，评分 4.72／29 | [App Store](https://apps.apple.com/tw/app/id6784694460)、[GitHub](https://github.com/lime-ime/limeime) |
| **教育部台湾台语输入法** | 教育部（IQT 专案） | Windows、macOS、iOS/Android | ❌ | 免费（政府专案） | ✅ 活跃 | 桌机版 115.4.27；App v1.0.7（2026/08/28），4.62／45 | [教育部](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)、[App Store](https://apps.apple.com/tw/app/id6743423554) |
| 小吉注音 | PNYO, Inc. | iOS | ❌ | 付费 | ⚠️ **停滞**：v1.6（2018/02/06），评分 2.75／40 | 2018 | iTunes Lookup |

### 5.2 各产品现况补充

**微软注音（新注音）**【第三方】：以「语句输入」为特征的第三代输入法。版本史：4.0 → 98a → 2003 → 2007 → 2010 → 2013 → 2019。功能含**输入法整合器**（手写、笔画、部首、标点查询，Ctrl+Alt+,）、**多功能前导字元**（`` ` `` + B/U/, 輸入 Big5／Unicode／全形標點）、**萬用調號字元**、**智慧型輸入模式自動切換**、**自訂相近音輸入**、**忽略調號**；提供四種注音鍵盤（大千／倚天41／IBM／精業）與三種拼音鍵盤（漢語拼音／國音二式／通用拼音）及自訂鍵盤。已知問題：國音二式拼音設計爭議、`·ㄇㄜ` 无字。
→ **它是自然输入法最大的免费替代品**，也是自然输入法行销时的主要对照组（「微软内建的注音输入法在标点符号跟造词这两点上面设计非常烂」——[Mobile01 使用者](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)）。
来源：[维基：微软新注音输入法](https://zh.wikipedia.org/wiki/%E5%BE%AE%E8%BB%9F%E6%96%B0%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)

**新酷音输入法**【第三方】：起源于台大两位学生**龚律全与陈康本** 1999–2000 年的专题，由中研院资讯所**徐赞升**博士技术指导与经费支援，成果以 **GPL** 释出。2001 年后原版停止维护；2002–2003 由 Tim Hsu（徐千洋）与 jserv（黄敬群）移植；2004 年整合为「新酷音输入法」专案；已被 Ubuntu、Debian、FreeBSD 等收录。**2013 年洪任谕重启 Windows 版，改以 TSF（Text Services Framework）架构改写**。支援键盘：大千、许氏、IBM、精业、倚天、倚天26、Dvorak、Dvorak+许氏、汉语拼音、国音二式、台湾华语罗马拼音。
来源：[维基：新酷音输入法](https://zh.wikipedia.org/wiki/%E6%96%B0%E9%85%B7%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)

**⭐ 新酷音 TSF 版是自然输入法最直接的免费威胁，且节奏非常密集**（维护者 PTT ID `kanru`）：

| 版本 | 日期 | 重点功能 |
|---|---|---|
| v24.10.1 | 2024/12 | 稳定版释出 |
| v25.8.1.0 | 2025/07/31 | **全新设定介面（Slint UI）**、词库编辑器增强、外观自订（字型／颜色／半透明候选窗）、**Shift 快速符号输入**、Ctrl+F12 简繁转换、**UILess 模式（与全萤幕游戏相容）**、高 DPI 修正、旧版 Delphi／沙盒应用相容性修正 |
| **v26.1.1.0** | **2026/01/11** | 开始选单捷径、**设定汇出为 TOML**、**词库 CSV 汇入汇出**、**自动检查更新**、数字键盘支援、Shift 灵敏度可调、页码显示、方向键翻页、**依使用频率排序候选字**、**PIME 词库汇入**、自订按键绑定、**许氏／标准键盘切换绑定**、单字准确度提升、片语自动学习（含停用词）、高 DPI 缩放修正 |

授权：**GPL-3.0-or-later**（[README](https://raw.githubusercontent.com/chewing/windows-chewing-tsf/master/README.md)）。
来源：[PTT v26.1.1.0](https://www.ptt.cc/bbs/IME/M.1768090631.A.C70.html)、[PTT v25.8.1.0](https://www.ptt.cc/bbs/IME/M.1753963074.A.4D6.html)

> **观察**：新酷音 TSF 在 2025–2026 年的更新清单，**几乎逐项对应自然输入法的付费卖点**——符号输入、简繁转换、高 DPI、词库 CSV、候选字频率排序、许氏键盘。这是自然输入法最迫切的免费替代压力。

**Yahoo!奇摩输入法**【第三方】：曾提供「好打注音模式」智慧注音与仓颉，可自订输入法。**2013 年 1 月 15 日停止开发并终止官方网站下载，同时将原始码释出至开放原始码社群**，GitHub 上为 `yahoo/KeyKey`。最后版本 **1.1.2535**。系统需求 Windows XP/Vista/7 + .NET Framework 2.0+。
来源：[维基：Yahoo!奇摩输入法](https://zh.wikipedia.org/wiki/Yahoo!%E5%A5%87%E6%91%A9%E8%BC%B8%E5%85%A5%E6%B3%95)
【社群看法】PTT 2025 年仍有人怀念：「Yahoo已经阵亡多年了吧」「还是小输 yahoo 输入法」（[PTT MAC](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html)）→ **Yahoo 输入法仍是老使用者心中的标竿**，这是自然输入法在 Mac 族群的心占率缺口。

**小麦注音 McBopomofo**【官方】：最新版本 **3.1.1（2026-09-02，macOS 版）**，新版摘要为「词库大幅修订、标点输入改进、多语文字转换」。支援**标准、倚天、许氏、倚天26键、IBM 以及汉语拼音**键盘配置。另有 **Linux 版**（GitHub 专案）、**网页版**（可在主流浏览器或电子阅读器的浏览器内使用）、**Chrome OS 版**（Chrome 应用程式商店）。特色：轻巧简单、为 Mac 用户量身打造、可自行增减字词。
来源：[mcbopomofo.openvanilla.org](https://mcbopomofo.openvanilla.org/)
> **这是自然输入法在 macOS 上最直接的免费同类竞品**，且同样源自 OpenVanilla 生态（与自然输入法所用框架同源）。

**呒虾米输入法**【第三方】：台湾人**刘重次**发明的形码输入法，发想于 1969–1975 留欧期间，**1990 年成立「行易有限公司」**。名称取自台语「无啥物」。官方字根表称基本字根 **341 个**、简速字根 **156 个**；输入法研究者指官方列表省略近形字根，实际基本字根约 **580 个**、简速 **175 个**，合计约 **755 个**，且有「隐藏字根」。Windows 试用版档名为 `liu2007b.exe`（2007）。
来源：[维基：呒虾米输入法](https://zh.wikipedia.org/wiki/%E5%98%B8%E8%9D%A6%E7%B1%B3%E8%BC%B8%E5%85%A5%E6%B3%95)
**价格与目前维护状态：未能查证**（未取得行易官网现行资讯）。

**大新仓颉**【第三方，片段】：见于维基「简快码」条目：「**大新仓颉输入法将传统仓颉的尾编码规则简化为「头次尾」、「头尾.头尾」以外，还增设了大量简码。大新仓颉输入法的简码设计根据了字频统计以提高效率。**」
来源：[维基：简快码](https://zh.wikipedia.org/wiki/%E7%B0%A1%E5%BF%AB%E7%A2%BC)
**开发者、价格、目前维护状态、官网：未能查证**（zh 维基无独立条目，本次无法取得官网）。

**RIME 中州韵输入法引擎**【第三方】：由**佛振**编写的开源中文输入法，专案网站与源码托管于 GitHub。同一核心架构下有三个官方发行版：Linux **中州韵（ibus-rime）**、Windows **小狼毫（Weasel）**、macOS **鼠须管（Squirrel）**；第三方发行版含 fcitx-rime（Linux）、PRIME（Windows）、XIME（macOS）、**Trime 同文输入法（Android）**、iRime（iOS）。预设数十种输入方案。**优点**：跨平台、小巧快捷、可自订偏好、备份合并使用者词典、可藉线上储存服务同步、**因开源而受注重隐私者青睐**（曾在小众软体评选中列第八，为唯一上榜的开源输入法）。**缺点**：**没有图形设定介面**（需改 YAML 设定档；仅 Weasel 有简易图形介面），对一般使用者上手困难。
授权：**librime 为 BSD 3-Clause**。
来源：[维基：中州韵输入法引擎](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B7%9E%E9%9F%BB%E8%BC%B8%E5%85%A5%E6%B3%95%E5%BC%95%E6%93%8E)、[librime README](https://raw.githubusercontent.com/rime/librime/master/README.md)
【社群推荐】PTT Mac 板有人推荐：「用搜狗还不如用**鼠须管**，自由度和安全性更高」「**注音就选洋葱注音**，拼音也有很多选择」（[PTT MAC](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html)）。

**gcin / hime**【第三方】：gcin 作者为 **Edward Liu**，是原 xcin 开发者之一，目标是取代 xcin，**是目前台湾最常用的输入法平台之一**，支援类 Unix、Windows（gcin for windows）、Android（gcin for android）。**2011 年 12 月 13 日因意见分歧，部分原 gcin 社群成员独立开发分支版本 HIME**。
gcin 内建/支援输入法极广：**注音、词音／拼音、新酷音（仅 Linux）、仓颉、标点仓颉、仓五、乱仓打鸟、五四三仓颉、速成／简易、大易、行列、行列大字集、行列33、行列符号、呒虾米（需自装表格）、带调粤拼、内码、日本 anthy（仅 Linux）、hangul 韩拼、greek、latin-letters、En-words**。
特色：自动选字、中文预选词（联想词）、英文预选字词、萤幕小键盘、同步发音、模糊字根查询（`*`／`?`）、倚天式符号快捷键、完整 Unicode、繁简转换（可打繁出简）、OSD 状态显示。
来源：[维基：Gcin](https://zh.wikipedia.org/wiki/Gcin)
**hime 目前的维护状态与最后更新：未能查证**。

**Google 注音输入法（Android）**：**未能查证**——zh 维基无独立条目，本次无法取得可靠来源说明其停止更新或下架的具体时间。**可观察事实**：Google 的输入法战略已完全集中于 **Gboard**（Android 版作为「Google Keyboard」的更新于 2016/12 发布），且 **Gboard iOS 版自 2022/05（v2.3.19）后未再更新**（iTunes Lookup）。→ **Google 在注音输入法的投入已明显式微**。

**Gboard**【第三方】：iOS 版 2016/05 首发，Android 版 2016/12 发布；**2025 年 8 月 Google Play 下载量达百亿**，是有史以来最成功的 Android 软体之一。支援 100+ 语言（2019/10 达 916 种），含词联想、表情符号、翻译、单手模式、离线语音辨识等。
来源：[维基：Gboard](https://zh.wikipedia.org/wiki/Gboard)
**「Gboard 注音的具体品质与台湾使用者评价」：未能查证**（本次无法取得可靠评测来源）。

**超注音 / 莱姆输入法 LIME（行动端主要替代品）**【官方商店描述】：
- **超注音**：主打「注音缩写」输入（输入开头注音符号 + 任意符号，声调可作过滤／分隔）；支援**语音输入（Apple 内建语音辨识 + OpenAI Whisper 双引擎）**、智慧邻近修正、自建词汇、多种键盘颜色与大小、扇形符号键盘、Emoji。iOS v2.4.0（2026/09/23），**评分 3.30／47 笔**（偏低）。（[App Store](https://apps.apple.com/tw/app/id983145797)）
- **莱姆输入法 LIME**：**自由开源**，支援自建、注音、仓颉、快仓、仓颉五代、四码仓颉、速成、大易、轻松、行列、行列10；注音键盘含**标准（大千）、倚天26、倚天41、许氏**；中英混打不用切换；简繁转码与字根反查；**设定与词库可跨装置备份／还原**；**隐私优先（无伺服器搜集按键）**。iOS v6.1.38（2026/08/10），**评分 4.72／29**。（[App Store](https://apps.apple.com/tw/app/id6784694460)、[GitHub](https://github.com/lime-ime/limeime)）

### 5.3 市场结构结论

1. **桌面端只剩自然输入法一家在做「付费商业注音输入法」**。其余全部是：OS 内建（微软注音、Apple 内建注音）或免费开源（新酷音、小麦注音、RIME、LIME）。
2. **免费竞品的更新节奏已追上甚至超越**：新酷音 TSF 2026/01 的更新清单与自然输入法付费功能高度重叠；小麦注音 2026/09 也刚更新。**自然输入法不能再靠「有在更新」当差异点**。
3. **行动端是自然输入法的完全真空**：官方明确不支援 iOS/iPadOS，也无 Android 版；IQQI 已从 App Store 消失。行动注音市场由 OS 内建、Gboard、超注音、LIME 瓜分。
4. **开源阵营把「隐私／不联网」当核心卖点**，而自然输入法必须联网才能用订阅与云端同步——**在资安敏感客群处于结构性劣势**。
5. **公部门是自然输入法的护城河**：共同供应契约、教育部校园软体登录、司法院追音输入法、教育部台语输入法专案。这个领域开源专案难以竞标（需正式授权书、客服、SLA）。

---

## 6. 使用者真实痛点

**来源说明**：本节以 **PTT**（可直接抓取，含 IME／MAC／Windows 板）与 **Mobile01**（透过 Wayback Machine 存档取得）为主要论坛来源。**Dcard 回传 HTTP 403 无法存取 → 未能查证**。**Google Play 评论未能取得**；且因自然输入法**没有行动 App**，App Store／Google Play 上**不存在其商店评论**（这是重要事实本身）。媒体／部落客评测以重灌狂人、免费资源网路社群为主。

### 6.1 痛点总表

| 痛点主题 | 具体抱怨 | 来源类型 | 来源 |
|---|---|---|---|
| **价格偏高** | 「一套要 2000 元实在是」 | 论坛 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html) |
| **只卖双授权，取消单机版** | 「他现在是卖双授权版，以前是有卖单授权版的」 | 论坛 | 同上 |
| **为省钱而合购** | 2024/11 出现「自然输入法征求合购」文：「因只需要一台授权，故再征一人即可」 | 论坛 | [PTT 2024](https://www.ptt.cc/bbs/IME/M.1731933273.A.7A5.html) |
| **换新 OS 就得重新原价购买** | 2010 年买过 V6.5，换 Win7 后无法安装，客服要求「买新的，而且是原价」→「**我个人是觉得这样很抢钱**」；也有人回「你可以用**升级价**购买啊」 | 论坛 | [PTT 2010](https://www.ptt.cc/bbs/IME/M.1271414048.A.F76.html) |
| **买了才发现有免费 Lite 版** | Mobile01 原PO 花 NT$2,350 买 V13 专业版后：「后来看到有 Lite 版，应该是免费版，**早知道就先不要买**」 | 论坛 | [Mobile01 2023](https://www.mobile01.com/topicdetail.php?f=512&t=6872005) |
| **「免费版像施舍」＋授权认证烦人**（该串最高赞留言，10 推） | 「自然输入法完全不会考虑……可以取代的太多了，而且并没有特殊之处……**重点都免费，没那种烦死人的认证。好像免费的自然输入法是施舍来的**」 | 论坛 | 同上 |
| **升级感觉小贵** | 死忠用户：「最近升级买 V13，**感觉小贵**，但真的想再试试」 | 论坛 | 同上 |
| **稳定性／吃资源／切换崩溃** | TeamViewer 情境下「从中文输入切回英文输入法的同时，使用的那个程式都会自动关闭」；另一人回：「**自然输入法很吃资源，切换过程导致系统崩溃是我的日常**」 | 论坛 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1526125936.A.7BB.html) |
| **与安全软体冲突致安装失败／系统挂掉** | 安装时未关 COMODO HIPS，「安装尾声时候，发现自然输入法整个当掉，索性关掉并重开机之后，**整台电脑就挂了**」 | 论坛 | [PTT 2016](https://www.ptt.cc/bbs/IME/M.1477200375.A.2FE.html) |
| **应用程式相容性（Mac）** | 「很烦，**有的程式会跑掉，切回去繁体中文有时一直按不出来**，但好处是文字范本很好用」 | 论坛 | [PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |
| **相容性问题是长期结构问题（官方自述）** | 官方在追音输入法页面自述：「作业系统会一直更新修正、应用软体也会一直更新修正、防毒软体……浏览器……**这些软体往往不会考虑到输入法的相容性，往往在应用程式更新后，输入法也要被动去更新支援，这是输入法维护管理上最麻烦的地方**」 | 官方 | [text.tw/chasew](https://www.text.tw/chasew) |
| **相容性维修是常态** | 版本纪录长期出现针对特定软体的修正：Word 复制格式快速键失效、Process Lasso 当机、LINE 无法使用长句联想、Outlook for Mac 主旨文字消失、Evernote 换行注音残留、Excel 快速键、Chrome Ctrl+Space、终端机无法输入中文 | 官方 | [text.tw/releasenotes](https://www.text.tw/releasenotes) |
| **旧 OS 被放生** | Win7 使用者无法安装 V12，官方客服文章说明可改买 V11（论坛引用） | 官方客服 + 论坛 | [Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)、[support.iqt.ai](https://support.iqt.ai/hc/zh-tw/articles/4406907189913) |
| **选字准确度不如预期（单字）** | 「我要打『灯』……连打了好几次他都还是只显示『登』」「『摄』打了好多次都还是只显示『社』……**到底哪里聪明**」；回应：「**选字方面付费版跟免费版一样智障**」「新自然的选字引擎是……建立在打一长串的句子之后你再微调……**所以只打一个字的时候他不会去记**」 | 论坛 | [PTT 2016](https://www.ptt.cc/bbs/IME/M.1483084942.A.44E.html) |
| **选字准确度（与新注音差不多）** | 「发现选字跟新注音差不多烂……还以为能屌打微软欸，结果输入错误率真的是颇高」（惟同串多位使用者反呛原PO自己错字连篇） | 论坛 | [PTT 2021](https://www.ptt.cc/bbs/IME/M.1626033802.A.858.html) |
| **旧版 bug 不修就推新版（放生感）** | 「之前买了自然输入法 10，有些 bug……**结果一直都没有解决，然后就推出 11 版（狂发广告信）**」「**是！被放生了无误**」「基本上如果积极点多修点 bug，我或许会买 11 版本，但他们这样的态度，基本上 11 被放生也是早晚的事情」 | 论坛 | [PTT MAC 2017](https://www.ptt.cc/bbs/MAC/M.1504083004.A.65F.html) |
| **大版本差异不大** | V11 心得：「基本上第 11 版的自然输入法和第 10 版使用起来很类似，**没什么太大的差别**」 | 论坛 | [PTT 2016](https://www.ptt.cc/bbs/IME/M.1477200375.A.2FE.html) |
| **与 IDE／文件编辑器快捷键冲突** | Google Docs 注解 Ctrl+Alt+M 与自然输入法「显示对应码」快捷键相同，导致无法加注解（后获官方更新解决） | 论坛 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html) |
| **Mac 版选字操作不直觉** | 「自己太常异动到方向键左右移动滑鼠游标位置选字」，希望手指不离开 ASDF JKL; | 论坛 | [PTT 2019](https://www.ptt.cc/bbs/IME/M.1547612709.A.2DE.html) |
| **跨装置／换机的授权摩擦** | 序号用户换机**必须先解除安装旧机**，若电脑重灌／损毁则**须寄信请客服**从后台移除；订阅用户才能自行在后台登出装置 | 官方 | [text.tw/devices](https://www.text.tw/devices) |
| **强制升级（订阅）** | 官方公告：**2026/10/15 起旧版本将无法登入订阅帐号**，订阅用户须于期限前更新 | 官方 | [text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin) |
| **免费版强制注册与每周连网** | V11 免费版「仅限于个人和家用，**每周必须至少连网一次**」；V13 Lite「**必须注册为订阅平台会员**才能安装使用」、不支援离线 | 第三方 + 官方 | [免费资源网路社群](https://free.com.tw/going-input-v11-free/)、[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin) |
| **隐私／键盘侧录疑虑** | **本次研究未找到任何具体侧录指控或资安事件**。结构性风险：使用者词库为**未加密 SQLite**；有云端备份与帐号登入；隐私政策明示搜集操作纪录用于行销与产品改善 | 第三方技术文件 + 官方政策 | [vChewing](https://vchewing.github.io/manual/onboarding_goingime.html)、[iqt.ai/privacy](https://www.iqt.ai/privacy) |
| **Dcard 讨论** | **未能查证**（`dcard.tw` 回传 HTTP 403） | — | — |
| **App Store／Google Play 评论** | **不存在**——自然输入法没有行动 App，故无商店评论可查 | — | iTunes Search／Lookup |

### 6.2 正面评价（平衡呈现）

| 优点 | 具体说法 | 来源 |
|---|---|---|
| **选字准确（胜过新酷音）** | 2013 年由新酷音跳槽的使用者：「才用没几天选字准确度已经**比我用了好几年的新酷音词库还准了**」 | [PTT 2013](https://www.ptt.cc/bbs/IME/M.1382854578.A.3CE.html) |
| **团队用心、客服有回应** | 反映快捷键冲突后「没想到刚刚输入法更新，就增加了『开启/关闭快速键』的功能……**这团队真的蛮用心的**，使用者的回馈有听到」 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html) |
| **官方社群会回应抱怨** | 「说优势的话，就是不满意可以到自然的**脸书社团拉小窗抱怨，会有人回应**。用其他免费输入法要么没人理、不然就是被呛这很辛苦免费仔你不会自己来写喔！」 | [PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |
| **付费买稳定是合理选择** | 「如果机器是**赚钱工具**，那就付钱求稳定，不要用赚钱的工具与时间，帮忙除错。如果机器是自用……那就随便用哪套都可以」——此则获多人附和「中肯」「一针见血」 | 同上 |
| **标点符号与造词是杀手级优势** | 「主要是体现在**标点符号跟造词**，微软内建的注音输入法在这两点上面设计非常烂。**对文字工作者来说，用自然输入法会有效率非常多**」（2025/05 留言） | [Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005) |
| **Shift 打标点超直觉** | 死忠用户：「只要 SHIFT 按著就可以直觉打出，。『』...光这一点，超好用！」 | 同上 |
| **字大护眼、对高龄者友善** | 「字体比较大，对眼睛比较好」；「**打字匡超级大**，对于高龄人士来说是不可多得的福音」 | 同上 |
| **文字范本意外好用** | 「有些功能就是新注音没有的了，例如**文字范本**。这东西实在是出乎意料的好用，官网应该要好好宣传一下」 | [PTT 2013](https://www.ptt.cc/bbs/IME/M.1382854578.A.3CE.html) |
| **老用户忠诚度极高** | 「我都用自然输入法，几十年了」；「好用，**从 DOS 的时代用到现在**」；「注音输入法的唯一选择呀」 | [Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)、[PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |
| **跨平台一致性** | 「如果你习惯 Windows 版本的自然输入法，那我建议你买。我就是用习惯了，**mac 版继续买来用**」 | [PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |

### 6.3 痛点归纳（给产品／定价决策用）

1. **价格是最大争议点，但方式很特定**：使用者反弹的不是「付费」本身（多人认为「开发者花的成本值得」），而是 **①只能买双授权、②换 OS 就要原价重买、③买了才发现有免费 Lite 版、④订阅制与强制升级**。→ **定价结构与版本沟通**比绝对价格更伤。
2. **「放生感」是品牌最大长期伤害**：V10 bug 不修就推 V11、V11 于 2022 停止维护、V12 于 2025 停止维护——**三年一放生的节奏已被使用者内化成购买决策考量**。买断制「限购买当时版本」的条款更加深此印象。
3. **相容性问题是输入法的宿命，官方也承认**，但每一次 OS／App 更新都是一次使用者流失风险。
4. **免费竞品在 2025–2026 年快速缩小差距**（新酷音 TSF v26.1.1.0），自然输入法的差异化被迫往上移到「语意选字品质 + 标点/造词 + 文字范本 + 客服」。
5. **隐私是尚未被引爆、但结构上存在的弱点**：明文 SQLite 词库 + 云端备份 + 操作纪录搜集 + 开源竞品主打「不联网」。目前**没有实际丑闻**，但一旦发生资安事件，杀伤力会很大。
6. **行动端完全缺席**，等于放弃了整个世代使用者的第一接触点；使用者只会在「桌面工作」情境想到自然输入法。

---

## 7. 附录

### 7.1 主要来源清单（全部为本报告实际抓取过的 URL）

**官方（IQT／教育部）**
- [自然输入法官网 text.tw](https://www.text.tw/)｜[完整功能](https://www.text.tw/product-all)｜[价格方案比较](https://www.text.tw/subscription)｜[全新订阅方案](https://www.text.tw/new-plans)
- [下载页（版号／系统需求／SHA256）](https://www.text.tw/download)｜[版本更新资讯](https://www.text.tw/releasenotes)｜[各版本比较](https://www.text.tw/compare)｜[旧版本下载](https://www.text.tw/old-download)
- [V13 Lite 免费版](https://www.text.tw/freeware-zhuyin)｜[授权管理说明](https://www.text.tw/devices)｜[授权用户升级 V13](https://www.text.tw/licensing)｜[团体授权方案](https://www.text.tw/group-licensing)
- [追音输入法／自然输入法追音版](https://www.text.tw/chasew)
- [公司简介](https://www.iqt.ai/intro)｜[零售价格表](https://www.iqt.ai/price)｜[政府采购共同供应契约](https://www.iqt.ai/gov-licensing)｜[教育授权](https://www.iqt.ai/edu-licensing)｜[政府/企业授权](https://www.iqt.ai/licensing)｜[教育部校园数位内容](https://www.iqt.ai/school)
- [隐私权政策（2025-12-31 修订）](https://www.iqt.ai/privacy)｜[离线注册](https://www.iqt.ai/reg)｜[离线反注册](https://www.iqt.ai/unreg)｜[最新消息](https://www.iqt.ai/news)
- [教育部台湾台语输入法](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)
- [中研院专属贩售页 going-web2.iis.sinica.edu.tw](https://going-web2.iis.sinica.edu.tw/)
- 官方沿革页（2018 Wayback 存档，Big5）：[iq-t.com/PRODUCTS/version.asp](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)

**第三方技术文件／开源专案**
- [vChewing 唯音：写给自然输入法的使用者](https://vchewing.github.io/manual/onboarding_goingime.html) ← **本报告最重要的第三方技术来源**
- [McBopomofo 小麦注音官网](https://mcbopomofo.openvanilla.org/)
- [windows-chewing-tsf GitHub](https://github.com/chewing/windows-chewing-tsf)｜[v26.1.1.0 release](https://github.com/chewing/windows-chewing-tsf/releases/tag/v26.1.1.0)｜[libchewing（已迁 Codeberg）](https://github.com/chewing/libchewing)
- [rime/librime GitHub](https://github.com/rime/librime)｜[lime-ime/limeime GitHub](https://github.com/lime-ime/limeime)

**维基百科**
- [自然输入法](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)｜[注音输入法](https://zh.wikipedia.org/wiki/%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[新酷音输入法](https://zh.wikipedia.org/wiki/%E6%96%B0%E9%85%B7%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[Yahoo!奇摩输入法](https://zh.wikipedia.org/wiki/Yahoo!%E5%A5%87%E6%91%A9%E8%BC%B8%E5%85%A5%E6%B3%95)｜[呒虾米输入法](https://zh.wikipedia.org/wiki/%E5%98%B8%E8%9D%A6%E7%B1%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[中州韵输入法引擎](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B7%9E%E9%9F%BB%E8%BC%B8%E5%85%A5%E6%B3%95%E5%BC%95%E6%93%8E)｜[Gcin](https://zh.wikipedia.org/wiki/Gcin)｜[微软新注音输入法](https://zh.wikipedia.org/wiki/%E5%BE%AE%E8%BB%9F%E6%96%B0%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[Gboard](https://zh.wikipedia.org/wiki/Gboard)｜[大易输入法](https://zh.wikipedia.org/wiki/%E5%A4%A7%E6%98%93%E8%BC%B8%E5%85%A5%E6%B3%95)｜[简快码（提及大新仓颉）](https://zh.wikipedia.org/wiki/%E7%B0%A1%E5%BF%AB%E7%A2%BC)

**论坛（PTT／Mobile01）**
- PTT IME：[2010 原价重买争议](https://www.ptt.cc/bbs/IME/M.1271414048.A.F76.html)｜[2013 V10 心得](https://www.ptt.cc/bbs/IME/M.1382854578.A.3CE.html)｜[2016 V11 心得](https://www.ptt.cc/bbs/IME/M.1477200375.A.2FE.html)｜[2016 选字抱怨](https://www.ptt.cc/bbs/IME/M.1483084942.A.44E.html)｜[2018 稳定性](https://www.ptt.cc/bbs/IME/M.1526125936.A.7BB.html)｜[2018 团队用心](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html)｜[2018 付费版差异](https://www.ptt.cc/bbs/IME/M.1528288049.A.CD9.html)｜[2019 Mac 选字操作](https://www.ptt.cc/bbs/IME/M.1547612709.A.2DE.html)｜[2021 选字抱怨](https://www.ptt.cc/bbs/IME/M.1626033802.A.858.html)｜[2024 征求合购](https://www.ptt.cc/bbs/IME/M.1731933273.A.7A5.html)｜[2025 新酷音 v25.8.1.0](https://www.ptt.cc/bbs/IME/M.1753963074.A.4D6.html)｜[2026 新酷音 v26.1.1.0](https://www.ptt.cc/bbs/IME/M.1768090631.A.C70.html)
- PTT MAC：[2017 V10 bug 放生（含火灾传闻）](https://www.ptt.cc/bbs/MAC/M.1504083004.A.65F.html)｜[2025/12 自然输入法好用吗](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html)
- Mobile01：[昨晚买了自然输入法V13 专业版（含开箱分享）](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)（以 [Wayback 2025-09-01 存档](http://web.archive.org/web/20250901050518/https://www.mobile01.com/topicdetail.php?t=6872005&f=512) 取得）
- [Facebook 官方粉丝团 IQGoing](https://www.facebook.com/IQGoing/)

**部落客／媒体**
- [重灌狂人：自然输入法 v13 专业版+Mac 版+免费版](https://briian.com/5943/going-free.html)
- [免费资源网路社群：自然输入法 V11 免费版下载](https://free.com.tw/going-input-v11-free/)
- [免费资源网路社群：自然输入法 V12 注音免费版下载 Windows 注册安装教学](https://free.com.tw/)（由 V11 文章连结指向）

**App Store（iTunes API）**
- [教育部台湾台语输入法](https://apps.apple.com/tw/app/id6743423554)｜[超注音](https://apps.apple.com/tw/app/id983145797)｜[莱姆输入法](https://apps.apple.com/tw/app/id6784694460)

### 7.2 「未能查证」清单（明确标示，避免误用）

1. IQT 公司登记资料、成立日期（仅由页尾 `Copyright © 1995-2026` 推得 1995 起算）、员工人数、营收、自然输入法目前实际使用者数（官方 2018 年称 150 万）。
2. 自然输入法是否内建**客语**、**粤语**输入；现行 V13 是否仍支援**日文假名**。
3. 是否取得**无障碍规范认证**；自然输入法本体是否通过**数位发展部资安检测**（仅教育部台语 App 有 MAS 认证）。
4. **任何实际资安事件、键盘侧录指控、政府采购争议**——本次研究均未找到。
5. 「**火灾烧掉原始码**」说法——仅见于 2017 年 PTT 单一推文，无法交叉验证。
6. 呒虾米输入法**现行价格与维护状态**；**大新仓颉**的开发者、价格、官网与现况。
7. **hime** 专案目前的维护状态与最后更新。
8. **Google 注音输入法（Android）** 停止更新／下架的具体时间；**Gboard 注音的台湾使用者评价**。
9. **小麦注音的授权条款与维护者**细节（仅取得官网版本资讯）。
10. **Dcard** 上的相关讨论（HTTP 403 无法存取）。
11. **V13 Lite 是否同样搜集匿名使用资料**。
12. 教育授权完整价目表（`text.tw/group-licensing` 页面为 JS 渲染，表格仅部分读取；政府共契价目则完整取得）。

### 7.3 研究工具与再现方式

本报告的搜寻／抓取工具已留存于 `/home/rchua/GO/pingzhu/research/tools/`：

| 档案 | 用途 |
|---|---|
| `s.py` | DuckDuckGo-lite 搜寻（研究初期有效，后被封锁） |
| `s2.py` | 带 cookie jar 与退避重试的版本（同样被封锁） |
| `fetch.py` | 抓网页并转纯文字，支援 `FORCE_CS=big5` 处理 Big5 旧站 |
| `clean.py` | 去除导览列／页尾重复样板，抽出正文 |
| `links.py` | 抽出页面所有连结 |
| `wp.py`／`wp2.py` | Wikipedia 纯文字摘要（`wp2.py` 支援多标题单次请求，需 `exlimit=max`） |
| `wsearch.py` | Wikipedia 全文搜寻 |
| `ptt.sh` | 抓 PTT 文章并过滤样板 |
| `README.md` | 工具说明与「已确认被封锁的搜寻引擎」清单 |

**要重现本报告**：先修好 `web_search` 的 endpoint（见第 0 节），或沿用上述工具直接抓取 7.1 的来源 URL。

---

*报告结束。所有标示 `未能查證` 的项目，代表本次研究在可用管道下无法取得可靠来源，并非「不存在」。*
