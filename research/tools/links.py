import sys, re, html, subprocess, urllib.parse
url=sys.argv[1]
r=subprocess.run(['curl','-sL','--max-time','50','-A','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0',url],capture_output=True,text=True)
h=r.stdout
seen=set()
for m in re.finditer(r'href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', h, re.S|re.I):
    u,t=m.group(1), html.unescape(re.sub(r'<[^>]+>','',m.group(2))).strip()
    if u.startswith('mailto:') or u.startswith('javascript'): continue
    au=urllib.parse.urljoin(url,u)
    key=au.split('#')[0]
    if key in seen: continue
    seen.add(key)
    print(f'{t[:60]:60s} | {key}')
