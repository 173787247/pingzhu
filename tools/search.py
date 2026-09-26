#!/usr/bin/env python3
"""Search helper for this WSL box, used because the dsh `web_search` tool is broken
(undici dispatcher mismatch, needs a dsh restart). Everything goes through the
Windows/WSL HTTP proxy taken from the environment.

usage:
  search.py bing  "<query>"            # Bing RSS
  search.py news  "<query>"            # Google News RSS (zh-TW)
  search.py wiki  "<query>"            # zh.wikipedia.org API
  search.py hn    "<query>"            # Hacker News (Algolia)
  search.py ptt   "<board>" "<query>"  # PTT board search (e.g. IME, MobileComm)
  search.py gh    "<query>"            # GitHub repo search via `gh`
  search.py ghcode "<query>"           # GitHub code search via `gh`
  search.py ddg   "<query>"            # DuckDuckGo lite (may hit captcha)
"""
import sys, json, re, html, subprocess
import urllib.request, urllib.parse
import xml.etree.ElementTree as ET

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    })
    return urllib.request.urlopen(req, timeout=timeout).read()


def strip(t):
    t = re.sub(r"(?s)<[^>]+>", "", t or "")
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def rss(raw, limit=15):
    root = ET.fromstring(raw)
    out = []
    for it in root.iter("item"):
        title = strip(it.findtext("title"))
        link = (it.findtext("link") or "").strip()
        desc = strip(it.findtext("description"))[:300]
        date = strip(it.findtext("pubDate"))
        out.append((title, link, f"{date} {desc}".strip()))
        if len(out) >= limit:
            break
    return out


def show(rows):
    if not rows:
        print("(no results)")
    for i, (t, u, s) in enumerate(rows, 1):
        print(f"{i}. {t}\n   {u}\n   {s}\n")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    eng = sys.argv[1]
    if eng == "ptt":
        board, q = sys.argv[2], " ".join(sys.argv[3:])
    else:
        q = " ".join(sys.argv[2:])
    e = urllib.parse.quote(q)

    if eng == "bing":
        show(rss(get(f"https://www.bing.com/search?q={e}&format=rss&count=30")))
    elif eng == "news":
        show(rss(get("https://news.google.com/rss/search?q=" + e +
                     "&hl=zh-TW&gl=TW&ceid=TW:zh-Hant")))
    elif eng == "wiki":
        d = json.loads(get("https://zh.wikipedia.org/w/api.php?action=query&list=search"
                           f"&srsearch={e}&format=json&srlimit=8&srprop=snippet"))
        show([(x["title"], "https://zh.wikipedia.org/wiki/" + urllib.parse.quote(x["title"]),
               strip(x["snippet"])) for x in d["query"]["search"]])
    elif eng == "hn":
        d = json.loads(get(f"https://hn.algolia.com/api/v1/search?query={e}&hitsPerPage=10"))
        show([(h.get("title") or h.get("story_title") or "",
               h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}",
               f"{h.get('points')} points, {h.get('num_comments')} comments")
              for h in d["hits"]])
    elif eng == "ptt":
        raw = get(f"https://www.ptt.cc/bbs/{board}/search?q={e}")
        rows = []
        for m in re.finditer(r'<div class="title">\s*<a href="([^"]+)">(.*?)</a>', raw.decode("utf-8", "replace"), re.S):
            rows.append((strip(m.group(2)), "https://www.ptt.cc" + m.group(1), ""))
        show(rows)
    elif eng == "ddg":
        raw = get(f"https://lite.duckduckgo.com/lite/?q={e}").decode("utf-8", "replace")
        rows = [(strip(t), u, "") for u, t in
                re.findall(r'<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', raw, re.S)]
        if not rows:
            rows = [(strip(t), u, "") for u, t in
                    re.findall(r'<a[^>]+href="(http[^"]+)"[^>]*>(.*?)</a>', raw, re.S)][:15]
        show(rows)
    elif eng in ("gh", "ghcode"):
        kind = "repositories" if eng == "gh" else "code"
        p = subprocess.run(["gh", "api", "-X", "GET", f"search/{kind}",
                            "-f", f"q={q}", "-f", "per_page=15",
                            "--jq", ".items[] | \"\\(.full_name // .repository.full_name)\\t\\(.html_url)\\t\\(.description // .path // \"\")\\t\\(.stargazers_count // 0)★\\t\\(.license.spdx_id // \"?\") \""],
                           capture_output=True, text=True)
        if p.returncode != 0:
            print("gh error:", p.stderr[:400]); return 1
        for i, line in enumerate(p.stdout.strip().splitlines(), 1):
            print(f"{i}. {line}")
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
