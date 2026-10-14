# Polo Umpire Assistant v0.27

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

Open `http://localhost:3000`. **OFFLINE READY** is shown only after the Rulebook, app shell and runtime assets required by the current build have been cached and verified. Then test with airplane mode / network disabled.

## Production build

```bash
npm run build
```

The production build uses the Next.js App Router and can be deployed to Vercel. Critical ruling logic and Rulebook data remain local/offline; the optional feedback endpoint requires the Next.js server runtime when feedback delivery is enabled.

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

- Next.js 16.3.8 / React 19 / TypeScript
- App Router with an optional feedback API route
- Service Worker (`public/sw.js`) with verified runtime-asset readiness
- Local JSON ruleset
- No network/backend dependency for critical ruling use

Current next layers:

1. Deeper Arena deterministic coverage
2. More official golden examples for every deterministic branch
3. Optional AI interpretation when connected, without replacing local rule citations
4. Admin change-review screen for materially changed Rulebook versions


## Situation rules

Substitutions now include a handicap eligibility calculator. For Outdoor play it combines:

- Rule 2.d individual-player handicap limits (the “3/4 Rule”).
- Rule 3.c post-substitution aggregate team handicap.
- General player eligibility checks from Rule 2 and Rule 3 interpretations.

If the question gives the tournament upper limit and outgoing player handicap but not the original team total, the app asks for the missing team handicap before calculating the exact maximum substitute.


## Validation

Decision confidence is reported as **Direct Rule Support**, **Umpire Judgment**, or **Insufficient Validated Coverage** rather than as an invented percentage. See [docs/VALIDATION.md](docs/VALIDATION.md) for the audit methodology, known limits, official-guidance coverage, and human-review policy.


## v0.27 feedback quality loop

- Umpire feedback is persisted in a dedicated Postgres store with idempotent IDs, so offline replay cannot create duplicate records.
- Server-side validation limits accepted fields and lengths; the original play description, event name, player names, IP and device identifiers are not stored.
- A protected `/admin/feedback` dashboard reports **usefulness rate** and **review-request rate** with sample size, grouped by topic, rule/reference, reason and app version.
- Needs-review feedback enters a review queue that can be marked open, reviewed or dismissed.
- A best-effort in-memory rate limiter reduces automated abuse without persisting user identity.
- These metrics are product-quality signals and must never be presented as an accuracy percentage.

## v0.26 reliability hardening

- Dependencies are locked with `package-lock.json`; CI uses `npm ci`.
- Next.js is pinned to the patched 16.3.8 release.
- CI syntax-checks the service worker in addition to the rule regression suite and production build.
- Offline readiness is persisted only after the exact same-origin runtime assets observed by the installed build are cached successfully.
- Match Mode stops asking questions when later answers cannot change the current ruling class or validation state.
