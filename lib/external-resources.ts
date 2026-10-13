import type { ExternalResource, ExternalResourceDb, ExternalSection } from "./types";

export type ExternalSectionMatch = {
  resource: ExternalResource;
  section: ExternalSection;
  score: number;
  requestedLabel?: string;
};

const normalize = (value = "") =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/®/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const stop = new Set([
  "the","and","for","with","from","that","this","what","when","where","which","into","under","rule","rules",
  "a","an","of","to","in","on","is","are","be","or","as","by","at","it","its",
  "el","la","los","las","un","una","de","del","y","o","en","para","por","con","que","es","son",
]);

const tokens = (value = "") =>
  [...new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !stop.has(token)))];

function resourceAliasScore(resource: ExternalResource, label: string) {
  const target = normalize(label);
  const aliases = [resource.title, resource.shortTitle, ...(resource.aliases ?? [])].map(normalize);
  let score = 0;
  for (const alias of aliases) {
    if (!alias || !target) continue;
    if (alias === target) score = Math.max(score, 80);
    else if (alias.includes(target) || target.includes(alias)) score = Math.max(score, 55);
    else {
      const wanted = tokens(target);
      const have = new Set(tokens(alias));
      const overlap = wanted.filter((token) => have.has(token)).length;
      if (overlap) score = Math.max(score, overlap * 14);
    }
  }
  return score;
}

function scoreSection(resource: ExternalResource, section: ExternalSection, query: string) {
  const q = normalize(query);
  const qTokens = tokens(query);
  if (!qTokens.length && !q) return 1;
  const title = normalize(section.title + " " + section.ref);
  const resourceHay = normalize([
    resource.title, resource.shortTitle, ...(resource.aliases ?? []),
    ...(resource.keywords ?? []), ...(section.keywords ?? []),
  ].join(" "));
  const body = normalize(section.text);
  let score = 0;
  if (q && title.includes(q)) score += 55;
  if (q && resourceHay.includes(q)) score += 28;
  for (const token of qTokens) {
    if (title.includes(token)) score += token.length > 6 ? 10 : 7;
    if (resourceHay.includes(token)) score += token.length > 6 ? 6 : 4;
    if (body.includes(token)) score += token.length > 7 ? 4 : 2;
  }
  for (const phrase of ["affiliate player member","host country","american player","sport related conduct","equine medication","instant replay","alternative format","tournament condition","player eligibility"]) {
    if (q.includes(phrase) && body.includes(phrase)) score += 24;
  }
  return score;
}

export function searchExternalSections(db: ExternalResourceDb | null, query: string, limit = 10): ExternalSectionMatch[] {
  if (!db || !query.trim()) return [];
  return db.resources
    .flatMap((resource) => resource.sections.map((section) => ({ resource, section, score: scoreSection(resource, section, query) })))
    .filter((item) => item.score > 0)
    .sort((a,b) => b.score - a.score || a.section.pageStart - b.section.pageStart)
    .slice(0, limit);
}

export function externalMatchesForLabels(db: ExternalResourceDb | null, labels: string[], query: string, limit = 8): ExternalSectionMatch[] {
  if (!db || !labels.length) return [];
  const out: ExternalSectionMatch[] = [];
  for (const label of labels) {
    let resources = db.resources
      .map((resource) => ({ resource, aliasScore: resourceAliasScore(resource, label) }))
      .filter((item) => item.aliasScore > 0)
      .sort((a,b) => b.aliasScore - a.aliasScore);
    if (!resources.length) {
      for (const hit of searchExternalSections(db, label + " " + query, 2)) out.push({ ...hit, requestedLabel: label });
      continue;
    }
    if (!/[\/]/.test(label)) resources = resources.slice(0,1);
    for (const {resource, aliasScore} of resources.slice(0,2)) {
      const ranked = resource.sections
        .map((section) => ({ resource, section, score: aliasScore + scoreSection(resource, section, query), requestedLabel: label }))
        .sort((a,b) => b.score - a.score || a.section.pageStart - b.section.pageStart);
      if (ranked[0]) out.push(ranked[0]);
    }
  }
  const seen = new Set<string>();
  return out.sort((a,b) => b.score - a.score).filter((item) => {
    const key = item.resource.id + "::" + item.section.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export function externalPageLabel(section: ExternalSection | ExternalResource) {
  return section.pageEnd && section.pageEnd !== section.pageStart
    ? section.pageStart + "–" + section.pageEnd
    : String(section.pageStart);
}
