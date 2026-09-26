#!/usr/bin/env python3
"""Wikipedia plain-text extract. Usage: wp.py "標題" [chars] [lang]"""
import sys, json, subprocess, urllib.parse
t=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 2500
lang=sys.argv[3] if len(sys.argv)>3 else 'zh'
url=('https://'+lang+'.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1'
     '&redirects=1&format=json&titles='+urllib.parse.quote(t))
r=subprocess.run(['curl','-s','--max-time','40','-A','dsh-research/1.0',url],capture_output=True,text=True)
try:
    d=json.loads(r.stdout)
    pages=d['query']['pages']
    for k,v in pages.items():
        if 'extract' not in v:
            print(f'== {t}: NO ARTICLE ({v.get("title")})'); continue
        print(f'== {v["title"]} ({len(v["extract"])} chars) ==')
        print(v['extract'][:n])
except Exception as e:
    print(f'== {t}: FAIL {type(e).__name__} {e} :: {r.stdout[:200]}')
