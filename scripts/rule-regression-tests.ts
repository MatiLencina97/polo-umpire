import assert from "node:assert/strict";
import fs from "node:fs";
import { classify } from "../lib/engine";
import { decidePlay } from "../lib/play-decision";
import { parseRuleProvisions, bestProvisionsForRules } from "../lib/subarticles";
import { defaultSubstitutionCrossFacts, buildSubstitutionCrossRuleState } from "../lib/cross-rule";
import { matchProgress } from "../lib/match-flow";
import { externalMatchesForLabels, searchExternalSections } from "../lib/external-resources";
import type { ExternalResourceDb, RuleDb } from "../lib/types";

type TestCase = { name: string; run: () => void };
const cases: TestCase[] = [];

function test(name: string, run: () => void) {
  cases.push({ name, run });
}

const db = JSON.parse(fs.readFileSync("public/data/rules-2026.json", "utf8")) as RuleDb;
const externalDb = JSON.parse(fs.readFileSync("public/data/resources-2026.json", "utf8")) as ExternalResourceDb;
const outdoorRule = (rule: string) => {
  const found = db.rules.find((item) => item.discipline === "outdoor" && item.rule === rule);
  assert.ok(found, "Missing Outdoor Rule " + rule);
  return found;
};

test("classifies knocked-off-balance ride-off as Dangerous Riding", () => {
  const ranked = classify("During a ride-off the horse was knocked off balance by the contact.");
  assert.equal(ranked[0].id, "dangerous");
  assert.ok(ranked[0].score > 0);
});

test("ROW line change with no clearance time resolves to foul", () => {
  const decision = decidePlay("row", "outdoor", {
    rowEntitled: "yes",
    risk: "yes",
    lineChanged: "yes",
    clearanceTime: "no",
  }, "en");
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("24.c"));
  assert.ok(decision.references.includes("24.d"));
  assert.ok(decision.references.includes("35.b"));
});

test("ROW with no risk resolves to no-foul on the crossing issue", () => {
  const decision = decidePlay("row", "outdoor", {
    rowEntitled: "yes",
    risk: "no",
    lineChanged: "no",
  }, "en");
  assert.equal(decision.status, "no-foul");
  assert.ok(decision.references.includes("24.c"));
});

test("ROW without established entitlement requests more facts", () => {
  const decision = decidePlay("row", "outdoor", { rowEntitled: "unknown" }, "en");
  assert.equal(decision.status, "needs-info");
  assert.ok(decision.references.includes("24.a"));
});

test("knocked-off-balance fact resolves Dangerous Riding immediately", () => {
  const decision = decidePlay("dangerous", "outdoor", { balance: "yes" }, "en");
  const progress = matchProgress("dangerous", { balance: "yes" });
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("26.a"));
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
  assert.deepEqual(progress.keys, ["balance"]);
});

test("Dangerous Riding continues when horse stayed balanced", () => {
  const progress = matchProgress("dangerous", { balance: "no" });
  assert.equal(progress.complete, false);
  assert.equal(progress.currentKey, "speedAngle");
});

test("Dangerous Riding with all primary factors negative does not establish foul", () => {
  const decision = decidePlay("dangerous", "outdoor", {
    balance: "no",
    speedAngle: "no",
    blind: "no",
  }, "en");
  assert.equal(decision.status, "no-foul");
  assert.ok(decision.references.includes("26.a"));
});

test("restart blocking that prevents marking resolves to Improper Blocking foul", () => {
  const decision = decidePlay("blocking", "outdoor", {
    restartBlock: "yes",
    marking: "yes",
  }, "en");
  const progress = matchProgress("blocking", { restartBlock: "yes", marking: "yes" });
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("26A"));
  assert.equal(progress.complete, true);
});

test("blocking category closes early when defender was not prevented from marking", () => {
  const decision = decidePlay("blocking", "outdoor", {
    restartBlock: "no",
    marking: "no",
  }, "en");
  const progress = matchProgress("blocking", { restartBlock: "no", marking: "no" });
  assert.equal(decision.status, "no-foul");
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
});

test("dangerous mallet use is a foul", () => {
  const decision = decidePlay("mallet", "outdoor", { strokeDanger: "yes" }, "en");
  const progress = matchProgress("mallet", { strokeDanger: "yes" });
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("28.d"));
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
});

test("hook meeting position timing clearance and safety conditions resolves no-foul", () => {
  const decision = decidePlay("mallet", "outdoor", {
    strokeDanger: "no",
    hookPosition: "yes",
    hookTiming: "yes",
    hookClear: "yes",
  }, "en");
  assert.equal(decision.status, "no-foul");
  assert.ok(decision.references.includes("28.a"));
});

test("Rule 33 conduct with prior similar offense includes escalation rule", () => {
  const decision = decidePlay("conduct", "outdoor", {
    conductMatches: "yes",
    repeat: "yes",
  }, "en");
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("33.a"));
  assert.ok(decision.references.includes("34"));
});

test("early play before a penalty/free hit is a procedure violation", () => {
  const decision = decidePlay("restart", "outdoor", {
    dead: "yes",
    restartType: "penalty",
    early: "yes",
  }, "en");
  assert.equal(decision.status, "procedure");
  assert.ok(decision.references.includes("36"));
});

test("subarticle parser exposes Rule 24 c and d separately", () => {
  const provisions = parseRuleProvisions(outdoorRule("24"));
  const refs = provisions.map((item) => item.ref);
  assert.ok(refs.includes("24.c"));
  assert.ok(refs.includes("24.d"));
  const d = provisions.find((item) => item.ref === "24.d");
  assert.ok(d?.text.includes("Line of the Ball changes"));
  assert.ok(d?.text.includes("necessary time"));
});

test("subarticle parser exposes nested Dangerous Riding factors", () => {
  const provisions = parseRuleProvisions(outdoorRule("26"));
  const refs = provisions.map((item) => item.ref);
  assert.ok(refs.includes("26.a"));
  assert.ok(refs.includes("26.a(1)"));
  assert.ok(refs.includes("26.a(6)"));
});

test("subarticle parser exposes American Rule definition", () => {
  const provisions = parseRuleProvisions(outdoorRule("1"));
  const refs = provisions.map((item) => item.ref);
  assert.ok(refs.includes("1.f"));
  assert.ok(refs.includes("1.f(2)"));
});

test("subarticle retrieval ranks Rule 24.d for line-change clearance query", () => {
  const matches = bestProvisionsForRules(
    [outdoorRule("24")],
    "line changed opponent necessary time clear new right of way",
    5,
  );
  assert.ok(matches.some((item) => item.ref === "24.d"));
});

test("8-goal event rejects a 7-goal substitute under 3/4 Rule", () => {
  const state = buildSubstitutionCrossRuleState({
    discipline: "outdoor",
    handicap: {
      eventUpper: 8,
      teamTotalBefore: 8,
      outgoingHandicap: 5,
      candidateHandicap: 7,
    },
    facts: { ...defaultSubstitutionCrossFacts },
    answers: { endPeriod: "yes", penalty7: "no" },
    language: "en",
  });
  const handicapCheck = state.checks.find((item) => item.id === "individual-handicap");
  assert.equal(handicapCheck?.status, "fail");
  assert.equal(state.status, "fail");
});

test("suspended substitute creates an eligibility failure", () => {
  const state = buildSubstitutionCrossRuleState({
    discipline: "outdoor",
    handicap: {
      eventUpper: 8,
      teamTotalBefore: 8,
      outgoingHandicap: 3,
      candidateHandicap: 3,
    },
    facts: {
      ...defaultSubstitutionCrossFacts,
      candidateSuspended: "yes",
    },
    answers: { endPeriod: "yes", penalty7: "no" },
    language: "en",
  });
  assert.ok(state.checks.some((item) => item.status === "fail" && /suspend/i.test(item.summary)));
});

test("external Rulebook dataset contains governing source families", () => {
  assert.ok(externalDb.resources.length >= 9);
  assert.ok(externalDb.resources.some((item) => item.id === "tournament-conditions"));
  assert.ok(externalDb.resources.some((item) => item.id === "equine-medications"));
  assert.ok(externalDb.resources.some((item) => item.id === "policies"));
});

test("host-country eligibility query surfaces Tournament Conditions Section IV", () => {
  const hits = searchExternalSections(externalDb, "Affiliate Player Member citizen of the host country Registered Player Member Outdoor Rule 1.f", 5);
  assert.ok(hits.some((item) => item.resource.id === "tournament-conditions" && item.section.title.includes("Section IV") && /citizen of the host country/i.test(item.section.text)));
});

test("Tournament Conditions graph label resolves to Section IV for host-country substitution", () => {
  const hits = externalMatchesForLabels(externalDb, ["Tournament Conditions"], "substitute American Player Affiliate Member Club host country", 3);
  assert.equal(hits[0]?.resource.id, "tournament-conditions");
  assert.ok(/Section IV/.test(hits[0]?.section.title ?? ""));
});

test("Alternative Format Arena source is locally searchable", () => {
  const hits = searchExternalSections(externalDb, "alternative format arena beach snow replace USPA Arena Rules", 5);
  assert.ok(hits.some((item) => item.resource.id === "alternative-format-arena"));
});

test("Sport-Related Conduct graph label resolves to disciplinary policy Part I", () => {
  const hits = externalMatchesForLabels(externalDb, ["Sport-Related Conduct Procedures"], "conduct violation umpire player", 5);
  assert.ok(hits.some((item) => item.resource.id === "policies" && /Sport-Related Conduct Violation Procedures/i.test(item.section.title)));
});

test("equine medication query surfaces Equine Medications Rules", () => {
  const hits = searchExternalSections(externalDb, "restricted medication horse blood level NSAID", 5);
  assert.ok(hits.some((item) => item.resource.id === "equine-medications"));
});

let passed = 0;
const failures: string[] = [];

for (const item of cases) {
  try {
    item.run();
    passed += 1;
    process.stdout.write("✓ " + item.name + "\n");
  } catch (error) {
    failures.push(item.name);
    process.stderr.write("✗ " + item.name + "\n");
    process.stderr.write(String(error) + "\n");
  }
}

process.stdout.write("\nRule regression suite: " + passed + "/" + cases.length + " passed.\n");
if (failures.length) {
  process.stderr.write("Failed: " + failures.join(", ") + "\n");
  process.exit(1);
}
