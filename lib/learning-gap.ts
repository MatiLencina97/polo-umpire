import { nextDecisiveQuestion } from "./decision-intelligence";
import { relevantMatchKeys } from "./match-flow";
import type { DecisionAudit } from "./decision-audit";
import type { PlayDecision } from "./play-decision";
import type { ChoiceValue, Discipline, Language, TopicId } from "./types";
import { safeStorageGet, safeStorageSet, sessionStore } from "./browser-storage";

export type LearningGapReason = "missing-fact" | "unknown-fact" | "model-coverage" | "arena-coverage";

export type LearningGapRecord = {
  fingerprint: string;
  createdAt: string;
  source: "match" | "analysis";
  discipline: Discipline;
  topic: TopicId;
  reason: LearningGapReason;
  decisionStatus: string;
  validationLevel: "insufficient-coverage";
  rulebookVersion: string;
  ruleRefs: string[];
  factState: Record<string, ChoiceValue>;
  missingFactKeys: string[];
  unknownFactKeys: string[];
  nextDecisiveFact: string | null;
  appVersion: string;
};

const SENT_KEY = "polo-umpire-learning-gaps-sent-v1";
const MAX_SENT = 250;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function gapReason(
  discipline: Discipline,
  missing: string[],
  unknown: string[],
  decision: PlayDecision,
): LearningGapReason {
  if (discipline === "arena") return "arena-coverage";
  if (unknown.length) return "unknown-fact";
  if (missing.length && decision.status === "needs-info") return "missing-fact";
  return "model-coverage";
}

export function buildLearningGapRecord(args: {
  source: "match" | "analysis";
  discipline: Discipline;
  topic: TopicId;
  answers: Record<string, ChoiceValue>;
  decision: PlayDecision;
  audit: DecisionAudit;
  rulebookVersion: string;
  appVersion: string;
  language: Language;
  createdAt?: string;
}): LearningGapRecord | null {
  if (args.audit.level !== "insufficient-coverage") return null;

  const keys = relevantMatchKeys(args.topic, args.answers);
  const factState = Object.fromEntries(
    keys
      .filter((key) => args.answers[key] !== undefined && args.answers[key] !== "")
      .map((key) => [key, args.answers[key]]),
  ) as Record<string, ChoiceValue>;
  const missingFactKeys = keys.filter((key) => args.answers[key] === undefined || args.answers[key] === "");
  const unknownFactKeys = keys.filter((key) => args.answers[key] === "unknown");
  const next = nextDecisiveQuestion(
    args.topic,
    args.discipline,
    args.answers,
    args.language,
  );

  const signature = {
    discipline: args.discipline,
    topic: args.topic,
    reason: gapReason(args.discipline, missingFactKeys, unknownFactKeys, args.decision),
    decisionStatus: args.decision.status,
    ruleRefs: [...new Set(args.decision.references)].sort(),
    factState,
    missingFactKeys: [...missingFactKeys].sort(),
    unknownFactKeys: [...unknownFactKeys].sort(),
    nextDecisiveFact: next?.key ?? null,
    rulebookVersion: args.rulebookVersion,
  };

  return {
    fingerprint: "gap-" + stableHash(canonical(signature)),
    createdAt: args.createdAt ?? new Date().toISOString(),
    source: args.source,
    discipline: args.discipline,
    topic: args.topic,
    reason: signature.reason,
    decisionStatus: args.decision.status,
    validationLevel: "insufficient-coverage",
    rulebookVersion: args.rulebookVersion,
    ruleRefs: signature.ruleRefs,
    factState,
    missingFactKeys,
    unknownFactKeys,
    nextDecisiveFact: next?.key ?? null,
    appVersion: args.appVersion,
  };
}

function readSentFingerprints() {
  const raw = safeStorageGet(sessionStore(), SENT_KEY);
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function rememberFingerprint(fingerprint: string) {
  const current = readSentFingerprints().filter((item) => item !== fingerprint);
  safeStorageSet(sessionStore(), SENT_KEY, JSON.stringify([fingerprint, ...current].slice(0, MAX_SENT)));
}

export async function submitLearningGap(record: LearningGapRecord) {
  if (readSentFingerprints().includes(record.fingerprint)) return { delivered: false, duplicateLocal: true };

  try {
    const response = await fetch("/api/learning-gaps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
      cache: "no-store",
    });

    if (!response.ok) return { delivered: false, duplicateLocal: false };
    rememberFingerprint(record.fingerprint);
    return { delivered: true, duplicateLocal: false };
  } catch {
    return { delivered: false, duplicateLocal: false };
  }
}
