#!/usr/bin/env python3
"""Paced DDG-lite search with cookie jar + challenge backoff.
Usage: s2.py "query" [n] [page]   (reads cookie jar /tmp/ddg_cj.txt)
"""
import sys, re, html, subprocess, urllib.parse, time, os, random

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
CJ='/tmp/ddg_cj.txt'

def raw(q, page=0, kl='tw-tzh', attempt=0):
    url = 'https://lite.duckduckgo.com/lite/?q=' + urllib.parse.quote(q) + f'&kl={kl}'
    if page: url += f'&s={page*30}'
    r = subprocess.run(['curl','-s','--max-time','45','-A',UA,
        '-H','Accept-Language: zh-TW,zh;q=0.9,en;q=0.8',
        '-H','Accept: text/html,application/xhtml+xml',
        '-c',CJ,'-b',CJ, url], capture_output=True, text=True)
    return r.stdout

def parse(h):
    out=[]; cur=None
    for row in re.findall(r'<tr>(.*?)</tr>', h, re.S):
        a = re.search(r"<a[^>]+href=[\"']([^\"']+)[\"'][^>]*class=['\"]result-link['\"][^>]*>(.*?)</a>", row, re.S)
        if a:
            u=html.unescape(a.group(1)); t=html.unescape(re.sub(r'<[^>]+>','',a.group(2))).strip()
            m=re.search(r'uddg=([^&]+)',u)
            if m: u=urllib.parse.unquote(m.group(1))
            cur={'title':t,'url':u,'snippet':''}; out.append(cur); continue
        sn=re.search(r"class=['\"]result-snippet['\"][^>]*>(.*?)</td>", row, re.S)
        if sn and cur is not None:
            cur['snippet']=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',sn.group(1))).strip())
    return out

def search(q, page=0):
    for attempt in range(3):
        h = raw(q, page)
        if 'result-link' in h:
            return parse(h), 'ok'
        if 'challenge' in h or 'anomaly' in h:
            time.sleep(20 + attempt*25 + random.random()*10)
            continue
        time.sleep(8)
    return [], 'blocked'

if __name__=='__main__':
    q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 10
    pg=int(sys.argv[3]) if len(sys.argv)>3 else 0
    res, st = search(q, pg)
    print(f'== DDG({st}): {q}  ({len(res)} hits)')
    for i,r in enumerate(res[:n],1):
        print(f'{i}. {r["title"]}\n   {r["url"]}\n   {r["snippet"][:300]}')
