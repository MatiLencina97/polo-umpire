# Polo Umpire Assistant v0.23

Offline-first PWA for polo umpires under the Polo Umpire Assistant brand, built with Next.js + TypeScript and a local dataset extracted from the current USPA Rulebook.

## What works offline

- Outdoor and Arena rules
- Rule lookup and keyword search
- Guided play-resolution flow
- Rule references and detected interpretations/examples
- Offline status / readiness test

The app deliberately keeps the critical rules engine local. Future AI features should enhance natural-language understanding, but rule citations and the deterministic fallback must remain available without network access.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, wait for **OFFLINE READY**, then test with airplane mode / network disabled.

## Production build

```bash
npm run build
```

`next.config.ts` uses `output: "export"`, so the app can be served statically and deployed to Vercel.

## Rulebook data

Current offline dataset:

- `public/data/manifest.json`
- `public/data/rules-2026.json`

To rebuild from a Rulebook PDF:

```bash
sudo apt-get install poppler-utils   # Linux
python scripts/extract_rulebook.py /path/to/rulebook.pdf
```

The parser discovers the Outdoor, Arena and Umpire Guide sections from headings rather than fixed PDF page numbers.

## Automatic Rulebook updates

`.github/workflows/update-rulebook.yml` runs weekly and executes `scripts/check_rulebook.py`.

Configure a GitHub repository variable:

- `USPA_RULEBOOK_URL` = direct URL of the official current USPA Rulebook PDF

When the PDF SHA-256 changes, the workflow regenerates `public/data`, commits the change, and a Git-linked Vercel project can deploy the new version automatically.

For safety, production should eventually add an admin approval step before activating a materially changed Rulebook version.

## Architecture

- Next.js 16 / React 19 / TypeScript
- Static export
- Service Worker (`public/sw.js`)
- Local JSON ruleset
- No backend required for critical use

Planned next layers:

1. More granular sub-rule decision trees (`24.c`, `26.a`, etc.)
2. Local query/history storage in IndexedDB
3. Optional cloud sync
4. Optional AI interpretation when connected
5. Admin change-review screen for new Rulebook versions


## Situation rules

Substitutions now include a handicap eligibility calculator. For Outdoor play it combines:

- Rule 2.d individual-player handicap limits (the “3/4 Rule”).
- Rule 3.c post-substitution aggregate team handicap.
- General player eligibility checks from Rule 2 and Rule 3 interpretations.

If the question gives the tournament upper limit and outgoing player handicap but not the original team total, the app asks for the missing team handicap before calculating the exact maximum substitute.


## Validation

Decision confidence is reported as **Direct Rule Support**, **Umpire Judgment**, or **Insufficient Validated Coverage** rather than as an invented percentage. See [docs/VALIDATION.md](docs/VALIDATION.md) for the audit methodology, known limits, official-guidance coverage, and human-review policy.
