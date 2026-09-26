#!/usr/bin/env python3
import sys, json, subprocess, urllib.parse
q=sys.argv[1]
url=('https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=8&srsearch='+urllib.parse.quote(q))
r=subprocess.run(['curl','-s','--max-time','40','-A','dsh-research/1.0',url],capture_output=True,text=True)
try:
    d=json.loads(r.stdout)
    for x in d['query']['search']:
        import re,html
        sn=re.sub(r'<[^>]+>','',x.get('snippet',''))
        print(f"- {x['title']}: {html.unescape(sn)}")
except Exception as e: print('FAIL',e,r.stdout[:200])
