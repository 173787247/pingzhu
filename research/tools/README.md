# 检索工具（web_search 故障时的替代方案）

本 session 的 `web_search` 工具持续回传无法解析的回应（DeepSeek search endpoint 故障），
因此改用 bash + curl 直接检索。以下工具已验证可用（2026-09）。

## ★ 2026-10-01 情况反转：请优先用内建 `web_search` / `web_fetch`

上面那段的历史背景已经不成立 ✓ **内建的 `web_search` 与 `web_fetch` 现已可用**
（走 Windows 侧代理）✓ 而原本用来替代它的 `s.py` **已经失效** ✗

实测（2026-10-01）：

```
s.py（DuckDuckGo lite）   → 回传 14 KB 空壳页，0 个结果连结
                            选择器 class="result-link" 已不存在
html.duckduckgo.com/html  → 0 结果
www.mojeek.com            → 回传 Captcha 页
search.marcia.cc          → 空回应
```

**所以：检索优先用 `web_search`，抓网页优先用 `web_fetch`。**
`s.py` 留在仓库是因为解析逻辑仍可作参考，但**不要再指望它** ✗

`fetch.py`（curl 版）在某些站点仍可用，但 `web_fetch` 更可靠 ✓

## 搜寻（DuckDuckGo lite，支援繁体中文）—— ★ 已失效，见上
    python3 /home/rchua/GO/pingzhu/research/tools/s.py "查询字串" [笔数] [页码0起]
- `kl=tw-tzh` 已在脚本内固定，结果偏台湾繁中。
- 已验证：Google / Bing / Brave / Ecosia / Startpage / Qwant 皆被挡或回传无关结果，不要浪费时间。

## 抓取网页并转纯文字（无长度限制，可存档）
    python3 /home/rchua/GO/pingzhu/research/tools/fetch.py "URL" [最多字元数] [输出档案路径]
- 走环境变数 proxy（HTTP_PROXY=http://127.0.0.1:16006），可用。
- 输出第一行是 `### HTTP <code> final=<url> textlen=<n>`，最后一行 `### FAIL ...` 代表失败。

## 抓出页面所有连结（单引号/双引号皆可）
    python3 /home/rchua/GO/pingzhu/research/tools/links.py "URL"
