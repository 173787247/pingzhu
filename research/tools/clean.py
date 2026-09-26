#!/usr/bin/env python3
"""Strip repeated boilerplate lines from fetched text. Usage: clean.py file [minlen]"""
import sys, collections
p=sys.argv[1]; minlen=int(sys.argv[2]) if len(sys.argv)>2 else 4
lines=[l.strip() for l in open(p,encoding='utf-8',errors='replace').read().split('\n')]
c=collections.Counter(l for l in lines if l)
out=[]; seen=set()
for l in lines:
    if not l: continue
    if c[l]>1: continue   # drop anything repeated (nav/footer)
    if len(l)<minlen: continue
    if l.startswith('###'): continue
    if l in seen: continue
    seen.add(l); out.append(l)
print('\n'.join(out))
