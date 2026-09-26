# 07 · 调研工具链（可重现取证）

> 这个仓库的每一项事实都应该能被重新取得。这份文件记录工具与方法，
> 让「这些数字哪里来的」有答案。

## 背景：`web_search` 工具在本次调研中全程失效

本次调研期间，dsh 的 `web_search` 工具在所有查询上都失败：

```
DeepSeek returned an unprocessable response body: SyntaxError: Unexpected token 'e',
"e \u0000\u0010-\u0000\u0000����"... is not valid JSON
```

根因已知（见 `~/GO/dsh-websearch-修复记录.md`）：dsh 把 undici 8.x 的 `ProxyAgent`
装成 Node 内建 fetch（undici 7.x）的全局 dispatcher，跨大版本时**回应标头遗失**，
导致 brotli 压缩的回应未被解压就送进 `JSON.parse`。修法是让 dsh 用与 Node 同版的
undici，但**需要重启 dsh 才生效**——而重启会中断当时的工作阶段，因此本次调研全程
改用下列替代通道完成。

**这件事的副产品**：本仓库的工具链不依赖任何「AI 搜寻」服务，全部是可重跑的 HTTP 请求。

## 工具

| 工具 | 用途 |
|---|---|
| `tools/search.py` | 多引擎搜寻（Bing RSS／Google News RSS／维基百科 API／Hacker News／PTT／GitHub） |
| `tools/webfetch.sh` | 走代理抓取单一 URL 并转纯文字 |
| `tools/h2t.py` | HTML → 纯文字（stdlib，无依赖） |
| `tools/crawl.sh` | 批次抓取 URL 清单，存 HTML 与纯文字两份 |
| `tools/page.py` | 去重后印出爬取结果的正文（跳过导览列） |
| `tools/zd.py` | 倾印 Zendesk 客服中心（本专案最重要的单一资料来源） |

所有工具都走 `HTTPS_PROXY`（本机 `127.0.0.1:16006`），不需要额外设定。

## 实测可用的通道

| 通道 | 端点 | 结果 |
|---|---|---|
| Google News RSS | `news.google.com/rss/search?q=…&hl=zh-TW&gl=TW&ceid=TW:zh-Hant` | ✅ 最适合找媒体报导 |
| Bing RSS | `bing.com/search?q=…&format=rss` | ✅ 中文查询不稳，英文可用 |
| 维基百科 API | `zh.wikipedia.org/w/api.php?action=query&list=search` | ✅ |
| Hacker News（Algolia） | `hn.algolia.com/api/v1/search` | ✅ |
| PTT 站内搜寻 | `ptt.cc/bbs/{board}/search?q=…` | ✅ 痛点证据 |
| GitHub API | 经 `gh api`（已登入，避免匿名限流） | ✅ 授权与活跃度查证的主力 |
| **Zendesk 公开 API** | `{site}/api/v2/help_center/{locale}/articles.json` | ✅ **本次关键突破** |
| DuckDuckGo / Mojeek 直抓 | — | ❌ CAPTCHA |
| Yep API | `api.yep.com/fs/2/search` | ❌ 403 |

## 关键突破：客服中心是公开 API

`text.tw` 是 **Strikingly** 架站，正文由 JS 从 JSON 拉取，直接抓 HTML 只会拿到导览列。
但导览列里露出一个网址：`support.iqt.ai` —— 那是 **Zendesk**，而 Zendesk 的
Help Center API 预设公开：

```bash
python3 tools/zd.py https://support.iqt.ai zh-tw ~/GO/raw/zendesk
# → 201 篇文章，含標題、更新時間、正文
```

这份资料的价值远高于行销页面：**它无意间揭露了产品的真实问题分布**
（25% 的条目是授权／订阅／付款问题，Android 相关条目为零）。
行销页面会说自己多好；客服中心会说使用者实际上遇到什么。

## 另一个坑：Strikingly 的正文是转义过的

抓下 `text.tw` 的 HTML 后，`<script>` 里是 `\uXXXX` 转义的 JSON，
所以「去标签」会把正文一起丢掉。正确做法是**先还原转义再去除标签**：

```python
s = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)
s = re.sub(r'\\n|\\t', ' ', s)
s = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', s)
t = re.sub(r'(?s)<[^>]+>', ' ', s)
```

`tools/h2t.py` 保留的是「纯 HTML」路径；上述变体用于 Strikingly 站台。

## 取证清单

| 主张 | 来源 | 取证方式 |
|---|---|---|
| 自然输入法无 Android／iOS／Linux 版 | support.iqt.ai 条目标题 | Zendesk API，见 [01](01-competitive-analysis.md) |
| 定价 NT$2,800 起、订阅 NT$129/月起 | iqt.ai/price | 爬取 + 转义还原 |
| V13 于 2023-09 上市 | 工商时报（Google News RSS） | `search.py news` |
| 客服 201 篇中 51 篇为授权／订阅／付款 | support.iqt.ai 全量 | 分类统计脚本（见 [01](01-competitive-analysis.md) 第 5 节） |
| McBopomofo 为 MIT、840★ | GitHub API | `gh api repos/openvanilla/McBopomofo` |
| libchewing 已重写为 Rust、迁至 Codeberg | Codeberg API + crates.io | `codeberg.org/api/v1/repos/chewing/libchewing`、`crates.io/api/v1/crates/chewing` |
| libchewing-data 为 CC BY 4.0 | Codeberg 档案树 | `LICENSES/CC-BY-4.0.txt` |
| RIME 官方前端全为 GPL-3.0 | GitHub API | `gh api repos/rime/weasel` 等 |

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

`research/02-opensource-stack.md` 是另一份独立的技术栈调研报告，
含更完整的授权表格与来源清单。
