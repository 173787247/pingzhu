# 07 · 調研工具鏈（可重現取證）

> 這個倉庫的每一項事實都應該能被重新取得。這份文件記錄工具與方法，
> 讓「這些數字哪裡來的」有答案。

## 背景：`web_search` 工具在本次調研中全程失效

本次調研期間，dsh 的 `web_search` 工具在所有查詢上都失敗：

```
DeepSeek returned an unprocessable response body: SyntaxError: Unexpected token 'e',
"e \u0000\u0010-\u0000\u0000����"... is not valid JSON
```

根因已知（見 `~/GO/dsh-websearch-修复记录.md`）：dsh 把 undici 8.x 的 `ProxyAgent`
裝成 Node 內建 fetch（undici 7.x）的全局 dispatcher，跨大版本時**回應標頭遺失**，
導致 brotli 壓縮的回應未被解壓就送進 `JSON.parse`。修法是讓 dsh 用與 Node 同版的
undici，但**需要重啟 dsh 才生效**——而重啟會中斷當時的工作階段，因此本次調研全程
改用下列替代通道完成。

**這件事的副產品**：本倉庫的工具鏈不依賴任何「AI 搜尋」服務，全部是可重跑的 HTTP 請求。

## 工具

| 工具 | 用途 |
|---|---|
| `tools/search.py` | 多引擎搜尋（Bing RSS／Google News RSS／維基百科 API／Hacker News／PTT／GitHub） |
| `tools/webfetch.sh` | 走代理抓取單一 URL 並轉純文字 |
| `tools/h2t.py` | HTML → 純文字（stdlib，無依賴） |
| `tools/crawl.sh` | 批次抓取 URL 清單，存 HTML 與純文字兩份 |
| `tools/page.py` | 去重後印出爬取結果的正文（跳過導覽列） |
| `tools/zd.py` | 傾印 Zendesk 客服中心（本專案最重要的單一資料來源） |

所有工具都走 `HTTPS_PROXY`（本機 `127.0.0.1:16006`），不需要額外設定。

## 實測可用的通道

| 通道 | 端點 | 結果 |
|---|---|---|
| Google News RSS | `news.google.com/rss/search?q=…&hl=zh-TW&gl=TW&ceid=TW:zh-Hant` | ✅ 最適合找媒體報導 |
| Bing RSS | `bing.com/search?q=…&format=rss` | ✅ 中文查詢不穩，英文可用 |
| 維基百科 API | `zh.wikipedia.org/w/api.php?action=query&list=search` | ✅ |
| Hacker News（Algolia） | `hn.algolia.com/api/v1/search` | ✅ |
| PTT 站內搜尋 | `ptt.cc/bbs/{board}/search?q=…` | ✅ 痛點證據 |
| GitHub API | 經 `gh api`（已登入，避免匿名限流） | ✅ 授權與活躍度查證的主力 |
| **Zendesk 公開 API** | `{site}/api/v2/help_center/{locale}/articles.json` | ✅ **本次關鍵突破** |
| DuckDuckGo / Mojeek 直抓 | — | ❌ CAPTCHA |
| Yep API | `api.yep.com/fs/2/search` | ❌ 403 |

## 關鍵突破：客服中心是公開 API

`text.tw` 是 **Strikingly** 架站，正文由 JS 從 JSON 拉取，直接抓 HTML 只會拿到導覽列。
但導覽列裡露出一個網址：`support.iqt.ai` —— 那是 **Zendesk**，而 Zendesk 的
Help Center API 預設公開：

```bash
python3 tools/zd.py https://support.iqt.ai zh-tw ~/GO/raw/zendesk
# → 201 篇文章，含標題、更新時間、正文
```

這份資料的價值遠高於行銷頁面：**它無意間揭露了產品的真實問題分布**
（25% 的條目是授權／訂閱／付款問題，Android 相關條目為零）。
行銷頁面會說自己多好；客服中心會說使用者實際上遇到什麼。

## 另一個坑：Strikingly 的正文是轉義過的

抓下 `text.tw` 的 HTML 後，`<script>` 裡是 `\uXXXX` 轉義的 JSON，
所以「去標籤」會把正文一起丟掉。正確做法是**先還原轉義再去除標籤**：

```python
s = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)
s = re.sub(r'\\n|\\t', ' ', s)
s = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', s)
t = re.sub(r'(?s)<[^>]+>', ' ', s)
```

`tools/h2t.py` 保留的是「純 HTML」路徑；上述變體用於 Strikingly 站台。

## 取證清單

| 主張 | 來源 | 取證方式 |
|---|---|---|
| 自然輸入法無 Android／iOS／Linux 版 | support.iqt.ai 條目標題 | Zendesk API，見 [01](01-competitive-analysis.md) |
| 定價 NT$2,800 起、訂閱 NT$129/月起 | iqt.ai/price | 爬取 + 轉義還原 |
| V13 於 2023-09 上市 | 工商時報（Google News RSS） | `search.py news` |
| 客服 201 篇中 51 篇為授權／訂閱／付款 | support.iqt.ai 全量 | 分類統計腳本（見 [01](01-competitive-analysis.md) 第 5 節） |
| McBopomofo 為 MIT、840★ | GitHub API | `gh api repos/openvanilla/McBopomofo` |
| libchewing 已重寫為 Rust、遷至 Codeberg | Codeberg API + crates.io | `codeberg.org/api/v1/repos/chewing/libchewing`、`crates.io/api/v1/crates/chewing` |
| libchewing-data 為 CC BY 4.0 | Codeberg 檔案樹 | `LICENSES/CC-BY-4.0.txt` |
| RIME 官方前端全為 GPL-3.0 | GitHub API | `gh api repos/rime/weasel` 等 |

## 重跑方式

```bash
# 1. 爬官網（產品、定價、平台支援）
bash tools/crawl.sh /tmp/pingzhu-crawl research/_urls_text.tw.txt
bash tools/crawl.sh /tmp/pingzhu-crawl research/_urls_iqt.ai.txt

# 2. 傾印客服中心（201 篇）
python3 tools/zd.py https://support.iqt.ai zh-tw /tmp/pingzhu-zendesk

# 3. 找媒體報導
python3 tools/search.py news "自然輸入法"

# 4. 查證開源專案的授權與活躍度
python3 tools/search.py gh "bopomofo"
gh api repos/openvanilla/McBopomofo --jq '{license:.license.spdx_id, stars:.stargazers_count}'
```

`research/02-opensource-stack.md` 是另一份獨立的技術棧調研報告，
含更完整的授權表格與來源清單。
