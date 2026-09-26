#!/usr/bin/env python3
"""Fetch a URL (honoring env proxies), strip HTML -> text. Usage: fetch.py URL [maxchars] [outfile]"""
import sys, re, html, urllib.request, gzip, io, zlib, os
FORCE_CS = os.environ.get('FORCE_CS')

def get(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        enc = r.headers.get('Content-Encoding','')
        if enc == 'gzip':
            raw = gzip.decompress(raw)
        elif enc == 'deflate':
            try: raw = zlib.decompress(raw)
            except Exception: raw = zlib.decompress(raw, -zlib.MAX_WBITS)
        ct = r.headers.get('Content-Type','')
        cs = 'utf-8'
        m = re.search(r'charset=([\w-]+)', ct)
        if m: cs = m.group(1)
        if FORCE_CS: cs = FORCE_CS
        return raw.decode(cs, errors='replace'), r.geturl(), r.status

def totext(h):
    h = re.sub(r'(?is)<script.*?</script>', ' ', h)
    h = re.sub(r'(?is)<style.*?</style>', ' ', h)
    h = re.sub(r'(?is)<noscript.*?</noscript>', ' ', h)
    h = re.sub(r'(?is)<svg.*?</svg>', ' ', h)
    h = re.sub(r'(?i)<br\s*/?>', '\n', h)
    h = re.sub(r'(?i)</(p|div|li|tr|h[1-6]|td|th|section|article)>', '\n', h)
    h = re.sub(r'(?s)<[^>]+>', ' ', h)
    h = html.unescape(h)
    h = re.sub(r'[ \t\xa0]+', ' ', h)
    h = re.sub(r'\n\s*\n\s*\n+', '\n\n', h)
    lines = [l.strip() for l in h.split('\n')]
    return '\n'.join(l for l in lines if l)

if __name__ == '__main__':
    url = sys.argv[1]; maxc = int(sys.argv[2]) if len(sys.argv) > 2 else 40000
    out = sys.argv[3] if len(sys.argv) > 3 else None
    try:
        raw, final, st = get(url)
        t = totext(raw)
        print(f'### HTTP {st} final={final} textlen={len(t)}')
        if out:
            open(out,'w',encoding='utf-8').write(t)
            print(f'### saved -> {out}')
        print(t[:maxc])
    except Exception as e:
        print(f'### FAIL {type(e).__name__}: {e}')
