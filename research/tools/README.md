# 检索工具（web_search 故障时的替代方案）

本 session 的 `web_search` 工具持续回传无法解析的回应（DeepSeek search endpoint 故障），
因此改用 bash + curl 直接检索。以下工具已验证可用（2026-09）。

## 搜寻（DuckDuckGo lite，支援繁体中文）
    python3 /home/rchua/GO/pingzhu/research/tools/s.py "查询字串" [笔数] [页码0起]
- `kl=tw-tzh` 已在脚本内固定，结果偏台湾繁中。
- 已验证：Google / Bing / Brave / Ecosia / Startpage / Qwant 皆被挡或回传无关结果，不要浪费时间。

## 抓取网页并转纯文字（无长度限制，可存档）
    python3 /home/rchua/GO/pingzhu/research/tools/fetch.py "URL" [最多字元数] [输出档案路径]
- 走环境变数 proxy（HTTP_PROXY=http://127.0.0.1:16006），可用。
- 输出第一行是 `### HTTP <code> final=<url> textlen=<n>`，最后一行 `### FAIL ...` 代表失败。

## 抓出页面所有连结（单引号/双引号皆可）
    python3 /home/rchua/GO/pingzhu/research/tools/links.py "URL"
