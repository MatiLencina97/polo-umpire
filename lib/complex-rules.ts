import type { Discipline, Language } from "./types";

export type ComplexRuleFocus = {
  id: string;
  discipline: Discipline;
  title: string;
  refs: string[];
  related: string[];
  whyEn: string;
  whyEs: string;
  certaintyEn: string;
  certaintyEs: string;
  judgmentEn: string;
  judgmentEs: string;
};

export const complexRuleFocuses: ComplexRuleFocus[] = [
  {
    id: "row",
    discipline: "outdoor",
    title: "Right of Way",
    refs: ["23","24.a","24.b","24.c","24.d","24.e","24.f","24.g","24.h"],
    related: ["26.d","35.b"],
    whyEn: "LOB and ROW are different concepts; entitlement can move between players as their relationship to the LOB changes, and near-side, following/meeting, angle and two-player situations interact.",
    whyEs: "LOB y ROW son conceptos distintos; la titularidad puede cambiar entre jugadores según su relación con la LOB, y se combinan situaciones de near-side, following/meeting, ángulos y dos jugadores.",
    certaintyEn: "Rule 24(f), 24(g) and 24(h) provide deterministic entitlement tests in well-described physical situations. Rule 24(c) and 24(d) then govern unsafe entry/crossing and line changes.",
    certaintyEs: "Rule 24(f), 24(g) y 24(h) dan tests determinísticos de titularidad cuando la situación física está bien descripta. Rule 24(c) y 24(d) controlan luego el ingreso/cruce inseguro y los cambios de línea.",
    judgmentEn: "The Umpire must still decide the observed geometry, whether players were truly parallel/exactly on the LOB, and whether risk existed.",
    judgmentEs: "El Umpire todavía debe decidir la geometría observada, si los jugadores estaban realmente paralelos/exactamente sobre la LOB y si existió riesgo.",
  },
  {
    id: "substitutions",
    discipline: "outdoor",
    title: "Substitutions & eligibility",
    refs: ["1.f","2","2.d","3","3.a","3.b","3.c","3.f"],
    related: [],
    whyEn: "A legal substitution can depend simultaneously on timing, ability to continue, team aggregate, individual handicap, membership, suspension, same-event team history, American Rule status, sponsor structure and Tournament Conditions.",
    whyEs: "Una sustitución legal puede depender al mismo tiempo del timing, capacidad de continuar, handicap agregado, handicap individual, membresía, suspensión, participación previa, American Rule, sponsor y Tournament Conditions.",
    certaintyEn: "Most eligibility checks can be modeled deterministically once all event and player facts are known.",
    certaintyEs: "La mayoría de los controles de elegibilidad pueden modelarse de forma determinística una vez conocidos todos los datos del evento y del jugador.",
    judgmentEn: "Event-specific Tournament Conditions and factual status of the player must be verified by the Umpire/organizer.",
    judgmentEs: "Las Tournament Conditions específicas y el estado fáctico del jugador deben ser verificados por el Umpire/organizador.",
  },
  {
    id: "dangerous",
    discipline: "outdoor",
    title: "Dangerous Riding",
    refs: ["26.a","26.e","26.h"],
    related: ["35.b"],
    whyEn: "Rule 26 uses multiple non-exhaustive danger factors. Some facts are strong indicators, but absence of those factors does not prove a legal play.",
    whyEs: "Rule 26 usa múltiples factores de peligro no exhaustivos. Algunos hechos son indicadores fuertes, pero su ausencia no demuestra que la jugada sea legal.",
    certaintyEn: "A mount knocked off balance is a strong rule-supported trigger. Other branches should identify factors rather than invent a no-foul.",
    certaintyEs: "Que un caballo pierda el equilibrio es un disparador fuertemente respaldado por la regla. Otras ramas deben identificar factores en vez de inventar un no-foul.",
    judgmentEn: "Aggressor, unnecessary danger, force, angle, relative position and total circumstances remain Umpire judgments.",
    judgmentEs: "Agresor, peligro innecesario, fuerza, ángulo, posición relativa y circunstancias totales siguen siendo juicios del Umpire.",
  },
  {
    id: "mallet",
    discipline: "outdoor",
    title: "Mallet / hook responsibility",
    refs: ["28.a","28.d","26.h"],
    related: ["35.b","33"],
    whyEn: "A dangerous-looking contact does not automatically identify the fouling player; another player may have ridden into an already established stroke.",
    whyEs: "Un contacto que parece peligroso no identifica automáticamente al infractor; otro jugador puede haber entrado en un stroke ya establecido.",
    certaintyEn: "Hook position/timing/clearance conditions are highly structured. Responsibility for dangerous mallet use can be narrowed with Rule 28(d) and Rule 26(h).",
    certaintyEs: "Las condiciones de posición/timing/clearance del hook son muy estructuradas. La responsabilidad por uso peligroso del mallet puede acotarse con Rule 28(d) y Rule 26(h).",
    judgmentEn: "The Umpire determines who actually created the danger and whether an act was deliberate.",
    judgmentEs: "El Umpire determina quién creó realmente el peligro y si un acto fue deliberado.",
  },
  {
    id: "blocking",
    discipline: "outdoor",
    title: "Improper Blocking",
    refs: ["26A"],
    related: ["35.b"],
    whyEn: "The restart and open-play versions use different conditions, and contact is not required.",
    whyEs: "Las versiones de restart y juego abierto usan condiciones distintas, y no hace falta contacto.",
    certaintyEn: "The rule can be evaluated with concrete facts: restart/open play, whether the defender was prevented from marking, distance and pace.",
    certaintyEs: "La regla puede evaluarse con hechos concretos: restart/juego abierto, si se impidió marcar al defensor, distancia y velocidad.",
    judgmentEn: "The Umpire still determines whether the defender truly had a play and whether separate dangerous conduct occurred.",
    judgmentEs: "El Umpire todavía determina si el defensor realmente tenía una jugada y si hubo conducta peligrosa separada.",
  },
  {
    id: "penalties",
    discipline: "outdoor",
    title: "Penalty selection",
    refs: ["35.a","35.b","35.c","35.d"],
    related: ["37"],
    whyEn: "The same foul can justify different penalties because danger/unfair advantage, field location, player positions and repetition must all be weighed.",
    whyEs: "La misma falta puede justificar penalidades distintas porque deben ponderarse peligro/ventaja, ubicación, posiciones y reiteración.",
    certaintyEn: "The app can reliably identify the mandatory factors and extreme/specific cases stated by the Rulebook.",
    certaintyEs: "La app puede identificar de forma confiable los factores obligatorios y los casos extremos/específicos indicados por el Rulebook.",
    judgmentEn: "Where the Rulebook gives a range, the final penalty is deliberately left to the Umpire.",
    judgmentEs: "Cuando el Rulebook da un rango, la penalidad final queda deliberadamente en manos del Umpire.",
  },
];

export function complexText(focus: ComplexRuleFocus, language: Language) {
  return {
    why: language === "en" ? focus.whyEn : focus.whyEs,
    certainty: language === "en" ? focus.certaintyEn : focus.certaintyEs,
    judgment: language === "en" ? focus.judgmentEn : focus.judgmentEs,
  };
}
