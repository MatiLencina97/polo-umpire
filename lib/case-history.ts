import type { Discipline, Language, ResolverMode } from "./types";

export type CaseStatus =
  | "foul"
  | "no-foul"
  | "needs-info"
  | "procedure"
  | "conflict"
  | "clear"
  | "reference";

export type CaseFactSnapshot = {
  label: string;
  value: string;
};

export type CaseReferenceSnapshot = {
  kind: "rule" | "external";
  label: string;
  page?: string;
  excerpt?: string;
  resourceId?: string;
  sectionId?: string;
};

export type CaseOutcomeSnapshot = {
  status: CaseStatus;
  headline: string;
  summary: string;
};

export type CaseRecord = {
  id: string;
  createdAt: string;
  source: "match" | "analysis";
  resolverMode: ResolverMode;
  discipline: Discipline;
  language: Language;
  situation: string;
  eventContext?: string;
  rulebookVersion: string;
  outcome: CaseOutcomeSnapshot;
  facts: CaseFactSnapshot[];
  references: CaseReferenceSnapshot[];
};

export type CaseDraft = Omit<CaseRecord, "id" | "createdAt">;

export const CASE_HISTORY_KEY = "umpire-polo-case-history-v1";
export const CASE_HISTORY_EVENT = "umpire-polo-case-history-changed";
export const MAX_CASE_HISTORY = 250;

export function buildCaseRecord(draft: CaseDraft, id: string, createdAt: string): CaseRecord {
  return {
    ...draft,
    id,
    createdAt,
    situation: draft.situation.trim(),
    facts: draft.facts.filter((fact) => fact.label.trim() && fact.value.trim()),
    references: draft.references.filter((ref, index, array) =>
      ref.label.trim() && array.findIndex((other) =>
        other.kind === ref.kind &&
        other.label === ref.label &&
        other.resourceId === ref.resourceId &&
        other.sectionId === ref.sectionId
      ) === index
    ),
  };
}

export function normalizeCaseHistory(value: unknown): CaseRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is CaseRecord => {
      if (!item || typeof item !== "object") return false;
      const record = item as Partial<CaseRecord>;
      return typeof record.id === "string"
        && typeof record.createdAt === "string"
        && (record.source === "match" || record.source === "analysis")
        && (record.resolverMode === "play" || record.resolverMode === "situation")
        && (record.discipline === "outdoor" || record.discipline === "arena")
        && typeof record.situation === "string"
        && typeof record.rulebookVersion === "string"
        && Boolean(record.outcome && typeof record.outcome.headline === "string")
        && Array.isArray(record.facts)
        && Array.isArray(record.references);
    })
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_CASE_HISTORY);
}

export function mergeCaseRecord(history: CaseRecord[], record: CaseRecord) {
  return [record, ...history.filter((item) => item.id !== record.id)]
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_CASE_HISTORY);
}

function newCaseId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "case-" + Date.now() + "-" + Math.random().toString(36).slice(2,9);
}

export function loadCaseHistory(): CaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeCaseHistory(JSON.parse(window.localStorage.getItem(CASE_HISTORY_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeCaseHistory(history: CaseRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CASE_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event(CASE_HISTORY_EVENT));
}

export function saveCaseRecord(draft: CaseDraft) {
  const record = buildCaseRecord(draft, newCaseId(), new Date().toISOString());
  writeCaseHistory(mergeCaseRecord(loadCaseHistory(), record));
  return record;
}

export function deleteCaseRecord(id: string) {
  writeCaseHistory(loadCaseHistory().filter((item) => item.id !== id));
}

export function clearCaseHistory() {
  writeCaseHistory([]);
}
