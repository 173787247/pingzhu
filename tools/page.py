#!/usr/bin/env python3
"""Print de-duplicated plain text of Strikingly pages extracted into txt2/.

usage: page.py <txt2-dir> <slug-substring> [maxchars]
"""
import sys, os, re, glob

d, pat = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 5000
files = [f for f in sorted(glob.glob(os.path.join(d, "*.txt"))) if pat in f]
if not files:
    print("no file matching", pat); sys.exit(1)
for f in files:
    print(f"########## {os.path.basename(f)} ##########")
    seen, out = set(), []
    for line in open(f, encoding="utf-8", errors="replace").read().split("\n"):
        line = line.strip()
        if not line or line in seen:
            continue
        seen.add(line)
        out.append(line)
    txt = "\n".join(out)
    print(txt[:limit])
    print(f"...[total {len(txt)} chars]" if len(txt) > limit else "")
    print()
