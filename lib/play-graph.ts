import { classify, topicDefs } from "./engine";
import { extractExplicitPlayFacts, type ExtractedPlayFact } from "./play-fact-extractor";
import type { Discipline, TopicId } from "./types";

export type PlayGraphNode = {
  topic: TopicId;
  score: number;
  firstEventIndex: number;
  evidence: string[];
  facts: ExtractedPlayFact[];
  rules: string[];
};

export type PlayGraphEdge = {
  from: TopicId;
  to: TopicId;
  kind: "sequence" | "overlap" | "context" | "related";
  ruleRefs: string[];
  explanationEn: string;
  explanationEs: string;
};

export type PlayGraph = {
  primaryTopic: TopicId | null;
  nodes: PlayGraphNode[];
  edges: PlayGraphEdge[];
  events: string[];
  multiFamily: boolean;
};

const topicOrder: TopicId[] = ["row", "dangerous", "blocking", "mallet", "conduct", "restart"];

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function splitPlayEvents(text: string) {
  const normalized = normalizeSpaces(text);
  if (!normalized) return [];

  const firstPass = normalized
    .split(/(?:[.!?;]+|\b(?:and then|then|after that|afterwards?|subsequently|y luego|y despues|luego|despues)\b)/i)
    .map(normalizeSpaces)
    .filter((item) => item.length >= 3);

  return firstPass.length ? firstPass : [normalized];
}

function strongTopicsForText(text: string) {
  const ranked = classify(text);
  const top = ranked[0]?.score ?? 0;
  if (top <= 0) return [];

  return ranked.filter((item, index) => {
    if (item.score <= 0) return false;
    if (item.score >= 3 && item.score >= top - 2) return true;
    return index === 0 && item.score >= 2;
  });
}

function interactionEdge(left: TopicId, right: TopicId): Omit<PlayGraphEdge, "from" | "to"> {
  const key = [left, right].sort().join(":");

  if (key === "dangerous:row") {
    return {
      kind: "overlap",
      ruleRefs: ["24", "26", "35"],
      explanationEn: "A ROW/crossing violation and Dangerous Riding can coexist. Resolve ROW entitlement/risk and dangerous-riding factors separately before penalty selection.",
      explanationEs: "Una infracción de ROW/cruce y Dangerous Riding pueden coexistir. Resolvé por separado el ROW/riesgo y los factores de Dangerous Riding antes de seleccionar la penalidad.",
    };
  }

  if (key === "blocking:restart") {
    return {
      kind: "context",
      ruleRefs: ["22", "26A", "35"],
      explanationEn: "Rule 26A has specific blocking restrictions during knock-ins, Penalty 5 and free hits after an out-of-bounds ball.",
      explanationEs: "Rule 26A tiene restricciones específicas de blocking durante knock-ins, Penalty 5 y free hits después de pelota afuera.",
    };
  }

  if (key === "blocking:dangerous") {
    return {
      kind: "overlap",
      ruleRefs: ["26", "26A", "35"],
      explanationEn: "Improper Blocking may also constitute Dangerous Riding, so the blocking elements and danger level must be checked separately.",
      explanationEs: "Improper Blocking también puede constituir Dangerous Riding, por lo que deben revisarse por separado los elementos del bloqueo y el nivel de peligro.",
    };
  }

  if (key === "conduct:mallet") {
    return {
      kind: "overlap",
      ruleRefs: ["28", "33", "35"],
      explanationEn: "Improper mallet use can create a Rule 28 foul and also a Rule 33 conduct issue, especially for deliberate, abusive or post-whistle actions.",
      explanationEs: "El uso indebido del mallet puede generar una falta bajo Rule 28 y también una cuestión de conducta bajo Rule 33, especialmente si es deliberada, abusiva o posterior al whistle.",
    };
  }

  if (key === "conduct:dangerous") {
    return {
      kind: "overlap",
      ruleRefs: ["26", "33", "34", "35"],
      explanationEn: "Dangerous Riding can also feed unsportsmanlike-conduct or repeated-foul escalation. Keep the riding violation and conduct escalation as separate checks.",
      explanationEs: "Dangerous Riding también puede alimentar escalamiento por conducta antideportiva o faltas reiteradas. Mantené separadas la infracción de riding y la escalada de conducta.",
    };
  }

  if (key === "conduct:restart") {
    return {
      kind: "sequence",
      ruleRefs: ["21", "22", "33", "35"],
      explanationEn: "Conduct after the whistle/dead ball is a separate event from the restart itself and may affect the sanction without changing why play stopped.",
      explanationEs: "La conducta después del whistle/dead ball es un evento separado de la reanudación y puede afectar la sanción sin cambiar por qué se detuvo el juego.",
    };
  }

  if (key === "dangerous:mallet") {
    return {
      kind: "overlap",
      ruleRefs: ["26", "28", "33", "35"],
      explanationEn: "A dangerous mallet action and dangerous riding are distinct foul paths. Evaluate the riding/contact facts separately from the stroke/hook facts.",
      explanationEs: "Una acción peligrosa con el mallet y Dangerous Riding son caminos de falta distintos. Evaluá por separado los hechos de riding/contacto y los del stroke/hook.",
    };
  }

  return {
    kind: "related",
    ruleRefs: [],
    explanationEn: "The description contains more than one rule family. Review each branch independently before combining the result.",
    explanationEs: "La descripción contiene más de una familia reglamentaria. Revisá cada rama de forma independiente antes de combinar el resultado.",
  };
}

export function buildPlayGraph(text: string, discipline: Discipline): PlayGraph {
  const events = splitPlayEvents(text);
  const aggregate = new Map<TopicId, {
    score: number;
    firstEventIndex: number;
    evidence: string[];
  }>();

  const candidates = events.length ? events : [text];

  candidates.forEach((event, index) => {
    for (const item of strongTopicsForText(event)) {
      const existing = aggregate.get(item.id);
      if (!existing) {
        aggregate.set(item.id, {
          score: item.score,
          firstEventIndex: index,
          evidence: [event],
        });
        continue;
      }

      existing.score = Math.max(existing.score, item.score) + 1;
      if (!existing.evidence.includes(event)) existing.evidence.push(event);
      existing.firstEventIndex = Math.min(existing.firstEventIndex, index);
    }
  });

  // Full-text scoring catches legitimate multi-family descriptions that remain
  // in a single grammatical clause.
  for (const item of strongTopicsForText(text)) {
    const existing = aggregate.get(item.id);
    if (!existing) {
      aggregate.set(item.id, {
        score: item.score,
        firstEventIndex: 0,
        evidence: [normalizeSpaces(text)],
      });
    } else {
      existing.score = Math.max(existing.score, item.score);
    }
  }

  const nodes = [...aggregate.entries()]
    .map(([topic, value]) => {
      const extracted = extractExplicitPlayFacts(text, topic);
      return {
        topic,
        score: value.score,
        firstEventIndex: value.firstEventIndex,
        evidence: value.evidence,
        facts: extracted.facts,
        rules: topicDefs[topic][discipline],
      } satisfies PlayGraphNode;
    })
    .sort((a, b) =>
      b.score - a.score
      || a.firstEventIndex - b.firstEventIndex
      || topicOrder.indexOf(a.topic) - topicOrder.indexOf(b.topic)
    );

  const edges: PlayGraphEdge[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const from = nodes[i].topic;
      const to = nodes[j].topic;
      edges.push({ from, to, ...interactionEdge(from, to) });
    }
  }

  const primaryTopic = nodes[0]?.topic ?? null;

  return {
    primaryTopic,
    nodes,
    edges,
    events,
    multiFamily: nodes.length > 1,
  };
}
