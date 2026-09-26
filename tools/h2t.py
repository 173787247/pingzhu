#!/usr/bin/env python3
"""HTML -> plain text (stdlib only). Usage: h2t.py < file.html"""
import sys, re, html

def to_text(raw: str) -> str:
    s = raw
    s = re.sub(r"(?is)<!--.*?-->", " ", s)
    s = re.sub(r"(?is)<(script|style|noscript|svg|head|iframe)[^>]*>.*?</\1\s*>", " ", s)
    s = re.sub(r"(?is)<br\s*/?>", "\n", s)
    s = re.sub(r"(?is)</(p|div|li|tr|h[1-6]|section|article|table|ul|ol|blockquote)\s*>", "\n", s)
    s = re.sub(r"(?is)<li[^>]*>", "\n- ", s)
    s = re.sub(r"(?is)<t[dh][^>]*>", " | ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace("\u00a0", " ").replace("\u200b", "")
    s = re.sub(r"[ \t\f\v]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()

if __name__ == "__main__":
    data = sys.stdin.buffer.read()
    for enc in ("utf-8", "big5", "cp950", "gb18030", "latin-1"):
        try:
            print(to_text(data.decode(enc)))
            break
        except UnicodeDecodeError:
            continue
