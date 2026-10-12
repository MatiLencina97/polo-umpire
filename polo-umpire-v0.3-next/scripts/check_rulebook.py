#!/usr/bin/env python3
"""Download the official USPA Rulebook and regenerate the offline dataset on change.

Configure USPA_RULEBOOK_URL as a repository variable. The URL should point to the
current official Rulebook PDF. GitHub Actions can run this weekly; a changed hash
regenerates public/data and a Vercel Git integration can deploy it automatically.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public" / "data" / "manifest.json"
url = os.environ.get("USPA_RULEBOOK_URL", "").strip()

if not url:
    print("USPA_RULEBOOK_URL is not configured; keeping current local ruleset.")
    raise SystemExit(0)

tmp = ROOT / "rulebook-latest.pdf"
request = urllib.request.Request(url, headers={"User-Agent": "PoloUmpireRulebookUpdater/1.0"})
with urllib.request.urlopen(request, timeout=45) as response:
    data = response.read()

if not data.startswith(b"%PDF"):
    raise RuntimeError("USPA_RULEBOOK_URL did not return a PDF")

tmp.write_bytes(data)
new_hash = hashlib.sha256(data).hexdigest()
manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
if new_hash == manifest.get("sha256"):
    print("No Rulebook change detected.")
    tmp.unlink(missing_ok=True)
    raise SystemExit(0)

subprocess.run([sys.executable, str(ROOT / "scripts" / "extract_rulebook.py"), str(tmp)], check=True)
print("Rulebook change detected and local dataset regenerated.")
tmp.unlink(missing_ok=True)
