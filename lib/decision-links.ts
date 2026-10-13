import type { ChoiceValue, Discipline, ExternalResourceDb, Language, RuleDb, TopicId } from "./types";
import type { CrossRuleCheck } from "./cross-rule";
import type { PlayDecision } from "./play-decision";
import { getProvision, resolveProvisions, type RuleProvision } from "./subarticles";
import { externalMatchesForLabels, type ExternalSectionMatch } from "./external-resources";

export type DecisionRuleLink = {
  provision: RuleProvision;
  role: string;
};

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function t(language: Language, en: string, es: string) {
  return language === "en" ? en : es;
}

function add(out: DecisionRuleLink[], db: RuleDb, discipline: Discipline, ref: string, role: string) {
  const provision = getProvision(db, discipline, ref);
  if (provision) out.push({ provision, role });
}

export function playDecisionRuleTrail(args: {
  db: RuleDb;
  discipline: Discipline;
  topic: TopicId;
  answers: Record<string, ChoiceValue>;
  decision: PlayDecision;
  language: Language;
}) {
  const { db, discipline, topic, answers, decision, language } = args;
  const out: DecisionRuleLink[] = resolveProvisions(db, discipline, decision.references).map((provision) => ({
    provision,
    role: t(language, "Directly applied by the decision branch", "Aplicada directamente por la rama de decisión"),
  }));

  if (discipline === "outdoor") {
    if (topic === "row") {
      add(out, db, discipline, "23", t(language, "Defines the Line of the Ball used to analyze ROW", "Define la Line of the Ball usada para analizar el ROW"));
      add(out, db, discipline, "24.b", t(language, "Explains that ROW is not the same as the Line of the Ball", "Aclara que ROW no es lo mismo que la Line of the Ball"));
      if (answers.rowEntitled === "yes" || answers.rowEntitled === "no") {
        for (const ref of ["24.e","24.f","24.g","24.h"]) {
          add(out, db, discipline, ref, t(language, "Possible source of ROW entitlement — review the physical relationship of the players", "Posible fuente de titularidad del ROW — revisá la relación física entre los jugadores"));
        }
      }
      if (answers.lineChanged === "yes") {
        add(out, db, discipline, "24.d", t(language, "Controls clearance after a Line of the Ball change", "Controla el despeje luego de un cambio de Line of the Ball"));
      }
    }

    if (topic === "dangerous") {
      add(out, db, discipline, "26.a", t(language, "Core Dangerous Riding factors and ride-off standard", "Factores centrales y estándar del ride-off peligroso"));
      add(out, db, discipline, "26.e", t(language, "Covers careless or deliberate acts that unnecessarily endanger a person or mount", "Cubre actos descuidados o deliberados que ponen innecesariamente en peligro a una persona o caballo"));
      if (decision.status === "foul") add(out, db, discipline, "35.b", t(language, "Penalty selection remains an Umpire judgment", "La selección de penalidad sigue siendo juicio del Umpire"));
    }

    if (topic === "blocking") {
      add(out, db, discipline, "26A", t(language, "Defines Improper Blocking and the situations in which it applies", "Define Improper Blocking y las situaciones en las que aplica"));
      if (decision.status === "foul") add(out, db, discipline, "35.b", t(language, "Penalty selection factors", "Factores para seleccionar la penalidad"));
    }

    if (topic === "mallet") {
      add(out, db, discipline, "28.a", t(language, "Hook position and timing requirements", "Requisitos de posición y timing del hook"));
      add(out, db, discipline, "28.d", t(language, "Responsibility for dangerous or abusive mallet use", "Responsabilidad por uso peligroso o abusivo del mallet"));
      if (answers.strokeDanger === "yes") add(out, db, discipline, "26.h", t(language, "Relevant when a player rides into an established stroke", "Relevante cuando un jugador entra en un stroke ya establecido"));
      if (decision.status === "foul") add(out, db, discipline, "35.b", t(language, "Penalty selection remains discretionary", "La selección de penalidad sigue siendo discrecional"));
    }

    if (topic === "conduct") {
      add(out, db, discipline, "33.a", t(language, "Defines prohibited conduct", "Define la conducta prohibida"));
      add(out, db, discipline, "34", t(language, "Escalation / repeat-offense consequences", "Consecuencias de escalamiento / reiteración"));
      add(out, db, discipline, "35", t(language, "Penalty-selection framework", "Marco de selección de penalidades"));
    }

    if (topic === "restart") {
      for (const ref of ["20","21","22","36"]) {
        add(out, db, discipline, ref, t(language, "Restart / dead-ball procedure that can control the ruling", "Procedimiento de reanudación / dead-ball que puede controlar la decisión"));
      }
    }
  }

  return unique(out, (item) => item.provision.ref);
}

function refsFromCrossRuleSource(source: string) {
  const exact = source.match(/(?:Outdoor|Arena) Rule\s+([0-9]+[A-Za-z]?(?:\.[a-z](?:\(\d+\))?)?)(?:-([a-z]))?/i);
  if (!exact) return [];
  const first = exact[1];
  const endLetter = exact[2];
  if (!endLetter) return [first];

  const m = first.match(/^(\d+[A-Za-z]?)\.([a-z])$/i);
  if (!m) return [first];
  const startCode = m[2].toLowerCase().charCodeAt(0);
  const endCode = endLetter.toLowerCase().charCodeAt(0);
  const refs: string[] = [];
  for (let code = startCode; code <= endCode; code += 1) refs.push(m[1] + "." + String.fromCharCode(code));
  return refs;
}

export function substitutionDecisionRuleTrail(args: {
  db: RuleDb;
  discipline: Discipline;
  checks: CrossRuleCheck[];
  language: Language;
}) {
  const { db, discipline, checks, language } = args;
  const out: DecisionRuleLink[] = [];

  for (const check of checks) {
    for (const ref of refsFromCrossRuleSource(check.source)) {
      add(out, db, discipline, ref, check.title + " — " + check.summary);
    }
  }

  if (discipline === "outdoor") {
    for (const [ref,en,es] of [
      ["3", "Substitution timing, aggregate handicap and special substitution rules", "Timing de sustitución, handicap agregado y reglas especiales"],
      ["2", "Player eligibility and individual handicap restrictions", "Elegibilidad del jugador y restricciones de handicap individual"],
      ["1.f", "American Rule and sponsor structure", "American Rule y estructura del sponsor"],
    ] as const) add(out, db, discipline, ref, t(language,en,es));
  }

  return unique(out, (item) => item.provision.ref);
}

export function substitutionExternalTrail(args: {
  db: ExternalResourceDb | null;
  query: string;
  language: Language;
}) {
  const { db, query } = args;
  if (!db) return [] as ExternalSectionMatch[];
  return externalMatchesForLabels(
    db,
    ["Tournament Conditions", "Constitution / By-Laws"],
    query,
    6,
  );
}
