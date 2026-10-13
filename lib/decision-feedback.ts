import type { Discipline, ResolverMode } from "./types";

export type FeedbackRating = "useful" | "needs-review";
export type FeedbackReason =
  | "clear"
  | "rules-helped"
  | "disagree-call"
  | "missing-fact"
  | "missing-rule"
  | "unclear"
  | "other";

export type FeedbackContext = {
  source: "match" | "analysis";
  discipline: Discipline;
  resolverMode: ResolverMode;
  topic?: string | null;
  scenario?: string | null;
  outcomeStatus: string;
  validationLevel?: string | null;
  headline: string;
  rulebookVersion: string;
  ruleRefs: string[];
  appVersion: string;
};

export type FeedbackRecord = {
  id: string;
  createdAt: string;
  rating: FeedbackRating;
  reason?: FeedbackReason;
  note?: string;
  context: FeedbackContext;
  delivery: "pending" | "sent";
};

const STORAGE_KEY = "polo-umpire-feedback-v1";
const MAX_LOCAL_RECORDS = 200;

function id() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "feedback-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

export function sanitizeFeedbackNote(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

export function buildFeedbackRecord(
  context: FeedbackContext,
  rating: FeedbackRating,
  reason?: FeedbackReason,
  note?: string,
  recordId = id(),
  createdAt = new Date().toISOString(),
): FeedbackRecord {
  return {
    id: recordId,
    createdAt,
    rating,
    reason,
    note: note ? sanitizeFeedbackNote(note) : undefined,
    context: {
      ...context,
      headline: context.headline.slice(0, 180),
      ruleRefs: [...new Set(context.ruleRefs)].slice(0, 20),
    },
    delivery: "pending",
  };
}

export function normalizeFeedbackRecord(value: unknown): FeedbackRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<FeedbackRecord>;
  if (typeof item.id !== "string" || typeof item.createdAt !== "string") return null;
  if (item.rating !== "useful" && item.rating !== "needs-review") return null;
  if (!item.context || typeof item.context !== "object") return null;

  const context = item.context as Partial<FeedbackContext>;
  if (context.source !== "match" && context.source !== "analysis") return null;
  if (context.discipline !== "outdoor" && context.discipline !== "arena") return null;
  if (context.resolverMode !== "play" && context.resolverMode !== "situation") return null;
  if (typeof context.outcomeStatus !== "string" || typeof context.headline !== "string") return null;
  if (typeof context.rulebookVersion !== "string" || typeof context.appVersion !== "string") return null;

  return {
    id: item.id,
    createdAt: item.createdAt,
    rating: item.rating,
    reason: item.reason,
    note: typeof item.note === "string" ? sanitizeFeedbackNote(item.note) : undefined,
    context: {
      source: context.source,
      discipline: context.discipline,
      resolverMode: context.resolverMode,
      topic: typeof context.topic === "string" ? context.topic : null,
      scenario: typeof context.scenario === "string" ? context.scenario : null,
      outcomeStatus: context.outcomeStatus.slice(0, 60),
      validationLevel: typeof context.validationLevel === "string" ? context.validationLevel.slice(0, 80) : null,
      headline: context.headline.slice(0, 180),
      rulebookVersion: context.rulebookVersion.slice(0, 40),
      ruleRefs: Array.isArray(context.ruleRefs) ? context.ruleRefs.filter((ref): ref is string => typeof ref === "string").slice(0, 20) : [],
      appVersion: context.appVersion.slice(0, 40),
    },
    delivery: item.delivery === "sent" ? "sent" : "pending",
  };
}

export function readFeedbackRecords(): FeedbackRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeFeedbackRecord).filter((item): item is FeedbackRecord => Boolean(item));
  } catch {
    return [];
  }
}

export function writeFeedbackRecords(records: FeedbackRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_LOCAL_RECORDS)));
}

export function saveFeedbackRecord(record: FeedbackRecord) {
  const existing = readFeedbackRecords().filter((item) => item.id !== record.id);
  writeFeedbackRecords([record, ...existing]);
  return record;
}

async function postFeedback(record: FeedbackRecord) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("feedback-submit-failed");
}

export async function submitFeedbackRecord(record: FeedbackRecord) {
  saveFeedbackRecord(record);
  if (typeof navigator !== "undefined" && !navigator.onLine) return { delivered: false };

  try {
    await postFeedback(record);
    const updated = readFeedbackRecords().map((item) => item.id === record.id ? { ...item, delivery: "sent" as const } : item);
    writeFeedbackRecords(updated);
    return { delivered: true };
  } catch {
    return { delivered: false };
  }
}

export async function flushPendingFeedback() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const records = readFeedbackRecords();
  let delivered = 0;
  const next: FeedbackRecord[] = [];

  for (const record of records) {
    if (record.delivery === "sent") {
      next.push(record);
      continue;
    }
    try {
      await postFeedback(record);
      next.push({ ...record, delivery: "sent" });
      delivered += 1;
    } catch {
      next.push(record);
    }
  }

  writeFeedbackRecords(next);
  return delivered;
}
