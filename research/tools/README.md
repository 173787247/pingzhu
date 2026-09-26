# 檢索工具（web_search 故障時的替代方案）

本 session 的 `web_search` 工具持續回傳無法解析的回應（DeepSeek search endpoint 故障），
因此改用 bash + curl 直接檢索。以下工具已驗證可用（2026-09）。

## 搜尋（DuckDuckGo lite，支援繁體中文）
    python3 /home/rchua/GO/pingzhu/research/tools/s.py "查詢字串" [筆數] [頁碼0起]
- `kl=tw-tzh` 已在腳本內固定，結果偏台灣繁中。
- 已驗證：Google / Bing / Brave / Ecosia / Startpage / Qwant 皆被擋或回傳無關結果，不要浪費時間。

## 抓取網頁並轉純文字（無長度限制，可存檔）
    python3 /home/rchua/GO/pingzhu/research/tools/fetch.py "URL" [最多字元數] [輸出檔案路徑]
- 走環境變數 proxy（HTTP_PROXY=http://127.0.0.1:16006），可用。
- 輸出第一行是 `### HTTP <code> final=<url> textlen=<n>`，最後一行 `### FAIL ...` 代表失敗。

## 抓出頁面所有連結（單引號/雙引號皆可）
    python3 /home/rchua/GO/pingzhu/research/tools/links.py "URL"
