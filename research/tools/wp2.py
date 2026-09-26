#!/usr/bin/env python3
"""Wikipedia multi-title plain-text extract (one request). Usage: wp2.py "T1" "T2" ..."""
import sys, json, subprocess, urllib.parse
titles='|'.join(sys.argv[1:])
url=('https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1'
     '&redirects=1&format=json&exchars=1200&exlimit=max&titles='+urllib.parse.quote(titles))
r=subprocess.run(['curl','-s','--max-time','45','-A','dsh-research/1.0 (contact: local)',url],capture_output=True,text=True)
try:
    d=json.loads(r.stdout)
    for k,v in d['query']['pages'].items():
        if 'extract' not in v:
            print(f'== {v.get("title")}: NO ARTICLE'); print('-'*40); continue
        print(f'== {v["title"]} =='); print(v['extract']); print('-'*40)
except Exception as e:
    print(f'FAIL {e} :: {r.stdout[:300]}')
