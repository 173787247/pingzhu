# 台灣「自然輸入法」（IQT 網際智慧）產品線競品研究報告

> 研究對象：自然輸入法（自然智慧型中文輸入系統）、網際智慧股份有限公司（IQ Technology Inc.）
> 官網：[https://www.text.tw/](https://www.text.tw/)（產品線）、[https://www.iqt.ai/](https://www.iqt.ai/)（公司／多產品線）
> 報告產出時間：2026 年 9 月（以站上最新資料為準）

---

## 0. 研究方法與限制（請先讀）

**本報告的`web_search` 工具在本次研究中全程故障**，無法使用。錯誤如下（多次重試皆相同）：

```
DeepSeek returned an unprocessable response body: SyntaxError: Unexpected token 'e', "e - ..." is not valid JSON
The web search request used endpoint "https://api.deepseek.com/anthropic/v1/messages".
```

`net_doctor` 顯示 HTTPS 探測正常（`https://api.deepseek.com/` 回 401），因此**問題出在 web-search 外掛所使用的那個 endpoint／回應格式，而非網路斷線**。這需要使用者到「Settings > Plugins > Plugin configuration > Web search」更改 Endpoint，或設定 `DEEPSEEK_SEARCH_BASE_URL`；本報告作者為子代理，權限內無法修改此設定，**建議交由上層處理**。

因此本研究改用替代路徑，實際可用的來源管道如下（皆已驗證）：

| 管道 | 狀態 | 備註 |
|---|---|---|
| `web_fetch` 工具 | ✅ 可用 | 走 Windows proxy；**內容會被截斷**，長頁面需另尋方法 |
| 自建 `curl` 抓取 + 純文字化 | ✅ 可用 | 本報告主要工具，可完整取得頁面 |
| Wikipedia API（`action=query&prop=extracts`） | ✅ 可用 | 需加 `exlimit=max`，且會限流 |
| **Wayback Machine（web.archive.org）** | ✅ 可用 | 取回舊版官網、被封鎖的論壇頁面的關鍵手段 |
| PTT 網頁版（`ptt.cc`） | ✅ 可用 | 可直接抓文章與看板搜尋 |
| iTunes Search／Lookup API | ✅ 可用 | 查台灣 App Store 上架狀況與評分 |
| Google／Bing／Brave／Ecosia／Startpage／Qwant／Mojeek／Yahoo TW／Baidu／Sogou／DuckDuckGo | ❌ 全數被擋 | 主因是**代理 IP 信譽不佳**（`s.jina.ai` 回報 `bad network reputation (AS36352)`），驗證碼／429／302 迴圈 |

**重要副作用**：`lite.duckduckgo.com` 在本次研究初期可用（成功取得約 20 筆有效結果），隨後即被 DuckDuckGo 反機器人驗證封鎖。所有「搜尋引擎式」的探索都受限，本報告因此**偏向以官方站、Wayback 檔案、PTT 討論與 Wikipedia 等一手／可驗證來源為主**，並在查不到時明確標示「未能查證」。

**標示慣例**：`【官方】`＝ IQT／教育部等發布者自述；`【第三方】`＝ 媒體、部落客、社群、維基百科；`【未證實】`＝ 僅見於論壇、無法交叉驗證的說法；`未能查證`＝ 本次研究找不到可靠來源。

---

## 1. 產品史：從國音輸入法到 V13

### 1.1 起源與定位

【官方，存檔】自然輸入法全名「自然智慧型中文輸入系統」，1990 年由**中央研究院資訊科學研究所許聞廉博士**發明，早期稱為「**國音輸入法**」。原始技術文件為許聞廉、陳克健於 1993 年發表的〈「自然」智慧型輸入系統的語意分析─脈絡會意法〉。
- 存檔官方沿革頁（2018 擷取）：[iq-t.com/PRODUCTS/version.asp](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)
- 1993 年論文（存檔）：[脈絡會意法 PDF](https://web.archive.org/web/20061015034341/http://iasl.iis.sinica.edu.tw/webpdf/paper-1993-c02.pdf)

【官方】該頁自述：以「全句語意分析」為原則，用**樣式比對（pattern matching）**建立字詞出現的環境特徵，而非單純字頻／詞頻統計；經**八百萬字報紙語料**測試，平均正確率達 **95%**。這是自然輸入法數十年來的技術主軸（「**脈絡會意法**」）。【第三方】維基百科亦轉引同一說法：[自然輸入法 - 維基百科](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)

【官方，2018 存檔】該頁同時聲稱「目前使用者約達到 **150 萬人**」。此為 2018 年官方數字，**現況未能查證**。

### 1.2 版本演進年表

以下年表以【官方，2018 存檔沿革頁】為主幹（1990–2005），2009 年之後以【第三方】維基百科與【官方】現行版本更新紀錄補足。

| 年份 | 版本 | 環境 | 重大功能／事件 | 來源 |
|---|---|---|---|---|
| 1990 | 國音輸入法 | DOS | 許聞廉開發；全句語意分析、自動辨認同音字 | [官方存檔](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp) |
| 1993 | 國音輸入法 V2.11 | DOS | 獲第一屆十大傑出中文資訊產品獎 | 同上 |
| 1994 | 自然注音輸入法 V3.1 | Windows 3.1 | 以「全句語意分析」依上下文選取同音字 | 同上 |
| 1996 | 自然輸入法 V4.0（Open Chinese 開放式中文輸入系統） | Windows 95 / NT | 首次以「Open Chinese」為名 | 同上 |
| 1998 | 自然輸入法 V5.0 | Windows 98 / NT 4.0 | 法務部長頒獎表揚 | 同上 |
| 1999 | 自然新注音、自然輸入法 99（V5.04） | — | 教育部長頒獎表揚 | 同上 |
| 2001 | 自然輸入法 V6.0 | Windows Me / 2000 | 強化語意分析；融合注音、倉頡、拼音、語音、容錯 | [官方存檔](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)、[維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 2002 | 自然輸入法 V6.5 | — | 榮獲海華獎；為支援 Windows XP 改為全 32 位元 | 同上 |
| 2003 | 自然輸入 2003（V7.0） | Windows XP | 行政院研考會頒獎；新增 **Big5E 外字**、罕見字、**日文平假名／片假名**、Unicode 輸出、簡體字輸出、通用拼音／漢語拼音／注音／點字碼輸出、部首查詢、語音朗讀 | [維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 2004 | 自然輸入 2003（V7.5） | — | 榮獲**教育部金學獎** | [官方存檔](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)、[iqt.ai/intro](https://www.iqt.ai/intro) |
| 2005 | 自然輸入 8（V8.0）**華語教學加強版** | Windows 2000 / XP / 2003 | 主推華語聽說拼寫與教學；僑委會**海華獎**；支援各國 Windows 不必改 locale；新增音標、一字多音、同音字詞、近音字、部首筆畫、成語、發聲；可輸出正體／簡體／音標 | [維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)、[iqt.ai/intro](https://www.iqt.ai/intro) |
| 2009 | 自然輸入 9（V9.0） | Vista / Windows 7（限 32 位元） | 提升選字正確率；支援數十種線上遊戲（魔獸爭霸、天堂、天龍八部）自訂虛擬寶物名詞；支援 Windows Live Messenger／Yahoo! Messenger；100+ 表情符號、1000+ 特殊符號 | [維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 2013 | 新自然輸入法 **V10.0** | Windows 7 / 8 Desktop + Metro | **雲端詞庫備份還原**；分「**注音版（免費）**」與「**專業版（付費）**」 | 同上 |
| 2013 | V10.1 | Windows 8 | 支援平板模式（Win10 平板模式下仍需外接鍵盤） | 同上 |
| 2014 | 自然輸入法 **Mac 版** | macOS | 首次跨出 Windows | 同上 |
| 2016 | 自然輸入法 **V11** | Win 7 / 8 / 8.1 / 10、OS X 10.10+ | 大版本更新 | 同上 |
| 2020 | 自然輸入法 **V12** | Windows 10 1607+、macOS Mojave 10.14+ | 數字快打、符號 2.0、詞語管理 2.0 | 同上 |
| 2021 | V12（更新） | macOS Big Sur 11.0、Apple Silicon M1 | **改採訂閱制**（年／季／月繳、自動續訂），同時提供 V12 注音免費版 | 同上 |
| 2023 | 自然輸入法 **V13** | Windows 11、Windows 10 1903+、macOS Catalina 10.15+ | **長句聯想**、**英文聯想**、**智慧中英切換**；提供**買斷序號版**與訂閱；另有 **V13 Lite 版（僅 Windows）** | 同上 |
| 2025 | V12 停止維護更新 | — | 【官方】「V12 已於 2025 年停止維護更新」 | [text.tw/releasenotes](https://www.text.tw/releasenotes) |
| 2026 | V13 安全性更新 | Windows / macOS | 2026/09/08 釋出「因應資安規範進行安全性強化」版本 | [text.tw/releasenotes](https://www.text.tw/releasenotes) |

**停止維護時程【官方】**：V11 已於 **2022 年**停止維護更新；V12 已於 **2025 年**停止維護更新。
來源：[text.tw/releasenotes](https://www.text.tw/releasenotes)

**官方販售政策【官方】**：「於 2023.09.06 起，官網僅販售自然輸入法 V13。目前 V11 已停止維護更新，不提供技術支援。」
來源：[text.tw/compare](https://www.text.tw/compare)

**公司沿革**：`text.tw` 頁尾為「Copyright © 1995-2026 IQ Technology Inc.」【官方】，可推得 IQT 以 1995 年為公司起算年。公司登記細節本次**未能查證**（未查經濟部商業司）。

### 1.3 在台灣輸入法史上的地位

【第三方】維基百科將其定位為**台灣最早期、也是少數商業化的「智慧型」注音輸入法**，與微軟新注音、新酷音、Yahoo!奇摩輸入法並列為注音輸入法的四大代表。其歷史意義在於：

1. **把「自動選字」變成商品**：在 1990 年代微軟新注音尚未成熟時，以「脈絡會意法」提供可用於實務的注音自動選字，是台灣注音輸入法從「逐字選字」走向「整句輸入」的關鍵推手。
2. **許氏鍵盤的發明地**：許氏鍵盤由許聞廉所創，以 25 鍵、聲韻不分離的方式降低手指移動，是台灣自製鍵盤排列中最廣為人知的一種（[維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)）。
3. **司法體系的實質標準**：太易資訊（大易輸入法公司）原開發的「追音輸入法」，後由**司法院委託網際智慧重新開發**為「司法院智慧型輸入法」，2017 年已發展到**第四代**，支援 Windows 10/11、Unicode 6.0、司法院造字。**官方明言「每一套『司法院智慧型輸入法』都包含了一套『自然輸入法軟體』在裡面」**（[text.tw/chasew](https://www.text.tw/chasew)）。這是自然輸入法技術進入公部門核心文書流程的直接證據。
4. **華語教學用途**：V8.0 起主打華語教學（音標、拼音輸出、發聲），並獲教育部金學獎、僑委會海華獎（[iqt.ai/intro](https://www.iqt.ai/intro)）。

---

## 2. 現行版本、平台、`text.tw` 定位、價格與授權

### 2.1 最新版號與作業系統支援

【官方】現行最新版本（截至 2026 年 9 月）：

| 平台 | 版號 | 釋出日 | 系統需求 | 備註 |
|---|---|---|---|---|
| Windows | **V13.1.1.35084（64Bit）** | 2026/09/08 | Windows 11、Windows 10 **1903 或以上**（**不支援 S 模式**）；x86 / x64 / **ARM64** | 提供 SHA256 校驗碼 `C3FC00...6A87` |
| macOS | **13.2.1（35084）** | 2026/09/08 | **macOS Catalina 10.15 或以上**；Intel / Apple Silicon 原生（Universal） | **「不支援 iOS、iPadOS」**；提供移除工具與 SHA256 |
| Windows（Lite 免費版） | **V13.1.1.34834（64Bit）** | 2026/09/08 | Windows | 需登入訂閱平台帳號才能啟用 |

來源：[text.tw/download](https://www.text.tw/download)、[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin)、[text.tw/releasenotes](https://www.text.tw/releasenotes)

**Windows on Arm**：V13.1.1 版號 34952 標示「**重大更新！支援 Windows on Arm 作業系統！** 支援 Arm64 架構應用程式」（[text.tw/releasenotes](https://www.text.tw/releasenotes)）。

**Mac 用戶另有移除工具**：因 macOS 輸入法移除較麻煩，官方單獨提供移除工具（[text.tw/download](https://www.text.tw/download)）。

### 2.2 支援平台結論：**只有 Windows 與 macOS**

| 平台 | 是否支援 | 依據 |
|---|---|---|
| Windows | ✅ | [text.tw/download](https://www.text.tw/download) |
| macOS | ✅ | 同上 |
| **Linux** | ❌ **無官方版本** | 官網全站未見 Linux 版；本次研究未找到任何官方 Linux 發行版 |
| **Android** | ❌ **目前無** | 官網無 Android 下載；Google Play 未見「自然輸入法」；歷史上的行動產品為 **IQQI 智能輸入法**（見下） |
| **iOS / iPadOS** | ❌ **官方明確排除** | 下載頁明文「不支援 iOS、iPadOS」 |
| Web／雲端輸入法 | ❌ | `text.tw` 是產品官網，非網頁版輸入法（見 2.3） |

**行動裝置的歷史【官方】**：IQT 曾推出 **「IQQI 智能輸入法」**（含「快注音」「快注音 Pro」「音樂精靈」），2011–2014 年間獲遠傳 S 市集 APP 星光大賞「年度最佳 APP」「Smart TV 特別獎」、經濟部工業局黃金企鵝獎、資訊月百大創新產品金質獎、雲端創新獎「最佳 OpenData 應用獎」（[iqt.ai/intro](https://www.iqt.ai/intro)）。

**【第三方實測】IQQI 目前在台灣 App Store 已查無此 App**：以 iTunes Search API 查詢 `IQQI`（`country=tw`）回傳 7 筆結果，**無任何 IQT／IQQI 產品**。以 `自然輸入法` 查詢回傳 8 筆，亦**無自然輸入法 App**（結果為可可鍵盤、簡繁轉換器、超注音、萊姆輸入法、百度輸入法等無關 App）。→ **可合理判定 IQT 目前沒有在台灣 App Store 上架任何輸入法 App。**

### 2.3 `text.tw` 到底是什麼服務？

**結論：`text.tw` 是「自然輸入法」產品線的官方網站與線上商店入口，不是 AI 寫作服務、不是雲端輸入法、也不是網頁版注音。**

【官方】證據：

1. `text.tw` 標題為「自然輸入法｜個人化 AI 智慧輸入，讓打字更簡單」，站上內容為產品功能、價格、下載、操作手冊、授權管理、客服（[text.tw](https://www.text.tw/)）。
2. 網站實際上以 **Strikingly** 架站服務託管（HTML 註解 `<!-- Powered by Strikingly.com 4 (1) -->`），非自建複雜應用。
3. 網站上「AI」一詞是**行銷用語**，指輸入法的「AI 語意核心處理技術」自動選字，而非生成式 AI 寫作工具。官方文案：「採用獨特 AI 語意核心處理技術」「在台研發，維護更新近 30 年」（[text.tw/subscription](https://www.text.tw/subscription)）。
4. 真正的交易與帳號系統在**子網域**：
   - 訂閱平台：`https://service.iqt.ai`
   - 買斷序號線上購買：`https://onlineshop.iqt.ai`
   - 客服中心：`https://support.iqt.ai`（Zendesk）
   - 另有 `https://iqservice.zendesk.com/hc/zh-tw`
5. `text.tw` 同時承載**追音輸入法／自然輸入法追音版**（[text.tw/chasew](https://www.text.tw/chasew)）。

> 注意：`iqt.ai` 才是公司官網，且該公司已轉型為多產品線 AI 公司：自然輸入法（`text.tw`）、**VoAI 絕好聲創**（`voai.ai`，AI 語音／有聲書）、**XComply 快合規**（`xcomply.ai`／`textcomply.com`，廣告合規檢核）（[iqt.ai/intro](https://www.iqt.ai/intro)）。**輸入法已非公司唯一主力**。

### 2.4 價格與授權方式

【官方】零售價格（`iqt.ai/price`，`text.tw/subscription` 一致）：

| 方案 | 授權 | 價格 | 期限 | 可安裝 |
|---|---|---|---|---|
| 買斷序號（專業版） | 1 人 2 台 | **NT$2,800** | 永久，限購買當時版本 | Windows 或 Mac，共 2 台 |
| 買斷序號（專業版） | 1 人 3 台 | **NT$3,900** | 永久 | 共 3 台 |
| 付費訂閱 | 1 人 2 台 | **月繳 NT$129** | 1 個月 | 2 台 |
| 付費訂閱 | 1 人 2 台 | **季繳 NT$329** | 3 個月 | 2 台 |
| 付費訂閱 | 1 人 2 台 | **年繳 NT$899** | 1 年 | 2 台 |
| 付費訂閱 | 1 人 3 台 | **年繳 NT$1,299** | 1 年 | 3 台 |
| 付費訂閱 | 1 人 4 台 | **年繳 NT$1,649** | 1 年 | 4 台 |
| **V13 Lite 版** | 個人 | **免費** | — | 僅 Windows |

來源：[iqt.ai/price](https://www.iqt.ai/price)、[text.tw/subscription](https://www.text.tw/subscription)

**試用**【官方】：
- **不綁卡**：下載專業版直接試用 **14 天**。
- **綁卡訂閱**：完成註冊與綁卡可免費試用 **30 天**，次月才扣款。
來源：[text.tw/download](https://www.text.tw/download)、[text.tw/subscription](https://www.text.tw/subscription)

**訂閱 vs 買斷的官方差異**【官方】（[text.tw/subscription](https://www.text.tw/subscription)）：

| 項目 | 買斷序號 | 付費訂閱 |
|---|---|---|
| 付款方式 | 線上刷卡、ATM 轉帳、便利商店繳款 | **僅信用卡綁定扣款** |
| 更新與支援 | 未來公告停止更新與技術支援後即不再提供 | 訂閱期間持續升級最新版 + 優先技術支援 |
| 使用期限 | 終身使用「本版本所支援的作業系統」 | 訂閱期間；**訂閱結束則無法繼續使用** |
| 離線使用 | **可離線**（適合資安嚴格環境） | 需一般連網 |
| 裝置管理 | 需自行解除安裝或聯絡客服才能釋放授權 | 有後台可自行登出裝置 |

**授權綁定機制**【官方】（[text.tw/devices](https://www.text.tw/devices)）：
- **序號用戶**：以序號在電腦上註冊成功即佔用一台授權。換機需**先解除安裝舊機**；若電腦重灌／損毀無法移除，須**寄信給客服**（提供授權用戶名稱、註冊 email、產品序號）由後台移除。
- **訂閱用戶**：可自行至 `service.iqt.ai` → 「裝置管理」登出不再使用的裝置，**不需客服介入**。這是訂閱制的主要便利性賣點。
- 常見問題：「授權到期」多為扣款失敗，重新登出再登入即可。

**Lite 免費版的限制**【官方】（[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin)）：
- **僅限個人使用**；公家機關、公司團體等公用場合不在授權範圍，須用專業版或訂閱版。
- **必須註冊為網際智慧訂閱平台會員**才能安裝使用。
- **僅提供「標準注音」鍵盤**，不含許氏、倚天、倉頡等。
- **不支援 Mac、不支援離線使用**。
- **無技術客服、不定期更新、部分功能鎖定**。

**重要時程【官方】**：**2026 年 10 月 15 日起，舊版本將無法登入訂閱帳號**，訂閱用戶須於該日前更新（[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin)、[Facebook 官方貼文](https://www.facebook.com/IQGoing/)）。這是強制升級的機制。

**團體／教育／政府授權**【官方】：
- 教育授權 **NT$6,600 起**，依國中小（12 班以下／13–29 班／30 班以上）、高中職全校、大專校院分級（[text.tw/group-licensing](https://www.text.tw/group-licensing)；該頁表格為 JS 渲染，部分數字未能完整讀取）。
- 企業：**10 人起**，可選永久或一年授權（同上）。
- **政府採購共同供應契約**：**114 年第四次電腦軟體共同供應契約採購（案號 1140204，契約期間 114/10/30 ~ 115/11/20）**，項次包含：
  - 394 自然輸入法 V13 專業版－國中小全校授權（12 班以下）**$13,140**
  - 395 國中小全校授權（30 班以上）**$23,009**
  - 398 高中職全校授權 **$24,884**
  - 397 大專院校電腦教室 100 台授權 **$41,492**
  來源：[iqt.ai/gov-licensing](https://www.iqt.ai/gov-licensing)
- 教育部「校園數位內容與教學軟體」登錄認證（2022 年，產品：自然輸入法、文字MP3專業版）【官方】：[iqt.ai/intro](https://www.iqt.ai/intro)、[iqt.ai/school](https://www.iqt.ai/school)

### 2.5 相關產品線：追音輸入法與教育部台語輸入法

**（A）追音輸入法／自然輸入法追音版**【官方】（[text.tw/chasew](https://www.text.tw/chasew)）：
- 為**法院法官、書記官**的司法領域中文輸入需求設計，**最早由開發大易輸入法的太易資訊股份有限公司開發**。
- 後由**司法院委託網際智慧重新開發**，名為「**司法院智慧型輸入法**」。因經費有限，IQT **採用自然輸入法語意核心與輸入法框架客製化**。2017 年開發**第四代**，支援 Windows 10/11、Unicode 6.0、司法院造字、法院常用文書。
- 「司法院智慧型輸入法」**僅授權司法院及所屬機關**。2022 年 6 月 IQT 另推出商業版「**自然輸入法追音版**」線上販售（不支援司法院造字、靜默安裝／移除）。
- 技術特徵：**31 鍵代表 42 個注音符號**（37 基本 + 5 聲調）；**每字 3 鍵、任意順序**（如「水」ㄕㄨㄟˇ → 只按 `b`＋`,`）；聲調左右手各一組。官方稱熟練後「**一分鐘輸入 200 字是很正常的**」【官方說法，未經第三方驗證】。
- 官方也坦言輸入法維護困境：「作業系統、應用軟體、防毒軟體、瀏覽器都會一直更新……應用程式更新後，輸入法也要被動去更新支援，**這是輸入法維護管理上最麻煩的地方**」——這段自述是理解整個輸入法產業痛點的一手材料。

**（B）教育部臺灣台語輸入法**【官方】（[教育部語文成果入口網](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)）：
- 依「**臺灣台語羅馬字拼音方案**（臺羅）」輸入拼音打出臺灣台語漢字；內建常用詞自動排序、自動完成、連續拼音輸入、詞庫管理、**上下文預測**。
- 提供桌機版（Windows / macOS 共用核心，頁面附 PDF 載點）與行動 App。
- 頁面顯示版本「**115.4.27**」（民國 115 年＝2026 年）的修正項目。
- **App Store 上架**：`教育部臺灣台語輸入法`，發行者 **Ministry of Education, Republic of China (Taiwan)**，v**1.0.7**（2026-08-28），評分 **4.62／45 筆**；主打功能含**語音辨識**（漢字模式／臺羅模式）、內建臺灣台語漢字字型與「文字轉圖」避免豆腐字、萬用符號、多種鍵盤佈局、手動匯入匯出。**並取得數位發展部數位產業署「行動應用 App 基本資安檢測基準」合格證明（字號 MAS-3016-11400164）**。
  → [App Store 連結](https://apps.apple.com/tw/app/id6743423554)
- **IQT 的角色**：`iqt.ai` 官網導覽列以「臺灣台」連結至上述教育部頁面，且 IQT 隱私權政策頁尾把「**臺灣台語輸入法（教育部專案）**」列為其產品之一（[iqt.ai/privacy](https://www.iqt.ai/privacy)）。→ **可判定為 IQT 承接之教育部委外專案**（App Store 發行者掛名教育部）。
- **客語（臺灣客語）輸入法：未能查證**是否有 IQT 參與；本次僅找到教育部的「臺灣客語辭典」（[hakkadict.moe.edu.tw](https://hakkadict.moe.edu.tw/)），非 IQT 產品。

---

## 3. 核心功能清單

以【官方】[text.tw/product-all](https://www.text.tw/product-all)（「自然輸入法 V13 完整功能」）為主，並以【第三方】vChewing 唯音技術文件與部落客評測交叉補充。官方在頁面上以 ⭐ 標示「經過使用者調查，用戶離不開自然輸入法原因」。

### 3.1 輸入法方案（可打哪些碼）

【官方】支援 **注音（標準鍵盤、許氏鍵盤、倚天鍵盤、倚天 26 鍵）、漢語拼音、通用拼音、倉頡（三代、五代）、簡易（速成）**，並可**自行新增慣用輸入法**。
【第三方】vChewing 技術文件補充：v13 內建輸入法為「注音（標準／許氏／倚天／倚天 26）、漢語拼音、通用拼音、倉頡、簡易（速成）」，且**可用「匯入 .cin」建立自訂輸入法**（[vChewing 技術文件](https://vchewing.github.io/manual/onboarding_goingime.html)）。

### 3.2 選字與學習（⭐ 核心賣點）

| 功能 | 說明 | 來源 |
|---|---|---|
| ⭐ 人工智慧聰明選字 | 「擁有獨特人工智慧語意處理技術，輸入即自動調整至最接近的文意」 | [官方](https://www.text.tw/product-all) |
| ⭐ 聰明自動學習 | 「**打過 1 次即記憶，打過 3 次即永久記憶**」；學習後存入「使用者詞庫」永久儲存 | [官方](https://www.text.tw/product-all)、[維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| ⭐ 快捷鍵加詞 | 以快捷鍵新增詞彙，避免打出錯字 | [官方](https://www.text.tw/product-all) |
| 手動強制斷詞 | 詞界判斷錯誤時，游標移到應斷開處按 **Tab** 強制斷詞 | 同上 |
| 近音表選字 | 輸入後按 **↑** 顯示同音字／相似符號（解決 ㄗ/ㄓ、ㄣ/ㄥ 不分） | 同上 |
| 部首筆劃表 | 近音表狀態下按 **Ctrl+↑** 切換部首筆畫表，再按一次切換至網站查詢 | 同上 |
| 顯示對應碼 | 中文輸入時同步顯示該字注音、拼音或倉頡碼 | 同上 |
| 打字同步發音 | 邊打邊聽，利於校稿與教學 | 同上 |

### 3.3 輸出與中英處理

| 功能 | 說明 | 來源 |
|---|---|---|
| ⭐ 智慧中英切換（**V13 獨佔**） | 自動切換英文模式，輸入空白／任意符號／倒退鍵即回中文模式。**官方註明：本功能僅支援標準注音** | [官方](https://www.text.tw/product-all) |
| ⭐ 英文聯想 | 英文單字聯想快打，官方例：`vocabulary` 只要輸入 `vby` | 同上 |
| ⭐ 數字快打 | 中文數字、千分位逗號、計算機、日期格式、時間格式等 | 同上 |
| 成語快打 | 中文模式按 **`,`+`,`** 啟動，輸入成語任兩字首音查詢 | 同上 |
| 記憶首碼快打 | 輸入前三碼注音首碼，帶出曾輸入過的長句或文章 | 同上 |
| 快打模式 | 加速輸入模式（偏好設定內選項） | 同上、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 輕鬆打出簡體字 | 注音、倉頡也能打簡體；繁簡一鍵切換 | 同上 |
| 漢字及拼碼輸出 | 多種輸出組合，適合老師製作華語教材；**v13 共 10 種輸出組合**（正體／簡體／注音碼／通用拼音碼／漢語拼音碼等），可自訂常用輸出碼 | 同上、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 護照拼音 | 支援輸出護照拼音與中文教學用途 | [官方](https://www.text.tw/product-all) |
| 自訂預設中英文 | 可設定開機預設輸入法為中文或英文 | 同上 |
| 中英切換設定鍵 | 可選 **CapsLock** 或 **Shift**；官方特別註明「**Mac 也能用 shift 切換中英**」 | 同上 |
| 空白鍵快速選字 | 空白鍵三種模式：輸入空白／快速切換常用字（候選前五字）／開啟候選列表 | 同上 |

**【第三方重要註記】** vChewing 文件指出：**「智慧中英切換」與「英文聯想」互斥**——開啟前者，後者就沒有作用（[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html)）。

### 3.4 詞庫與個人化

| 功能 | 說明 | 來源 |
|---|---|---|
| ⭐ 個人詞庫 | 記憶個人專屬詞彙，智慧選字自動增加，也可手動增刪 | [官方](https://www.text.tw/product-all) |
| ⭐ 文字範本 | 快速輸出重複性高的文字片語（可為一篇文、一篇法條） | 同上 |
| ⭐ 長句聯想 | 自動推薦常打長句（約 7 字以上），輸入前 1–2 字即可選取整句 | 同上、[中研院販售頁](https://going-web2.iis.sinica.edu.tw/) |
| ⭐ 符號表 | 內建 **48 組**，可自訂擴充至 **500 組**，可自行編排順序 | 同上 |
| 詞語隨身包 | 匯出／匯入個人所有詞語資料，方便換電腦或重裝 | 同上 |
| ⭐ CSV 匯出匯入 | 大量編輯詞庫及文字範本 | 同上 |
| ⭐ 雲端同步／詞庫共享 | 「個人詞庫帶著走，到哪都能同步」 | 同上 |
| 暫存詞批次匯入 | 暫存詞批次匯入個人詞庫成為永久詞 | 同上 |
| 容量上限【第三方】 | 專業版支援 **20,000 筆個人詞庫、2,000 筆文字範本、20,000 筆英文詞庫、500 組符號表、8 種輸入法切換、10 種輸出碼切換** | [重灌狂人](https://briian.com/5943/going-free.html) |

### 3.5 介面與其他

- **暗黑模式**、**工具列大小**（含 150×150 尺寸）、**字體縮放**（輸入視窗與候選視窗字體大小；上限曾調整為 128）、**隱藏工具列至系統列**（打遊戲、做簡報不干擾）— [官方](https://www.text.tw/product-all)、[text.tw/releasenotes](https://www.text.tw/releasenotes)
- **操作手冊**：Windows 版與 Mac 版分開提供（[text.tw/helpguide](https://www.text.tw/helpguide)）
- **v13 起工具列功能整合至 Windows 語言列**，可右鍵開啟功能選單（[text.tw/releasenotes](https://www.text.tw/releasenotes)）

### 3.6 無障礙（Accessibility）

**部分證實，但官方未設專屬無障礙專區。**

| 證據 | 來源 |
|---|---|
| 版本更新紀錄出現「切換中英文時 **NVDA** 不會發出聲音提示」的修正項 → 表示支援 **NVDA 螢幕報讀器** | [text.tw/releasenotes](https://www.text.tw/releasenotes) |
| 打字同步發音、工具列語音提示、朗讀複製文章（Mac 快捷鍵 ⌥⌘V 開始／⌥⌘S 停止） | [官方](https://www.text.tw/product-all)、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 字體縮放、大輸入框、工具列大小可調（對高齡使用者友善，社群稱「打字匡超級大」） | [官方](https://www.text.tw/product-all)、[Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005) |
| 螢幕鍵盤、朗讀複製文章、語音提示（專業版功能） | [重灌狂人](https://briian.com/5943/going-free.html) |

**「符合無障礙規範認證」：未能查證**（未見官方無障礙標章或政府無障礙認證文件）。

### 3.7 客語／台語／粵語／日文等附加輸入

| 語言 | 結論 | 依據 |
|---|---|---|
| **台語（臺灣台語）** | ✅ **有**，但是**獨立產品**（教育部委外專案），非自然輸入法內建功能 | [教育部頁面](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)、[App Store](https://apps.apple.com/tw/app/id6743423554) |
| **客語** | ❌／**未能查證** IQT 有客語輸入法 | 僅找到教育部臺灣客語辭典 |
| **粵語** | ❌ **未能查證** 自然輸入法內建粵語 | — （對照：gcin 內建「帶調粵拼」） |
| **日文** | ⚠️ **歷史上有**：V7.0（2003）新增日文平假名／片假名（透過 Big5E 外字）；**現行 V13 是否仍有：未能查證** | [維基](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95) |
| 韓文 | ❌ 無（對照：gcin 內建 hangul） | — |

---

## 4. 技術推測與公開資訊

### 4.1 語言模型／斷詞／詞庫（含一項重大第三方揭露）

**核心技術【第三方，轉引官方論文】「脈絡會意法」**：不用單純字頻／詞頻統計，而是依「人類理解系統」假設，用**樣式比對（pattern matching）**建立字、詞出現的**環境特徵**，再以統計決定各模板的強度與邊際效用。經 800 萬字報紙語料測試，平均正確率 95%。
來源：[維基百科](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)、[1993 論文存檔](https://web.archive.org/web/20061015034341/http://iasl.iis.sinica.edu.tw/webpdf/paper-1993-c02.pdf)

**⭐ 重大第三方技術揭露：自然輸入法 v10–v13 使用的注音引擎**

來自另一個開源注音輸入法 **vChewing 唯音**的官方技術文件（以自然輸入法 v13.2.1 為對照基準），指出：

> 「本文提及的自然輸入法版本為所有使用**姜天戩菸草注音引擎**版本的自然輸入法。截至本文最後一次更新時，已確認至少自然輸入法 **v10 & v11 & v12 & v13** 使用該引擎（及與此對應的資料架構）。以 v13.2.1 的 App Bundle 為例：內含菸草引擎模組 **`Modules/OVIMTobacco`** 與 **`PhTab/`** 對照表，其**輸入法本體則是 OpenVanilla 框架的產物**。」

來源：[vChewing — 寫給自然輸入法的使用者](https://vchewing.github.io/manual/onboarding_goingime.html)

**這代表什麼**（本報告推論，非官方說法）：
1. 自然輸入法近十餘年的**注音輸入層並非完全自研**，而是架在台灣開源輸入法框架 **OpenVanilla** 與「菸草（Tobacco）」注音引擎之上；IQT 的價值主要在**語意選字層、詞庫資料、UX 與商業支援**。
2. 「菸草引擎」一詞源自 **Tobacco**／OVIMTobacco 模組；此命名與 vChewing 作者（姜天戩）相關。
3. 這也解釋了為何 vChewing 能提供從自然輸入法**匯出使用者詞庫**的工具（見下）。

**【未經 IQT 官方確認】**：以上為第三方對 App Bundle 結構的逆向觀察，IQT 官網從未提及 OpenVanilla 或菸草引擎。**屬高可信度但非官方證實的技術情報**。

**使用者資料存放位置與格式【第三方，可自行驗證】**：

| 平台 | 路徑 |
|---|---|
| macOS | `~/Library/Application Support/GOING{版本號}/UserData/Going{版本號}/profile.db` |
| Windows | `%appdata%\Going{版本號}\profile.db` |

- 為**未加密的 SQLite 資料庫**。
- `profile` 資料表欄位：`keystrokes`（注音讀音，以 `-` 分隔）、`pattern`（漢字詞語）、`hits`（使用次數）、`isCustom`（是否自訂）、`timestamp`。
- 社群工具 **NCIUserDBKit**（FOSS，Swift／C# 雙版本）可將 `isCustom == 1` 的自訂詞條匯出，用於搬遷至其他輸入法。
- 自然輸入法自行匯出的「**PersonalPack.gox**」為**私有格式**，第三方工具不處理（可能有著作權考量）。

來源：[vChewing 技術文件](https://vchewing.github.io/manual/onboarding_goingime.html)

> **資安意涵**：使用者詞庫以**明文 SQLite** 儲存，代表本機上任何可讀取該檔案的程式（含惡意軟體）都能取得使用者的**完整自訂詞彙與輸入習慣**。這是一個**未被官方揭露、由第三方實測發現**的隱私設計特性。**是否為漏洞見仁見智**（本機檔案本來就可被同使用者權限的程式讀取），但對高敏感環境（如司法、政府）值得注意。

### 4.2 是否雲端？——本地為主，雲端為輔（且需登入）

| 層面 | 是否雲端 | 依據 |
|---|---|---|
| 選字／斷詞運算 | **本機**（菸草引擎 + 本機 profile.db） | [vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 詞庫雲端備份／還原 | ✅ 有，**需登入**（官方稱「IQ 雲備份」） | [官方功能頁](https://www.text.tw/product-all)、[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html) |
| 雲端詞庫同步 | ✅ 有（官方標示「⭐ 雲端同步 詞庫共享」） | [官方](https://www.text.tw/product-all) |
| 訂閱授權驗證 | ✅ 需要（訂閱制須登入帳號；**買斷序號可完全離線**） | [text.tw/subscription](https://www.text.tw/subscription) |
| **每週連網要求** | ⚠️ 舊免費版（V11 注音版）**每週必須至少連網一次** | 【第三方】[免費資源網路社群](https://free.com.tw/going-input-v11-free/) |
| 訂閱強制升級 | ⚠️ **2026/10/15 起舊版本無法登入訂閱帳號** | [官方](https://www.text.tw/freeware-zhuyin) |

**重要區分**：**買斷序號版可離線使用**（官方明言「若資安環境較嚴格……需要在未連網環境下使用，則請選擇買斷序號」）。這對政府／司法採購是關鍵賣點。

### 4.3 隱私爭議與資料蒐集

**（A）官方隱私權政策（修訂日期 2025 年 12 月 31 日）**【官方】[iqt.ai/privacy](https://www.iqt.ai/privacy)

蒐集的資訊（明文列舉）：
- 使用者提供：姓名、生日、性別、單位、職稱、聯絡方式、交易資料、**軟硬體環境**等可識別資訊。
- 使用服務時取得：**Cookies、操作紀錄（功能點擊、偏好設定、使用時間及次數）、IP 位址、瀏覽器類型、語言與地區、硬體型號及軟體版本**。並註明「若您拒絕提供這些資訊，則可能無法使用本服務之部分功能」。
- 信用卡：由第三方金流（如綠界科技）直接處理，IQT 僅取得部分卡號。

**雲端備份與去識別化利用（最需注意的一段）**：
> 「為提供您更順暢的跨裝置使用體驗，本公司之部分產品提供雲端備份服務。如果您使用我們的雲端備份服務，**備份資料將於加密後上傳至我們的雲端伺服器**。我們可能會不定期將雲端伺服器中的資料以**去識別化**之方式整理為『**綜合性非個人資訊**』（即有關用戶的、被分組的資訊……例如**群體用戶偏好設定、常用詞、常用符號**等）做為**產品改善更新的依據**。」

**跨境傳輸**：
> 「您使用本服務即視為您同意本公司可以為本服務營運之目的，將您的個人資訊之處理與利用，使用包含**臺灣及國外（除中國大陸地區外）**之合法雲端服務廠商之伺服器。」

**其他用途**：包含**廣告行銷宣傳、評估廣告行銷效益、用戶滿意度調查**（可來信 `services@iqt.ai` 拒絕行銷）。第三方分享僅限去識別化「綜合性非個人資訊」，且**可能跨國進行**。法源為《個人資料保護法》，跨境傳輸依個資法第 21 條辦理。

**適用範圍**：`iqt.ai`、`text.tw`、`voai.ai`、`xcomply.ai`、`textmp3.pro`、`ainowcast.com` 等網域；產品含**自然輸入法系列產品**、VoAI 系列、快合規系列、文字MP3 系列、IQ-TTS、哈英文、快文寶、EmojiBurger 等。

**（B）免費版的匿名資料蒐集**【第三方】[免費資源網路社群](https://free.com.tw/going-input-v11-free/)（描述 V11 注音免費版）：
> 「自然輸入法免費版僅限於個人和家用，**每週必須至少連網一次**，而使用時會**匿名收集使用詞庫等相關資訊**，用以改善輸入法本身的智慧型選字準確性。免費版免序號，且可永久使用沒有期限。」

此為部落客描述，**與官方隱私權政策的「去識別化／綜合性非個人資訊」條款方向一致**，可視為相互印證。**V13 Lite 是否採同樣機制：未能查證**（官方 Lite 說明頁未提資料蒐集）。

**（C）鍵盤側錄疑慮**【本報告評估】：
- 本次研究**未找到任何具體指控自然輸入法鍵盤側錄的報導、判決或資安通報**。→ **未能查證有任何側錄事件**。
- 但**結構性風險存在且未被官方否認**：輸入法本質上能取得所有按鍵；自然輸入法有雲端備份與帳號登入；使用者詞庫為**明文 SQLite**；隱私政策明示會蒐集「功能點擊、使用時間及次數」等操作紀錄並用於行銷與產品改善。
- **對照組**：開源競品會把「不聯網」當賣點。例如萊姆輸入法 App Store 描述明言：「**隱私優先——您輸入的文字保留在裝置上。萊姆沒有任何伺服器會蒐集您的按鍵、學習詞彙或個人詞庫。**」（[App Store](https://apps.apple.com/tw/app/id6784694460)）vChewing 亦標榜「沒有雲端功能、也不聯網」（[vChewing](https://vchewing.github.io/manual/onboarding_goingime.html)）。→ **這是自然輸入法在資安敏感客群的結構性弱點。**

### 4.4 資安事件與政府採購爭議

| 項目 | 結論 | 依據 |
|---|---|---|
| 已知資安事件（外洩、後門、通報） | **未能查證**（本次未找到任何公開紀錄） | — |
| 政府採購爭議 | **未能查證**（未找到爭議報導） | — |
| 政府採購現況 | ✅ **正常在架**：114 年第四次共同供應契約（案號 1140204，契約期間 114/10/30 ~ 115/11/20） | [iqt.ai/gov-licensing](https://www.iqt.ai/gov-licensing) |
| 官方資安作為 | ✅ 2026/09/08 版本明示「**因應資安規範進行安全性強化**」；發布安裝檔 **SHA256** 供校驗；提供**離線註冊／離線反註冊**流程 | [text.tw/releasenotes](https://www.text.tw/releasenotes)、[text.tw/download](https://www.text.tw/download)、[iqt.ai/reg](https://www.iqt.ai/reg)、[iqt.ai/unreg](https://www.iqt.ai/unreg) |
| 資安檢測認證 | ⚠️ 目前僅見**教育部臺灣台語輸入法**（App）取得數位發展部「行動應用 App 基本資安檢測基準」合格（**MAS-3016-11400164**）；**自然輸入法本身是否取得同等認證：未能查證** | [App Store 描述](https://apps.apple.com/tw/app/id6743423554) |
| 離線部署能力 | ✅ 買斷序號版可離線；政府／企業／教育另有團體授權與正式授權書 | [text.tw/subscription](https://www.text.tw/subscription)、[text.tw/group-licensing](https://www.text.tw/group-licensing) |

**【未證實，但值得記錄的一項傳聞】**：2017 年 PTT Mac 版有使用者 `lordmi` 推文稱：
> 「這家的技術交接感覺有問題，**自從火災燒掉原始碼之後，幾乎每一代都是打掉重寫**」

來源：[PTT MAC 板 M.1504083004](https://www.ptt.cc/bbs/MAC/M.1504083004.A.65F.html)

**本報告立場**：這是**單一論壇匿名說法，本次研究無法以任何官方或媒體來源交叉驗證**（未找到 IQT 火災、原始碼遺失的報導）。它與另一項可觀察事實**方向一致**——V10 的 bug 未修就推出 V11（同串討論），且 vChewing 觀察到 v10–v13 的資料架構延續；但**不能因此認定火災屬實**。**標記為未證實傳聞**；若需在報告中引用，務必註明僅為論壇說法。

---

## 5. 台灣注音／中文輸入法市場全景

### 5.1 總覽對照表

| 名稱 | 開發者／維護者 | 平台 | 開源 | 計價 | 目前狀態 | 最後更新 | 來源 |
|---|---|---|---|---|---|---|---|
| **自然輸入法 V13** | 網際智慧 IQT | Windows、macOS | ❌ 閉源商業 | 買斷 2,800／3,900；訂閱 129/月～1,649/年；Lite 免費 | ✅ 活躍（2026/09 安全性更新） | 2026/09/08 | [text.tw](https://www.text.tw/) |
| **微軟注音（新注音）** | Microsoft | Windows（內建） | ❌ 閉源內建 | 隨 Windows 免費 | ✅ 活躍（隨 OS 更新） | 隨 Windows 11 | [維基](https://zh.wikipedia.org/wiki/%E5%BE%AE%E8%BB%9F%E6%96%B0%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95) |
| **新酷音 TSF 版（Windows）** | kanru 等社群 | Windows | ✅ GPL-3.0-or-later | 免費 | ✅ **非常活躍** | **v26.1.1.0（2026/01/11）** | [PTT](https://www.ptt.cc/bbs/IME/M.1768090631.A.C70.html)、[GitHub](https://github.com/chewing/windows-chewing-tsf/releases/tag/v26.1.1.0) |
| **新酷音／libchewing（Linux 等）** | chewing 社群 | Linux、macOS、BSD、Solaris 等 | ✅ GPL | 免費 | ✅ 維護中（**GitHub 已標示 Migrated to Codeberg**） | — | [維基](https://zh.wikipedia.org/wiki/%E6%96%B0%E9%85%B7%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)、[GitHub](https://github.com/chewing/libchewing) |
| **Yahoo!奇摩輸入法** | Yahoo!奇摩 | Windows、macOS | ✅ 已開源（`yahoo/KeyKey`） | 免費 | ❌ **2013/01/15 停止開發並終止官網下載**，原始碼釋出 | 1.1.2535（2013 前） | [維基](https://zh.wikipedia.org/wiki/Yahoo!%E5%A5%87%E6%91%A9%E8%BC%B8%E5%85%A5%E6%B3%95) |
| **小麥注音 McBopomofo** | OpenVanilla 社群 | macOS、Linux、Web、Chrome OS | ✅ 開源 | 免費 | ✅ **活躍** | **3.1.1（2026/09/02）** | [官網](https://mcbopomofo.openvanilla.org/) |
| **嘸蝦米 Boshiamy** | 行易有限公司（劉重次） | Windows 等（含 Android LIME 授權、iOS iAccess 授權） | ❌ 閉源商業 | 付費（價格**未能查證**） | ⚠️ 商業維護中（近年討論度低） | **未能查證** | [維基](https://zh.wikipedia.org/wiki/%E5%98%B8%E8%9D%A6%E7%B1%B3%E8%BC%B8%E5%85%A5%E6%B3%95) |
| **大新倉頡** | **未能查證** | Windows 等 | ❌ | 付費 | **未能查證**（無獨立維基條目） | **未能查證** | [維基：簡快碼](https://zh.wikipedia.org/wiki/%E7%B0%A1%E5%BF%AB%E7%A2%BC) |
| **RIME 中州韻引擎** | 佛振（lotem） | 跨平台 | ✅ BSD-3-Clause（librime） | 免費 | ✅ 活躍 | librime 持續發布 | [維基](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B7%9E%E9%9F%BB%E8%BC%B8%E5%85%A5%E6%B3%95%E5%BC%95%E6%93%8E)、[GitHub](https://github.com/rime/librime) |
| ├ 小狼毫 Weasel | RIME 官方 | Windows | ✅ | 免費 | ✅ 活躍 | — | 同上 |
| ├ 鼠鬚管 Squirrel | RIME 官方 | macOS | ✅ | 免費 | ✅ 活躍 | — | 同上 |
| ├ 中州韻 ibus-rime | RIME 官方 | Linux | ✅ | 免費 | ✅ 活躍 | — | 同上 |
| ├ Trime 同文輸入法 | 第三方 | Android | ✅ | 免費 | ✅ | — | 同上 |
| ├ XIME | Stackie Jia | macOS | ✅ | 免費 | — | — | 同上 |
| **gcin** | Edward Liu（廖承慶） | Linux、Windows、Android | ✅ | 免費 | ✅ 仍在開發 | 見 gcin 更動紀錄 | [維基](https://zh.wikipedia.org/wiki/Gcin) |
| **hime** | 2011/12/13 自 gcin 分岔的社群 | Linux | ✅ | 免費 | ⚠️ 分岔後活躍度較低 | **未能查證** | [維基](https://zh.wikipedia.org/wiki/Gcin) |
| **Google 注音輸入法（Android）** | Google | Android | ❌ | 免費 | ❌／**未能查證**（被 Gboard 取代；zh 維基無獨立條目） | **未能查證** | — |
| **Gboard（注音）** | Google | Android、iOS | ❌ | 免費 | ✅ Android 活躍；**iOS 版明顯停滯（v2.3.19，2022/05/02）** | Android 持續／iOS 2022 | [維基](https://zh.wikipedia.org/wiki/Gboard)、iTunes Lookup |
| **超注音** | Chih Chao Yu | Android（主力）、iOS | ❌ | 付費／免費版 | ✅ 活躍 | **iOS v2.4.0（2026/09/23）**，評分 3.30／47 | [App Store](https://apps.apple.com/tw/app/id983145797) |
| **萊姆輸入法 LIME** | YI-PIN LEE | Android、iOS | ✅ 自由開源 | 免費 | ✅ 活躍 | **iOS v6.1.38（2026/08/10）**，評分 4.72／29 | [App Store](https://apps.apple.com/tw/app/id6784694460)、[GitHub](https://github.com/lime-ime/limeime) |
| **教育部臺灣台語輸入法** | 教育部（IQT 專案） | Windows、macOS、iOS/Android | ❌ | 免費（政府專案） | ✅ 活躍 | 桌機版 115.4.27；App v1.0.7（2026/08/28），4.62／45 | [教育部](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)、[App Store](https://apps.apple.com/tw/app/id6743423554) |
| 小吉注音 | PNYO, Inc. | iOS | ❌ | 付費 | ⚠️ **停滯**：v1.6（2018/02/06），評分 2.75／40 | 2018 | iTunes Lookup |

### 5.2 各產品現況補充

**微軟注音（新注音）**【第三方】：以「語句輸入」為特徵的第三代輸入法。版本史：4.0 → 98a → 2003 → 2007 → 2010 → 2013 → 2019。功能含**輸入法整合器**（手寫、筆畫、部首、標點查詢，Ctrl+Alt+,）、**多功能前導字元**（`` ` `` + B/U/, 輸入 Big5／Unicode／全形標點）、**萬用調號字元**、**智慧型輸入模式自動切換**、**自訂相近音輸入**、**忽略調號**；提供四種注音鍵盤（大千／倚天41／IBM／精業）與三種拼音鍵盤（漢語拼音／國音二式／通用拼音）及自訂鍵盤。已知問題：國音二式拼音設計爭議、`·ㄇㄜ` 無字。
→ **它是自然輸入法最大的免費替代品**，也是自然輸入法行銷時的主要對照組（「微軟內建的注音輸入法在標點符號跟造詞這兩點上面設計非常爛」——[Mobile01 使用者](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)）。
來源：[維基：微軟新注音輸入法](https://zh.wikipedia.org/wiki/%E5%BE%AE%E8%BB%9F%E6%96%B0%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)

**新酷音輸入法**【第三方】：起源於台大兩位學生**龔律全與陳康本** 1999–2000 年的專題，由中研院資訊所**徐讚昇**博士技術指導與經費支援，成果以 **GPL** 釋出。2001 年後原版停止維護；2002–2003 由 Tim Hsu（徐千洋）與 jserv（黃敬群）移植；2004 年整合為「新酷音輸入法」專案；已被 Ubuntu、Debian、FreeBSD 等收錄。**2013 年洪任諭重啟 Windows 版，改以 TSF（Text Services Framework）架構改寫**。支援鍵盤：大千、許氏、IBM、精業、倚天、倚天26、Dvorak、Dvorak+許氏、漢語拼音、國音二式、台灣華語羅馬拼音。
來源：[維基：新酷音輸入法](https://zh.wikipedia.org/wiki/%E6%96%B0%E9%85%B7%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)

**⭐ 新酷音 TSF 版是自然輸入法最直接的免費威脅，且節奏非常密集**（維護者 PTT ID `kanru`）：

| 版本 | 日期 | 重點功能 |
|---|---|---|
| v24.10.1 | 2024/12 | 穩定版釋出 |
| v25.8.1.0 | 2025/07/31 | **全新設定介面（Slint UI）**、詞庫編輯器增強、外觀自訂（字型／顏色／半透明候選窗）、**Shift 快速符號輸入**、Ctrl+F12 簡繁轉換、**UILess 模式（與全螢幕遊戲相容）**、高 DPI 修正、舊版 Delphi／沙盒應用相容性修正 |
| **v26.1.1.0** | **2026/01/11** | 開始選單捷徑、**設定匯出為 TOML**、**詞庫 CSV 匯入匯出**、**自動檢查更新**、數字鍵盤支援、Shift 靈敏度可調、頁碼顯示、方向鍵翻頁、**依使用頻率排序候選字**、**PIME 詞庫匯入**、自訂按鍵綁定、**許氏／標準鍵盤切換綁定**、單字準確度提升、片語自動學習（含停用詞）、高 DPI 縮放修正 |

授權：**GPL-3.0-or-later**（[README](https://raw.githubusercontent.com/chewing/windows-chewing-tsf/master/README.md)）。
來源：[PTT v26.1.1.0](https://www.ptt.cc/bbs/IME/M.1768090631.A.C70.html)、[PTT v25.8.1.0](https://www.ptt.cc/bbs/IME/M.1753963074.A.4D6.html)

> **觀察**：新酷音 TSF 在 2025–2026 年的更新清單，**幾乎逐項對應自然輸入法的付費賣點**——符號輸入、簡繁轉換、高 DPI、詞庫 CSV、候選字頻率排序、許氏鍵盤。這是自然輸入法最迫切的免費替代壓力。

**Yahoo!奇摩輸入法**【第三方】：曾提供「好打注音模式」智慧注音與倉頡，可自訂輸入法。**2013 年 1 月 15 日停止開發並終止官方網站下載，同時將原始碼釋出至開放原始碼社群**，GitHub 上為 `yahoo/KeyKey`。最後版本 **1.1.2535**。系統需求 Windows XP/Vista/7 + .NET Framework 2.0+。
來源：[維基：Yahoo!奇摩輸入法](https://zh.wikipedia.org/wiki/Yahoo!%E5%A5%87%E6%91%A9%E8%BC%B8%E5%85%A5%E6%B3%95)
【社群看法】PTT 2025 年仍有人懷念：「Yahoo已經陣亡多年了吧」「還是小輸 yahoo 輸入法」（[PTT MAC](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html)）→ **Yahoo 輸入法仍是老使用者心中的標竿**，這是自然輸入法在 Mac 族群的心佔率缺口。

**小麥注音 McBopomofo**【官方】：最新版本 **3.1.1（2026-09-02，macOS 版）**，新版摘要為「詞庫大幅修訂、標點輸入改進、多語文字轉換」。支援**標準、倚天、許氏、倚天26鍵、IBM 以及漢語拼音**鍵盤配置。另有 **Linux 版**（GitHub 專案）、**網頁版**（可在主流瀏覽器或電子閱讀器的瀏覽器內使用）、**Chrome OS 版**（Chrome 應用程式商店）。特色：輕巧簡單、為 Mac 用戶量身打造、可自行增減字詞。
來源：[mcbopomofo.openvanilla.org](https://mcbopomofo.openvanilla.org/)
> **這是自然輸入法在 macOS 上最直接的免費同類競品**，且同樣源自 OpenVanilla 生態（與自然輸入法所用框架同源）。

**嘸蝦米輸入法**【第三方】：台灣人**劉重次**發明的形碼輸入法，發想於 1969–1975 留歐期間，**1990 年成立「行易有限公司」**。名稱取自台語「無啥物」。官方字根表稱基本字根 **341 個**、簡速字根 **156 個**；輸入法研究者指官方列表省略近形字根，實際基本字根約 **580 個**、簡速 **175 個**，合計約 **755 個**，且有「隱藏字根」。Windows 試用版檔名為 `liu2007b.exe`（2007）。
來源：[維基：嘸蝦米輸入法](https://zh.wikipedia.org/wiki/%E5%98%B8%E8%9D%A6%E7%B1%B3%E8%BC%B8%E5%85%A5%E6%B3%95)
**價格與目前維護狀態：未能查證**（未取得行易官網現行資訊）。

**大新倉頡**【第三方，片段】：見於維基「簡快碼」條目：「**大新倉頡輸入法將傳統倉頡的尾編碼規則簡化為「頭次尾」、「頭尾.頭尾」以外，還增設了大量簡碼。大新倉頡輸入法的簡碼設計根據了字頻統計以提高效率。**」
來源：[維基：簡快碼](https://zh.wikipedia.org/wiki/%E7%B0%A1%E5%BF%AB%E7%A2%BC)
**開發者、價格、目前維護狀態、官網：未能查證**（zh 維基無獨立條目，本次無法取得官網）。

**RIME 中州韻輸入法引擎**【第三方】：由**佛振**編寫的開源中文輸入法，專案網站與源碼託管於 GitHub。同一核心架構下有三個官方發行版：Linux **中州韻（ibus-rime）**、Windows **小狼毫（Weasel）**、macOS **鼠鬚管（Squirrel）**；第三方發行版含 fcitx-rime（Linux）、PRIME（Windows）、XIME（macOS）、**Trime 同文輸入法（Android）**、iRime（iOS）。預設數十種輸入方案。**優點**：跨平台、小巧快捷、可自訂偏好、備份合併使用者詞典、可藉線上儲存服務同步、**因開源而受注重隱私者青睞**（曾在小众軟體評選中列第八，為唯一上榜的開源輸入法）。**缺點**：**沒有圖形設定介面**（需改 YAML 設定檔；僅 Weasel 有簡易圖形介面），對一般使用者上手困難。
授權：**librime 為 BSD 3-Clause**。
來源：[維基：中州韻輸入法引擎](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B7%9E%E9%9F%BB%E8%BC%B8%E5%85%A5%E6%B3%95%E5%BC%95%E6%93%8E)、[librime README](https://raw.githubusercontent.com/rime/librime/master/README.md)
【社群推薦】PTT Mac 板有人推薦：「用搜狗還不如用**鼠鬚管**，自由度和安全性更高」「**注音就選洋蔥注音**，拼音也有很多選擇」（[PTT MAC](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html)）。

**gcin / hime**【第三方】：gcin 作者為 **Edward Liu**，是原 xcin 開發者之一，目標是取代 xcin，**是目前台灣最常用的輸入法平台之一**，支援類 Unix、Windows（gcin for windows）、Android（gcin for android）。**2011 年 12 月 13 日因意見分歧，部分原 gcin 社群成員獨立開發分支版本 HIME**。
gcin 內建/支援輸入法極廣：**注音、詞音／拼音、新酷音（僅 Linux）、倉頡、標點倉頡、倉五、亂倉打鳥、五四三倉頡、速成／簡易、大易、行列、行列大字集、行列33、行列符號、嘸蝦米（需自裝表格）、帶調粵拼、內碼、日本 anthy（僅 Linux）、hangul 韓拼、greek、latin-letters、En-words**。
特色：自動選字、中文預選詞（聯想詞）、英文預選字詞、螢幕小鍵盤、同步發音、模糊字根查詢（`*`／`?`）、倚天式符號快捷鍵、完整 Unicode、繁簡轉換（可打繁出簡）、OSD 狀態顯示。
來源：[維基：Gcin](https://zh.wikipedia.org/wiki/Gcin)
**hime 目前的維護狀態與最後更新：未能查證**。

**Google 注音輸入法（Android）**：**未能查證**——zh 維基無獨立條目，本次無法取得可靠來源說明其停止更新或下架的具體時間。**可觀察事實**：Google 的輸入法戰略已完全集中於 **Gboard**（Android 版作為「Google Keyboard」的更新於 2016/12 發布），且 **Gboard iOS 版自 2022/05（v2.3.19）後未再更新**（iTunes Lookup）。→ **Google 在注音輸入法的投入已明顯式微**。

**Gboard**【第三方】：iOS 版 2016/05 首發，Android 版 2016/12 發布；**2025 年 8 月 Google Play 下載量達百億**，是有史以來最成功的 Android 軟體之一。支援 100+ 語言（2019/10 達 916 種），含詞聯想、表情符號、翻譯、單手模式、離線語音辨識等。
來源：[維基：Gboard](https://zh.wikipedia.org/wiki/Gboard)
**「Gboard 注音的具體品質與台灣使用者評價」：未能查證**（本次無法取得可靠評測來源）。

**超注音 / 萊姆輸入法 LIME（行動端主要替代品）**【官方商店描述】：
- **超注音**：主打「注音縮寫」輸入（輸入開頭注音符號 + 任意符號，聲調可作過濾／分隔）；支援**語音輸入（Apple 內建語音辨識 + OpenAI Whisper 雙引擎）**、智慧鄰近修正、自建詞彙、多種鍵盤顏色與大小、扇形符號鍵盤、Emoji。iOS v2.4.0（2026/09/23），**評分 3.30／47 筆**（偏低）。（[App Store](https://apps.apple.com/tw/app/id983145797)）
- **萊姆輸入法 LIME**：**自由開源**，支援自建、注音、倉頡、快倉、倉頡五代、四碼倉頡、速成、大易、輕鬆、行列、行列10；注音鍵盤含**標準（大千）、倚天26、倚天41、許氏**；中英混打不用切換；簡繁轉碼與字根反查；**設定與詞庫可跨裝置備份／還原**；**隱私優先（無伺服器蒐集按鍵）**。iOS v6.1.38（2026/08/10），**評分 4.72／29**。（[App Store](https://apps.apple.com/tw/app/id6784694460)、[GitHub](https://github.com/lime-ime/limeime)）

### 5.3 市場結構結論

1. **桌面端只剩自然輸入法一家在做「付費商業注音輸入法」**。其餘全部是：OS 內建（微軟注音、Apple 內建注音）或免費開源（新酷音、小麥注音、RIME、LIME）。
2. **免費競品的更新節奏已追上甚至超越**：新酷音 TSF 2026/01 的更新清單與自然輸入法付費功能高度重疊；小麥注音 2026/09 也剛更新。**自然輸入法不能再靠「有在更新」當差異點**。
3. **行動端是自然輸入法的完全真空**：官方明確不支援 iOS/iPadOS，也無 Android 版；IQQI 已從 App Store 消失。行動注音市場由 OS 內建、Gboard、超注音、LIME 瓜分。
4. **開源陣營把「隱私／不聯網」當核心賣點**，而自然輸入法必須聯網才能用訂閱與雲端同步——**在資安敏感客群處於結構性劣勢**。
5. **公部門是自然輸入法的護城河**：共同供應契約、教育部校園軟體登錄、司法院追音輸入法、教育部台語輸入法專案。這個領域開源專案難以競標（需正式授權書、客服、SLA）。

---

## 6. 使用者真實痛點

**來源說明**：本節以 **PTT**（可直接抓取，含 IME／MAC／Windows 板）與 **Mobile01**（透過 Wayback Machine 存檔取得）為主要論壇來源。**Dcard 回傳 HTTP 403 無法存取 → 未能查證**。**Google Play 評論未能取得**；且因自然輸入法**沒有行動 App**，App Store／Google Play 上**不存在其商店評論**（這是重要事實本身）。媒體／部落客評測以重灌狂人、免費資源網路社群為主。

### 6.1 痛點總表

| 痛點主題 | 具體抱怨 | 來源類型 | 來源 |
|---|---|---|---|
| **價格偏高** | 「一套要 2000 元實在是」 | 論壇 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html) |
| **只賣雙授權，取消單機版** | 「他現在是賣雙授權版，以前是有賣單授權版的」 | 論壇 | 同上 |
| **為省錢而合購** | 2024/11 出現「自然輸入法徵求合購」文：「因只需要一台授權，故再徵一人即可」 | 論壇 | [PTT 2024](https://www.ptt.cc/bbs/IME/M.1731933273.A.7A5.html) |
| **換新 OS 就得重新原價購買** | 2010 年買過 V6.5，換 Win7 後無法安裝，客服要求「買新的，而且是原價」→「**我個人是覺得這樣很搶錢**」；也有人回「你可以用**升級價**購買啊」 | 論壇 | [PTT 2010](https://www.ptt.cc/bbs/IME/M.1271414048.A.F76.html) |
| **買了才發現有免費 Lite 版** | Mobile01 原PO 花 NT$2,350 買 V13 專業版後：「後來看到有 Lite 版，應該是免費版，**早知道就先不要買**」 | 論壇 | [Mobile01 2023](https://www.mobile01.com/topicdetail.php?f=512&t=6872005) |
| **「免費版像施捨」＋授權認證煩人**（該串最高讚留言，10 推） | 「自然輸入法完全不會考慮……可以取代的太多了，而且並沒有特殊之處……**重點都免費，沒那種煩死人的認證。好像免費的自然輸入法是施捨來的**」 | 論壇 | 同上 |
| **升級感覺小貴** | 死忠用戶：「最近升級買 V13，**感覺小貴**，但真的想再試試」 | 論壇 | 同上 |
| **穩定性／吃資源／切換崩潰** | TeamViewer 情境下「從中文輸入切回英文輸入法的同時，使用的那個程式都會自動關閉」；另一人回：「**自然輸入法很吃資源，切換過程導致系統崩潰是我的日常**」 | 論壇 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1526125936.A.7BB.html) |
| **與安全軟體衝突致安裝失敗／系統掛掉** | 安裝時未關 COMODO HIPS，「安裝尾聲時候，發現自然輸入法整個當掉，索性關掉並重開機之後，**整台電腦就掛了**」 | 論壇 | [PTT 2016](https://www.ptt.cc/bbs/IME/M.1477200375.A.2FE.html) |
| **應用程式相容性（Mac）** | 「很煩，**有的程式會跑掉，切回去繁體中文有時一直按不出來**，但好處是文字範本很好用」 | 論壇 | [PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |
| **相容性問題是長期結構問題（官方自述）** | 官方在追音輸入法頁面自述：「作業系統會一直更新修正、應用軟體也會一直更新修正、防毒軟體……瀏覽器……**這些軟體往往不會考慮到輸入法的相容性，往往在應用程式更新後，輸入法也要被動去更新支援，這是輸入法維護管理上最麻煩的地方**」 | 官方 | [text.tw/chasew](https://www.text.tw/chasew) |
| **相容性維修是常態** | 版本紀錄長期出現針對特定軟體的修正：Word 複製格式快速鍵失效、Process Lasso 當機、LINE 無法使用長句聯想、Outlook for Mac 主旨文字消失、Evernote 換行注音殘留、Excel 快速鍵、Chrome Ctrl+Space、終端機無法輸入中文 | 官方 | [text.tw/releasenotes](https://www.text.tw/releasenotes) |
| **舊 OS 被放生** | Win7 使用者無法安裝 V12，官方客服文章說明可改買 V11（論壇引用） | 官方客服 + 論壇 | [Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)、[support.iqt.ai](https://support.iqt.ai/hc/zh-tw/articles/4406907189913) |
| **選字準確度不如預期（單字）** | 「我要打『燈』……連打了好幾次他都還是只顯示『登』」「『攝』打了好多次都還是只顯示『社』……**到底哪裡聰明**」；回應：「**選字方面付費版跟免費版一樣智障**」「新自然的選字引擎是……建立在打一長串的句子之後你再微調……**所以只打一個字的時候他不會去記**」 | 論壇 | [PTT 2016](https://www.ptt.cc/bbs/IME/M.1483084942.A.44E.html) |
| **選字準確度（與新注音差不多）** | 「發現選字跟新注音差不多爛……還以為能屌打微軟欸，結果輸入錯誤率真的是頗高」（惟同串多位使用者反嗆原PO自己錯字連篇） | 論壇 | [PTT 2021](https://www.ptt.cc/bbs/IME/M.1626033802.A.858.html) |
| **舊版 bug 不修就推新版（放生感）** | 「之前買了自然輸入法 10，有些 bug……**結果一直都沒有解決，然後就推出 11 版（狂發廣告信）**」「**是！被放生了無誤**」「基本上如果積極點多修點 bug，我或許會買 11 版本，但他們這樣的態度，基本上 11 被放生也是早晚的事情」 | 論壇 | [PTT MAC 2017](https://www.ptt.cc/bbs/MAC/M.1504083004.A.65F.html) |
| **大版本差異不大** | V11 心得：「基本上第 11 版的自然輸入法和第 10 版使用起來很類似，**沒什麼太大的差別**」 | 論壇 | [PTT 2016](https://www.ptt.cc/bbs/IME/M.1477200375.A.2FE.html) |
| **與 IDE／文件編輯器快捷鍵衝突** | Google Docs 註解 Ctrl+Alt+M 與自然輸入法「顯示對應碼」快捷鍵相同，導致無法加註解（後獲官方更新解決） | 論壇 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html) |
| **Mac 版選字操作不直覺** | 「自己太常異動到方向鍵左右移動滑鼠游標位置選字」，希望手指不離開 ASDF JKL; | 論壇 | [PTT 2019](https://www.ptt.cc/bbs/IME/M.1547612709.A.2DE.html) |
| **跨裝置／換機的授權摩擦** | 序號用戶換機**必須先解除安裝舊機**，若電腦重灌／損毀則**須寄信請客服**從後台移除；訂閱用戶才能自行在後台登出裝置 | 官方 | [text.tw/devices](https://www.text.tw/devices) |
| **強制升級（訂閱）** | 官方公告：**2026/10/15 起舊版本將無法登入訂閱帳號**，訂閱用戶須於期限前更新 | 官方 | [text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin) |
| **免費版強制註冊與每週連網** | V11 免費版「僅限於個人和家用，**每週必須至少連網一次**」；V13 Lite「**必須註冊為訂閱平台會員**才能安裝使用」、不支援離線 | 第三方 + 官方 | [免費資源網路社群](https://free.com.tw/going-input-v11-free/)、[text.tw/freeware-zhuyin](https://www.text.tw/freeware-zhuyin) |
| **隱私／鍵盤側錄疑慮** | **本次研究未找到任何具體側錄指控或資安事件**。結構性風險：使用者詞庫為**未加密 SQLite**；有雲端備份與帳號登入；隱私政策明示蒐集操作紀錄用於行銷與產品改善 | 第三方技術文件 + 官方政策 | [vChewing](https://vchewing.github.io/manual/onboarding_goingime.html)、[iqt.ai/privacy](https://www.iqt.ai/privacy) |
| **Dcard 討論** | **未能查證**（`dcard.tw` 回傳 HTTP 403） | — | — |
| **App Store／Google Play 評論** | **不存在**——自然輸入法沒有行動 App，故無商店評論可查 | — | iTunes Search／Lookup |

### 6.2 正面評價（平衡呈現）

| 優點 | 具體說法 | 來源 |
|---|---|---|
| **選字準確（勝過新酷音）** | 2013 年由新酷音跳槽的使用者：「才用沒幾天選字準確度已經**比我用了好幾年的新酷音詞庫還準了**」 | [PTT 2013](https://www.ptt.cc/bbs/IME/M.1382854578.A.3CE.html) |
| **團隊用心、客服有回應** | 反映快捷鍵衝突後「沒想到剛剛輸入法更新，就增加了『開啟/關閉快速鍵』的功能……**這團隊真的蠻用心的**，使用者的回饋有聽到」 | [PTT 2018](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html) |
| **官方社群會回應抱怨** | 「說優勢的話，就是不滿意可以到自然的**臉書社團拉小窗抱怨，會有人回應**。用其他免費輸入法要麼沒人理、不然就是被嗆這很辛苦免費仔你不會自己來寫喔！」 | [PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |
| **付費買穩定是合理選擇** | 「如果機器是**賺錢工具**，那就付錢求穩定，不要用賺錢的工具與時間，幫忙除錯。如果機器是自用……那就隨便用哪套都可以」——此則獲多人附和「中肯」「一針見血」 | 同上 |
| **標點符號與造詞是殺手級優勢** | 「主要是體現在**標點符號跟造詞**，微軟內建的注音輸入法在這兩點上面設計非常爛。**對文字工作者來說，用自然輸入法會有效率非常多**」（2025/05 留言） | [Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005) |
| **Shift 打標點超直覺** | 死忠用戶：「只要 SHIFT 按著就可以直覺打出，。『』...光這一點，超好用！」 | 同上 |
| **字大護眼、對高齡者友善** | 「字體比較大，對眼睛比較好」；「**打字匡超級大**，對於高齡人士來說是不可多得的福音」 | 同上 |
| **文字範本意外好用** | 「有些功能就是新注音沒有的了，例如**文字範本**。這東西實在是出乎意料的好用，官網應該要好好宣傳一下」 | [PTT 2013](https://www.ptt.cc/bbs/IME/M.1382854578.A.3CE.html) |
| **老用戶忠誠度極高** | 「我都用自然輸入法，幾十年了」；「好用，**從 DOS 的時代用到現在**」；「注音輸入法的唯一選擇呀」 | [Mobile01](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)、[PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |
| **跨平台一致性** | 「如果你習慣 Windows 版本的自然輸入法，那我建議你買。我就是用習慣了，**mac 版繼續買來用**」 | [PTT 2025/12](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html) |

### 6.3 痛點歸納（給產品／定價決策用）

1. **價格是最大爭議點，但方式很特定**：使用者反彈的不是「付費」本身（多人認為「開發者花的成本值得」），而是 **①只能買雙授權、②換 OS 就要原價重買、③買了才發現有免費 Lite 版、④訂閱制與強制升級**。→ **定價結構與版本溝通**比絕對價格更傷。
2. **「放生感」是品牌最大長期傷害**：V10 bug 不修就推 V11、V11 於 2022 停止維護、V12 於 2025 停止維護——**三年一放生的節奏已被使用者內化成購買決策考量**。買斷制「限購買當時版本」的條款更加深此印象。
3. **相容性問題是輸入法的宿命，官方也承認**，但每一次 OS／App 更新都是一次使用者流失風險。
4. **免費競品在 2025–2026 年快速縮小差距**（新酷音 TSF v26.1.1.0），自然輸入法的差異化被迫往上移到「語意選字品質 + 標點/造詞 + 文字範本 + 客服」。
5. **隱私是尚未被引爆、但結構上存在的弱點**：明文 SQLite 詞庫 + 雲端備份 + 操作紀錄蒐集 + 開源競品主打「不聯網」。目前**沒有實際醜聞**，但一旦發生資安事件，殺傷力會很大。
6. **行動端完全缺席**，等於放棄了整個世代使用者的第一接觸點；使用者只會在「桌面工作」情境想到自然輸入法。

---

## 7. 附錄

### 7.1 主要來源清單（全部為本報告實際抓取過的 URL）

**官方（IQT／教育部）**
- [自然輸入法官網 text.tw](https://www.text.tw/)｜[完整功能](https://www.text.tw/product-all)｜[價格方案比較](https://www.text.tw/subscription)｜[全新訂閱方案](https://www.text.tw/new-plans)
- [下載頁（版號／系統需求／SHA256）](https://www.text.tw/download)｜[版本更新資訊](https://www.text.tw/releasenotes)｜[各版本比較](https://www.text.tw/compare)｜[舊版本下載](https://www.text.tw/old-download)
- [V13 Lite 免費版](https://www.text.tw/freeware-zhuyin)｜[授權管理說明](https://www.text.tw/devices)｜[授權用戶升級 V13](https://www.text.tw/licensing)｜[團體授權方案](https://www.text.tw/group-licensing)
- [追音輸入法／自然輸入法追音版](https://www.text.tw/chasew)
- [公司簡介](https://www.iqt.ai/intro)｜[零售價格表](https://www.iqt.ai/price)｜[政府採購共同供應契約](https://www.iqt.ai/gov-licensing)｜[教育授權](https://www.iqt.ai/edu-licensing)｜[政府/企業授權](https://www.iqt.ai/licensing)｜[教育部校園數位內容](https://www.iqt.ai/school)
- [隱私權政策（2025-12-31 修訂）](https://www.iqt.ai/privacy)｜[離線註冊](https://www.iqt.ai/reg)｜[離線反註冊](https://www.iqt.ai/unreg)｜[最新消息](https://www.iqt.ai/news)
- [教育部臺灣台語輸入法](https://language.moe.gov.tw/material/info?m=a1c64194-23d9-433e-8782-8550080788d2)
- [中研院專屬販售頁 going-web2.iis.sinica.edu.tw](https://going-web2.iis.sinica.edu.tw/)
- 官方沿革頁（2018 Wayback 存檔，Big5）：[iq-t.com/PRODUCTS/version.asp](https://web.archive.org/web/20180605051619/http://www.iq-t.com/PRODUCTS/version.asp)

**第三方技術文件／開源專案**
- [vChewing 唯音：寫給自然輸入法的使用者](https://vchewing.github.io/manual/onboarding_goingime.html) ← **本報告最重要的第三方技術來源**
- [McBopomofo 小麥注音官網](https://mcbopomofo.openvanilla.org/)
- [windows-chewing-tsf GitHub](https://github.com/chewing/windows-chewing-tsf)｜[v26.1.1.0 release](https://github.com/chewing/windows-chewing-tsf/releases/tag/v26.1.1.0)｜[libchewing（已遷 Codeberg）](https://github.com/chewing/libchewing)
- [rime/librime GitHub](https://github.com/rime/librime)｜[lime-ime/limeime GitHub](https://github.com/lime-ime/limeime)

**維基百科**
- [自然輸入法](https://zh.wikipedia.org/wiki/%E8%87%AA%E7%84%B6%E8%BC%B8%E5%85%A5%E6%B3%95)｜[注音輸入法](https://zh.wikipedia.org/wiki/%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[新酷音輸入法](https://zh.wikipedia.org/wiki/%E6%96%B0%E9%85%B7%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[Yahoo!奇摩輸入法](https://zh.wikipedia.org/wiki/Yahoo!%E5%A5%87%E6%91%A9%E8%BC%B8%E5%85%A5%E6%B3%95)｜[嘸蝦米輸入法](https://zh.wikipedia.org/wiki/%E5%98%B8%E8%9D%A6%E7%B1%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[中州韻輸入法引擎](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B7%9E%E9%9F%BB%E8%BC%B8%E5%85%A5%E6%B3%95%E5%BC%95%E6%93%8E)｜[Gcin](https://zh.wikipedia.org/wiki/Gcin)｜[微軟新注音輸入法](https://zh.wikipedia.org/wiki/%E5%BE%AE%E8%BB%9F%E6%96%B0%E6%B3%A8%E9%9F%B3%E8%BC%B8%E5%85%A5%E6%B3%95)｜[Gboard](https://zh.wikipedia.org/wiki/Gboard)｜[大易輸入法](https://zh.wikipedia.org/wiki/%E5%A4%A7%E6%98%93%E8%BC%B8%E5%85%A5%E6%B3%95)｜[簡快碼（提及大新倉頡）](https://zh.wikipedia.org/wiki/%E7%B0%A1%E5%BF%AB%E7%A2%BC)

**論壇（PTT／Mobile01）**
- PTT IME：[2010 原價重買爭議](https://www.ptt.cc/bbs/IME/M.1271414048.A.F76.html)｜[2013 V10 心得](https://www.ptt.cc/bbs/IME/M.1382854578.A.3CE.html)｜[2016 V11 心得](https://www.ptt.cc/bbs/IME/M.1477200375.A.2FE.html)｜[2016 選字抱怨](https://www.ptt.cc/bbs/IME/M.1483084942.A.44E.html)｜[2018 穩定性](https://www.ptt.cc/bbs/IME/M.1526125936.A.7BB.html)｜[2018 團隊用心](https://www.ptt.cc/bbs/IME/M.1537440700.A.85B.html)｜[2018 付費版差異](https://www.ptt.cc/bbs/IME/M.1528288049.A.CD9.html)｜[2019 Mac 選字操作](https://www.ptt.cc/bbs/IME/M.1547612709.A.2DE.html)｜[2021 選字抱怨](https://www.ptt.cc/bbs/IME/M.1626033802.A.858.html)｜[2024 徵求合購](https://www.ptt.cc/bbs/IME/M.1731933273.A.7A5.html)｜[2025 新酷音 v25.8.1.0](https://www.ptt.cc/bbs/IME/M.1753963074.A.4D6.html)｜[2026 新酷音 v26.1.1.0](https://www.ptt.cc/bbs/IME/M.1768090631.A.C70.html)
- PTT MAC：[2017 V10 bug 放生（含火災傳聞）](https://www.ptt.cc/bbs/MAC/M.1504083004.A.65F.html)｜[2025/12 自然輸入法好用嗎](https://www.ptt.cc/bbs/MAC/M.1765259843.A.2BD.html)
- Mobile01：[昨晚買了自然輸入法V13 專業版（含開箱分享）](https://www.mobile01.com/topicdetail.php?f=512&t=6872005)（以 [Wayback 2025-09-01 存檔](http://web.archive.org/web/20250901050518/https://www.mobile01.com/topicdetail.php?t=6872005&f=512) 取得）
- [Facebook 官方粉絲團 IQGoing](https://www.facebook.com/IQGoing/)

**部落客／媒體**
- [重灌狂人：自然輸入法 v13 專業版+Mac 版+免費版](https://briian.com/5943/going-free.html)
- [免費資源網路社群：自然輸入法 V11 免費版下載](https://free.com.tw/going-input-v11-free/)
- [免費資源網路社群：自然輸入法 V12 注音免費版下載 Windows 註冊安裝教學](https://free.com.tw/)（由 V11 文章連結指向）

**App Store（iTunes API）**
- [教育部臺灣台語輸入法](https://apps.apple.com/tw/app/id6743423554)｜[超注音](https://apps.apple.com/tw/app/id983145797)｜[萊姆輸入法](https://apps.apple.com/tw/app/id6784694460)

### 7.2 「未能查證」清單（明確標示，避免誤用）

1. IQT 公司登記資料、成立日期（僅由頁尾 `Copyright © 1995-2026` 推得 1995 起算）、員工人數、營收、自然輸入法目前實際使用者數（官方 2018 年稱 150 萬）。
2. 自然輸入法是否內建**客語**、**粵語**輸入；現行 V13 是否仍支援**日文假名**。
3. 是否取得**無障礙規範認證**；自然輸入法本體是否通過**數位發展部資安檢測**（僅教育部台語 App 有 MAS 認證）。
4. **任何實際資安事件、鍵盤側錄指控、政府採購爭議**——本次研究均未找到。
5. 「**火災燒掉原始碼**」說法——僅見於 2017 年 PTT 單一推文，無法交叉驗證。
6. 嘸蝦米輸入法**現行價格與維護狀態**；**大新倉頡**的開發者、價格、官網與現況。
7. **hime** 專案目前的維護狀態與最後更新。
8. **Google 注音輸入法（Android）** 停止更新／下架的具體時間；**Gboard 注音的台灣使用者評價**。
9. **小麥注音的授權條款與維護者**細節（僅取得官網版本資訊）。
10. **Dcard** 上的相關討論（HTTP 403 無法存取）。
11. **V13 Lite 是否同樣蒐集匿名使用資料**。
12. 教育授權完整價目表（`text.tw/group-licensing` 頁面為 JS 渲染，表格僅部分讀取；政府共契價目則完整取得）。

### 7.3 研究工具與再現方式

本報告的搜尋／抓取工具已留存於 `/home/rchua/GO/pingzhu/research/tools/`：

| 檔案 | 用途 |
|---|---|
| `s.py` | DuckDuckGo-lite 搜尋（研究初期有效，後被封鎖） |
| `s2.py` | 帶 cookie jar 與退避重試的版本（同樣被封鎖） |
| `fetch.py` | 抓網頁並轉純文字，支援 `FORCE_CS=big5` 處理 Big5 舊站 |
| `clean.py` | 去除導覽列／頁尾重複樣板，抽出正文 |
| `links.py` | 抽出頁面所有連結 |
| `wp.py`／`wp2.py` | Wikipedia 純文字摘要（`wp2.py` 支援多標題單次請求，需 `exlimit=max`） |
| `wsearch.py` | Wikipedia 全文搜尋 |
| `ptt.sh` | 抓 PTT 文章並過濾樣板 |
| `README.md` | 工具說明與「已確認被封鎖的搜尋引擎」清單 |

**要重現本報告**：先修好 `web_search` 的 endpoint（見第 0 節），或沿用上述工具直接抓取 7.1 的來源 URL。

---

*報告結束。所有標示 `未能查證` 的項目，代表本次研究在可用管道下無法取得可靠來源，並非「不存在」。*
