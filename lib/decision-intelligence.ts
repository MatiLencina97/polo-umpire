import { questions } from "./engine";
import { relevantMatchKeys } from "./match-flow";
import { decidePlay, type PlayDecision } from "./play-decision";
import type { ChoiceValue, Discipline, Language, TopicId } from "./types";

export type QuestionOutcome = {
  value: ChoiceValue;
  status: PlayDecision["status"];
  headline: string;
  references: string[];
};

export type QuestionImpact = {
  topic: TopicId;
  key: string;
  score: number;
  changesStatus: boolean;
  changesControllingRules: boolean;
  canResolveBranch: boolean;
  outcomes: QuestionOutcome[];
  reasonEn: string;
  reasonEs: string;
};

function referenceSignature(decision: PlayDecision) {
  return [...new Set(decision.references)].sort().join("|");
}

function outcomeFingerprint(decision: PlayDecision) {
  return [
    decision.status,
    decision.headline,
    referenceSignature(decision),
  ].join("::");
}

function concreteOptions(topic: TopicId, key: string) {
  const question = questions[topic].find((item) => item.key === key);
  if (!question) return [];
  return question.options
    .map(([value]) => value)
    .filter((value) => value !== "unknown" && value !== "");
}

function isAnswered(value?: ChoiceValue) {
  return value !== undefined && value !== "" && value !== "unknown";
}

export function rankDecisiveQuestions(
  topic: TopicId,
  discipline: Discipline,
  answers: Record<string, ChoiceValue>,
  language: Language,
) {
  if (discipline === "arena") {
    // The current Arena decision engine intentionally does not collapse every
    // variation to a deterministic call yet, so counterfactual scores would
    // create false precision. Keep the ordinary guided flow there.
    return [] as QuestionImpact[];
  }

  const currentDecision = decidePlay(topic, discipline, answers, language);
  const relevant = new Set(relevantMatchKeys(topic, answers));
  const candidates = questions[topic].filter(
    (question) => relevant.has(question.key) && !isAnswered(answers[question.key]),
  );

  return candidates
    .map((question) => {
      const options = concreteOptions(topic, question.key);
      const outcomes = options.map((value) => {
        const decision = decidePlay(
          topic,
          discipline,
          { ...answers, [question.key]: value },
          language,
        );
        return {
          value,
          status: decision.status,
          headline: decision.headline,
          references: decision.references,
        } satisfies QuestionOutcome;
      });

      const statuses = new Set(outcomes.map((item) => item.status));
      const refs = new Set(outcomes.map((item) => [...new Set(item.references)].sort().join("|")));
      const headlines = new Set(outcomes.map((item) => item.headline));
      const fingerprints = new Set(outcomes.map((item) => [
        item.status,
        item.headline,
        [...new Set(item.references)].sort().join("|"),
      ].join("::")));
      const currentFingerprint = outcomeFingerprint(currentDecision);
      const changesFromCurrent = outcomes.filter((item) => [
        item.status,
        item.headline,
        [...new Set(item.references)].sort().join("|"),
      ].join("::") !== currentFingerprint).length;
      const resolvedOutcomes = outcomes.filter((item) => item.status !== "needs-info").length;

      const changesStatus = statuses.size > 1;
      const changesControllingRules = refs.size > 1;
      const canResolveBranch = currentDecision.status === "needs-info" && resolvedOutcomes > 0;

      let score = 0;
      score += Math.max(0, statuses.size - 1) * 12;
      score += Math.max(0, refs.size - 1) * 5;
      score += Math.max(0, headlines.size - 1) * 3;
      score += Math.max(0, fingerprints.size - 1) * 2;
      score += resolvedOutcomes * 3;
      score += changesFromCurrent;
      if (canResolveBranch) score += 6;

      let reasonEn = "This fact helps narrow the branch.";
      let reasonEs = "Este dato ayuda a acotar la rama.";
      if (changesStatus) {
        reasonEn = "This fact can change the ruling status, so it is the most decision-sensitive question now.";
        reasonEs = "Este dato puede cambiar el estado de la decisión, por eso es la pregunta más sensible en este momento.";
      } else if (canResolveBranch) {
        reasonEn = "One or more answers to this fact can close the branch instead of leaving it as needs-info.";
        reasonEs = "Una o más respuestas a este dato pueden cerrar la rama en vez de dejarla como needs-info.";
      } else if (changesControllingRules) {
        reasonEn = "This fact can change which Rulebook provisions control the branch.";
        reasonEs = "Este dato puede cambiar qué disposiciones del Rulebook controlan la rama.";
      }

      return {
        topic,
        key: question.key,
        score,
        changesStatus,
        changesControllingRules,
        canResolveBranch,
        outcomes,
        reasonEn,
        reasonEs,
      } satisfies QuestionImpact;
    })
    .filter((item) => item.score > 0)
    .sort((a, b) =>
      b.score - a.score
      || Number(b.changesStatus) - Number(a.changesStatus)
      || Number(b.canResolveBranch) - Number(a.canResolveBranch)
      || a.key.localeCompare(b.key)
    );
}

export function nextDecisiveQuestion(
  topic: TopicId,
  discipline: Discipline,
  answers: Record<string, ChoiceValue>,
  language: Language,
) {
  return rankDecisiveQuestions(topic, discipline, answers, language)[0] ?? null;
}
