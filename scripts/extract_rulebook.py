#!/usr/bin/env python3
"""Extract the current USPA Rulebook into the offline JSON dataset.

Requires poppler-utils (pdftotext). The parser discovers the Outdoor, Arena and
Umpire Guide sections from their headings, so annual page shifts do not require
hard-coded PDF page numbers.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "source" / "rulebook.pdf"
DATA_DIR = ROOT / "public" / "data"
MANIFEST = DATA_DIR / "manifest.json"

SIDE_LABELS = set("OUTDOORARENAUMPIRETOURNEMRTCPLWSBYI")
RULE_RE = re.compile(r"(?m)^RULE\s+(\d+[A-Z]?)\s*[-–]\s*([^\n]+)$")


def run_pdftotext() -> str:
    cp = subprocess.run(
        ["pdftotext", "-raw", str(PDF), "-"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return cp.stdout.decode("utf-8", errors="ignore").replace("\r", "")


def find_year(pages: list[str]) -> int:
    probe = "\n".join(pages[:8])
    matches = re.findall(r"\b(20\d{2})\b", probe)
    if not matches:
        raise RuntimeError("Could not identify Rulebook year")
    # The cover/year is repeated often. Use the most common year in the front matter.
    return int(max(set(matches), key=matches.count))


def find_page_regex(pages: list[str], pattern: str, start: int = 0) -> int:
    rx = re.compile(pattern, re.I | re.S)
    for idx in range(start, len(pages)):
        if rx.search(pages[idx]):
            return idx
    raise RuntimeError(f"Could not locate page matching: {pattern}")


def printed_page_number(page_text: str, fallback: int) -> int:
    candidates = []
    for raw in page_text.splitlines():
        s = raw.strip()
        if re.fullmatch(r"\d{1,3}", s):
            n = int(s)
            if 0 < n < 500:
                candidates.append(n)
    return candidates[-1] if candidates else fallback


def clean_page(page_text: str, year: int) -> str:
    lines: list[str] = []
    header_re = re.compile(rf"^UNITED STATES POLO ASSOCIATION®?\s+{year}\s*$", re.I)
    for raw in page_text.splitlines():
        s = raw.strip()
        if not s:
            lines.append("")
            continue
        if header_re.match(s):
            continue
        if re.fullmatch(r"\d{1,3}", s):
            continue
        if len(s) == 1 and s.upper() in SIDE_LABELS:
            continue
        lines.append(s.replace("\u00ad", ""))
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"([A-Za-z])-\n([a-z])", r"\1\2", text)
    return text.strip()


def build_section(pages: list[str], year: int, start_idx: int, end_idx: int) -> str:
    chunks: list[str] = []
    for idx in range(start_idx, end_idx + 1):
        raw = pages[idx]
        printed = printed_page_number(raw, idx + 1)
        cleaned = clean_page(raw, year)
        chunks.append(f"\n<<<PAGE:{idx + 1}:{printed}>>>\n{cleaned}\n")
    return "".join(chunks)


def page_for_pos(text: str, pos: int):
    last = (None, None)
    for match in re.finditer(r"<<<PAGE:(\d+):(\d+)>>>", text):
        if match.start() > pos:
            break
        last = (int(match.group(1)), int(match.group(2)))
    return last


def strip_markers(text: str) -> str:
    return re.sub(r"\n?<<<PAGE:\d+:\d+>>>\n?", "\n", text).strip()


def parse_rules(kind: str, text: str):
    matches = []
    for match in RULE_RE.finditer(text):
        title = match.group(2).strip()
        if "EXAMPLE" in title.upper() or "INTERPRETATION" in title.upper():
            continue
        matches.append(match)

    rules = []
    seen = set()
    for i, match in enumerate(matches):
        num = match.group(1).upper()
        if num in seen:
            continue
        seen.add(num)
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = strip_markers(text[match.end():end])
        title = re.sub(r"\s{2,}.*$", "", match.group(2)).strip()
        if len(body) < 20:
            continue
        p1, pr1 = page_for_pos(text, match.start())
        p2, pr2 = page_for_pos(text, max(match.start(), end - 1))

        anchors = []
        anchor_re = re.compile(
            r"(?m)^(\d+[A-Z]?\.\s+[^\n]{0,100}?(?:INTERPRETATION(?:S)?|EXAMPLE(?:S)?))\s*:\s*"
        )
        anchor_matches = list(anchor_re.finditer(body))
        for j, anchor in enumerate(anchor_matches):
            anchor_end = anchor_matches[j + 1].start() if j + 1 < len(anchor_matches) else len(body)
            anchors.append({"label": anchor.group(1).strip(), "text": body[anchor.end():anchor_end].strip()})

        rules.append(
            {
                "id": f"{kind}-{num.lower()}",
                "discipline": kind,
                "rule": num,
                "title": title,
                "pageStart": pr1,
                "pageEnd": pr2,
                "pdfPageStart": p1,
                "pdfPageEnd": p2,
                "text": body,
                "applications": anchors,
            }
        )
    return rules


def parse_guide(text: str, year: int):
    pages = []
    for match in re.finditer(r"<<<PAGE:(\d+):(\d+)>>>\n(.*?)(?=\n<<<PAGE:|\Z)", text, re.S):
        pdf = int(match.group(1))
        printed = int(match.group(2))
        body = clean_page(match.group(3), year)
        pages.append({"id": f"guide-{printed}", "discipline": "umpireGuide", "page": printed, "pdfPage": pdf, "text": body})
    return pages


def add_search_metadata(rule):
    synonyms = {
        "RIGHT OF WAY": ["right of way", "row", "cruce", "cruzar", "linea", "línea", "trayectoria", "paso", "crossing", "cross"],
        "LINE OF THE BALL": ["line of the ball", "lob", "linea de la pelota", "línea de la pelota", "trayectoria"],
        "DANGEROUS RIDING": ["dangerous riding", "ride off", "ride-off", "montada peligrosa", "choque", "contacto", "blind side", "zigzag"],
        "IMPROPER BLOCKING": ["blocking", "block", "bloqueo", "bloquear", "obstruccion", "obstrucción"],
        "USE OF THE MALLET": ["mallet", "mallet use", "taco", "hook", "enganche", "swing", "stroke"],
        "UNSPORTSMANLIKE CONDUCT": ["unsportsmanlike", "conduct", "conducta antideportiva", "protesta", "insulto", "yellow card", "red card"],
        "SELECTION OF PENALTIES": ["penalty", "penalidad", "penal", "foul", "falta", "advantage", "ventaja"],
        "PENALTIES": ["penalty", "penalidad", "penal", "foul", "falta"],
        "STOPPING ON BALL": ["stopping", "delay", "detener", "parar pelota", "demora"],
        "DEAD BALL": ["dead ball", "pelota muerta"],
        "INTERRUPTION OF PLAY": ["interruption", "stop play", "interrupcion", "interrupción"],
    }
    key = rule["title"].upper()
    words = []
    for label, values in synonyms.items():
        if label in key:
            words.extend(values)
    words += [rule["title"], f"rule {rule['rule']}", f"regla {rule['rule']}"]
    rule["keywords"] = sorted(set(word.lower() for word in words))
    return rule


def main():
    if not PDF.exists():
        raise SystemExit(f"PDF not found: {PDF}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    raw = run_pdftotext()
    pages = raw.split("\f")
    year = find_year(pages)

    outdoor_start = find_page_regex(pages, r"OUTDOOR\s+RULES.*?RULE\s+1\s*[-–]\s*TEAMS")
    arena_start = find_page_regex(pages, r"ARENA\s+RULES.*?RULE\s+1\s*[-–]\s*FACILITIES", start=outdoor_start + 1)
    tournament_start = find_page_regex(pages, r"TOURNAMENT\s+CONDITIONS\s*\n.*?PAGES", start=arena_start + 1)
    guide_start = find_page_regex(pages, r"UMPIRE\s+GUIDE.*?ORGANIZATIONAL\s+STRUCTURE\s+OF\s+UMPIRE\s+PROGRAM.*?Certification\s+and\s+Training\s+Program", start=tournament_start + 1)
    policies_start = find_page_regex(pages, r"(?:USPA\s+)?POLICIES\s*\n.*?PAGES", start=guide_start + 1)

    outdoor_text = build_section(pages, year, outdoor_start, arena_start - 1)
    arena_text = build_section(pages, year, arena_start, tournament_start - 1)
    guide_text = build_section(pages, year, guide_start, policies_start - 1)

    outdoor = [add_search_metadata(rule) for rule in parse_rules("outdoor", outdoor_text)]
    arena = [add_search_metadata(rule) for rule in parse_rules("arena", arena_text)]
    guide = parse_guide(guide_text, year)
    sha = hashlib.sha256(PDF.read_bytes()).hexdigest()
    generated = datetime.now(timezone.utc).isoformat()
    outfile = DATA_DIR / f"rules-{year}.json"

    payload = {
        "source": {
            "organization": "United States Polo Association",
            "title": f"{year} Rulebook of the United States Polo Association",
            "year": year,
            "sha256": sha,
            "generatedAt": generated,
        },
        "rules": outdoor + arena,
        "umpireGuide": guide,
    }
    outfile.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    manifest = {
        "activeVersion": str(year),
        "year": year,
        "rulesFile": f"data/rules-{year}.json",
        "sha256": sha,
        "generatedAt": generated,
        "offlineReady": True,
        "counts": {"outdoor": len(outdoor), "arena": len(arena), "umpireGuidePages": len(guide)},
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # Keep all governing sections versioned/offline with the playing rules.
    subprocess.run([sys.executable, str(ROOT / "scripts" / "extract_resources.py"), str(PDF)], check=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
