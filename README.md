# Polo Umpire v0.3

Offline-first PWA for polo umpires, built with Next.js + TypeScript and a local dataset extracted from the current USPA Rulebook.

## Core modes

- **Resolver una jugada**: guided analysis for in-play situations such as Line of the Ball, Right of Way, Dangerous Riding, Blocking and Mallet use.
- **Interpretar una situación reglamentaria**: guided questions for rules that are not tied to a single play, starting with substitutions / alternates and expanding to eligibility, handicap, equipment, officials, mounts, Tournament Conditions and protests.
- **Buscar reglas**: local keyword search across the installed Rulebook.

## Offline-first

The critical rules engine and Rulebook dataset are stored locally in the PWA. After the first successful load, the app is designed to keep rule lookup and guided resolution available without network access.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000 and wait for **OFFLINE READY** before testing without connectivity.

## Production

```bash
npm run build
```

The app uses Next.js static export and can be deployed to Vercel.

## Rulebook updates

The current offline dataset lives in:

- `public/data/manifest.json`
- `public/data/rules-2026.json`

The repository includes scripts to detect a changed official Rulebook PDF, regenerate the dataset and commit the new version. Configure the GitHub repository variable `USPA_RULEBOOK_URL` with the direct official PDF URL.

For safety, a future production version should add an admin review/approval step before activating materially changed rules.
