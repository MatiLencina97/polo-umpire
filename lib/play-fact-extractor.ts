import type { ChoiceValue, TopicId } from "./types";
import { canonicalPlayText } from "./play-language-model";

export type ExtractedPlayFact = {
  key: string;
  value: ChoiceValue;
  reasonEn: string;
  reasonEs: string;
};

type FactRule = ExtractedPlayFact & {
  pattern: RegExp;
  source: "raw" | "canonical";
};

function rawPlayText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const factRules: Record<TopicId, FactRule[]> = {
  row: [
    {
      key: "risk",
      value: "yes",
      source: "canonical",
      pattern: /\b(?:force|made) (?:(?:blue|red|him|her|player) )?(?:to )?(?:check|change_course)\b|\b(?:had|needed) to (?:check|change_course)\b|\bcut off\b/,
      reasonEn: "The description says the player had to check, pull up or change course.",
      reasonEs: "La descripción indica que el jugador tuvo que frenar, levantar o cambiar de rumbo.",
    },
    {
      key: "risk",
      value: "no",
      source: "raw",
      pattern: /\b(?:did not|didnt|never) (?:have to )?(?:check|pull up|slow down|change course|turn away)\b|\bno (?:tuvo que|necesito) (?:frenar|desviar|cambiar de rumbo)\b/,
      reasonEn: "The description explicitly says no check or course change was required.",
      reasonEs: "La descripción dice explícitamente que no fue necesario frenar ni cambiar el rumbo.",
    },
    {
      key: "lineChanged",
      value: "yes",
      source: "raw",
      pattern: /\b(?:the )?(?:line|line of the ball) (?:had )?(?:changed|shifted)\b|\b(?:cambio|cambia) la linea(?: de la pelota)?\b/,
      reasonEn: "The description explicitly says the Line of the Ball changed.",
      reasonEs: "La descripción dice explícitamente que cambió la línea de la pelota.",
    },
    {
      key: "clearanceTime",
      value: "no",
      source: "raw",
      pattern: /\b(?:no|without) (?:time|chance) to clear\b|\bnot enough time to clear\b|\bsin tiempo (?:para )?(?:salir|despejar)\b/,
      reasonEn: "The description explicitly says there was not enough time to clear the new ROW.",
      reasonEs: "La descripción dice explícitamente que no hubo tiempo suficiente para despejar el nuevo ROW.",
    },
    {
      key: "clearanceTime",
      value: "yes",
      source: "raw",
      pattern: /\b(?:had|was given) enough time to clear\b|\btuvo tiempo suficiente (?:para )?(?:salir|despejar)\b/,
      reasonEn: "The description explicitly says enough clearance time was available.",
      reasonEs: "La descripción dice explícitamente que hubo tiempo suficiente para despejar.",
    },
  ],
  dangerous: [
    {
      key: "balance",
      value: "yes",
      source: "canonical",
      pattern: /\b(?:horse )?(?:lose balance|balance)\b|\boff balance\b/,
      reasonEn: "The description explicitly says a mount lost balance.",
      reasonEs: "La descripción dice explícitamente que un caballo perdió el equilibrio.",
    },
    {
      key: "balance",
      value: "no",
      source: "raw",
      pattern: /\b(?:horse|pony|mount) (?:stayed|remained) balanced\b|\bno (?:perdio|pierde) el equilibrio\b/,
      reasonEn: "The description explicitly says the mount stayed balanced.",
      reasonEs: "La descripción dice explícitamente que el caballo mantuvo el equilibrio.",
    },
    {
      key: "speedAngle",
      value: "yes",
      source: "raw",
      pattern: /\b(?:sharp|steep|strong) (?:angle|converging angle)\b|\bat (?:high )?speed\b|\bfull speed\b|\ba mucha velocidad\b|\bangulo (?:fuerte|cerrado|pronunciado)\b/,
      reasonEn: "The description explicitly mentions a strong angle or significant speed.",
      reasonEs: "La descripción menciona explícitamente un ángulo fuerte o velocidad significativa.",
    },
    {
      key: "blind",
      value: "yes",
      source: "canonical",
      pattern: /\bblindside\b|\bfrom behind\b|\bunprepared\b/,
      reasonEn: "The description explicitly says the contact came blind-side, from behind, or while the opponent was unprepared.",
      reasonEs: "La descripción indica explícitamente un contacto por blind-side, desde atrás o con el rival sin preparación.",
    },
  ],
  blocking: [
    {
      key: "marking",
      value: "yes",
      source: "canonical",
      pattern: /\bscreen defender\b|\bprevent defender (?:mark|play|get)\b|\bblock defender\b|\bpick off defender\b/,
      reasonEn: "The description explicitly says the defender was screened or prevented from marking/playing.",
      reasonEs: "La descripción dice explícitamente que el defensor fue bloqueado o impedido de marcar/jugar.",
    },
    {
      key: "marking",
      value: "no",
      source: "raw",
      pattern: /\bdefender was free to (?:mark|play)\b|\b(?:did not|didnt) prevent (?:the )?defender\b|\blo dejo marcar\b|\bla dejo marcar\b/,
      reasonEn: "The description explicitly says the defender remained free to mark or play.",
      reasonEs: "La descripción dice explícitamente que el defensor pudo marcar o jugar libremente.",
    },
    {
      key: "restartBlock",
      value: "yes",
      source: "canonical",
      pattern: /\b(?:knockin|freehit|penalty 5)\b/,
      reasonEn: "The described blocking occurred in a knock-in, Penalty 5, or free-hit context.",
      reasonEs: "El bloqueo descripto ocurrió durante un knock-in, Penalty 5 o free hit.",
    },
    {
      key: "slow",
      value: "yes",
      source: "raw",
      pattern: /\b(?:slow canter|walk)\b[\s\S]*\b(?:within|inside) two horse lengths\b|\b(?:paso|trote lento)\b[\s\S]*\b(?:dentro de|a menos de) dos largos de caballo\b/,
      reasonEn: "The description explicitly gives both the slow pace and the two-horse-length condition.",
      reasonEs: "La descripción indica explícitamente tanto la baja velocidad como la condición de dos largos de caballo.",
    },
  ],
  mallet: [
    {
      key: "strokeDanger",
      value: "yes",
      source: "raw",
      pattern: /\b(?:swing|mallet|stick|taco) (?:passed|came|went|paso) (?:very )?(?:close|near|cerca)\b|\b(?:mallet|stick|taco) (?:hit|struck|touched|contacted|golpeo|toco) (?:the |al |el )?(?:horse|pony|mount|player|caballo|petiso|jugador)\b/,
      reasonEn: "The description explicitly places the swing/mallet dangerously close to, or in contact with, a player or mount.",
      reasonEs: "La descripción ubica explícitamente el swing/mallet muy cerca o en contacto con un jugador o caballo.",
    },
    {
      key: "hookPosition",
      value: "no",
      source: "canonical",
      pattern: /\bhook (?:from )?(?:the )?(?:wrong|far|other) side\b|\bhook (?:under|across) (?:the )?horse\b/,
      reasonEn: "The description explicitly says the hook came from a prohibited side or across/under the mount.",
      reasonEs: "La descripción dice explícitamente que el hook se hizo desde un lado prohibido o cruzando/pasando por debajo del caballo.",
    },
    {
      key: "hookPosition",
      value: "yes",
      source: "raw",
      pattern: /\bhook(?:ed|ing)? (?:from )?(?:the )?same side as (?:the )?ball\b|\bhook(?:ed|ing)? directly from behind\b|\bhookeo (?:del )?mismo lado (?:que|de) la pelota\b|\bhookeo directamente desde atras\b/,
      reasonEn: "The description explicitly states a Rule 28 permitted hook position.",
      reasonEs: "La descripción indica explícitamente una posición de hook permitida por Rule 28.",
    },
    {
      key: "hookTiming",
      value: "yes",
      source: "raw",
      pattern: /\bopponent was (?:in the act of )?(?:hitting|swinging|hooking)\b|\brival estaba (?:pegando|en el acto de pegar|hookeando)\b/,
      reasonEn: "The description explicitly says the opponent was in the act of hitting or hooking.",
      reasonEs: "La descripción dice explícitamente que el rival estaba en el acto de pegar o hookear.",
    },
    {
      key: "hookClear",
      value: "no",
      source: "raw",
      pattern: /\b(?:excessive force|above (?:the )?shoulder|over (?:the )?shoulder|across (?:the )?(?:horse|mount))\b|\b(?:fuerza excesiva|por encima del hombro|cruzando (?:el )?(?:caballo|petiso))\b/,
      reasonEn: "The description explicitly states a prohibited force/height/clearance condition.",
      reasonEs: "La descripción indica explícitamente una condición prohibida de fuerza, altura o despeje.",
    },
  ],
  conduct: [
    {
      key: "conductMatches",
      value: "yes",
      source: "canonical",
      pattern: /\b(?:argue|appeal|protest|yell|abuse)\b|\byellowcard\b|\bredcard\b/,
      reasonEn: "The description explicitly contains conduct listed under the unsportsmanlike-conduct path.",
      reasonEs: "La descripción contiene explícitamente una conducta contemplada por la rama de conducta antideportiva.",
    },
    {
      key: "deliberate",
      value: "yes",
      source: "raw",
      pattern: /\b(?:deliberate|deliberately|intentional|intentionally|on purpose)\b|\b(?:deliberado|deliberadamente|intencional|intencionalmente|a proposito)\b/,
      reasonEn: "The description explicitly says the conduct was deliberate or intentional.",
      reasonEs: "La descripción dice explícitamente que la conducta fue deliberada o intencional.",
    },
    {
      key: "repeat",
      value: "yes",
      source: "raw",
      pattern: /\b(?:again|repeated|repeatedly|kept|continued) (?:arguing|appealing|protesting|yelling)\b|\b(?:prior|previous) (?:warning|yellow card|foul)\b|\b(?:otra vez|reiteradamente|siguio|continuo) (?:protestando|discutiendo|gritando)\b|\b(?:advertencia|tarjeta) previa\b/,
      reasonEn: "The description explicitly indicates repetition or a prior warning/card.",
      reasonEs: "La descripción indica explícitamente reiteración o una advertencia/tarjeta previa.",
    },
  ],
  restart: [
    {
      key: "dead",
      value: "yes",
      source: "canonical",
      pattern: /\b(?:out|deadball)\b|\bumpire stop play\b/,
      reasonEn: "The description explicitly says the ball was out/dead or play had been stopped.",
      reasonEs: "La descripción dice explícitamente que la pelota estaba afuera/muerta o que el juego había sido detenido.",
    },
    {
      key: "dead",
      value: "no",
      source: "raw",
      pattern: /\bball (?:stayed|remained) (?:in|inside|in play)\b|\b(?:pelota|bocha) (?:siguio|quedo) (?:adentro|en juego)\b/,
      reasonEn: "The description explicitly says the ball remained in play.",
      reasonEs: "La descripción dice explícitamente que la pelota siguió en juego.",
    },
    {
      key: "restartType",
      value: "knockin",
      source: "canonical",
      pattern: /\bknockin\b/,
      reasonEn: "The description explicitly identifies a knock-in.",
      reasonEs: "La descripción identifica explícitamente un knock-in.",
    },
    {
      key: "restartType",
      value: "throwin",
      source: "canonical",
      pattern: /\bthrowin\b|\bbowl in\b/,
      reasonEn: "The description explicitly identifies a throw-in/bowl-in.",
      reasonEs: "La descripción identifica explícitamente un throw-in/bowl-in.",
    },
    {
      key: "restartType",
      value: "penalty",
      source: "canonical",
      pattern: /\bfreehit\b|\bpenalty(?: 5)?\b/,
      reasonEn: "The description explicitly identifies a penalty or free hit.",
      reasonEs: "La descripción identifica explícitamente una penalidad o free hit.",
    },
    {
      key: "early",
      value: "yes",
      source: "raw",
      pattern: /\b(?:hit|played|swung|golpeo|jugo) (?:the ball )?before (?:the )?umpire (?:called|said) play\b|\b(?:golpeo|jugo) antes de que (?:el )?(?:umpire|arbitro) (?:llamara|dijera) play\b/,
      reasonEn: "The description explicitly says the ball was played before the Umpire called Play.",
      reasonEs: "La descripción dice explícitamente que se jugó la pelota antes de que el Umpire llamara Play.",
    },
  ],
};

export function extractExplicitPlayFacts(text: string, topic: TopicId) {
  const raw = rawPlayText(text);
  const canonical = canonicalPlayText(text);
  const candidates = new Map<string, ExtractedPlayFact[]>();

  for (const rule of factRules[topic]) {
    const haystack = rule.source === "canonical" ? canonical : raw;
    if (!rule.pattern.test(haystack)) continue;
    const list = candidates.get(rule.key) ?? [];
    list.push({
      key: rule.key,
      value: rule.value,
      reasonEn: rule.reasonEn,
      reasonEs: rule.reasonEs,
    });
    candidates.set(rule.key, list);
  }

  const answers: Record<string, ChoiceValue> = {};
  const facts: ExtractedPlayFact[] = [];

  for (const [key, matches] of candidates) {
    const values = [...new Set(matches.map((item) => item.value))];
    if (values.length !== 1) continue;
    const fact = matches[0];
    answers[key] = fact.value;
    facts.push(fact);
  }

  return { answers, facts };
}
