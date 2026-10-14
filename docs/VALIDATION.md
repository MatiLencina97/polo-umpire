# Validation & Decision-Support Policy

Polo Umpire Assistant is a **decision-support tool**, not a replacement for the Umpire.

The final ruling always belongs to the Umpire. The application is designed to be conservative: when the installed Rulebook does not support a deterministic conclusion from the facts currently known, the app should return **Umpire Judgment** or **Insufficient Validated Coverage** instead of inventing certainty.

## Installed source

Current source:

- 2026 Rulebook of the United States Polo Association
- SHA-256: `dd1e4bf60bb8cfb82e2f33539de45f459e0bed97827949445bacd256b90ed025`
- Outdoor Rules: 38
- Arena Rules: 19
- Governing/supporting resources stored offline: 9
- Governing/supporting sections stored offline: 112

The app keeps the source version attached to saved cases.

## Validation categories

### Direct Rule Support

The modeled branch follows an explicit provision when the entered facts are correct.

This is **not** a statistical probability and it does **not** mean the software replaces the Umpire. Observed facts, player identity, aggressor, Tournament Conditions, and penalty selection may still require Umpire judgment.

### Umpire Judgment

The Rulebook requires observation, interpretation, discretion, or a factual conclusion that software should not replace.

Examples include:

- establishing ROW entitlement in Rule 24 paths not yet fully derived by the engine;
- Dangerous Riding when the mount was not automatically knocked off balance;
- determining who created danger around a mallet stroke;
- conduct severity and card escalation;
- penalty selection under Rule 35.

### Insufficient Validated Coverage

A decisive fact is unknown, the branch is outside the validated model, or the app cannot safely close the call.

The app should not present a definitive FOUL / NO FOUL in this state.

## Official guidance index

The local Rulebook parser indexes every `INTERPRETATION(S):` and `EXAMPLE(S):` marker in the installed playing-rule dataset.

For the current 2026 source this produces:

- 132 official guidance blocks
- 63 Example blocks
- 69 Interpretation blocks
- 36 playing rules with at least one official guidance block

Some blocks contain more than one individual example. These counts are **source blocks**, not a claim that every individual scenario has already been converted into a golden regression case.

## Automated audit

The regression suite checks:

- rule/subarticle extraction;
- Rulebook cross-references used by deterministic decisions;
- substitution eligibility branches;
- governing-resource lookup;
- Match Mode flow;
- saved-case snapshots;
- voice helpers;
- official-guidance indexing;
- selected official golden examples;
- fail-safe decision-audit categories.

The Outdoor quick-decision truth-table audit enumerates **774 raw answer combinations** across:

- Right of Way / Crossing
- Dangerous Riding
- Improper Blocking
- Mallet / Hook
- Unsportsmanlike Conduct
- Restart / Dead Ball

Every combination must return a known decision status, a known validation category, and resolvable Rulebook references.

This does **not** mean there are only 774 possible polo situations. It tests the combinations of the facts currently represented by the quick-decision model.

## Golden examples currently tied to the engine

The regression suite currently includes direct checks against official 2026 Rulebook example text for key modeled areas, including:

- Rule 24 safe ROW entry / no-risk crossing;
- Rule 24 line change and clearance;
- Rule 26 knocked-off-balance Dangerous Riding;
- Rule 26A Improper Blocking during a knock-in;
- Rule 28 dangerous mallet use;
- Rule 35 guardrail against inventing a fixed automatic penalty.

The goal is to keep expanding this set until every modeled deterministic branch is backed by official Rulebook text, Interpretation/Example evidence, or both.

## Important known limits

1. **ROW entitlement is only partially derived.** Common deterministic Rule 24(e)-(h) relationships can be resolved from physical facts with the ROW helper, while uncommon or ambiguous geometry still requires an Umpire-established entitlement or further review.
2. **Dangerous Riding is intentionally conservative.** Absence of the currently asked danger factors is not converted into an automatic NO FOUL because Rule 26 lists non-exhaustive factors and relies on Umpire judgment.
3. **Penalty selection is not a fixed lookup.** Rule 35 requires Umpire discretion based on danger/unfair advantage, field location, player positions and repetition.
4. **Arena deterministic coverage is shallower than Outdoor.** The app should return more review states until Arena branches are modeled and audited with the same depth.
5. **Tournament Conditions can control or modify a playing-rule answer.** The applicable Event context must be known.
6. **Speech transcription can be wrong.** Dictated text must be reviewed before the app applies the Rulebook.

## Review process before calling a branch validated

A deterministic branch should not be promoted to **Direct Rule Support** unless:

1. the controlling provision can be resolved in the installed Rulebook;
2. all facts capable of changing the branch are represented or explicitly delegated to Umpire judgment;
3. no known governing source is silently ignored;
4. at least one regression test covers the branch;
5. where an official Interpretation/Example exists, the branch is compared against it;
6. contradictory or ambiguous source language is not silently reconciled by the software.

## Human review

A qualified Umpire or rules official should be able to review:

- the input facts;
- the exact output;
- the validation category;
- the exact Rule/subarticle;
- the official source text;
- the Rulebook version;
- any applicable Tournament Conditions;
- the saved Case History snapshot.

That human-reviewability is a core product requirement, not an optional debugging feature.


## High-complexity rule focus

Validation effort is intentionally concentrated on the rules most likely to create confusion in practice:

- Rule 24 — Right of Way, especially the distinction between LOB and ROW, near-side precedence, following vs meeting, lesser-angle tests, and two-player priority.
- Rules 1/2/3 + Tournament Conditions — substitution and player eligibility.
- Rule 26 — Dangerous Riding and the non-exhaustive danger-factor analysis.
- Rule 26A — Improper Blocking.
- Rule 28 together with Rule 26.h — mallet/hook responsibility and riding into the stroke.
- Rule 35 — penalty selection and the boundary between structured factors and Umpire discretion.

v0.20 added a Rule 24 entitlement helper for common deterministic branches under 24(e)-(h) and a complete decision rule trail.

v0.26 hardens field reliability without changing the governing-rule standard: Match Mode now stops once additional quick questions cannot change the current ruling class, and **OFFLINE READY** is only reported after the installed build's required runtime assets have been cached and re-verified.


## v0.27 feedback audit loop

v0.27 adds persistent anonymous feedback as an audit signal. The feedback system stores only structured decision context: app/rulebook version, discipline, resolver mode, topic/scenario, outcome status, validation class, headline, cited references, rating, reason and an optional sanitized note.

It explicitly does **not** persist the original play narrative, event name, player names, IP address, device identifier or user identity.

Dashboard metrics are labeled **usefulness rate** and **review-request rate**, always together with sample size (n). They are not an accuracy estimate and must not be used as a substitute for rule validation or qualified Umpire review.

Offline retries are idempotent by feedback ID. A repeated submission with the same ID is treated as success without creating a second record.
