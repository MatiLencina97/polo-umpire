import assert from "node:assert/strict";
import fs from "node:fs";
import { classify, classifyTopic, playClarifierCandidates, playClarifierLabel, questions, scoreRule } from "../lib/engine";
import { decidePlay } from "../lib/play-decision";
import { parseRuleProvisions, bestProvisionsForRules, resolveProvisions } from "../lib/subarticles";
import { defaultSubstitutionCrossFacts, buildSubstitutionCrossRuleState } from "../lib/cross-rule";
import { applyMatchAnswer, matchProgress, rewindLastMatchAnswer } from "../lib/match-flow";
import { extractExplicitPlayFacts } from "../lib/play-fact-extractor";
import { externalMatchesForLabels, searchExternalSections } from "../lib/external-resources";
import { buildCaseRecord, mergeCaseRecord, normalizeCaseHistory } from "../lib/case-history";
import { appendTranscript, speechLocale } from "../lib/voice";
import { extractOfficialGuidance, officialGuidanceMetrics } from "../lib/official-guidance";
import { auditPlayDecision } from "../lib/decision-audit";
import { defaultRowEntitlementFacts, deriveRowEntitlement } from "../lib/row-entitlement";
import { buildFeedbackRecord, normalizeFeedbackRecord, sanitizeFeedbackNote } from "../lib/decision-feedback";
import { normalizeEventProfile, profileToCaseFacts } from "../lib/event-profile";
import { safeStorageGet, safeStorageRemove, safeStorageSet, type KeyValueStorage } from "../lib/browser-storage";
import { playDecisionRuleTrail, substitutionDecisionRuleTrail } from "../lib/decision-links";
import { cleanOfficialSourceText, formatOfficialTextBlocks } from "../lib/official-text-format";
import { getOfficialSourceNotice, getOfficialStructuredTable } from "../lib/official-structured-tables";
import type { ExternalResourceDb, Rule, RuleDb } from "../lib/types";

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

test("classifier does not treat player as restart play", () => {
  const ranked = classify("A player approaches the ball and changes direction.");
  const restart = ranked.find((item) => item.id === "restart");
  assert.equal(restart?.score, 0);
});

test("classifier does not treat throw-in as ROW because throw contains row", () => {
  const ranked = classify("The Umpire orders a throw-in.");
  const row = ranked.find((item) => item.id === "row");
  const restart = ranked.find((item) => item.id === "restart");
  assert.equal(row?.score, 0);
  assert.ok((restart?.score ?? 0) > 0);
});

test("exact Play still triggers restart context", () => {
  const ranked = classify("A penalty was taken before the Umpire called Play.");
  assert.equal(ranked[0].id, "restart");
  assert.ok(ranked[0].score > 0);
});

test("generic use of the word play does not classify as a restart", () => {
  const detected = classifyTopic("Can Blue play the ball from there?");
  assert.equal(detected.topic, null);
  assert.equal(detected.ambiguous, false);
});

test("English crosses/crossed/crossing variants classify as ROW without matching across", () => {
  for (const text of [
    "Red crosses in front of Blue.",
    "Red crossed in front of Blue.",
    "Red is crossing in front of Blue.",
  ]) {
    assert.equal(classifyTopic(text).topic, "row", text);
  }
  assert.equal(classifyTopic("He rode across the field.").topic, null);
});

test("natural field-language corpus routes common umpire descriptions without clarification", () => {
  const samples: Array<[string, string]> = [
    // Right of Way / Crossing
    ["Red cut Blue off and Blue had to pull up.", "row"],
    ["Red rode into Blue's line and forced him to check.", "row"],
    ["He closed his line and made him change course.", "row"],
    ["Blue needed to slow down because Red came across his path.", "row"],
    ["Se le cruzó adelante y lo obligó a frenar.", "row"],
    ["Le cerró la línea y lo hizo cambiar de rumbo.", "row"],

    // Dangerous Riding
    ["There was a hard ride-off and the pony lost its balance.", "dangerous"],
    ["He came in at a sharp angle at speed.", "dangerous"],
    ["The horse lost its balance after the contact.", "dangerous"],
    ["He hit the opponent hard from the blind side.", "dangerous"],
    ["Lo chocó de costado durante el ride-off.", "dangerous"],
    ["El petiso perdió el equilibrio con el contacto.", "dangerous"],

    // Improper Blocking
    ["The attacker screened the defender so his teammate could play the ball.", "blocking"],
    ["He picked off the defender and freed his teammate.", "blocking"],
    ["He prevented the defender from marking the teammate.", "blocking"],
    ["He rode between the defender and his teammate to keep him away.", "blocking"],
    ["Le hizo pantalla al defensor para liberar al compañero.", "blocking"],
    ["No lo dejó marcar y liberó a su compañero.", "blocking"],

    // Mallet / Hook
    ["He hooked from the wrong side.", "mallet"],
    ["The swing passed close to the pony.", "mallet"],
    ["His mallet struck the opponent's horse.", "mallet"],
    ["He reached across to hook the opponent.", "mallet"],
    ["Hookeó del lado equivocado.", "mallet"],
    ["El taco tocó al caballo rival.", "mallet"],

    // Conduct
    ["He yelled at the umpire after the call.", "conduct"],
    ["He kept arguing with the umpire.", "conduct"],
    ["There was verbal abuse toward the official.", "conduct"],
    ["He hit after the whistle.", "conduct"],
    ["Le gritó al árbitro y siguió protestando.", "conduct"],
    ["Puteó al umpire después de la jugada.", "conduct"],

    // Restart / dead ball
    ["The ball rolled over the sideline.", "restart"],
    ["The ball left the field off Red.", "restart"],
    ["The whistle stopped play.", "restart"],
    ["The ball went over the end line.", "restart"],
    ["La bocha se fue afuera por el lateral.", "restart"],
    ["Rebotó en el rival y salió afuera.", "restart"],
  ];

  for (const [description, expected] of samples) {
    const detected = classifyTopic(description);
    assert.equal(detected.topic, expected, description + " => " + JSON.stringify(detected.ranked.slice(0, 2)));
    assert.equal(detected.ambiguous, false, description);
  }
});

test("prototype learner generalizes to held-out paraphrases and common typos", () => {
  const samples: Array<[string, string]> = [
    ["His route was shut and he checked hard.", "row"],
    ["The pony got unbalanced after a heavy bump.", "dangerous"],
    ["The attacker stayed between the defender and teammate so he could not get through.", "blocking"],
    ["The malet clipped the pony during the swing.", "mallet"],
    ["The official was abused verbally after the call.", "conduct"],
    ["The shot finished outside the playing area.", "restart"],
  ];

  for (const [description, expected] of samples) {
    const detected = classifyTopic(description);
    assert.equal(detected.topic, expected, description + " => " + JSON.stringify(detected.ranked.slice(0, 3)));
    assert.equal(detected.ambiguous, false, description);
  }
});

test("negated family cues are suppressed instead of creating false ties", () => {
  const cases: Array<[string, string, string]> = [
    ["The ball stayed in play and Red crossed in front, forcing Blue to check.", "row", "restart"],
    ["There was no hook; Red hit the opponent hard from the blind side.", "dangerous", "mallet"],
    ["No hubo bloqueo; el caballo perdió el equilibrio por el contacto.", "dangerous", "blocking"],
    ["He did not argue; he hooked from the wrong side.", "mallet", "conduct"],
    ["La pelota no salió afuera; Red se le cruzó y lo obligó a frenar.", "row", "restart"],
  ];

  for (const [description, expected, suppressed] of cases) {
    const detected = classifyTopic(description);
    assert.equal(detected.topic, expected, description + " => " + JSON.stringify(detected.ranked.slice(0, 3)));
    assert.equal(detected.ranked.find((item) => item.id === suppressed)?.score, 0, description);
  }
});

test("explicit fact extractor prefills only facts actually stated in the play", () => {
  const row = extractExplicitPlayFacts("Red crossed in front and forced Blue to pull up. The line had changed and there was no time to clear.", "row");
  assert.equal(row.answers.risk, "yes");
  assert.equal(row.answers.lineChanged, "yes");
  assert.equal(row.answers.clearanceTime, "no");
  assert.equal(row.answers.rowEntitled, undefined);

  const dangerous = extractExplicitPlayFacts("A hard ride-off knocked the pony off balance from the blind side.", "dangerous");
  assert.equal(dangerous.answers.balance, "yes");
  assert.equal(dangerous.answers.blind, "yes");

  const mallet = extractExplicitPlayFacts("He hooked from the wrong side. The swing passed close to the pony.", "mallet");
  assert.equal(mallet.answers.hookPosition, "no");
  assert.equal(mallet.answers.strokeDanger, "yes");

  const conduct = extractExplicitPlayFacts("He kept arguing with the umpire after a previous warning.", "conduct");
  assert.equal(conduct.answers.conductMatches, "yes");
  assert.equal(conduct.answers.repeat, "yes");

  const restart = extractExplicitPlayFacts("The ball went out over the boards and they prepared for a knock-in.", "restart");
  assert.equal(restart.answers.dead, "yes");
  assert.equal(restart.answers.restartType, "knockin");
});

test("fact extractor preserves uncertainty when wording conflicts", () => {
  const facts = extractExplicitPlayFacts("The pony lost its balance, but another angle says the pony remained balanced.", "dangerous");
  assert.equal(facts.answers.balance, undefined);
  assert.equal(facts.facts.some((fact) => fact.key === "balance"), false);
});

test("fact extraction can shorten the quick flow without inventing missing ROW entitlement", () => {
  const dangerousFacts = extractExplicitPlayFacts("The pony lost its balance during the ride-off.", "dangerous");
  const dangerousProgress = matchProgress("dangerous", dangerousFacts.answers);
  assert.equal(dangerousProgress.complete, true);
  assert.equal(dangerousProgress.earlyResolved, true);

  const rowFacts = extractExplicitPlayFacts("Red crossed in front and forced Blue to pull up.", "row");
  const rowProgress = matchProgress("row", rowFacts.answers);
  assert.equal(rowProgress.currentKey, "rowEntitled");
  assert.equal(rowProgress.complete, false);
});

test("explicit dead-ball wording changes restart question order", () => {
  const restartFacts = extractExplicitPlayFacts("The ball went out over the boards for a knock-in.", "restart");
  const progress = matchProgress("restart", restartFacts.answers);
  assert.deepEqual(progress.keys, ["dead", "restartType"]);
  assert.equal(progress.complete, true);

  const decision = decidePlay("restart", "outdoor", restartFacts.answers, "en");
  assert.equal(decision.status, "procedure");
  assert.ok(decision.references.some((ref) => ref.startsWith("22")));
});

test("natural-language collision traps stay out of the wrong family", () => {
  const cases: Array<[string, string | null, string]> = [
    ["Red picked up the ball and continued.", null, "blocking"],
    ["Blue tried to marcar un gol.", null, "blocking"],
    ["He rode across the field to the pony line.", null, "row"],
    ["The scoreboard is beside the boards.", null, "restart"],
    ["The umpire yelled Play and the game continued.", null, "conduct"],
  ];

  for (const [description, expectedTopic, forbidden] of cases) {
    const detected = classifyTopic(description);
    assert.equal(detected.topic, expectedTopic, description);
    assert.equal(detected.ranked.find((item) => item.id === forbidden)?.score, 0, description);
  }
});

test("ambiguous classifier output becomes observable-action clarification choices", () => {
  const detected = classifyTopic("Dangerous hook.");
  assert.equal(detected.topic, null);
  assert.deepEqual(playClarifierCandidates(detected.ranked), ["dangerous", "mallet"]);
  assert.equal(playClarifierLabel("dangerous", "en"), "Dangerous contact / ride-off");
});

test("zero-signal descriptions still get a complete guided clarification path", () => {
  const detected = classifyTopic("Something happened near midfield.");
  assert.equal(detected.topic, null);
  assert.deepEqual(
    playClarifierCandidates(detected.ranked),
    ["restart", "row", "dangerous", "blocking", "mallet", "conduct"],
  );
});

test("unknown play descriptions do not silently default to ROW", () => {
  const detected = classifyTopic("The weather changed during the chukker.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked[0].score, 0);
});

test("out-over-boards wording classifies as Restart / Dead Ball", () => {
  const detected = classifyTopic("The ball is hit over the boards of opponents horse");
  assert.equal(detected.topic, "restart");
  assert.equal(detected.ambiguous, false);
});

test("ball over the boards off an opponent horse classifies as Restart", () => {
  const detected = classifyTopic("The ball went over the boards off an opponent's horse.");
  assert.equal(detected.topic, "restart");
  assert.equal(detected.ambiguous, false);
});

test("out-of-bounds wording classifies as Restart", () => {
  const detected = classifyTopic("The ball went out of bounds after touching Blue's pony.");
  assert.equal(detected.topic, "restart");
  assert.equal(detected.ambiguous, false);
});

test("crossed-the-sideline wording classifies as Restart", () => {
  const detected = classifyTopic("The ball crossed the sideline after glancing off an opposing player.");
  assert.equal(detected.topic, "restart");
  assert.equal(detected.ambiguous, false);
});

test("crossing boards remains out-of-bounds and does not create a ROW tie", () => {
  for (const text of [
    "The ball crossed the boards after touching Red's horse.",
    "The ball crosses the boards off an opponent.",
  ]) {
    const detected = classifyTopic(text);
    assert.equal(detected.topic, "restart", text);
    assert.equal(detected.ranked.find((item) => item.id === "row")?.score, 0, text);
  }
});

test("Spanish tablas wording classifies as Restart", () => {
  const detected = classifyTopic("La pelota salió por las tablas después de tocar el caballo rival.");
  assert.equal(detected.topic, "restart");
  assert.equal(detected.ambiguous, false);
});

test("Spanish línea lateral wording classifies as Restart", () => {
  const detected = classifyTopic("La bocha salió por la línea lateral después de rebotar en un rival.");
  assert.equal(detected.topic, "restart");
  assert.equal(detected.ambiguous, false);
});

test("scoreboard and nearby boards do not create a Restart false positive", () => {
  const detected = classifyTopic("The scoreboard shows 7-6 near the boards.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked.find((item) => item.id === "restart")?.score, 0);
});

test("being near the sideline without an out-of-bounds event does not trigger Restart", () => {
  const detected = classifyTopic("A player rides along the sideline while the ball remains in play.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked.find((item) => item.id === "restart")?.score, 0);
});

test("tied rule-family signals require an explicit family choice", () => {
  const detected = classifyTopic("Dangerous hook.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ambiguous, true);
  assert.equal(detected.ranked[0].score, detected.ranked[1].score);
});

test("near-tied rule-family signals also require an explicit family choice", () => {
  const detected = classifyTopic("Dangerous action during a free hit.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ambiguous, true);
  assert.equal(detected.ranked[0].score - detected.ranked[1].score, 1);
});

test("Spanish conversational 'qué pasó' does not falsely classify as ROW", () => {
  const detected = classifyTopic("¿Qué pasó con el jugador azul?");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked.find((item) => item.id === "row")?.score, 0);
});

test("English 'across' does not falsely match the ROW cue 'cross'", () => {
  const detected = classifyTopic("He rode across the field and then turned back.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked.find((item) => item.id === "row")?.score, 0);
});

test("Spanish alineado does not falsely match the ROW cue linea", () => {
  const detected = classifyTopic("El jugador estaba alineado con el arco.");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked.find((item) => item.id === "row")?.score, 0);
});

test("asking for the penalty for arguing is classified as conduct, not restart", () => {
  const detected = classifyTopic("What penalty should be given for arguing with the umpire?");
  assert.equal(detected.topic, "conduct");
  assert.equal(detected.ranked.find((item) => item.id === "restart")?.score, 0);
});

test("generic penalty consequence wording does not by itself trigger Restart", () => {
  const detected = classifyTopic("What penalty should the Umpire award here?");
  assert.equal(detected.topic, null);
  assert.equal(detected.ranked.find((item) => item.id === "restart")?.score, 0);
});

test("short rule-search token ROW does not match inside throw-in", () => {
  const synthetic: Rule = {
    id: "outdoor-20",
    discipline: "outdoor",
    rule: "20",
    title: "Throw-in",
    pageStart: 1,
    text: "The throw-in restarts play.",
    keywords: ["throw-in"],
  };
  assert.equal(scoreRule(synthetic, "ROW"), 0);
  assert.ok(scoreRule(synthetic, "throw") > 0);
});

test("Blocking open-play question offers uncertainty instead of an inapplicable escape", () => {
  const slow = questions.blocking.find((question) => question.key === "slow");
  assert.ok(slow);
  assert.ok(slow.options.some(([value]) => value === "unknown"));
  assert.equal(slow.options.some(([value]) => value === "na"), false);
});

test("conditional ROW and mallet questions do not offer N/A once activated", () => {
  const clearance = questions.row.find((question) => question.key === "clearanceTime");
  const strokeEntry = questions.mallet.find((question) => question.key === "strokeEnteredByOpponent");
  assert.ok(clearance);
  assert.ok(strokeEntry);
  assert.equal(clearance.options.some(([value]) => value === "na"), false);
  assert.ok(clearance.options.some(([value]) => value === "unknown"));
  assert.equal(strokeEntry.options.some(([value]) => value === "na"), false);
  assert.ok(strokeEntry.options.some(([value]) => value === "unknown"));
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

test("Match Mode stops ROW questions once no risk is established", () => {
  const progress = matchProgress("row", { rowEntitled: "yes", risk: "no" });
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
  assert.deepEqual(progress.keys, ["rowEntitled", "risk"]);
});

test("changing an upstream ROW answer clears stale downstream branch answers", () => {
  const current = {
    rowEntitled: "yes",
    risk: "yes",
    lineChanged: "yes",
    clearanceTime: "no",
  };
  const nextAnswers = applyMatchAnswer("row", current, "risk", "no");
  assert.deepEqual(nextAnswers, { rowEntitled: "yes", risk: "no" });
  assert.deepEqual(matchProgress("row", nextAnswers).keys, ["rowEntitled", "risk"]);
});

test("re-entering a changed branch does not resurrect old hidden answers", () => {
  const first = applyMatchAnswer("row", {
    rowEntitled: "yes",
    risk: "yes",
    lineChanged: "yes",
    clearanceTime: "no",
  }, "risk", "no");
  const second = applyMatchAnswer("row", first, "risk", "yes");
  assert.deepEqual(second, { rowEntitled: "yes", risk: "yes" });
  assert.equal(matchProgress("row", second).currentKey, "lineChanged");
});

test("rewind from a completed quick flow reopens the last answered fact", () => {
  const completed = { marking: "yes", restartBlock: "yes" };
  assert.equal(matchProgress("blocking", completed).complete, true);
  const rewound = rewindLastMatchAnswer("blocking", completed);
  assert.deepEqual(rewound, { marking: "yes" });
  assert.equal(matchProgress("blocking", rewound).currentKey, "restartBlock");
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

test("Dangerous Riding stops after an express indicator because later quick facts cannot close the Umpire judgment", () => {
  const progress = matchProgress("dangerous", { balance: "no", speedAngle: "yes" });
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
  assert.deepEqual(progress.keys, ["balance", "speedAngle"]);
});

test("Dangerous Riding with primary factors negative remains Umpire judgment", () => {
  const answers = {
    balance: "no",
    speedAngle: "no",
    blind: "no",
  } as const;
  const decision = decidePlay("dangerous", "outdoor", answers, "en");
  const audit = auditPlayDecision("dangerous", "outdoor", answers, decision);
  assert.equal(decision.status, "needs-info");
  assert.equal(audit.level, "umpire-judgment");
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
  assert.deepEqual(progress.keys, ["marking"]);
});

test("Blocking asks whether marking was prevented before asking restart context", () => {
  const progress = matchProgress("blocking", {});
  assert.equal(progress.currentKey, "marking");
});

test("dangerous mallet use is a foul when another player did not create the danger", () => {
  const answers = { strokeDanger: "yes", strokeEnteredByOpponent: "no" } as const;
  const decision = decidePlay("mallet", "outdoor", answers, "en");
  const progress = matchProgress("mallet", answers);
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("28.d"));
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
});

test("mallet danger caused by a player riding into the stroke stays with the Umpire for responsibility", () => {
  const answers = { strokeDanger: "yes", strokeEnteredByOpponent: "yes" } as const;
  const decision = decidePlay("mallet", "outdoor", answers, "en");
  assert.equal(decision.status, "needs-info");
  assert.ok(decision.references.includes("28.d"));
  assert.ok(decision.references.includes("26.h"));
});

test("Match Mode stops hook questions after the first illegal hook condition", () => {
  const progress = matchProgress("mallet", { strokeDanger: "no", hookPosition: "no" });
  assert.equal(progress.complete, true);
  assert.equal(progress.earlyResolved, true);
  assert.deepEqual(progress.keys, ["strokeDanger", "hookPosition"]);
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

test("Restart flow asks the early-play fact first and only then the restart type when needed", () => {
  const first = matchProgress("restart", {});
  assert.equal(first.currentKey, "early");

  const early = matchProgress("restart", { early: "yes" });
  assert.equal(early.currentKey, "restartType");
  assert.deepEqual(early.keys, ["early", "restartType"]);

  const ordinary = matchProgress("restart", { early: "no", dead: "no" });
  assert.equal(ordinary.complete, true);
  assert.equal(ordinary.earlyResolved, true);
  assert.deepEqual(ordinary.keys, ["early", "dead"]);
});

test("dead-ball restart type is actually used by the decision engine", () => {
  const decision = decidePlay("restart", "outdoor", {
    early: "no",
    dead: "yes",
    restartType: "knockin",
  }, "en");
  assert.equal(decision.status, "procedure");
  assert.ok(decision.references.includes("22.a"));
  assert.equal(decision.missing.length, 0);
});

test("unknown dead-ball restart type remains explicitly unresolved", () => {
  const decision = decidePlay("restart", "outdoor", {
    early: "no",
    dead: "yes",
    restartType: "unknown",
  }, "en");
  assert.equal(decision.status, "needs-info");
  assert.ok(decision.missing.length > 0);
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


test("case history snapshot preserves Rulebook version, facts and sources", () => {
  const record = buildCaseRecord({
    source: "match",
    resolverMode: "play",
    discipline: "outdoor",
    language: "en",
    situation: "Blue had the ROW and Red crossed.",
    eventContext: "Autumn 8 Goal",
    rulebookVersion: "2026",
    outcome: {
      status: "foul",
      headline: "ROW entry/crossing foul",
      summary: "The ROW holder had to check.",
    },
    facts: [
      { label: "ROW entitlement", value: "YES" },
      { label: "Risk", value: "YES" },
    ],
    references: [
      { kind: "rule", label: "Rule 24.c", page: "88", excerpt: "Right of Way text" },
      { kind: "rule", label: "Rule 24.c", page: "88", excerpt: "duplicate" },
      { kind: "external", label: "Umpire Guide", page: "223", resourceId: "umpire-guide", sectionId: "intro" },
    ],
  }, "case-1", "2026-10-13T15:30:00.000Z");

  assert.equal(record.rulebookVersion, "2026");
  assert.equal(record.eventContext, "Autumn 8 Goal");
  assert.equal(record.facts.length, 2);
  assert.equal(record.references.length, 2);
  assert.equal(record.references[0].label, "Rule 24.c");
});

test("case history merge keeps newest cases first and avoids duplicate IDs", () => {
  const base = buildCaseRecord({
    source: "analysis",
    resolverMode: "situation",
    discipline: "outdoor",
    language: "en",
    situation: "Substitute eligibility",
    rulebookVersion: "2026",
    outcome: { status: "reference", headline: "Eligibility", summary: "Review rules." },
    facts: [],
    references: [],
  }, "case-a", "2026-10-13T10:00:00.000Z");

  const newer = buildCaseRecord({
    source: "match",
    resolverMode: "play",
    discipline: "arena",
    language: "en",
    situation: "Arena hook",
    rulebookVersion: "2026",
    outcome: { status: "needs-info", headline: "Need facts", summary: "More detail required." },
    facts: [],
    references: [],
  }, "case-b", "2026-10-13T11:00:00.000Z");

  const merged = mergeCaseRecord([base], newer);
  assert.deepEqual(merged.map((item) => item.id), ["case-b", "case-a"]);
  assert.equal(mergeCaseRecord(merged, newer).filter((item) => item.id === "case-b").length, 1);
});

test("case history normalizer rejects malformed stored entries", () => {
  const valid = buildCaseRecord({
    source: "analysis",
    resolverMode: "play",
    discipline: "outdoor",
    language: "en",
    situation: "Valid",
    rulebookVersion: "2026",
    outcome: { status: "reference", headline: "Valid case", summary: "Summary" },
    facts: [],
    references: [],
  }, "valid", "2026-10-13T12:00:00.000Z");

  const normalized = normalizeCaseHistory([null, { id: "broken" }, valid]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "valid");
});


test("voice transcript appends to an existing query without losing text", () => {
  assert.equal(
    appendTranscript("Blue had the line.", "Red crossed and Blue checked."),
    "Blue had the line. Red crossed and Blue checked.",
  );
});

test("voice transcript fills an empty query cleanly", () => {
  assert.equal(appendTranscript("", "Red crossed the line"), "Red crossed the line");
});

test("voice dictation language follows the app language", () => {
  assert.equal(speechLocale("en"), "en-US");
  assert.equal(speechLocale("es"), "es-AR");
});


test("official guidance index covers every Interpretation/Example marker in the installed Rulebook", () => {
  const metrics = officialGuidanceMetrics(db);
  assert.equal(metrics.total, 132);
  assert.equal(metrics.examples, 63);
  assert.equal(metrics.interpretations, 69);
  assert.equal(metrics.rulesWithGuidance, 36);
});

test("golden Rule 24 example: safe entry after checking supports no crossing foul", () => {
  const guidance = extractOfficialGuidance(db);
  assert.ok(guidance.some((item) =>
    item.discipline === "outdoor" &&
    item.rule === "24" &&
    item.kind === "example" &&
    /No foul on Red #3[\s\S]{0,260}safe distance and relative speed/i.test(item.text)
  ));
  const decision = decidePlay("row", "outdoor", {
    rowEntitled: "yes",
    risk: "no",
    lineChanged: "no",
  }, "en");
  assert.equal(decision.status, "no-foul");
});

test("golden Rule 24 example: line change without safe clearance remains a foul branch", () => {
  const guidance = extractOfficialGuidance(db);
  assert.ok(guidance.some((item) =>
    item.discipline === "outdoor" &&
    item.rule === "24" &&
    item.kind === "example" &&
    /Red taps the ball sharply to the right/i.test(item.text) &&
    /risk of collision or danger/i.test(item.text)
  ));
  const decision = decidePlay("row", "outdoor", {
    rowEntitled: "yes",
    risk: "yes",
    lineChanged: "yes",
    clearanceTime: "no",
  }, "en");
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("24.d"));
});

test("golden Rule 26 example: staggered mount supports Dangerous Riding foul", () => {
  const guidance = extractOfficialGuidance(db);
  assert.ok(guidance.some((item) =>
    item.discipline === "outdoor" &&
    item.rule === "26" &&
    item.kind === "example" &&
    /mount is staggered from the force of contact/i.test(item.text) &&
    /Foul Red/i.test(item.text)
  ));
  const decision = decidePlay("dangerous", "outdoor", { balance: "yes" }, "en");
  assert.equal(decision.status, "foul");
});

test("golden Rule 26A example: shielding a defender during a knock-in is improper blocking", () => {
  const guidance = extractOfficialGuidance(db);
  assert.ok(guidance.some((item) =>
    item.discipline === "outdoor" &&
    item.rule === "26A" &&
    item.kind === "example" &&
    /uses\s+Red #1\s+as\s+a\s+shield/i.test(item.text) &&
    /Improper blocking/i.test(item.text)
  ));
  const decision = decidePlay("blocking", "outdoor", {
    restartBlock: "yes",
    marking: "yes",
  }, "en");
  assert.equal(decision.status, "foul");
});

test("golden Rule 28 example: striking a safely positioned mount on downswing is a foul", () => {
  const guidance = extractOfficialGuidance(db);
  assert.ok(guidance.some((item) =>
    item.discipline === "outdoor" &&
    item.rule === "28" &&
    item.kind === "example" &&
    /strikes\s+Red.s\s+mount\s+on\s+the\s+downswing/i.test(item.text) &&
    /Foul Blue/i.test(item.text)
  ));
  const decision = decidePlay("mallet", "outdoor", { strokeDanger: "yes", strokeEnteredByOpponent: "no" }, "en");
  assert.equal(decision.status, "foul");
});

test("Rule 35 penalty selection is never converted into a fixed automatic penalty by the play engine", () => {
  const decision = decidePlay("row", "outdoor", {
    rowEntitled: "yes",
    risk: "yes",
    lineChanged: "no",
  }, "en");
  assert.equal(decision.status, "foul");
  assert.ok(decision.references.includes("35.b"));
  assert.ok(decision.penalty.some((item) => /discretion|discrecional/i.test(item)));
});

test("decision audit marks ROW calls as Umpire judgment until ROW entitlement is fully derived", () => {
  const answers = { rowEntitled: "yes", risk: "yes", lineChanged: "no" } as const;
  const decision = decidePlay("row", "outdoor", answers, "en");
  const audit = auditPlayDecision("row", "outdoor", answers, decision);
  assert.equal(audit.level, "umpire-judgment");
});

test("decision audit promotes helper-derived ROW branch to direct rule support", () => {
  const answers = {
    rowEntitled: "yes",
    rowEntitlementDerived: "24.f",
    risk: "yes",
    lineChanged: "no",
  } as const;
  const decision = decidePlay("row", "outdoor", answers, "en");
  const audit = auditPlayDecision("row", "outdoor", answers, decision);
  assert.equal(audit.level, "direct-rule-support");
});


test("decision audit marks knocked-off-balance Dangerous Riding as directly rule-supported", () => {
  const answers = { balance: "yes" } as const;
  const decision = decidePlay("dangerous", "outdoor", answers, "en");
  const audit = auditPlayDecision("dangerous", "outdoor", answers, decision);
  assert.equal(audit.level, "direct-rule-support");
  assert.match(audit.scopeEn, /aggressor/i);
});

test("every Outdoor quick-decision truth-table combination returns a valid audited result with resolvable references", () => {
  const topics = ["row","dangerous","blocking","mallet","conduct","restart"] as const;

  function combinations(options: string[][], index = 0, current: string[] = [], output: string[][] = []) {
    if (index === options.length) {
      output.push([...current]);
      return output;
    }
    for (const value of options[index]) {
      current.push(value);
      combinations(options, index + 1, current, output);
      current.pop();
    }
    return output;
  }

  let evaluated = 0;
  for (const topic of topics) {
    const defs = questions[topic];
    const optionSets = defs.map((question) => question.options.map(([value]) => value));
    for (const values of combinations(optionSets)) {
      const answers: Record<string,string> = {};
      defs.forEach((question,index) => { answers[question.key] = values[index]; });
      const decision = decidePlay(topic, "outdoor", answers, "en");
      const audit = auditPlayDecision(topic, "outdoor", answers, decision);
      assert.ok(["foul","no-foul","needs-info","procedure"].includes(decision.status));
      assert.ok(["direct-rule-support","umpire-judgment","insufficient-coverage"].includes(audit.level));
      for (const ref of decision.references) {
        assert.ok(resolveProvisions(db, "outdoor", [ref]).length > 0, "Unresolved ref " + ref + " for " + topic);
      }
      evaluated += 1;
    }
  }
  assert.ok(evaluated >= 500);
});


test("Rule 24(f) helper gives ROW to following player when meeting opponent is not exact-line offside", () => {
  const result = deriveRowEntitlement({
    ...defaultRowEntitlementFacts,
    nearSideDanger: "no",
    relation: "affected-following",
    meetingExactOffside: "no",
  });
  assert.equal(result.status, "affected-has-row");
  assert.ok(result.refs.includes("24.f"));
});

test("Rule 24(f) helper gives ROW to exact-line offside meeting player", () => {
  const result = deriveRowEntitlement({
    ...defaultRowEntitlementFacts,
    nearSideDanger: "no",
    relation: "affected-following",
    meetingExactOffside: "yes",
  });
  assert.equal(result.status, "affected-no-row");
  assert.ok(result.refs.includes("24.f"));
});

test("Rule 24(g) helper resolves approximately equal angles by offside", () => {
  const result = deriveRowEntitlement({
    ...defaultRowEntitlementFacts,
    nearSideDanger: "no",
    relation: "both-follow-or-meet",
    lesserAngle: "approximately-equal",
    equalAngleOffside: "affected",
  });
  assert.equal(result.status, "affected-has-row");
  assert.ok(result.refs.includes("24.g"));
});

test("Rule 24(h) helper gives engaged exact-line pair priority over a single player", () => {
  const result = deriveRowEntitlement({
    ...defaultRowEntitlementFacts,
    nearSideDanger: "no",
    relation: "affected-pair-vs-single",
    pairEngagedExactLine: "yes",
  });
  assert.equal(result.status, "affected-has-row");
  assert.ok(result.refs.includes("24.h"));
});

test("Rule 24(e) near-side restriction takes precedence when no exception applies", () => {
  const result = deriveRowEntitlement({
    ...defaultRowEntitlementFacts,
    nearSideDanger: "yes",
    nearSideException: "no",
  });
  assert.equal(result.status, "restricted");
  assert.deepEqual(result.refs, ["24.e"]);
});

test("ROW decision rule trail includes LOB definition, entitlement provisions and applied crossing rule", () => {
  const answers = { rowEntitled: "yes", risk: "yes", lineChanged: "yes", clearanceTime: "no" } as const;
  const decision = decidePlay("row", "outdoor", answers, "en");
  const trail = playDecisionRuleTrail({ db, discipline: "outdoor", topic: "row", answers, decision, language: "en" });
  const refs = trail.map((item) => item.provision.ref);
  for (const ref of ["23","24.b","24.c","24.d","24.e","24.f","24.g","24.h"]) {
    assert.ok(refs.includes(ref), "Missing ROW trail ref " + ref);
  }
});

test("substitution decision rule trail turns cross-rule checks into exact clickable provisions", () => {
  const state = buildSubstitutionCrossRuleState({
    discipline: "outdoor",
    handicap: { eventUpper: 8, teamTotalBefore: 8, outgoingHandicap: 5, candidateHandicap: 3 },
    facts: {
      ...defaultSubstitutionCrossFacts,
      candidateCurrentMember: "yes",
      candidateSuspended: "no",
      candidatePlayedOtherTeam: "no",
    },
    answers: { endPeriod: "yes", penalty7: "no" },
    language: "en",
  });
  const trail = substitutionDecisionRuleTrail({ db, discipline: "outdoor", checks: state.checks, language: "en" });
  const refs = trail.map((item) => item.provision.ref);
  assert.ok(refs.includes("3.a"));
  assert.ok(refs.includes("2.d"));
  assert.ok(refs.includes("1.f"));
});


test("safe storage helpers absorb blocked-browser storage errors", () => {
  const broken: KeyValueStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(safeStorageGet(broken, "x"), null);
  assert.equal(safeStorageSet(broken, "x", "1"), false);
  assert.equal(safeStorageRemove(broken, "x"), false);
});

test("persisted Event Profile is normalized before it can affect a ruling", () => {
  const profile = normalizeEventProfile({
    name: 42,
    discipline: "invalid",
    eventType: "mystery",
    upperHandicap: "8",
    lowerHandicap: Number.NaN,
    sponsorStructure: "other",
    affiliateHostException: "maybe",
    format: "  Standard  ",
    conditionsKnown: "yes",
    conditionsNotes: " note ",
  });
  assert.equal(profile.discipline, "outdoor");
  assert.equal(profile.eventType, "unknown");
  assert.equal(profile.upperHandicap, null);
  assert.equal(profile.lowerHandicap, null);
  assert.equal(profile.sponsorStructure, "unknown");
  assert.equal(profile.affiliateHostException, "unknown");
  assert.equal(profile.format, "Standard");
  assert.equal(profile.conditionsKnown, "yes");
  assert.equal(profile.conditionsNotes, "note");
});

test("Outdoor Event Profile does not inject Arena-only facts", () => {
  const outdoor = normalizeEventProfile({
    discipline: "outdoor",
    format: "6 chukkers",
    conditionsKnown: "yes",
  });
  const facts = profileToCaseFacts(outdoor);
  assert.equal("arenaFormatType" in facts, false);
  assert.equal("arenaEventConditions" in facts, false);
  assert.equal(facts.matchFormat, "6 chukkers");
});

test("Arena Event Profile keeps Arena-specific facts", () => {
  const arena = normalizeEventProfile({
    discipline: "arena",
    format: "4 periods",
    conditionsKnown: "yes",
  });
  const facts = profileToCaseFacts(arena);
  assert.equal(facts.arenaFormatType, "4 periods");
  assert.equal(facts.arenaEventConditions, "yes");
});

test("legacy feedback with an invalid reason is sanitized instead of poisoning the queue", () => {
  const base = buildFeedbackRecord({
    source: "analysis",
    discipline: "outdoor",
    resolverMode: "play",
    topic: "row",
    outcomeStatus: "needs-info",
    headline: "Needs info",
    rulebookVersion: "2026",
    ruleRefs: ["24"],
    appVersion: "0.27.1",
  }, "needs-review", "missing-fact", "", "legacy-feedback", "2026-10-19T20:00:00.000Z");

  const normalized = normalizeFeedbackRecord({ ...base, reason: "old-invalid-reason" });
  assert.ok(normalized);
  assert.equal(normalized.reason, undefined);
});

test("feedback records never require the original play description", () => {
  const record = buildFeedbackRecord({
    source: "match",
    discipline: "outdoor",
    resolverMode: "play",
    topic: "row",
    outcomeStatus: "foul",
    validationLevel: "direct-rule-support",
    headline: "ROW crossing foul",
    rulebookVersion: "2026",
    ruleRefs: ["24.c", "35.b", "24.c"],
    appVersion: "0.25.0",
  }, "useful", "clear", "", "feedback-1", "2026-10-13T20:00:00.000Z");

  assert.equal(record.context.ruleRefs.length, 2);
  assert.equal("situation" in record.context, false);
  assert.equal(record.delivery, "pending");
});

test("feedback note is normalized and capped", () => {
  const note = sanitizeFeedbackNote("  Rule 24.d   should also be reviewed.  ");
  assert.equal(note, "Rule 24.d should also be reviewed.");
  assert.equal(sanitizeFeedbackNote("x".repeat(500)).length, 300);
});

test("official text formatter preserves Umpire Guide misexecution tables as table blocks", () => {
  const guide = externalDb.resources.find((resource) => resource.id === "umpire-guide");
  const section = guide?.sections.find((item) => item.id === "umpire-guide-outdoor-rules-misexecution-of-penalty-shots-knock-ins");
  assert.ok(section);
  const blocks = formatOfficialTextBlocks(section.text, section.title);
  assert.ok(blocks.length >= 1);
  assert.ok(blocks.some((block) => block.kind === "table"));
});

test("official text formatter detects Arena misexecution and handicap matrices", () => {
  const guide = externalDb.resources.find((resource) => resource.id === "umpire-guide");
  for (const id of [
    "umpire-guide-arena-rules-misexecution-of-penalty-shots",
    "umpire-guide-outdoor-handicap-matrix",
    "umpire-guide-arena-handicap-matrix",
  ]) {
    const section = guide?.sections.find((item) => item.id === id);
    assert.ok(section);
    const blocks = formatOfficialTextBlocks(section.text, section.title);
    assert.ok(blocks.some((block) => block.kind === "table"), "Expected table block for " + id);
  }
});

test("official text formatter keeps mixed Tournament Conditions prose separate from its fee table", () => {
  const tournament = externalDb.resources.find((resource) => resource.id === "tournament-conditions");
  const section = tournament?.sections.find((item) => item.id === "tournament-conditions-section-v-tournament-fees-and-charges");
  assert.ok(section);
  const blocks = formatOfficialTextBlocks(section.text, section.title);
  assert.ok(blocks.some((block) => block.kind === "prose"));
  assert.ok(blocks.some((block) => block.kind === "table"));
  assert.ok(blocks.find((block) => block.kind === "table")?.text.includes("GOAL LEVEL"));
});

test("official text formatter detects the penalty table embedded in Arena Rule 10", () => {
  const rule = db.rules.find((item) => item.discipline === "arena" && item.rule === "10");
  assert.ok(rule);
  const blocks = formatOfficialTextBlocks(rule.text, "Rule 10 · " + rule.title);
  assert.ok(blocks.some((block) => block.kind === "table"));
  assert.ok(blocks.find((block) => block.kind === "table")?.text.includes("PENALTY"));
});

test("embedded Arena Rule 10 penalty table is parsed into real columns", () => {
  const rule = db.rules.find((item) => item.discipline === "arena" && item.rule === "10");
  assert.ok(rule);
  const blocks = formatOfficialTextBlocks(rule.text, "Rule 10 · " + rule.title);
  const table = blocks.find((block) => block.table && block.text.includes("RULE"));
  assert.ok(table?.table);
  assert.equal(table.table.columnCount, 2);
  assert.ok(table.table.rows.some((row) => row[0].includes("14.h") && row[1].includes("2, 3, 4, 5")));
  assert.equal(blocks.some((block) => block.text.includes("2026 UNITED STATES POLO ASSOCIATION")), false);
});

test("Outdoor Rule 35 penalty matrix is parsed into real columns", () => {
  const rule = db.rules.find((item) => item.discipline === "outdoor" && item.rule === "35");
  assert.ok(rule);
  const blocks = formatOfficialTextBlocks(rule.text, "Rule 35 · " + rule.title);
  const table = blocks.find((block) => block.table && block.text.includes("RULE"));
  assert.ok(table?.table);
  assert.equal(table.table.columnCount, 2);
  assert.ok(table.table.rows.some((row) => row[0] === "24" && row[1].includes("1,2,3,4,5,7 or 10")));
  assert.equal(blocks.some((block) => block.text.includes("2026 UNITED STATES POLO ASSOCIATION")), false);
});

test("Tournament Fees schedule is parsed as a 3-column table", () => {
  const tournament = externalDb.resources.find((resource) => resource.id === "tournament-conditions");
  const section = tournament?.sections.find((item) => item.id === "tournament-conditions-section-v-tournament-fees-and-charges");
  assert.ok(section);
  const blocks = formatOfficialTextBlocks(section.text, section.title);
  const table = blocks.find((block) => block.table && block.text.includes("GOAL LEVEL"));
  assert.ok(table?.table);
  assert.equal(table.table.columnCount, 3);
  assert.ok(table.table.rows.some((row) => row[0] === "0 to 4 goals" && row[1] === "$300.00" && row[2] === "$200.00"));
});

test("Umpire certification requirements are recovered as a multi-column table", () => {
  const guide = externalDb.resources.find((resource) => resource.id === "umpire-guide");
  const section = guide?.sections.find((item) => item.id === "umpire-guide-umpire-certification-program-standards-and-qualifications");
  assert.ok(section);
  const blocks = formatOfficialTextBlocks(section.text, section.title);
  const table = blocks.find((block) => block.table && block.text.includes("Certification"));
  assert.ok(table?.table);
  assert.ok(table.table.columnCount >= 4);
  assert.equal(table.text.includes("\nM    P1"), false);
});

test("professional Umpire lists are parsed without PDF margin letters", () => {
  const guide = externalDb.resources.find((resource) => resource.id === "umpire-guide");
  const section = guide?.sections.find((item) => item.id === "umpire-guide-uspa-instructors-and-professional-umpires");
  assert.ok(section);
  const blocks = formatOfficialTextBlocks(section.text, section.title);
  assert.ok(blocks.filter((block) => block.table).length >= 2);
  const cleaned = cleanOfficialSourceText(section.text);
  assert.equal(/\s{8,}[A-Z]\s*$/m.test(cleaned), false);
});

test("official source cleanup removes repeated page headers and vertical margin furniture", () => {
  const sample = [
    "Body text                                                        U",
    "M",
    "I",
    "2026 UNITED STATES POLO ASSOCIATION®",
    "Next paragraph",
  ].join("\n");
  const cleaned = cleanOfficialSourceText(sample);
  assert.equal(cleaned.includes("UNITED STATES POLO ASSOCIATION"), false);
  assert.equal(cleaned.includes("                                                        U"), false);
  assert.equal(/^M$/m.test(cleaned), false);
  assert.equal(/^I$/m.test(cleaned), false);
});

test("Heat Index broken extraction is replaced by a structured summary", () => {
  const table = getOfficialStructuredTable("policies-noaa-s-national-weather-service-heat-index-chart");
  assert.ok(table);
  assert.equal(table.columns.join("|"), "Category|Heat Index");
  assert.equal(table.rows.at(-1)?.join("|"), "Extreme Danger|126+");
});

test("visual-only Henneke chart suppresses unreliable extracted glyphs", () => {
  const notice = getOfficialSourceNotice("policies-henneke-body-condition-score-chart");
  assert.ok(notice);
  assert.ok(notice.en.includes("visual chart"));
});

test("all Rulebook rule text renders without repeated USPA page headers", () => {
  for (const rule of db.rules) {
    const cleaned = cleanOfficialSourceText(rule.text);
    assert.equal(
      cleaned.includes("2026 UNITED STATES POLO ASSOCIATION®"),
      false,
      "Page header leaked in " + rule.discipline + " Rule " + rule.rule,
    );
  }
});

test("structured Outdoor misexecution table has complete 8-column rows", () => {
  const table = getOfficialStructuredTable("umpire-guide-outdoor-rules-misexecution-of-penalty-shots-knock-ins");
  assert.ok(table);
  assert.equal(table.columns.length, 8);
  assert.equal(table.rows.length, 5);
  assert.ok(table.rows.every((row) => row.length === 8));
  assert.equal(table.rows[0][0], "Swing and miss");
  assert.equal(table.rows[4][7], "Penalty 5.b for attacking team");
});

test("structured Arena misexecution table has complete 6-column rows", () => {
  const table = getOfficialStructuredTable("umpire-guide-arena-rules-misexecution-of-penalty-shots");
  assert.ok(table);
  assert.equal(table.columns.length, 6);
  assert.equal(table.rows.length, 10);
  assert.ok(table.rows.every((row) => row.length === 6));
  assert.equal(table.rows[1][4], "Spot hit no closer than center line for defending team");
  assert.equal(table.rows[1][5], "Spot hit");
});

test("structured handicap matrices preserve all extracted handicap rows", () => {
  const outdoor = getOfficialStructuredTable("umpire-guide-outdoor-handicap-matrix");
  const arena = getOfficialStructuredTable("umpire-guide-arena-handicap-matrix");
  assert.ok(outdoor);
  assert.ok(arena);
  assert.equal(outdoor.rows.length, 9);
  assert.equal(outdoor.rows.at(-1)?.join("|"), "4.0|1.5|2.0|2.5|3.5|4.0");
  assert.equal(arena.rows.length, 6);
  assert.equal(arena.rows.at(-1)?.join("|"), "6|3|6");
});

test("feedback normalization rejects malformed ratings", () => {
  const valid = buildFeedbackRecord({
    source: "analysis",
    discipline: "arena",
    resolverMode: "situation",
    scenario: "substitutes",
    outcomeStatus: "needs-info",
    headline: "More facts needed",
    rulebookVersion: "2026",
    ruleRefs: ["3"],
    appVersion: "0.25.0",
  }, "needs-review", "missing-fact", "Needs event conditions.", "feedback-2", "2026-10-13T20:00:00.000Z");

  assert.equal(normalizeFeedbackRecord(valid)?.id, "feedback-2");
  assert.equal(normalizeFeedbackRecord({ ...valid, rating: "perfect" }), null);
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
