#!/usr/bin/env python3
"""Dump a Zendesk Help Center to plain text files.

usage: zd.py <base> <locale> <outdir>
e.g.   zd.py https://support.iqt.ai zh-tw /home/rchua/GO/raw/zendesk
"""
import sys, os, json, re, html, urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def strip(h):
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", h or "")
    h = re.sub(r"(?i)<br\s*/?>", "\n", h)
    h = re.sub(r"(?i)</(p|div|li|tr|h[1-6])>", "\n", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = html.unescape(h).replace("\u00a0", " ")
    h = re.sub(r"[ \t]+", " ", h)
    return re.sub(r"\n{3,}", "\n\n", h).strip()


def main():
    base, locale, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    url = f"{base}/api/v2/help_center/{locale}/articles.json?per_page=100"
    art, page = [], 0
    while url:
        d = get(url)
        art += d.get("articles", [])
        page += 1
        url = d.get("next_page")
        print(f"page {page}: total {len(art)}/{d.get('count')}", file=sys.stderr)
        if page > 20:
            break
    index = []
    for a in art:
        aid, title = a["id"], a["title"]
        body = strip(a.get("body"))
        safe = re.sub(r"[^0-9A-Za-z._\u4e00-\u9fff-]+", "_", title)[:80]
        fn = f"{aid}-{safe}.txt"
        with open(os.path.join(outdir, fn), "w") as f:
            f.write(f"# {title}\n# updated: {a.get('updated_at','')}\n# url: {a.get('html_url','')}\n\n{body}\n")
        index.append({"id": aid, "title": title, "updated": a.get("updated_at", ""),
                      "url": a.get("html_url", ""), "file": fn, "chars": len(body)})
    with open(os.path.join(outdir, "_index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(index)} articles to {outdir}", file=sys.stderr)


if __name__ == "__main__":
    main()
