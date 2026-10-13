import type { Discipline, Rule, RuleDb } from "./types";
import { normalize, words } from "./engine";

export type RuleProvision = {
  id: string;
  discipline: Discipline;
  rule: string;
  ref: string;
  label: string;
  text: string;
  parentRef?: string;
  level: 0 | 1 | 2;
  pageStart: number;
  pageEnd?: number;
};

function escapeRegExp(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function coreText(rule: Rule) {
  const marker = new RegExp("\\n" + escapeRegExp(rule.rule) + "\\.\\s+[A-Z]");
  const match = marker.exec(rule.text);
  return match ? rule.text.slice(0, match.index).trim() : rule.text.trim();
}

function normalizeClauseText(value: string) {
  return value
    .replace(/\n\s*2026 UNITED STATES POLO ASSOCIATION®\s*\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRuleProvisions(rule: Rule): RuleProvision[] {
  const core = coreText(rule);
  const provisions: RuleProvision[] = [{
    id: rule.id + ":base",
    discipline: rule.discipline,
    rule: rule.rule,
    ref: rule.rule,
    label: "Rule " + rule.rule,
    text: normalizeClauseText(core),
    level: 0,
    pageStart: rule.pageStart,
    pageEnd: rule.pageEnd,
  }];

  const topMatches = [...core.matchAll(/(?:^|\n)([a-z])\.\s/gm)];
  if (topMatches.length) {
    for (let i = 0; i < topMatches.length; i++) {
      const match = topMatches[i];
      const letter = match[1];
      const start = (match.index ?? 0) + match[0].length;
      const end = i + 1 < topMatches.length ? (topMatches[i + 1].index ?? core.length) : core.length;
      const body = core.slice(start, end).trim();
      const ref = rule.rule + "." + letter;
      provisions.push({
        id: rule.id + ":" + ref,
        discipline: rule.discipline,
        rule: rule.rule,
        ref,
        label: "Rule " + ref,
        text: normalizeClauseText(body),
        parentRef: rule.rule,
        level: 1,
        pageStart: rule.pageStart,
        pageEnd: rule.pageEnd,
      });

      const nested = [...body.matchAll(/(?:^|\s)\((\d+)\)\s/gm)];
      for (let j = 0; j < nested.length; j++) {
        const child = nested[j];
        const number = child[1];
        const childStart = (child.index ?? 0) + child[0].length;
        const childEnd = j + 1 < nested.length ? (nested[j + 1].index ?? body.length) : body.length;
        const childRef = ref + "(" + number + ")";
        provisions.push({
          id: rule.id + ":" + childRef,
          discipline: rule.discipline,
          rule: rule.rule,
          ref: childRef,
          label: "Rule " + childRef,
          text: normalizeClauseText(body.slice(childStart, childEnd)),
          parentRef: ref,
          level: 2,
          pageStart: rule.pageStart,
          pageEnd: rule.pageEnd,
        });
      }
    }
  }

  if (/\bPENALTY\s+1\b/.test(core)) {
    const penalties = [...core.matchAll(/(?:^|\n)PENALTY\s+(\d+)\b/gm)];
    for (let i = 0; i < penalties.length; i++) {
      const match = penalties[i];
      const number = match[1];
      const start = (match.index ?? 0) + match[0].length;
      const end = i + 1 < penalties.length ? (penalties[i + 1].index ?? core.length) : core.length;
      provisions.push({
        id: rule.id + ":penalty-" + number,
        discipline: rule.discipline,
        rule: rule.rule,
        ref: rule.rule + " · Penalty " + number,
        label: "Rule " + rule.rule + " · Penalty " + number,
        text: normalizeClauseText(core.slice(start, end)),
        parentRef: rule.rule,
        level: 1,
        pageStart: rule.pageStart,
        pageEnd: rule.pageEnd,
      });
    }
  }

  return provisions;
}

export function getProvision(db: RuleDb, discipline: Discipline, ref: string) {
  const ruleNumber = ref.match(/^(\d+[A-Za-z]?)/)?.[1];
  if (!ruleNumber) return null;
  const rule = db.rules.find((item) => item.discipline === discipline && item.rule === ruleNumber);
  if (!rule) return null;
  return parseRuleProvisions(rule).find((item) => item.ref === ref) ?? null;
}

export function resolveProvisions(db: RuleDb, discipline: Discipline, refs: string[]) {
  const out: RuleProvision[] = [];
  for (const ref of refs) {
    const provision = getProvision(db, discipline, ref);
    if (provision && !out.some((item) => item.ref === provision.ref)) out.push(provision);
  }
  return out;
}

function provisionScore(provision: RuleProvision, query: string) {
  const q = normalize(query);
  const toks = words(query);
  let score = 0;
  if (q.includes(normalize(provision.ref)) || q.includes(normalize("rule " + provision.ref))) score += 30;
  const hay = normalize(provision.text);
  for (const token of toks) {
    if (hay.includes(token)) score += token.length > 6 ? 4 : 2;
  }
  return score;
}

export function bestProvisionsForRules(rules: Rule[], query: string, limit = 6) {
  return rules
    .flatMap(parseRuleProvisions)
    .filter((item) => item.level > 0)
    .map((provision) => ({ provision, score: provisionScore(provision, query) }))
    .filter((item) => item.score > 0)
    .sort((a,b) => b.score - a.score || b.provision.level - a.provision.level)
    .slice(0, limit)
    .map((item) => item.provision);
}
