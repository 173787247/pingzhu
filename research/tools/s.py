#!/usr/bin/env python3
"""DuckDuckGo-lite search (GET). Usage: s.py "query" [n] [page]"""
import sys, re, html, subprocess, urllib.parse

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

def search(q, page=0, kl='tw-tzh'):
    url = 'https://lite.duckduckgo.com/lite/?q=' + urllib.parse.quote(q) + f'&kl={kl}'
    if page: url += f'&s={page*30}'
    r = subprocess.run(['curl','-s','--max-time','45','-A',UA,
        '-H','Accept-Language: zh-TW,zh;q=0.9', url], capture_output=True, text=True)
    h = r.stdout
    out=[]
    rows = re.findall(r'<tr>(.*?)</tr>', h, re.S)
    cur=None
    for row in rows:
        a = re.search(r"<a[^>]+href=[\"']([^\"']+)[\"'][^>]*class=['\"]result-link['\"][^>]*>(.*?)</a>", row, re.S)
        if a:
            u = html.unescape(a.group(1)); t = html.unescape(re.sub(r'<[^>]+>','',a.group(2))).strip()
            m = re.search(r'uddg=([^&]+)', u)
            if m: u = urllib.parse.unquote(m.group(1))
            cur = {'title':t,'url':u,'snippet':''}
            out.append(cur); continue
        sn = re.search(r"class=['\"]result-snippet['\"][^>]*>(.*?)</td>", row, re.S)
        if sn and cur is not None:
            s = html.unescape(re.sub(r'<[^>]+>','',sn.group(1))).strip()
            cur['snippet'] = re.sub(r'\s+',' ',s)
    return out

if __name__=='__main__':
    q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 12
    pg=int(sys.argv[3]) if len(sys.argv)>3 else 0
    res=search(q,pg)
    print(f'== DDG: {q}  (page {pg}, {len(res)} hits)')
    for i,r in enumerate(res[:n],1):
        print(f'{i}. {r["title"]}\n   {r["url"]}\n   {r["snippet"][:300]}')
