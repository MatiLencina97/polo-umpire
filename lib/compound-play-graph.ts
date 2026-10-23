import { classify, classifyTopic } from "./engine";
import { extractExplicitPlayFacts, type ExtractedPlayFact } from "./play-fact-extractor";
import { decidePlay, type PlayDecision } from "./play-decision";
import type { Discipline, Language, TopicId } from "./types";

export type CompoundPlayNode = {
  topic: TopicId;
  label: string;
  score: number;
  primary: boolean;
  facts: ExtractedPlayFact[];
  answers: Record<string, string>;
  decision: PlayDecision;
};

export type CompoundPlayRelationKind = "overlay" | "related" | "parallel";

export type CompoundPlayRelation = {
  from: TopicId;
  to: TopicId;
  kind: CompoundPlayRelationKind;
  summaryEn: string;
  summaryEs: string;
  ruleRefs: string[];
};

export type CompoundPlayGraph = {
  compound: boolean;
  primaryTopic: TopicId | null;
  nodes: CompoundPlayNode[];
  relations: CompoundPlayRelation[];
  penaltySelectionRef: string;
};

const pairKey = (left: TopicId, right: TopicId) => [left, right].sort().join(":");

function relationFor(
  left: TopicId,
  right: TopicId,
  discipline: Discipline,
): CompoundPlayRelation {
  const key = pairKey(left, right);
  const penaltySelectionRef = discipline === "outdoor" ? "35" : "10";

  if (key === "blocking:dangerous") {
    return {
      from: left,
      to: right,
      kind: "related",
      summaryEn: "Improper Blocking and Dangerous Riding must be evaluated separately. Outdoor Rule 26A expressly says improper blocking may or may not also constitute Dangerous Riding.",
      summaryEs: "Improper Blocking y Dangerous Riding deben evaluarse por separado. Outdoor Rule 26A dice expresamente que un bloqueo indebido puede o no constituir también Dangerous Riding.",
      ruleRefs: discipline === "outdoor" ? ["26A", "26", penaltySelectionRef] : ["13", penaltySelectionRef],
    };
  }

  if (left === "conduct" || right === "conduct") {
    const other = left === "conduct" ? right : left;
    const conductRef = discipline === "outdoor" ? "33" : "14";
    return {
      from: other,
      to: "conduct",
      kind: "overlay",
      summaryEn: "The underlying play and the conduct issue remain separate rule branches. Resolve the play first, then review any disciplinary overlay without automatically stacking penalties.",
      summaryEs: "La jugada de base y la conducta siguen siendo ramas reglamentarias separadas. Resolvé primero la jugada y después revisá la consecuencia disciplinaria, sin sumar penalidades automáticamente.",
      ruleRefs: [conductRef, penaltySelectionRef],
    };
  }

  if (left === "restart" || right === "restart") {
    const restartRef = discipline === "outdoor" ? "22" : "16";
    return {
      from: left,
      to: right,
      kind: "related",
      summaryEn: "The stoppage/restart context can change how the other event is administered. Keep the restart procedure separate from the underlying foul analysis.",
      summaryEs: "El contexto de detención/reanudación puede cambiar cómo se administra el otro evento. Mantené separado el procedimiento de restart del análisis de la falta de base.",
      ruleRefs: [restartRef, penaltySelectionRef],
    };
  }

  if (key === "dangerous:row") {
    return {
      from: left,
      to: right,
      kind: "parallel",
      summaryEn: "A Right of Way infringement and Dangerous Riding can coexist, but neither should be inferred from the other. Evaluate entitlement/risk and dangerous contact independently.",
      summaryEs: "Una infracción de Right of Way y Dangerous Riding pueden coexistir, pero ninguna debe inferirse de la otra. Evaluá de forma independiente el ROW/riesgo y el contacto peligroso.",
      ruleRefs: discipline === "outdoor" ? ["24", "26", penaltySelectionRef] : ["12", "13", penaltySelectionRef],
    };
  }

  return {
    from: left,
    to: right,
    kind: "parallel",
    summaryEn: "More than one rule family has independent support in the description. Keep both branches open until their decisive facts are resolved.",
    summaryEs: "Más de una familia reglamentaria tiene respaldo independiente en la descripción. Mantené ambas ramas abiertas hasta resolver sus datos decisivos.",
    ruleRefs: [penaltySelectionRef],
  };
}

function isStrongCandidate(
  topic: TopicId,
  score: number,
  facts: ExtractedPlayFact[],
) {
  if (score >= 4) return true;
  return score > 0 && facts.length > 0;
}

export function buildCompoundPlayGraph(
  text: string,
  discipline: Discipline,
  language: Language,
): CompoundPlayGraph {
  const ranked = classify(text);
  const primaryDetection = classifyTopic(text);

  const enriched = ranked.map((item) => {
    const extracted = extractExplicitPlayFacts(text, item.id);
    return {
      ...item,
      facts: extracted.facts,
      answers: extracted.answers,
    };
  });

  const candidates = enriched
    .filter((item) => isStrongCandidate(item.id, item.score, item.facts))
    .slice(0, 4);

  const primaryTopic = primaryDetection.topic
    ?? (candidates.length === 1 ? candidates[0].id : null);

  const nodes = candidates.map<CompoundPlayNode>((item) => ({
    topic: item.id,
    label: item.label,
    score: item.score,
    primary: item.id === primaryTopic,
    facts: item.facts,
    answers: item.answers,
    decision: decidePlay(item.id, discipline, item.answers, language),
  }));

  const relations: CompoundPlayRelation[] = [];
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      relations.push(relationFor(nodes[leftIndex].topic, nodes[rightIndex].topic, discipline));
    }
  }

  return {
    compound: nodes.length > 1,
    primaryTopic,
    nodes,
    relations,
    penaltySelectionRef: discipline === "outdoor" ? "35" : "10",
  };
}
