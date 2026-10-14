import type { ChoiceValue, TopicId } from "./types";

const fullKeys: Record<TopicId, string[]> = {
  row: ["rowEntitled", "risk", "lineChanged", "clearanceTime"],
  dangerous: ["balance", "speedAngle", "blind"],
  blocking: ["marking", "restartBlock", "slow"],
  mallet: ["strokeDanger", "strokeEnteredByOpponent", "hookPosition", "hookTiming", "hookClear"],
  conduct: ["conductMatches", "repeat"],
  restart: ["early", "dead", "restartType"],
};

const topicAnswerKeys: Record<TopicId, string[]> = {
  row: ["rowEntitled", "risk", "lineChanged", "clearanceTime", "parallel"],
  dangerous: ["balance", "speedAngle", "blind"],
  blocking: ["marking", "restartBlock", "slow"],
  mallet: ["strokeDanger", "strokeEnteredByOpponent", "hookPosition", "hookTiming", "hookClear"],
  conduct: ["conductMatches", "deliberate", "repeat"],
  restart: ["early", "dead", "restartType"],
};

export function relevantMatchKeys(topic: TopicId, answers: Record<string, ChoiceValue>) {
  if (topic === "row") {
    const keys = ["rowEntitled"];
    if (answers.rowEntitled !== "yes") return keys;

    keys.push("risk");
    if (answers.risk !== "yes") return keys;

    keys.push("lineChanged");
    if (answers.lineChanged === "yes") keys.push("clearanceTime");
    return keys;
  }

  if (topic === "dangerous") {
    const keys = ["balance"];
    // Rule 26.a expressly states that a mount knocked off balance means
    // a dangerous ride-off has occurred. Unknown balance is also decisive
    // for the quick flow because later indicators cannot close that missing fact.
    if (answers.balance !== "no") return keys;

    keys.push("speedAngle");
    if (answers.speedAngle !== "no") return keys;

    keys.push("blind");
    return keys;
  }

  if (topic === "blocking") {
    const keys = ["marking"];
    if (answers.marking !== "yes") return keys;

    keys.push("restartBlock");
    if (answers.restartBlock === "no") keys.push("slow");
    return keys;
  }

  if (topic === "mallet") {
    const keys = ["strokeDanger"];
    if (answers.strokeDanger === "yes") {
      keys.push("strokeEnteredByOpponent");
      return keys;
    }
    if (answers.strokeDanger !== "no") return keys;

    keys.push("hookPosition");
    if (answers.hookPosition !== "yes") return keys;

    keys.push("hookTiming");
    if (answers.hookTiming !== "yes") return keys;

    keys.push("hookClear");
    return keys;
  }

  if (topic === "conduct") {
    const keys = ["conductMatches"];
    // Repetition changes escalation/card consequences, so keep it in the
    // fast flow after the conduct itself has been identified.
    if (answers.conductMatches === "yes") keys.push("repeat");
    return keys;
  }

  const keys = ["early"];
  if (answers.early === "yes") {
    keys.push("restartType");
    return keys;
  }
  if (answers.early !== "no") return keys;

  keys.push("dead");
  if (answers.dead === "yes") keys.push("restartType");
  return keys;
}

export function isMatchAnswerPresent(value?: ChoiceValue) {
  return value !== undefined && value !== "";
}

function preserveNonFlowMetadata(
  topic: TopicId,
  answers: Record<string, ChoiceValue>,
) {
  const flowKeys = new Set(topicAnswerKeys[topic]);
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => !flowKeys.has(key)),
  ) as Record<string, ChoiceValue>;
}

export function applyMatchAnswer(
  topic: TopicId,
  answers: Record<string, ChoiceValue>,
  key: string,
  value: ChoiceValue,
) {
  if (answers[key] === value) return { ...answers };

  const path = relevantMatchKeys(topic, answers);
  const pivot = path.indexOf(key);
  const next = preserveNonFlowMetadata(topic, answers);

  if (pivot >= 0) {
    for (const previousKey of path.slice(0, pivot)) {
      if (isMatchAnswerPresent(answers[previousKey])) next[previousKey] = answers[previousKey];
    }
  }

  next[key] = value;
  if (key === "rowEntitled") delete next.rowEntitlementDerived;
  return next;
}

export function rewindLastMatchAnswer(
  topic: TopicId,
  answers: Record<string, ChoiceValue>,
) {
  const path = relevantMatchKeys(topic, answers);
  const lastAnswered = [...path].reverse().find((key) => isMatchAnswerPresent(answers[key]));
  if (!lastAnswered) return { ...answers };

  const pivot = path.indexOf(lastAnswered);
  const next = preserveNonFlowMetadata(topic, answers);
  for (const previousKey of path.slice(0, pivot)) {
    if (isMatchAnswerPresent(answers[previousKey])) next[previousKey] = answers[previousKey];
  }
  if (lastAnswered === "rowEntitled") delete next.rowEntitlementDerived;
  return next;
}

export function matchProgress(topic: TopicId, answers: Record<string, ChoiceValue>) {
  const keys = relevantMatchKeys(topic, answers);
  const answeredKeys = keys.filter((key) => isMatchAnswerPresent(answers[key]));
  const currentKey = keys.find((key) => !isMatchAnswerPresent(answers[key])) ?? null;
  const complete = keys.length > 0 && currentKey === null;

  return {
    keys,
    answeredKeys,
    currentKey,
    complete,
    earlyResolved: complete && keys.length < fullKeys[topic].length,
  };
}
