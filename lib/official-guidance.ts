import type { Rule, RuleDb } from "./types";

export type OfficialGuidanceKind = "interpretation" | "example";

export type OfficialGuidanceItem = {
  id: string;
  discipline: Rule["discipline"];
  rule: string;
  title: string;
  kind: OfficialGuidanceKind;
  text: string;
  pageStart: number;
  pageEnd?: number;
};

function markerKind(marker: string): OfficialGuidanceKind {
  return marker.startsWith("INTERPRETATION") ? "interpretation" : "example";
}

export function extractOfficialGuidanceFromRule(rule: Rule): OfficialGuidanceItem[] {
  const matches = [...rule.text.matchAll(/INTERPRETATIONS?:|EXAMPLES?:/g)];
  const items: OfficialGuidanceItem[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const marker = match[0];
    const start = (match.index ?? 0) + marker.length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? rule.text.length) : rule.text.length;
    const raw = rule.text.slice(start, end).trim();
    if (!raw) continue;

    items.push({
      id: [rule.discipline, rule.rule, markerKind(marker), index + 1].join(":"),
      discipline: rule.discipline,
      rule: rule.rule,
      title: rule.title,
      kind: markerKind(marker),
      text: raw,
      pageStart: rule.pageStart,
      pageEnd: rule.pageEnd,
    });
  }

  return items;
}

export function extractOfficialGuidance(db: RuleDb) {
  return db.rules.flatMap(extractOfficialGuidanceFromRule);
}

export function officialGuidanceMetrics(db: RuleDb) {
  const items = extractOfficialGuidance(db);
  const examples = items.filter((item) => item.kind === "example").length;
  const interpretations = items.filter((item) => item.kind === "interpretation").length;
  const outdoor = items.filter((item) => item.discipline === "outdoor").length;
  const arena = items.filter((item) => item.discipline === "arena").length;

  return {
    total: items.length,
    examples,
    interpretations,
    outdoor,
    arena,
    rulesWithGuidance: new Set(items.map((item) => item.discipline + ":" + item.rule)).size,
  };
}
