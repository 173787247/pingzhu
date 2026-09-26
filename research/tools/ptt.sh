#!/bin/bash
# usage: ptt.sh <article-path> [chars]
p="$1"; n="${2:-3000}"
python3 /home/rchua/GO/pingzhu/research/tools/fetch.py "https://www.ptt.cc$p" "$n" 2>&1 | \
  grep -v -E '^(批踢踢實業坊|›|關於我們|聯絡資訊|看板|精華區|最舊|‹ 上頁|下頁 ›|最新|搜尋同標題文章|搜尋看板內|⋯|$)' | head -80
