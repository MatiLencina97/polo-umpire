import type { ChoiceValue, TopicId } from "./types";

const fullKeys: Record<TopicId, string[]> = {
  row: ["rowEntitled", "risk", "lineChanged", "clearanceTime"],
  dangerous: ["balance", "speedAngle", "blind"],
  blocking: ["restartBlock", "marking", "slow"],
  mallet: ["strokeDanger", "hookPosition", "hookTiming", "hookClear"],
  conduct: ["conductMatches", "repeat"],
  restart: ["dead", "restartType", "early"],
};

export function relevantMatchKeys(topic: TopicId, answers: Record<string, ChoiceValue>) {
  if (topic === "row") {
    const keys = ["rowEntitled"];
    if (answers.rowEntitled === "no") return keys;
    keys.push("risk", "lineChanged");
    if (answers.lineChanged === "yes") keys.push("clearanceTime");
    return keys;
  }

  if (topic === "dangerous") {
    // Rule 26.a expressly states that a mount knocked off balance means
    // a dangerous ride-off has occurred. Once this fact is confirmed,
    // additional factor questions may inform severity but cannot reverse the call.
    if (answers.balance === "yes") return ["balance"];
    return ["balance", "speedAngle", "blind"];
  }

  if (topic === "blocking") {
    const keys = ["restartBlock", "marking"];
    if (answers.marking === "no") return keys;
    if (answers.restartBlock === "no") keys.push("slow");
    return keys;
  }

  if (topic === "mallet") {
    const keys = ["strokeDanger"];
    if (answers.strokeDanger === "yes") return keys;
    keys.push("hookPosition", "hookTiming", "hookClear");
    return keys;
  }

  if (topic === "conduct") {
    const keys = ["conductMatches"];
    // Repetition changes escalation/card consequences, so keep it in the
    // fast flow after the conduct itself has been identified.
    if (answers.conductMatches === "yes") keys.push("repeat");
    return keys;
  }

  return ["dead", "restartType", "early"];
}

export function isMatchAnswerPresent(value?: ChoiceValue) {
  return value !== undefined && value !== "";
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
