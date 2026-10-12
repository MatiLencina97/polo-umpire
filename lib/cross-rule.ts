import type { ChoiceValue, Discipline, Language } from "./types";
import type { AnalysisSection, SubstitutionHandicapInputs } from "./engine";

export type CrossRuleStatus = "pass" | "fail" | "needs-info" | "info";

export type CrossRuleCheck = {
  id: string;
  source: string;
  title: string;
  status: CrossRuleStatus;
  summary: string;
};

export type CrossRuleQuestion = {
  key: keyof SubstitutionCrossFacts;
  label: string;
  why: string;
  kind: "choice" | "number";
  options?: Array<[ChoiceValue, string]>;
};

export type SubstitutionCrossFacts = {
  uspaNpcEvent: ChoiceValue;
  sponsorType: ChoiceValue;
  outgoingRole: ChoiceValue;
  outgoingAmerican: ChoiceValue;
  americanPlayersRemaining: number | null;
  candidateAmerican: ChoiceValue;
  affiliateHostException: ChoiceValue;
  candidateImmediateFamily: ChoiceValue;
  candidateIsTeamOwner: ChoiceValue;
  gauntlet: ChoiceValue;
  candidateCurrentMember: ChoiceValue;
  candidateSuspended: ChoiceValue;
  candidatePlayedOtherTeam: ChoiceValue;
  beginnerMemberException: ChoiceValue;
  otherNegativeRatedPlayers: number | null;
  onlyAvailableNegativeSub: ChoiceValue;
  candidateIsTHandicap: ChoiceValue;
  highGoalCreditStatus: ChoiceValue;
  candidatePreservesCredit: ChoiceValue;
};

export const defaultSubstitutionCrossFacts: SubstitutionCrossFacts = {
  uspaNpcEvent: "unknown",
  sponsorType: "unknown",
  outgoingRole: "unknown",
  outgoingAmerican: "unknown",
  americanPlayersRemaining: null,
  candidateAmerican: "unknown",
  affiliateHostException: "unknown",
  candidateImmediateFamily: "unknown",
  candidateIsTeamOwner: "unknown",
  gauntlet: "unknown",
  candidateCurrentMember: "unknown",
  candidateSuspended: "unknown",
  candidatePlayedOtherTeam: "unknown",
  beginnerMemberException: "unknown",
  otherNegativeRatedPlayers: null,
  onlyAvailableNegativeSub: "unknown",
  candidateIsTHandicap: "unknown",
  highGoalCreditStatus: "unknown",
  candidatePreservesCredit: "unknown",
};

export const substitutionRuleGraph = [
  { id: "r3", source: "Outdoor Rule 3", label: "Substitution timing & team aggregate" },
  { id: "r2", source: "Outdoor Rule 2", label: "Player eligibility & individual handicap" },
  { id: "r1", source: "Outdoor Rule 1.f", label: "American Rule & sponsor structure" },
  { id: "tc", source: "Tournament Conditions", label: "Event-specific exceptions" },
] as const;

const t = (language: Language, en: string, es: string) => language === "en" ? en : es;
const yesNoUnknown = (language: Language): Array<[ChoiceValue, string]> => [
  ["yes", t(language, "Yes", "Sí")],
  ["no", "No"],
  ["unknown", t(language, "Not sure", "No estoy seguro")],
];

function uniqueQuestions(items: CrossRuleQuestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

export function parseSubstitutionCrossFacts(text: string): Partial<SubstitutionCrossFacts> {
  const n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const out: Partial<SubstitutionCrossFacts> = {};

  if (/(uspa|npc) event|evento (uspa|npc)/.test(n)) out.uspaNpcEvent = "yes";
  if (/non[- ]?playing sponsor|sponsor no jugador/.test(n)) out.sponsorType = "nonplaying";
  if (/playing sponsor|sponsor jugador/.test(n)) out.sponsorType = "playing";
  if (/team owner|dueno del equipo|dueño del equipo/.test(n)) out.outgoingRole = "teamOwner";
  if (/designated sponsor/.test(n)) out.outgoingRole = "designatedSponsor";
  if (/playing sponsor/.test(n)) out.outgoingRole = "playingSponsor";

  if (/only (?:countable )?american player|unico american player|único american player/.test(n)) {
    out.outgoingAmerican = "yes";
    out.americanPlayersRemaining = 0;
  }

  const remaining = n.match(/(\d+)\s+(?:countable\s+)?american players?.{0,20}(?:remain|remaining|left|quedan|queda)/);
  if (remaining) out.americanPlayersRemaining = Number(remaining[1]);

  if (/registered player member/.test(n) || /canadian.{0,30}affiliate player member/.test(n)) {
    out.candidateCurrentMember = "yes";
    out.candidateAmerican = "yes";
  }
  if (/affiliate player member/.test(n) && !/canadian/.test(n)) out.candidateCurrentMember = "yes";
  if (/not (?:a )?(?:current )?uspa member|no es miembro (?:actual )?de uspa/.test(n)) out.candidateCurrentMember = "no";
  if (/(?:current )?uspa member|miembro (?:actual )?de uspa/.test(n) && out.candidateCurrentMember !== "no") out.candidateCurrentMember = "yes";

  if (/not suspended|no esta suspendid|no está suspendid/.test(n)) out.candidateSuspended = "no";
  else if (/suspended|suspendid/.test(n)) out.candidateSuspended = "yes";

  if (/already played for another team|played for another team|ya jugo para otro equipo|ya jugó para otro equipo/.test(n)) out.candidatePlayedOtherTeam = "yes";
  if (/has not played for another team|no jugo para otro equipo|no jugó para otro equipo/.test(n)) out.candidatePlayedOtherTeam = "no";

  if (/affiliate member club/.test(n) && /(host country|pais anfitrion|país anfitrión)/.test(n)) out.affiliateHostException = "yes";
  if (/gauntlet of polo/.test(n)) out.gauntlet = "yes";
  if (/homegrown player/.test(n)) out.highGoalCreditStatus = "homegrown";
  if (/credit[- ]earning american player/.test(n)) out.highGoalCreditStatus = "american";

  return out;
}

function sectionFromChecks(language: Language, checks: CrossRuleCheck[]): AnalysisSection[] {
  const failures = checks.filter((check) => check.status === "fail");
  const needs = checks.filter((check) => check.status === "needs-info");
  const passes = checks.filter((check) => check.status === "pass");
  const info = checks.filter((check) => check.status === "info");

  const sections: AnalysisSection[] = [];
  sections.push({
    id: "decision",
    title: t(language, "Decision status", "Estado de la decisión"),
    tone: failures.length ? "fail" : needs.length ? "warning" : "pass",
    items: failures.length
      ? failures.map((item) => item.summary)
      : needs.length
        ? [t(language, "The ruling is not closed yet because one or more facts can change the answer.", "La decisión todavía no está cerrada porque faltan hechos que pueden cambiar la respuesta.")]
        : [t(language, "No disqualifying condition was identified in the cross-rule checks entered so far.", "No se detectó una condición que vuelva inelegible al sustituto en los controles cruzados cargados.")],
  });

  if (passes.length) sections.push({
    id: "passed-checks",
    title: t(language, "Checks already satisfied", "Controles ya satisfechos"),
    tone: "pass",
    items: passes.map((item) => item.source + " — " + item.summary),
  });

  if (needs.length) sections.push({
    id: "missing",
    title: t(language, "Facts still needed", "Datos que todavía faltan"),
    tone: "warning",
    items: needs.map((item) => item.source + " — " + item.summary),
  });

  if (info.length) sections.push({
    id: "special",
    title: t(language, "Special conditions / exceptions", "Condiciones especiales / excepciones"),
    tone: "info",
    items: info.map((item) => item.source + " — " + item.summary),
  });

  return sections;
}

export function buildSubstitutionCrossRuleState(args: {
  discipline: Discipline;
  handicap: SubstitutionHandicapInputs;
  facts: SubstitutionCrossFacts;
  answers: Record<string, ChoiceValue>;
  language: Language;
}) {
  const { discipline, handicap, facts, answers, language } = args;
  const checks: CrossRuleCheck[] = [];
  const questions: CrossRuleQuestion[] = [];

  const addQuestion = (question: CrossRuleQuestion) => questions.push(question);
  const addCheck = (check: CrossRuleCheck) => checks.push(check);

  if (discipline !== "outdoor") {
    addCheck({
      id: "arena",
      source: "Arena Rule 3",
      title: t(language, "Arena substitution", "Sustitución Arena"),
      status: "needs-info",
      summary: t(language, "The current cross-rule graph is modeled on the Outdoor American Rule. Arena requires its own eligibility graph plus the applicable Tournament Conditions.", "El grafo cruzado actual está modelado sobre la American Rule de Outdoor. Arena requiere su propio grafo de elegibilidad más las Tournament Conditions aplicables."),
    });
    return {
      status: "needs-info" as CrossRuleStatus,
      checks,
      nextQuestions: [],
      nextQuestion: null,
      sections: sectionFromChecks(language, checks),
      graph: substitutionRuleGraph,
    };
  }

  // Rule 3 — timing and ability to continue.
  if (answers.endPeriod === "yes") {
    addCheck({ id: "timing", source: "Outdoor Rule 3.a", title: "Timing", status: "pass", summary: t(language, "The change is at the end of a period, when substitutions are generally permitted subject to the remaining eligibility checks.", "El cambio es al final de un período, cuando en general se permiten sustituciones sujeto al resto de los controles de elegibilidad.") });
  } else if (answers.unable === "yes" || answers.openSpot === "yes") {
    addCheck({ id: "timing", source: "Outdoor Rule 3.b", title: "Timing", status: "pass", summary: t(language, "The in-period substitution has a qualifying basis because the player is unable to continue or the position is already open.", "La sustitución durante el período tiene una base válida porque el jugador no puede continuar o la posición ya está vacante.") });
  } else if (answers.endPeriod === "no" && answers.unable === "no") {
    addCheck({ id: "timing", source: "Outdoor Rule 3.b", title: "Timing", status: "fail", summary: t(language, "A player who can continue cannot simply be replaced during the period.", "Un jugador que puede continuar no puede ser reemplazado libremente durante el período.") });
  } else {
    addCheck({ id: "timing", source: "Outdoor Rule 3.a-b", title: "Timing", status: "needs-info", summary: t(language, "Confirm whether the change is between periods or, if during a period, whether the outgoing player is unable to continue.", "Confirmá si el cambio es entre períodos o, si es durante el período, si el jugador que sale no puede continuar.") });
  }

  if (answers.penalty7 === "yes") {
    addCheck({ id: "penalty7", source: "Outdoor Rule 3.f", title: "Penalty 7", status: "info", summary: t(language, "Penalty 7 triggers a special substitution regime and can change the aggregate ceiling and re-entry rights.", "Penalty 7 activa un régimen especial de sustituciones y puede cambiar el límite agregado y el derecho de reingreso.") });
  }

  // Rule 2 — individual handicap.
  const upper = handicap.eventUpper ?? null;
  const candidate = handicap.candidateHandicap ?? null;
  const teamBefore = handicap.teamTotalBefore ?? null;
  const outgoing = handicap.outgoingHandicap ?? null;
  const remaining = teamBefore !== null && outgoing !== null ? teamBefore - outgoing : null;
  const individualMax = upper !== null && upper >= 4 ? Math.floor(upper * 0.75 + 1e-9) : null;
  const aggregateMax = upper !== null && remaining !== null ? upper - remaining : null;
  const maxReplacement = individualMax !== null && aggregateMax !== null ? Math.min(individualMax, aggregateMax) : individualMax ?? aggregateMax;

  if (upper === null) {
    addCheck({ id: "individual-handicap", source: "Outdoor Rule 2.d", title: "Individual handicap", status: "needs-info", summary: t(language, "The event upper handicap limit is needed to apply the player handicap limits.", "Hace falta el límite superior del evento para aplicar los límites de handicap individual.") });
  } else if (candidate === null) {
    addCheck({ id: "individual-handicap", source: "Outdoor Rule 2.d", title: "Individual handicap", status: "info", summary: individualMax !== null ? t(language, "For this event, the 3/4 Rule sets an individual ceiling of " + individualMax + " goals.", "Para este evento, la 3/4 Rule fija un máximo individual de " + individualMax + " goles.") : t(language, "The event is below the 4-goal threshold, so the separate Rule 2.d low-goal limit must be applied.", "El evento está por debajo del umbral de 4 goles, por lo que hay que aplicar el límite especial de Rule 2.d para low-goal.") });
  } else if (individualMax !== null && candidate > individualMax) {
    addCheck({ id: "individual-handicap", source: "Outdoor Rule 2.d(3)", title: "Individual handicap", status: "fail", summary: t(language, "The proposed substitute exceeds the 3/4 Rule individual ceiling of " + individualMax + " goals.", "El sustituto propuesto supera el máximo individual de " + individualMax + " goles de la 3/4 Rule.") });
  } else if (upper <= 3 && candidate > upper + 1) {
    addCheck({ id: "individual-handicap", source: "Outdoor Rule 2.d(4)", title: "Individual handicap", status: "fail", summary: t(language, "The proposed substitute exceeds the special individual ceiling for an Event at 3 goals or below.", "El sustituto propuesto supera el máximo individual especial para un Event de 3 goles o menos.") });
  } else if (candidate === -1 && upper > 12) {
    addCheck({ id: "minus-one", source: "Outdoor Rule 2.d(1)", title: "-1 player", status: "fail", summary: t(language, "A -1-goal player may not play in a USPA Event above the 12-goal level.", "Un jugador de -1 no puede jugar un USPA Event por encima de 12 goles.") });
  } else {
    addCheck({ id: "individual-handicap", source: "Outdoor Rule 2.d", title: "Individual handicap", status: "pass", summary: t(language, "The proposed substitute does not violate the individual handicap ceiling identified from the entered event limit.", "El sustituto propuesto no viola el máximo individual de handicap según el límite del evento cargado.") });
  }

  // Rule 3 — aggregate handicap.
  if (upper === null || teamBefore === null || outgoing === null) {
    addCheck({ id: "aggregate-handicap", source: "Outdoor Rule 3.c", title: "Team aggregate", status: "needs-info", summary: t(language, "The original team handicap and outgoing player's handicap are needed to calculate the exact post-substitution aggregate ceiling.", "Hace falta el handicap original del equipo y el handicap del jugador que sale para calcular el máximo agregado exacto después de la sustitución.") });
  } else if (candidate === null) {
    addCheck({ id: "aggregate-handicap", source: "Outdoor Rule 3.c", title: "Team aggregate", status: "info", summary: t(language, "The other three total " + remaining + "; by the aggregate limit, the substitute can be at most " + aggregateMax + " goals before applying any stricter individual limit.", "Los otros tres suman " + remaining + "; por el límite agregado, el sustituto puede tener como máximo " + aggregateMax + " goles antes de aplicar un límite individual más estricto.") });
  } else if (aggregateMax !== null && candidate > aggregateMax) {
    addCheck({ id: "aggregate-handicap", source: "Outdoor Rule 3.c", title: "Team aggregate", status: "fail", summary: t(language, "The substitution would take the team above the event's upper aggregate limit.", "La sustitución llevaría al equipo por encima del límite superior agregado del evento.") });
  } else {
    addCheck({ id: "aggregate-handicap", source: "Outdoor Rule 3.c", title: "Team aggregate", status: "pass", summary: t(language, "The proposed handicap fits the aggregate team ceiling. Falling below the event's lower aggregate limit is permitted for a substitution.", "El handicap propuesto entra dentro del máximo agregado del equipo. En una sustitución se permite quedar por debajo del límite inferior del evento.") });
  }

  // Rule 2 — membership, suspension, prior team.
  if (facts.candidateCurrentMember === "unknown") {
    addCheck({ id: "membership", source: "Outdoor Rule 2.b", title: "Membership", status: "needs-info", summary: t(language, "Confirm whether the substitute is a current USPA member (or qualifies for the narrow beginner exception in a below-2-goal Club Event).", "Confirmá si el sustituto es miembro vigente de USPA (o si entra en la excepción limitada para principiantes en Club Events debajo de 2 goles).") });
    addQuestion({ key: "candidateCurrentMember", label: t(language, "Is the proposed substitute a current USPA member?", "¿El sustituto propuesto es miembro vigente de USPA?"), why: t(language, "Rule 2.b makes membership a player-eligibility condition, subject to a narrow beginner exception.", "Rule 2.b hace de la membresía una condición de elegibilidad, con una excepción limitada para principiantes."), kind: "choice", options: yesNoUnknown(language) });
  } else if (facts.candidateCurrentMember === "no") {
    if (upper !== null && upper >= 2) {
      addCheck({ id: "membership", source: "Outdoor Rule 2.b", title: "Membership", status: "fail", summary: t(language, "A non-member cannot use the beginner exception at this handicap level.", "Un no-miembro no puede usar la excepción de principiante a este nivel de handicap.") });
    } else if (facts.beginnerMemberException === "unknown") {
      addCheck({ id: "membership", source: "Outdoor Rule 2.b", title: "Membership", status: "needs-info", summary: t(language, "A non-member may only fit the narrow beginner exception for Club Events below the 2-goal level; confirm whether that exception actually applies.", "Un no-miembro sólo puede entrar en la excepción limitada para principiantes en Club Events debajo de 2 goles; confirmá si realmente aplica.") });
      addQuestion({ key: "beginnerMemberException", label: t(language, "Does the Rule 2.b beginner exception apply?", "¿Aplica la excepción de principiante de Rule 2.b?"), why: t(language, "Without it, a non-member is not eligible.", "Sin esa excepción, un no-miembro no es elegible."), kind: "choice", options: yesNoUnknown(language) });
    } else if (facts.beginnerMemberException === "no") {
      addCheck({ id: "membership", source: "Outdoor Rule 2.b", title: "Membership", status: "fail", summary: t(language, "The substitute is not a current member and does not qualify for the beginner exception.", "El sustituto no es miembro vigente y no califica para la excepción de principiante.") });
    } else {
      addCheck({ id: "membership", source: "Outdoor Rule 2.b", title: "Membership", status: "pass", summary: t(language, "The beginner exception has been marked as applicable.", "La excepción de principiante fue marcada como aplicable.") });
    }
  } else {
    addCheck({ id: "membership", source: "Outdoor Rule 2.b", title: "Membership", status: "pass", summary: t(language, "Current USPA membership has been confirmed.", "Se confirmó membresía USPA vigente.") });
  }

  if (facts.candidateSuspended === "unknown") {
    addCheck({ id: "suspension", source: "Outdoor Rule 2.b", title: "Suspension", status: "needs-info", summary: t(language, "Confirm that the substitute is not currently suspended by USPA.", "Confirmá que el sustituto no esté actualmente suspendido por USPA.") });
    addQuestion({ key: "candidateSuspended", label: t(language, "Is the proposed substitute currently suspended by USPA?", "¿El sustituto propuesto está actualmente suspendido por USPA?"), why: t(language, "A current suspension makes the player ineligible.", "Una suspensión vigente vuelve inelegible al jugador."), kind: "choice", options: yesNoUnknown(language) });
  } else {
    addCheck({ id: "suspension", source: "Outdoor Rule 2.b", title: "Suspension", status: facts.candidateSuspended === "yes" ? "fail" : "pass", summary: facts.candidateSuspended === "yes" ? t(language, "The player is currently suspended and is not eligible.", "El jugador está suspendido y no es elegible.") : t(language, "No current USPA suspension has been identified.", "No se identificó una suspensión USPA vigente.") });
  }

  if (facts.candidatePlayedOtherTeam === "unknown") {
    addCheck({ id: "other-team", source: "Outdoor Rule 2.a", title: "Same Event / other team", status: "needs-info", summary: t(language, "Confirm whether the substitute has already played for another team in the same Event.", "Confirmá si el sustituto ya jugó para otro equipo en el mismo Event.") });
    addQuestion({ key: "candidatePlayedOtherTeam", label: t(language, "Has the substitute already played for another team in this same Event?", "¿El sustituto ya jugó para otro equipo en este mismo Event?"), why: t(language, "Rule 2.a generally bars a player from playing for more than one team in an Event.", "Rule 2.a en general impide que un jugador juegue para más de un equipo en un Event."), kind: "choice", options: yesNoUnknown(language) });
  } else {
    addCheck({ id: "other-team", source: "Outdoor Rule 2.a", title: "Same Event / other team", status: facts.candidatePlayedOtherTeam === "yes" ? "fail" : "pass", summary: facts.candidatePlayedOtherTeam === "yes" ? t(language, "The substitute has already played for another team in the Event and is not eligible under Rule 2.a.", "El sustituto ya jugó para otro equipo en el Event y no es elegible bajo Rule 2.a.") : t(language, "The substitute has not played for another team in the Event.", "El sustituto no jugó para otro equipo en el Event.") });
  }

  // Special negative-handicap limits.
  if (upper !== null && candidate !== null && upper > 6 && (candidate === -1 || candidate === -0.5)) {
    if (facts.otherNegativeRatedPlayers === null) {
      addCheck({ id: "negative-count", source: "Outdoor Rule 2.d(2)", title: "Negative-rated players", status: "needs-info", summary: t(language, "Count the other -1/-0.5 players who would remain on the team.", "Contá cuántos otros jugadores de -1/-0.5 quedarían en el equipo.") });
      addQuestion({ key: "otherNegativeRatedPlayers", label: t(language, "How many other -1 or -0.5 players would remain on the team?", "¿Cuántos otros jugadores de -1 o -0.5 quedarían en el equipo?"), why: t(language, "Events above 6 goals generally allow no more than one such player per team, with a narrow substitution exception at 7–12 goals.", "Los eventos por encima de 6 goles en general permiten como máximo uno por equipo, con una excepción limitada de sustitución entre 7 y 12 goles."), kind: "number" });
    } else if (facts.otherNegativeRatedPlayers > 0 && upper >= 7 && upper <= 12) {
      if (facts.onlyAvailableNegativeSub === "unknown") {
        addCheck({ id: "negative-count", source: "Outdoor Rule 2.d(2)", title: "Negative-rated players", status: "needs-info", summary: t(language, "More than one negative-rated player would be on the team. The special 7–12-goal substitution exception only works if this is the only available substitute.", "Quedaría más de un jugador con handicap negativo. La excepción especial de sustitución para 7–12 goles sólo funciona si éste es el único sustituto disponible.") });
        addQuestion({ key: "onlyAvailableNegativeSub", label: t(language, "Is this -1/-0.5 player the only available substitute?", "¿Este jugador de -1/-0.5 es el único sustituto disponible?"), why: t(language, "That fact controls the narrow Rule 2.d(2) exception.", "Ese dato controla la excepción limitada de Rule 2.d(2)."), kind: "choice", options: yesNoUnknown(language) });
      } else if (facts.onlyAvailableNegativeSub === "yes") {
        addCheck({ id: "negative-count", source: "Outdoor Rule 2.d(2)", title: "Negative-rated players", status: "info", summary: t(language, "The special game-only exception may allow the substitution, but the team plays with its original higher handicap.", "La excepción especial sólo para ese partido puede permitir la sustitución, pero el equipo juega con su handicap original más alto.") });
      } else {
        addCheck({ id: "negative-count", source: "Outdoor Rule 2.d(2)", title: "Negative-rated players", status: "fail", summary: t(language, "The proposed combination would exceed the normal one-player limit for -1/-0.5 rated players and the narrow exception has not been met.", "La combinación propuesta superaría el límite normal de un jugador de -1/-0.5 y no se cumple la excepción limitada.") });
      }
    } else if (facts.otherNegativeRatedPlayers > 0) {
      addCheck({ id: "negative-count", source: "Outdoor Rule 2.d(2)", title: "Negative-rated players", status: "fail", summary: t(language, "The proposed team would have more than one -1/-0.5 rated player in an Event above 6 goals.", "El equipo tendría más de un jugador de -1/-0.5 en un Event por encima de 6 goles.") });
    } else {
      addCheck({ id: "negative-count", source: "Outdoor Rule 2.d(2)", title: "Negative-rated players", status: "pass", summary: t(language, "The one-player limit for -1/-0.5 rated players is satisfied.", "Se cumple el límite de un jugador de -1/-0.5.") });
    }
  }

  if (upper !== null && upper >= 16 && candidate !== null && candidate <= 6) {
    if (facts.candidateIsTHandicap === "unknown") {
      addCheck({ id: "t-handicap", source: "Outdoor Rule 2.f", title: "T handicap", status: "needs-info", summary: t(language, "For a 16-goal-or-higher Event, confirm whether the proposed player carries a T handicap.", "Para un Event de 16 goles o más, confirmá si el jugador propuesto tiene handicap T.") });
      addQuestion({ key: "candidateIsTHandicap", label: t(language, "Does the proposed player have a T handicap?", "¿El jugador propuesto tiene handicap T?"), why: t(language, "Rule 2.f bars a player with a T handicap of 6 goals or less from Events at 16 goals and above.", "Rule 2.f impide que un jugador con handicap T de 6 goles o menos juegue Events de 16 goles o más."), kind: "choice", options: yesNoUnknown(language) });
    } else {
      addCheck({ id: "t-handicap", source: "Outdoor Rule 2.f", title: "T handicap", status: facts.candidateIsTHandicap === "yes" ? "fail" : "pass", summary: facts.candidateIsTHandicap === "yes" ? t(language, "A T-handicapped player at 6 goals or less is not eligible at this event level.", "Un jugador con handicap T de 6 goles o menos no es elegible a este nivel de evento.") : t(language, "The T-handicap restriction does not apply to the proposed player.", "La restricción de handicap T no aplica al jugador propuesto.") });
    }
  }

  // Rule 1.f — American Rule.
  if (facts.uspaNpcEvent === "unknown") {
    addCheck({ id: "american-scope", source: "Outdoor Rule 1.f", title: "American Rule scope", status: "needs-info", summary: t(language, "Confirm whether this is a USPA or NPC Event before applying the American Rule.", "Confirmá si es un USPA o NPC Event antes de aplicar la American Rule.") });
    addQuestion({ key: "uspaNpcEvent", label: t(language, "Is this a USPA or NPC Event?", "¿Es un USPA o NPC Event?"), why: t(language, "Rule 1.f's American Rule is written for USPA/NPC Events.", "La American Rule de Rule 1.f está redactada para USPA/NPC Events."), kind: "choice", options: yesNoUnknown(language) });
  } else if (facts.uspaNpcEvent === "no") {
    addCheck({ id: "american-scope", source: "Outdoor Rule 1.f", title: "American Rule scope", status: "info", summary: t(language, "The USPA/NPC American Rule does not automatically control this event; use the event's own conditions.", "La American Rule de USPA/NPC no controla automáticamente este evento; hay que usar sus condiciones propias.") });
  } else {
    addCheck({ id: "american-scope", source: "Outdoor Rule 1.f", title: "American Rule scope", status: "pass", summary: t(language, "Rule 1.f must be checked for this substitution.", "Rule 1.f debe verificarse para esta sustitución.") });

    if (facts.sponsorType === "unknown") {
      addCheck({ id: "sponsor-structure", source: "Outdoor Rule 1.f(1),(3)", title: "Sponsor structure", status: "needs-info", summary: t(language, "The required American Player count changes depending on whether the sponsor is playing or non-playing.", "La cantidad requerida de American Players cambia según el sponsor sea playing o non-playing.") });
      addQuestion({ key: "sponsorType", label: t(language, "Is the team sponsor playing or non-playing?", "¿El sponsor del equipo es playing o non-playing?"), why: t(language, "A team with a non-playing sponsor must have at least two American Players; the playing-sponsor structure uses a different count.", "Un equipo con non-playing sponsor debe tener al menos dos American Players; la estructura con playing sponsor usa un conteo diferente."), kind: "choice", options: [["playing", "Playing sponsor"], ["nonplaying", "Non-playing sponsor"], ["unknown", t(language, "Not sure", "No estoy seguro")]] });
    }

    if (facts.outgoingRole === "unknown") {
      addCheck({ id: "outgoing-role", source: "Outdoor Rule 1.f(4)-(5)", title: "Outgoing player's role", status: "needs-info", summary: t(language, "The player being replaced may be subject to extra restrictions if he or she is the team owner or designated sponsor.", "El jugador reemplazado puede tener restricciones adicionales si es el team owner o designated sponsor.") });
      addQuestion({ key: "outgoingRole", label: t(language, "What is the role of the player being replaced?", "¿Cuál es el rol del jugador que sale?"), why: t(language, "Rule 1.f has special replacement categories for the team owner and designated sponsor.", "Rule 1.f tiene categorías especiales de reemplazo para team owner y designated sponsor."), kind: "choice", options: [["regular", t(language, "Other player", "Otro jugador")], ["teamOwner", "Team owner"], ["designatedSponsor", "Designated sponsor"], ["playingSponsor", "Playing sponsor"], ["unknown", t(language, "Not sure", "No estoy seguro")]] });
    }

    if (facts.outgoingAmerican === "unknown") {
      addCheck({ id: "outgoing-american", source: "Outdoor Rule 1.f", title: "Outgoing American status", status: "needs-info", summary: t(language, "Confirm whether the player leaving the game is a countable American Player.", "Confirmá si el jugador que sale es un American Player computable.") });
      addQuestion({ key: "outgoingAmerican", label: t(language, "Does the outgoing player qualify as an American Player under Rule 1.f?", "¿El jugador que sale califica como American Player bajo Rule 1.f?"), why: t(language, "Losing a required American Player can make an otherwise valid handicap substitution illegal.", "Perder un American Player requerido puede volver ilegal una sustitución que por handicap sería válida."), kind: "choice", options: yesNoUnknown(language) });
    }

    if (facts.americanPlayersRemaining === null) {
      addCheck({ id: "american-count", source: "Outdoor Rule 1.f(1),(3)", title: "American Player count", status: "needs-info", summary: t(language, "Count the American Players who remain after the outgoing player leaves.", "Contá los American Players que quedan después de que sale el jugador.") });
      addQuestion({ key: "americanPlayersRemaining", label: t(language, "How many countable American Players remain after the outgoing player leaves?", "¿Cuántos American Players computables quedan después de que sale el jugador?"), why: t(language, "The team must still satisfy the Rule 1.f minimum after the substitution.", "El equipo debe seguir cumpliendo el mínimo de Rule 1.f después de la sustitución."), kind: "number" });
    }

    if (facts.candidateAmerican === "unknown") {
      addCheck({ id: "candidate-american", source: "Outdoor Rule 1.f(2)", title: "Substitute American status", status: "needs-info", summary: t(language, "Determine whether the proposed substitute qualifies as an American Player under the USPA definition.", "Determiná si el sustituto propuesto califica como American Player según la definición USPA.") });
      addQuestion({ key: "candidateAmerican", label: t(language, "Does the substitute qualify as an American Player under Rule 1.f?", "¿El sustituto califica como American Player bajo Rule 1.f?"), why: t(language, "This is a defined membership status, not simply a passport question: a Registered Player Member qualifies, and a Canadian citizen who is an Affiliate Player Member also qualifies.", "Es un status de membresía definido, no sólo una cuestión de pasaporte: califica un Registered Player Member y también un ciudadano canadiense que sea Affiliate Player Member."), kind: "choice", options: yesNoUnknown(language) });
    }

    const required = facts.sponsorType === "nonplaying" ? 2 : facts.sponsorType === "playing" ? 1 : null;
    const candidateCounts = facts.candidateAmerican === "yes" || facts.affiliateHostException === "yes";
    if (required !== null && facts.americanPlayersRemaining !== null && facts.candidateAmerican !== "unknown") {
      const afterCount = facts.americanPlayersRemaining + (candidateCounts ? 1 : 0);
      if (afterCount >= required) {
        addCheck({ id: "american-minimum", source: "Outdoor Rule 1.f(1),(3)", title: "American Player minimum", status: "pass", summary: t(language, "The team would have " + afterCount + " countable American Player(s) after the change; the required minimum for this sponsor structure is " + required + ".", "El equipo tendría " + afterCount + " American Player(s) computables después del cambio; el mínimo para esta estructura de sponsor es " + required + ".") });
      } else if (facts.affiliateHostException === "unknown") {
        addCheck({ id: "american-minimum", source: "Outdoor Rule 1.f + Tournament Conditions IV", title: "American Player minimum", status: "needs-info", summary: t(language, "The normal American Player count would be short. Before ruling the substitute ineligible, check whether the Affiliate Member Club host-country exception applies.", "El conteo normal de American Players quedaría corto. Antes de declarar inelegible al sustituto, hay que verificar si aplica la excepción del país anfitrión en un Affiliate Member Club.") });
        addQuestion({ key: "affiliateHostException", label: t(language, "Does the National/Circuit Affiliate Member Club host-country exception apply?", "¿Aplica la excepción del país anfitrión para National/Circuit Event en un Affiliate Member Club?"), why: t(language, "Tournament Conditions IV.A(3)/IV.B(2) can replace the Rule 1.f Registered Player requirement with an Affiliate Player Member who is a citizen of the host country.", "Tournament Conditions IV.A(3)/IV.B(2) pueden reemplazar el requisito de Registered Player de Rule 1.f por un Affiliate Player Member ciudadano del país anfitrión."), kind: "choice", options: yesNoUnknown(language) });
      } else if (facts.affiliateHostException === "yes") {
        addCheck({ id: "american-minimum", source: "Tournament Conditions IV.A(3)/IV.B(2)", title: "Host-country exception", status: "info", summary: t(language, "The host-country Affiliate Member Club exception has been marked as applicable; verify the player is an Affiliate Player Member and a citizen of the host country.", "La excepción del país anfitrión en Affiliate Member Club fue marcada como aplicable; verificá que el jugador sea Affiliate Player Member y ciudadano del país anfitrión.") });
      } else {
        addCheck({ id: "american-minimum", source: "Outdoor Rule 1.f(1),(3)", title: "American Player minimum", status: "fail", summary: t(language, "The substitution would leave the team below the required American Player minimum.", "La sustitución dejaría al equipo por debajo del mínimo requerido de American Players.") });
      }
    }

    const beforeCount = facts.americanPlayersRemaining !== null && facts.outgoingAmerican !== "unknown"
      ? facts.americanPlayersRemaining + (facts.outgoingAmerican === "yes" ? 1 : 0)
      : null;

    if (facts.outgoingRole === "teamOwner" || facts.outgoingRole === "designatedSponsor") {
      if (facts.gauntlet === "unknown") {
        addQuestion({ key: "gauntlet", label: t(language, "Is this the Gauntlet of Polo?", "¿Es Gauntlet of Polo?"), why: t(language, "Rule 1.f applies the owner/designated-sponsor replacement restriction differently in the Gauntlet.", "Rule 1.f aplica de forma distinta la restricción de reemplazo de owner/designated sponsor en el Gauntlet."), kind: "choice", options: yesNoUnknown(language) });
      }
      const roleRestrictionApplies = facts.gauntlet === "yes" || (facts.gauntlet === "no" && beforeCount !== null && beforeCount < 2);
      const roleUnknown = facts.gauntlet === "unknown" || (facts.gauntlet === "no" && beforeCount === null);
      if (roleUnknown) {
        addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Owner / designated sponsor", status: "needs-info", summary: t(language, "More facts are needed to determine whether the special owner/designated-sponsor replacement categories apply.", "Faltan datos para determinar si aplican las categorías especiales de reemplazo del owner/designated sponsor.") });
      } else if (roleRestrictionApplies && facts.outgoingRole === "teamOwner") {
        if (facts.candidateImmediateFamily === "unknown" && facts.candidateAmerican !== "yes") {
          addQuestion({ key: "candidateImmediateFamily", label: t(language, "Is the proposed substitute an immediate family member of the team owner?", "¿El sustituto propuesto es familiar inmediato del team owner?"), why: t(language, "When the restriction applies, the owner may be replaced by an immediate family member or an American Player.", "Cuando aplica la restricción, el owner puede ser reemplazado por un familiar inmediato o un American Player."), kind: "choice", options: yesNoUnknown(language) });
          addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Team owner replacement", status: "needs-info", summary: t(language, "Confirm whether the candidate fits one of the permitted owner-replacement categories.", "Confirmá si el candidato entra en una de las categorías permitidas para reemplazar al owner.") });
        } else if (facts.candidateAmerican === "yes" || facts.candidateImmediateFamily === "yes") {
          addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Team owner replacement", status: "pass", summary: t(language, "The candidate fits a permitted owner-replacement category.", "El candidato entra en una categoría permitida para reemplazar al owner.") });
        } else {
          addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Team owner replacement", status: "fail", summary: t(language, "The candidate does not fit the permitted owner-replacement categories.", "El candidato no entra en las categorías permitidas para reemplazar al owner.") });
        }
      } else if (roleRestrictionApplies && facts.outgoingRole === "designatedSponsor") {
        if (facts.candidateIsTeamOwner === "unknown" && facts.candidateImmediateFamily === "unknown" && facts.candidateAmerican !== "yes") {
          addQuestion({ key: "candidateIsTeamOwner", label: t(language, "Is the proposed substitute the team owner?", "¿El sustituto propuesto es el team owner?"), why: t(language, "The team owner is one of the permitted designated-sponsor replacement categories.", "El team owner es una de las categorías permitidas para reemplazar al designated sponsor."), kind: "choice", options: yesNoUnknown(language) });
          addQuestion({ key: "candidateImmediateFamily", label: t(language, "Is the proposed substitute an immediate family member of the team owner?", "¿El sustituto propuesto es familiar inmediato del team owner?"), why: t(language, "Immediate family is another permitted category when the restriction applies.", "El familiar inmediato es otra categoría permitida cuando aplica la restricción."), kind: "choice", options: yesNoUnknown(language) });
          addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Designated sponsor replacement", status: "needs-info", summary: t(language, "Confirm whether the candidate fits one of the designated-sponsor replacement categories.", "Confirmá si el candidato entra en una categoría permitida para reemplazar al designated sponsor.") });
        } else if (facts.candidateAmerican === "yes" || facts.candidateImmediateFamily === "yes" || facts.candidateIsTeamOwner === "yes") {
          addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Designated sponsor replacement", status: "pass", summary: t(language, "The candidate fits a permitted designated-sponsor replacement category.", "El candidato entra en una categoría permitida para reemplazar al designated sponsor.") });
        } else if (facts.candidateIsTeamOwner === "no" && facts.candidateImmediateFamily === "no" && facts.candidateAmerican === "no") {
          addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Designated sponsor replacement", status: "fail", summary: t(language, "The candidate does not fit a permitted designated-sponsor replacement category.", "El candidato no entra en una categoría permitida para reemplazar al designated sponsor.") });
        }
      } else {
        addCheck({ id: "role-restriction", source: "Outdoor Rule 1.f(4)-(5)", title: "Owner / designated sponsor", status: "pass", summary: t(language, "The special role-based replacement restriction is not triggered by the facts entered.", "La restricción especial por rol no se activa con los datos cargados.") });
      }
    }

    if (upper !== null && upper >= 16) {
      if (facts.highGoalCreditStatus === "unknown") {
        addCheck({ id: "high-goal-credit", source: "Outdoor Rule 1.f(6)-(8)", title: "16+ goal credit", status: "needs-info", summary: t(language, "Check whether the outgoing player is being used for a Homegrown or extra-American one-goal credit.", "Verificá si el jugador que sale está siendo usado para un crédito de un gol por Homegrown o American Player adicional.") });
        addQuestion({ key: "highGoalCreditStatus", label: t(language, "Is the outgoing player being used for a Rule 1.f Homegrown / extra-American credit?", "¿El jugador que sale está siendo usado para un crédito Homegrown / American Player adicional de Rule 1.f?"), why: t(language, "At 16 goals and above, the substitute's status can determine whether the team keeps that one-goal credit.", "A 16 goles o más, el status del sustituto puede determinar si el equipo conserva ese crédito de un gol."), kind: "choice", options: [["none", t(language, "No credit", "Sin crédito")], ["homegrown", "Homegrown"], ["american", "Extra American Player"], ["unknown", t(language, "Not sure", "No estoy seguro")]] });
      } else if (facts.highGoalCreditStatus === "homegrown" || facts.highGoalCreditStatus === "american") {
        if (facts.candidatePreservesCredit === "unknown") {
          addCheck({ id: "high-goal-credit", source: "Outdoor Rule 1.f(8)", title: "16+ goal credit", status: "needs-info", summary: t(language, "Confirm whether the substitute has the status needed to preserve the outgoing player's one-goal credit.", "Confirmá si el sustituto tiene el status necesario para conservar el crédito de un gol del jugador que sale.") });
          addQuestion({ key: "candidatePreservesCredit", label: t(language, "Does the substitute preserve the Rule 1.f credit?", "¿El sustituto conserva el crédito de Rule 1.f?"), why: t(language, "A Homegrown credit generally needs a Homegrown substitute; a credit-earning American Player generally needs an American Player substitute, unless the team already qualifies for the maximum credit without that status.", "Un crédito Homegrown generalmente requiere sustituto Homegrown; un American Player que genera crédito generalmente requiere sustituto American Player, salvo que el equipo ya alcance el crédito máximo sin ese status."), kind: "choice", options: yesNoUnknown(language) });
        } else {
          addCheck({ id: "high-goal-credit", source: "Outdoor Rule 1.f(8)", title: "16+ goal credit", status: facts.candidatePreservesCredit === "yes" ? "pass" : "info", summary: facts.candidatePreservesCredit === "yes" ? t(language, "The one-goal credit is preserved by the proposed substitution.", "El crédito de un gol se conserva con la sustitución propuesta.") : t(language, "The team may lose the one-goal credit; recalculate team handicap before deciding eligibility.", "El equipo puede perder el crédito de un gol; recalculá el handicap del equipo antes de decidir la elegibilidad.") });
        }
      }
    }
  }

  const orderedQuestions = uniqueQuestions(questions);
  const status: CrossRuleStatus = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "needs-info")
      ? "needs-info"
      : "pass";

  const sections = sectionFromChecks(language, checks);
  if (maxReplacement !== null) {
    sections.splice(1, 0, {
      id: "handicap-summary",
      title: t(language, "Handicap ceiling", "Máximo por handicap"),
      tone: "info",
      items: [t(language, "Maximum replacement handicap from the limits currently known: " + maxReplacement + " goals.", "Máximo handicap del reemplazante con los límites actualmente conocidos: " + maxReplacement + " goles.")],
    });
  }

  sections.push({
    id: "rule-chain",
    title: t(language, "Rules cross-checked", "Reglas cruzadas"),
    tone: "info",
    items: substitutionRuleGraph.map((node) => node.source + " — " + node.label),
  });

  return {
    status,
    checks,
    nextQuestions: orderedQuestions,
    nextQuestion: orderedQuestions[0] ?? null,
    sections,
    graph: substitutionRuleGraph,
  };
}
