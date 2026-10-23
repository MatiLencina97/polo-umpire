import type { ChoiceValue, Discipline, Language, QuestionDefinition, Rule, TopicDefinition, TopicId } from "./types";

export const topicDefs: Record<TopicId, TopicDefinition> = {
  row: {
    label: "Right of Way / Crossing",
    outdoor: ["24", "23"], arena: ["12", "11"],
    terms: ["right of way", "row", "cruce", "cruzar", "cruzo", "cruza", "linea", "línea", "cross", "crossing", "trayectoria", "frenar", "alterar curso", "change course", "alter course", "had to check", "forced to check", "checked up", "corto el paso", "le corto el paso"],
  },
  dangerous: {
    label: "Dangerous Riding",
    outdoor: ["26"], arena: ["13"],
    terms: ["dangerous", "peligroso", "ride off", "ride-off", "choque", "choco", "contacto", "angulo", "ángulo", "velocidad", "blind side", "zigzag", "desbalance", "tropezar"],
  },
  blocking: {
    label: "Improper Blocking",
    outdoor: ["26A"], arena: ["13"],
    terms: ["block", "blocking", "bloqueo", "bloquear", "pick", "obstruccion", "obstrucción", "marcar", "liberar compañero"],
  },
  mallet: {
    label: "Uso del mallet / hook",
    outdoor: ["28"], arena: ["15"],
    terms: ["mallet", "taco", "hook", "enganche", "swing", "stroke", "golpe", "martillo"],
  },
  conduct: {
    label: "Conducta antideportiva",
    outdoor: ["33", "34"], arena: ["14"],
    terms: ["insulto", "protesta", "protestar", "unsportsmanlike", "conducta", "tarjeta", "yellow card", "red card", "reiterada", "repetida", "argue", "arguing", "argued", "appealing", "appeal to umpire", "abuse", "abusive", "rough conduct", "post whistle", "post-whistle", "disrespect"],
  },
  restart: {
    label: "Reanudación / pelota muerta",
    outdoor: ["20", "21", "22", "36"], arena: ["7", "8", "16"],
    terms: ["knock in", "knock-in", "throw in", "throw-in", "bowl in", "restart", "reanudar", "reanudacion", "pelota muerta", "dead ball", "called play", "call play", "before play", "antes de play", "llamar play", "llamo play", "penalty hit", "free hit", "taking a penalty", "took the penalty", "penalty was taken", "during a penalty", "durante una penalidad", "durante un penalty", "tiro penal", "penalty 5", "out of bounds", "over the boards", "over boards", "went over the boards", "goes over the boards", "crossed the boards", "crosses the boards", "crossed the side boards", "crosses the side boards", "crossed the sideline", "crosses the sideline", "over the sideline", "ball went out", "ball goes out", "ball is out", "ball out of play", "pelota afuera", "bocha afuera", "fuera de la cancha", "salio por las tablas", "sale por las tablas", "salio por la linea lateral", "sale por la linea lateral", "salio por el lateral", "sale por el lateral", "cruzo la linea lateral", "cruza la linea lateral"],
  },
};

export const questions: Record<TopicId, QuestionDefinition[]> = {
  row: [
    { key: "rowEntitled", label: "¿El jugador afectado tenía realmente el Right of Way en ese momento?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "risk", label: "¿La acción obligó al jugador con el Right of Way a frenar, cambiar dirección o generó riesgo de colisión?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "lineChanged", label: "¿La línea de la pelota había cambiado inmediatamente antes de la acción?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "clearanceTime", label: "Si cambió la línea: ¿el oponente tuvo el tiempo necesario para despejar el nuevo ROW?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "parallel", label: "¿Los jugadores iban paralelos o casi paralelos al momento relevante?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  dangerous: [
    { key: "balance", label: "¿Algún caballo perdió el equilibrio o fue desplazado con fuerza?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "speedAngle", label: "¿Había diferencia importante de velocidad, posición o un ángulo de convergencia fuerte?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "blind", label: "¿El contacto tomó al oponente sin estar preparado (blind-side) o creó un riesgo innecesario?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  blocking: [
    { key: "restartBlock", label: "¿Ocurrió durante un knock-in, Penalty 5.a/5.b o free hit por pelota afuera?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "marking", label: "¿El atacante impidió que el defensor marcara a un compañero con posibilidad de jugar la pelota?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "slow", label: "Si fue durante juego abierto: ¿el jugador con pelota frenó o bajó a slow canter/walk y el bloqueo fue dentro de dos largos de caballo?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  mallet: [
    { key: "strokeDanger", label: "¿El swing/hook puso en riesgo a otro jugador o caballo?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "strokeEnteredByOpponent", label: "Si hubo peligro: ¿otro jugador entró claramente en un stroke ya establecido y creó ese peligro?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "hookPosition", label: "¿El hook se hizo desde el mismo lado del caballo rival que la pelota, o directamente desde atrás?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "hookTiming", label: "¿El rival estaba en el acto de pegarle a la pelota o de hookear/golpear el mallet?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "hookClear", label: "¿El mallet quedó libre del caballo rival, por debajo del hombro y sin fuerza excesiva?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  conduct: [
    { key: "conductMatches", label: "¿La conducta encaja en Rule 33.a (appealing, abuso, discutir con oficiales, rough/dangerous conduct, golpe después del whistle, etc.)?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "deliberate", label: "¿La conducta fue deliberada, abusiva o contraria al espíritu del juego?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "repeat", label: "¿Ya hubo faltas similares o una advertencia/tarjeta previa?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  restart: [
    { key: "dead", label: "¿La pelota estaba fuera de juego o el reloj detenido?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "restartType", label: "¿Qué tipo de reanudación se estaba ejecutando?", options: [["knockin", "Knock-in"], ["throwin", "Throw-in"], ["penalty", "Penalty / free hit"], ["other", "Otra"], ["unknown", "No estoy seguro"]] },
    { key: "early", label: "¿Alguien golpeó/jugó antes de que el Umpire llamara “Play”?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
};

export const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const words = (value = "") => normalize(value).split(/[^a-z0-9]+/).filter((x) => x.length > 1);

function searchableTopicText(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function containsTopicTerm(text: string, term: string) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term).trim();
  if (!normalizedTerm) return false;

  // These short terms are valid rule cues but are also common substrings of
  // unrelated polo words ("play" in "player", "row" in "throw-in").
  if (normalizedTerm === "play" || normalizedTerm === "row" || normalizedTerm === "cross" || normalizedTerm === "linea") {
    const haystack = searchableTopicText(normalizedText);
    const needle = searchableTopicText(normalizedTerm);

    // "línea lateral" is an out-of-bounds / Rule 22 cue, not a Line of the Ball
    // cue. Do not let the generic Spanish ROW token create an artificial tie.
    if (normalizedTerm === "linea" && (" " + haystack + " ").includes(" linea lateral ")) return false;

    // Match English cross/crossed/crosses/crossing as whole words without
    // reviving the old false positive where "cross" matched inside "across".
    if (normalizedTerm === "cross") return /(?:^| )cross(?:ed|es|ing)?(?: |$)/.test(haystack);

    return (" " + haystack + " ").includes(" " + needle + " ");
  }

  return normalizedText.includes(normalizedTerm);
}

function containsSearchTerm(text: string, term: string) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term).trim();
  if (!normalizedTerm) return false;

  if (normalizedTerm.length <= 3) {
    const haystack = searchableTopicText(normalizedText);
    const needle = searchableTopicText(normalizedTerm);
    return (" " + haystack + " ").includes(" " + needle + " ");
  }

  return normalizedText.includes(normalizedTerm);
}

export function classify(text: string) {
  const n = normalize(text);
  return (Object.entries(topicDefs) as Array<[TopicId, TopicDefinition]>).map(([id, t]) => {
    let score = 0;
    for (const term of t.terms) if (containsTopicTerm(n, term)) score += term.includes(" ") ? 3 : 2;
    return { id, score, label: t.label };
  }).sort((a, b) => b.score - a.score);
}

export function classifyTopic(text: string) {
  const ranked = classify(text);
  const first = ranked[0];
  const second = ranked[1];
  const ambiguous = Boolean(
    first && first.score > 0 &&
    second && second.score > 0 &&
    first.score - second.score <= 1
  );
  const topic = first && first.score > 0 && !ambiguous ? first.id : null;
  return { topic, ranked, ambiguous };
}

const playClarifierOrder: TopicId[] = ["restart", "row", "dangerous", "blocking", "mallet", "conduct"];

const playClarifierLabels: Record<TopicId, Record<Language, string>> = {
  restart: {
    en: "Ball out / dead ball / restart",
    es: "Pelota afuera / pelota muerta / reanudación",
  },
  row: {
    en: "Crossing / line interference",
    es: "Cruce / interferencia con la línea",
  },
  dangerous: {
    en: "Dangerous contact / ride-off",
    es: "Contacto peligroso / ride-off",
  },
  blocking: {
    en: "Blocking / preventing a mark",
    es: "Bloqueo / impedir una marca",
  },
  mallet: {
    en: "Mallet / hook / swing",
    es: "Mallet / hook / swing",
  },
  conduct: {
    en: "Arguing / abuse / misconduct",
    es: "Protesta / abuso / conducta",
  },
};

export function playClarifierLabel(topic: TopicId, language: Language) {
  return playClarifierLabels[topic][language];
}

export function playClarifierCandidates(
  ranked: Array<{ id: TopicId; score: number; label: string }>,
) {
  const positive = ranked.filter((item) => item.score > 0);
  if (!positive.length) return [...playClarifierOrder];

  const topScore = positive[0].score;
  const nearTop = positive
    .filter((item) => topScore - item.score <= 1)
    .map((item) => item.id);

  return nearTop.length ? nearTop : [positive[0].id];
}

export function scoreRule(rule: Rule, query: string) {
  if (!query) return 1;
  const nq = normalize(query);
  const toks = words(query);
  let score = 0;
  if (containsSearchTerm(rule.title, nq)) score += 20;
  if (containsSearchTerm(`rule ${rule.rule}`, nq) || containsSearchTerm(`regla ${rule.rule}`, nq)) score += 20;
  for (const k of rule.keywords ?? []) {
    if (containsSearchTerm(nq, k) || containsSearchTerm(k, nq)) score += 8;
  }
  const hay = normalize(`${rule.title} ${(rule.keywords ?? []).join(" ")} ${rule.text.slice(0, 5000)}`);
  for (const token of toks) if (containsSearchTerm(hay, token)) score += token.length > 5 ? 3 : 1;
  return score;
}

export function applicationText(topic: TopicId, answers: Record<string, ChoiceValue>) {
  const a = answers;
  if (topic === "row") {
    if (a.risk === "yes" && a.lineChanged === "yes") return "La situación encaja especialmente con el análisis de Right of Way después de un cambio de Line of the Ball: el oponente debe tener tiempo suficiente para despejar el nuevo ROW. Si la maniobra obliga al jugador con ROW a frenar o alterar curso para evitar peligro, existe una base fuerte para cobrar la infracción.";
    if (a.risk === "yes") return "El dato decisivo es que el jugador con el posible ROW tuvo que frenar, desviar su curso o afrontar riesgo. La regla de ROW exige que el ingreso o cruce se produzca sin generar riesgo de colisión o peligro.";
    if (a.risk === "no") return "Sin necesidad de frenar, alterar el curso ni riesgo apreciable, puede no existir infracción de ROW. Debe verificarse igualmente quién tenía el ROW según la relación de cada jugador con la Line of the Ball.";
    return "La regla aplicable depende principalmente de quién tenía el ROW y de si el ingreso o cruce generó riesgo. Falta confirmar ese hecho antes de concluir.";
  }
  if (topic === "dangerous") {
    if (a.balance === "yes") return "La pérdida de equilibrio del caballo es un indicador especialmente fuerte bajo Dangerous Riding. La regla ordena considerar además velocidad relativa, tamaño, posición, ángulo, fatiga y preparación del oponente.";
    if (a.speedAngle === "yes" || a.blind === "yes") return "Hay factores expresamente relevantes para Dangerous Riding: velocidad, ángulo, posición relativa y/o falta de preparación del oponente. El Umpire conserva discreción para valorar el grado de peligro.";
    return "La acción debe evaluarse con el conjunto de factores de Dangerous Riding. La ausencia de los indicadores preguntados no alcanza, por sí sola, para concluir no-foul: Rule 26 contempla otros factores y deja la valoración final del peligro al Umpire.";
  }
  if (topic === "blocking") {
    if (a.restartBlock === "yes" && a.marking === "yes") return "Los hechos coinciden con el supuesto central de Improper Blocking durante la ejecución de un knock-in, Penalty 5.a/5.b o free hit por pelota afuera: un atacante no puede impedir que un defensor marque al compañero que tiene una jugada sobre la pelota.";
    if (a.slow === "yes") return "En juego abierto, la regla también contempla el bloqueo cuando el jugador en posesión reduce la velocidad a slow canter o walk y un compañero bloquea dentro de dos largos de caballo al defensor que intenta jugar al poseedor o a la pelota.";
    return "Debe confirmarse si realmente se impidió al defensor marcar o jugar. La sola presencia de un compañero no convierte automáticamente la acción en Improper Blocking.";
  }
  if (topic === "mallet") return a.strokeDanger === "yes" ? "El riesgo creado por el swing/hook es el punto central. Corresponde revisar el artículo de uso del mallet y sus condiciones de seguridad antes de seleccionar la penalidad." : "Debe verificarse la posición relativa y la forma del hook/stroke. Sin peligro ni una condición prohibida, el uso del mallet puede ser legal.";
  if (topic === "conduct") return a.repeat === "yes" ? "Además de la conducta puntual, la reiteración importa: las reglas permiten escalar la respuesta ante faltas repetidas o flagrantes." : "La conducta debe evaluarse por su carácter deliberado/abusivo y por el efecto sobre el juego. La selección de la sanción exige revisar las reglas de conducta y penalidades.";
  return a.early === "yes" ? "Jugar antes de “Play” es un dato relevante de procedimiento. Debe aplicarse la regla específica de reanudación y la tabla/procedimiento de penalidades correspondiente." : "La resolución depende del estado de la pelota y del procedimiento de reanudación aplicable.";
}

export function relatedRuleNumbers(topic: TopicId, discipline: Discipline) {
  return topicDefs[topic][discipline];
}

export const scenarioDefs = {
  substitutes: {
    label: "Substitutions / Alternates",
    outdoor: ["3", "2", "1"],
    arena: ["3"],
    terms: [
      "substitute", "substitution", "sustituto", "suplente", "reemplazo", "reemplazar",
      "alternate", "alterno", "lesionado", "injury", "injured", "unable to continue",
      "no puede continuar", "handicap del equipo", "doble sustitucion", "double substitution",
      "american rule", "american player", "registered player member", "affiliate player member",
      "citizen", "citizenship", "nationality", "nacionalidad", "americano", "estadounidense",
      "canadian", "canadiense", "foreign", "extranjero", "homegrown", "sponsor", "team owner",
    ],
  },
} as const;

export const scenarioQuestions: Record<keyof typeof scenarioDefs, QuestionDefinition[]> = {
  substitutes: [
    { key: "endPeriod", label: "¿La sustitución se quiere hacer al final de un período/chukker?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "unable", label: "Si es durante el período: ¿el jugador que sale fue declarado incapaz de continuar?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
    { key: "openSpot", label: "¿La posición ya estaba vacante porque el equipo venía jugando con menos jugadores?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
    { key: "doubleSub", label: "¿Se trata de una lesión durante el período y el equipo quiere hacer una doble sustitución?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
    { key: "penalty7", label: "¿La sustitución está relacionada con una remoción por Penalty 7?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
};

export function classifyScenario(text: string) {
  const n = normalize(text);
  return (Object.entries(scenarioDefs) as Array<[keyof typeof scenarioDefs, (typeof scenarioDefs)[keyof typeof scenarioDefs]]>)
    .map(([id, def]) => {
      let score = 0;
      for (const term of def.terms) if (n.includes(normalize(term))) score += term.includes(" ") ? 4 : 2;
      return { id, score, label: def.label };
    })
    .sort((a, b) => b.score - a.score);
}


export type SubstitutionHandicapInputs = {
  eventUpper?: number | null;
  teamTotalBefore?: number | null;
  outgoingHandicap?: number | null;
  candidateHandicap?: number | null;
};

function parsedNumber(value?: string) {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseSubstitutionHandicaps(text: string): SubstitutionHandicapInputs {
  const n = normalize(text).replace(/,/g, ".");

  const eventUpper =
    parsedNumber(n.match(/torneo\s+de\s+(-?\d+(?:\.\d+)?)\s+goles?/)?.[1]) ??
    parsedNumber(n.match(/(?:limite superior|upper limit)\s+(?:de\s+)?(-?\d+(?:\.\d+)?)/)?.[1]) ??
    parsedNumber(n.match(/(-?\d+(?:\.\d+)?)\s*[- ]?goal\s+tournament/)?.[1]);

  const teamTotalBefore =
    parsedNumber(n.match(/equipo\s+(?:era\s+de|es\s+de|de|con|esta\s+en|tiene|sumaba|suma)\s+(-?\d+(?:\.\d+)?)\s+goles?/)?.[1]) ??
    parsedNumber(n.match(/team\s+(?:was\s+|is\s+|of\s+)?(-?\d+(?:\.\d+)?)\s*[- ]?goals?/)?.[1]);

  const outgoingHandicap =
    parsedNumber(n.match(/jugador\s+de\s+(-?\d+(?:\.\d+)?)\s+goles?/)?.[1]) ??
    parsedNumber(n.match(/(-?\d+(?:\.\d+)?)\s*[- ]?goal\s+player/)?.[1]);

  const candidateHandicap =
    parsedNumber(n.match(/(?:reemplazante|sustituto|suplente|replacement|substitute).{0,35}?(-?\d+(?:\.\d+)?)\s+(?:goles?|goals?)/)?.[1]) ??
    parsedNumber(n.match(/reemplazad[oa]\s+por\s+(?:un\s+)?(-?\d+(?:\.\d+)?)/)?.[1]) ??
    parsedNumber(n.match(/(?:uno|un\s+jugador)\s+de\s+(-?\d+(?:\.\d+)?)\s+goles?/)?.[1]) ??
    parsedNumber(n.match(/(?:entra|entrar|poner|consigo|hay|tengo).{0,20}?(?:un|uno|jugador)?\s*(?:de\s+)?(-?\d+(?:\.\d+)?)\s+goles?/)?.[1]);

  return { eventUpper, teamTotalBefore, outgoingHandicap, candidateHandicap };
}

export function substitutionEligibilityText(
  discipline: Discipline,
  inputs: SubstitutionHandicapInputs,
) {
  if (discipline !== "outdoor") {
    return "Para Arena, la elegibilidad del reemplazo debe resolverse con Arena Rule 3 y las Tournament Conditions aplicables. Este calculador de 3/4 Rule corresponde al reglamento Outdoor.";
  }

  const upper = inputs.eventUpper ?? null;
  const teamBefore = inputs.teamTotalBefore ?? null;
  const outgoing = inputs.outgoingHandicap ?? null;
  const candidate = inputs.candidateHandicap ?? null;

  const individualMax = upper !== null && upper >= 4 ? Math.floor(upper * 0.75 + 1e-9) : null;
  const remaining = teamBefore !== null && outgoing !== null ? teamBefore - outgoing : null;
  const aggregateMax = upper !== null && remaining !== null ? upper - remaining : null;
  const maxReplacement =
    individualMax !== null && aggregateMax !== null
      ? Math.min(individualMax, aggregateMax)
      : individualMax ?? aggregateMax;

  const parts: string[] = [];

  if (upper !== null) {
    if (individualMax !== null) {
      parts.push(`Con límite superior de ${upper} goles, la 3/4 Rule de Outdoor Rule 2.d limita a cualquier jugador individual a un máximo de ${individualMax} goles.`);
    }
    parts.push(`Outdoor Rule 3.c exige además que el handicap agregado del equipo después del cambio no supere ${upper} goles; sí puede quedar por debajo del límite inferior del evento.`);
  } else {
    parts.push("Necesito el límite superior de handicap del torneo para aplicar la 3/4 Rule y el límite agregado del equipo.");
  }

  if (teamBefore !== null && outgoing !== null && remaining !== null && upper !== null) {
    parts.push(`El equipo tenía ${teamBefore} y sale un jugador de ${outgoing}: los otros tres suman ${remaining}. Por límite agregado, el reemplazo puede tener como máximo ${aggregateMax} goles.`);
  } else if (upper !== null && outgoing !== null) {
    parts.push(`Sé que sale un jugador de ${outgoing} goles, pero para calcular el máximo exacto del reemplazante necesito el handicap total del equipo antes del cambio (o la suma de los otros tres jugadores).`);
  }

  if (maxReplacement !== null) {
    parts.push(`Máximo permitido por handicap en este caso: ${maxReplacement} goles, sujeto a las demás condiciones de elegibilidad.`);
  }

  if (candidate !== null && maxReplacement !== null) {
    parts.push(
      candidate <= maxReplacement
        ? `Un candidato de ${candidate} goles cumple los límites de handicap calculados.`
        : `Un candidato de ${candidate} goles NO cumple: supera el máximo de ${maxReplacement} para esta combinación.`,
    );
  }

  parts.push("Además, el sustituto debe haber sido elegible para comenzar el partido: membresía/credenciales y handicap en orden, no estar suspendido y no haber jugado para otro equipo en el mismo Event, salvo una Tournament Condition específica que autorice una excepción.");

  if (upper === 8 && outgoing === 5 && teamBefore === null) {
    parts.push("Ejemplo: si el equipo era exactamente de 8 goles, los otros tres suman 3 y el reemplazante puede ser como máximo de 5. Si el equipo era de 7, los otros tres suman 2 y podría entrar hasta un 6-goaler.");
  }

  return parts.join(" ");
}

export function scenarioApplicationText(
  scenario: keyof typeof scenarioDefs,
  discipline: Discipline,
  answers: Record<string, ChoiceValue>,
) {
  if (scenario !== "substitutes") return "Revisá la regla relacionada y sus interpretaciones.";

  if (answers.eligible === "no") {
    return discipline === "outdoor"
      ? "No corresponde permitir la sustitución: Outdoor Rule 3.c exige que todo sustituto sea elegible para jugar el partido."
      : "No corresponde permitir la sustitución: Arena Rule 3.c exige que el sustituto sea elegible para jugar el partido.";
  }
  if (answers.upperLimit === "yes") {
    return discipline === "outdoor"
      ? "No corresponde permitir esa combinación: Outdoor Rule 3.c establece que el handicap agregado después de la sustitución no puede superar el límite superior del evento."
      : "No corresponde permitir esa combinación: Arena Rule 3.c(2) establece que el handicap agregado después de la sustitución no puede superar el límite superior del evento.";
  }
  if (answers.penalty7 === "yes") {
    return discipline === "outdoor"
      ? "Hay un régimen especial por Penalty 7. Outdoor Rule 3.f limita las sustituciones posteriores y, si los equipos quedan reducidos a tres jugadores por lado, el jugador lesionado no puede reingresar."
      : "Hay un régimen especial por Penalty 7. Arena Rule 3.c(4)-(5) limita las sustituciones posteriores y, si los equipos quedan reducidos a dos jugadores por lado, el lesionado no puede reingresar.";
  }
  if (answers.endPeriod === "yes") {
    return discipline === "outdoor"
      ? "En principio sí. Outdoor Rule 3.a permite sustituciones ilimitadas al final de cualquier período, sujeto a la excepción de Rule 21.d y a que los sustitutos sean elegibles y el equipo no supere el límite superior de handicap."
      : "En principio sí. Arena Rule 3.c permite sustituciones ilimitadas al final de cualquier período, siempre que los sustitutos sean elegibles y el equipo continúe dentro del límite superior de handicap.";
  }
  if (answers.openSpot === "yes") {
    return discipline === "outdoor"
      ? "Si la posición quedó abierta porque el jugador ya salió y el equipo está jugando corto, el Rulebook incluye el ejemplo de que un sustituto elegible puede entrar cuando se lo encuentra, incluso durante el período."
      : "La regla de Arena permite continuar con menos jugadores dentro de sus límites y las sustituciones siguen sujetas a elegibilidad y handicap. Para una entrada durante el período, revisá además si la plaza quedó abierta por incapacidad de continuar."
  }
  if (answers.unable === "yes") {
    if (answers.doubleSub === "yes") {
      return discipline === "outdoor"
        ? "Sí, puede corresponder una doble sustitución por lesión durante el período: Outdoor Rule 3.b permite reemplazar al lesionado y a un segundo jugador con sustitutos elegibles, siempre que el equipo siga siendo elegible."
        : "Sí, puede corresponder una doble sustitución por lesión durante el período: Arena Rule 3.c(1) permite reemplazar al lesionado y a un segundo jugador con sustitutos elegibles, manteniendo la elegibilidad del equipo.";
    }
    return discipline === "outdoor"
      ? "Durante un período, Outdoor Rule 3.b permite una sustitución cuando un miembro del equipo no puede terminar el partido. El sustituto debe ser elegible y el equipo no puede superar el límite superior de handicap."
      : "Durante un período, la interpretación de Arena Rule 3 indica que un jugador solo puede ser reemplazado si fue declarado incapaz de continuar. Se mantienen los requisitos de elegibilidad y handicap.";
  }
  if (answers.unable === "no" && answers.endPeriod === "no") {
    return discipline === "outdoor"
      ? "No debería hacerse durante el período si el jugador que sale puede continuar. La interpretación de Outdoor Rule 3 reserva el reemplazo durante el período para quien sea declarado incapaz de continuar; de lo contrario, el cambio debe esperar al final del período."
      : "No debería hacerse durante el período si el jugador que sale puede continuar. La interpretación de Arena Rule 3 reserva los reemplazos durante el período para jugadores declarados incapaces de continuar.";
  }
  return "La situación encaja con la regla de sustituciones. Para cerrar la decisión faltan datos sobre el momento del cambio, la capacidad del jugador para continuar, la elegibilidad del sustituto y el límite superior de handicap.";
}


export type SubstitutionNationalityInputs = {
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
};

export type AnalysisSection = {
  id: string;
  title: string;
  items: string[];
  tone?: "info" | "pass" | "warning" | "fail";
};

const localText = (language: Language, en: string, es: string) => language === "en" ? en : es;

export function localizedApplicationText(topic: TopicId, answers: Record<string, ChoiceValue>, language: Language) {
  if (language === "es") return applicationText(topic, answers);
  const a = answers;
  if (topic === "row") {
    if (a.risk === "yes" && a.lineChanged === "yes") return "This is primarily a Right of Way analysis after a change in the Line of the Ball. The opponent must be given sufficient time to clear the new ROW. If the player with ROW had to check or alter course to avoid danger, there is a strong basis for a foul.";
    if (a.risk === "yes") return "The critical fact is that the player with the possible ROW had to check, alter course, or face a collision risk. Entry or crossing is only legal when speed and distance create no appreciable risk.";
    if (a.risk === "no") return "If the player with ROW did not need to check or alter course and there was no appreciable risk, the action may be legal. Confirm which player actually held the ROW based on the Line of the Ball.";
    return "The ruling depends mainly on who held the ROW and whether the entry or crossing created risk. That fact still needs to be confirmed.";
  }
  if (topic === "dangerous") {
    if (a.balance === "yes") return "A horse being knocked off balance is a particularly strong Dangerous Riding indicator. Relative speed, horse size, position, angle, fatigue, and whether the opponent was prepared must also be considered.";
    if (a.speedAngle === "yes" || a.blind === "yes") return "The facts include factors expressly relevant to Dangerous Riding: speed, angle, relative position, and/or an opponent who was not prepared for the contact. The Umpire still evaluates the degree of danger.";
    return "Evaluate the contact under the Dangerous Riding factors. If there was no undue force, dangerous speed/angle difference, or unnecessary risk, the ride-off may be legal.";
  }
  if (topic === "blocking") {
    if (a.restartBlock === "yes" && a.marking === "yes") return "The facts fit the core Improper Blocking situation during a knock-in, Penalty 5.a/5.b, or free hit from out of bounds: an attacker may not prevent a defender from marking a teammate who has a play on the ball.";
    if (a.slow === "yes") return "In open play, the rule also addresses blocking when the ball carrier slows to a slow canter or walk and a teammate blocks a defender within two horse lengths.";
    return "Confirm whether the defender was actually prevented from marking or making a play. Mere positioning by a teammate is not automatically Improper Blocking.";
  }
  if (topic === "mallet") return a.strokeDanger === "yes" ? "The risk created by the swing or hook is the central issue. Review the mallet rule and its safety conditions before selecting any penalty." : "Confirm relative position and the form of the hook or stroke. Without danger or a prohibited condition, the mallet action may be legal.";
  if (topic === "conduct") return a.repeat === "yes" ? "Repetition matters in addition to the individual act. The rules allow escalation for repeated or flagrant misconduct." : "Evaluate whether the conduct was deliberate or abusive and its effect on the game. Any sanction should be tied to the conduct and penalty provisions.";
  return a.early === "yes" ? "Playing before the Umpire calls Play is a relevant procedural fact. Apply the specific restart rule and the corresponding penalty procedure." : "The answer depends on whether the ball was dead and which restart procedure applied.";
}

export function localizedScenarioApplicationText(scenario: keyof typeof scenarioDefs, discipline: Discipline, answers: Record<string, ChoiceValue>, language: Language) {
  if (language === "es") return scenarioApplicationText(scenario, discipline, answers);
  if (scenario !== "substitutes") return "Review the related rule and its Interpretations.";
  if (answers.eligible === "no") return "The substitution should not be allowed: the substitute must be eligible to play in the game.";
  if (answers.upperLimit === "yes") return "The proposed combination is not permitted because the team aggregate handicap after substitution would exceed the event upper limit.";
  if (answers.penalty7 === "yes") return discipline === "outdoor" ? "Penalty 7 creates a special substitution regime under Outdoor Rule 3.f, including limits on later substitutions and re-entry." : "Penalty 7 creates a special substitution regime under Arena Rule 3.";
  if (answers.endPeriod === "yes") return "Generally yes. Substitutions may be made between periods, subject to eligibility, handicap, and any special injury or event condition.";
  if (answers.openSpot === "yes") return "If the position is already open because the player has left and the team is playing short, an eligible substitute may enter when found under the Rulebook example.";
  if (answers.unable === "yes") return answers.doubleSub === "yes" ? "An injury during a period can permit a double substitution, provided the substitutes and resulting team remain eligible." : "During a period, a substitution may be made when the player is unable to finish the game, subject to eligibility and team handicap limits.";
  if (answers.unable === "no" && answers.endPeriod === "no") return "The change should not be made during the period if the player being replaced is still able to continue.";
  return "The substitution rule applies, but additional facts are needed to close the eligibility decision.";
}

export function substitutionAnalysisSections(
  discipline: Discipline,
  handicapInputs: SubstitutionHandicapInputs,
  nationality: SubstitutionNationalityInputs,
  answers: Record<string, ChoiceValue>,
  language: Language,
): AnalysisSection[] {
  if (discipline !== "outdoor") {
    return [{ id: "decision", title: localText(language, "Decision", "Decisión"), tone: "warning", items: [localText(language, "The nationality cross-check is currently modeled on Outdoor Rule 1.f. For Arena, use the Arena Rules plus the applicable Tournament Conditions.", "El control de nacionalidad está modelado actualmente sobre Outdoor Rule 1.f. Para Arena hay que usar las Arena Rules y las Tournament Conditions aplicables.")] }];
  }

  const upper = handicapInputs.eventUpper ?? null;
  const teamBefore = handicapInputs.teamTotalBefore ?? null;
  const outgoing = handicapInputs.outgoingHandicap ?? null;
  const candidate = handicapInputs.candidateHandicap ?? null;
  const individualMax = upper !== null && upper >= 4 ? Math.floor(upper * 0.75 + 1e-9) : null;
  const remainingHandicap = teamBefore !== null && outgoing !== null ? teamBefore - outgoing : null;
  const aggregateMax = upper !== null && remainingHandicap !== null ? upper - remainingHandicap : null;
  const maxReplacement = individualMax !== null && aggregateMax !== null ? Math.min(individualMax, aggregateMax) : individualMax ?? aggregateMax;

  const decision: string[] = [];
  const handicap: string[] = [];
  const american: string[] = [];
  const eligibility: string[] = [];
  const missing: string[] = [];

  if (individualMax !== null) handicap.push(localText(language, "3/4 Rule individual ceiling: " + individualMax + " goals.", "Máximo individual por 3/4 Rule: " + individualMax + " goles."));
  if (aggregateMax !== null && teamBefore !== null && outgoing !== null) handicap.push(localText(language, "The team was " + teamBefore + "; after the " + outgoing + "-goal player leaves, the other three total " + remainingHandicap + ". The replacement can be at most " + aggregateMax + " by the aggregate team limit.", "El equipo era de " + teamBefore + "; al salir el jugador de " + outgoing + ", los otros tres suman " + remainingHandicap + ". Por el límite agregado, el reemplazo puede ser como máximo de " + aggregateMax + "."));
  else if (upper !== null && outgoing !== null) missing.push(localText(language, "Original team handicap, or the total handicap of the three players who remain.", "Handicap original del equipo, o suma de los tres jugadores que quedan."));

  if (candidate !== null && maxReplacement !== null) {
    decision.push(candidate <= maxReplacement ? localText(language, "A " + candidate + "-goal candidate passes the handicap ceiling of " + maxReplacement + ".", "Un candidato de " + candidate + " goles cumple el máximo de " + maxReplacement + ".") : localText(language, "A " + candidate + "-goal candidate exceeds the handicap ceiling of " + maxReplacement + ".", "Un candidato de " + candidate + " goles supera el máximo de " + maxReplacement + "."));
  } else if (maxReplacement !== null) {
    decision.push(localText(language, "Maximum replacement handicap on the facts entered: " + maxReplacement + " goals.", "Máximo handicap del reemplazante con estos datos: " + maxReplacement + " goles."));
  }

  if (nationality.uspaNpcEvent === "yes") {
    american.push(localText(language, "Rule 1.f is a separate test from handicap. American Player is a defined USPA status: a Registered Player Member qualifies, and a Canadian citizen who is an Affiliate Player Member also qualifies.", "Rule 1.f es un control separado del handicap. American Player es una categoría definida por USPA: califica un Registered Player Member y también un ciudadano canadiense que sea Affiliate Player Member."));
    const required = nationality.sponsorType === "nonplaying" ? 2 : nationality.sponsorType === "playing" ? 1 : null;
    const candidateCounts = nationality.candidateAmerican === "yes" || nationality.affiliateHostException === "yes";
    if (required === null) missing.push(localText(language, "Whether the team has a playing sponsor or a non-playing sponsor.", "Si el equipo tiene playing sponsor o non-playing sponsor."));
    if (nationality.americanPlayersRemaining === null) missing.push(localText(language, "How many countable American Players remain after the injured player leaves.", "Cuántos American Players computables quedan después de que sale el lesionado."));
    if (required !== null && nationality.americanPlayersRemaining !== null) {
      const countAfter = nationality.americanPlayersRemaining + (candidateCounts ? 1 : 0);
      if (countAfter < required) decision.push(localText(language, "The proposed substitution would fail the American Rule: " + countAfter + " countable American Player(s) after the change, with " + required + " required.", "La sustitución incumpliría la American Rule: quedarían " + countAfter + " American Player(s) computables y se requieren " + required + "."));
      else american.push(localText(language, "American Rule count after substitution: " + countAfter + "; minimum required: " + required + ".", "American Players después de la sustitución: " + countAfter + "; mínimo requerido: " + required + "."));
    }
    if (nationality.candidateAmerican === "unknown" && nationality.affiliateHostException !== "yes") missing.push(localText(language, "Whether the substitute qualifies as an American Player under Rule 1.f. Nationality by itself is not enough; USPA membership classification matters.", "Si el sustituto califica como American Player bajo Rule 1.f. La nacionalidad por sí sola no alcanza; importa la categoría de membresía USPA."));
    if (nationality.outgoingRole === "unknown") missing.push(localText(language, "Whether the player being replaced is the team owner, designated sponsor, playing sponsor, or another player.", "Si el jugador reemplazado es team owner, designated sponsor, playing sponsor u otro jugador."));

    const beforeAmericans = nationality.americanPlayersRemaining !== null && nationality.outgoingAmerican !== "unknown" ? nationality.americanPlayersRemaining + (nationality.outgoingAmerican === "yes" ? 1 : 0) : null;
    const specialRestriction = nationality.gauntlet === "yes" || (beforeAmericans === null || beforeAmericans < 2);
    if (specialRestriction && nationality.outgoingRole === "teamOwner") {
      american.push(localText(language, "When Rule 1.f's owner-replacement restriction applies, the team owner may be replaced by an immediate family member of the owner or an American Player.", "Cuando aplica la restricción de Rule 1.f para el team owner, puede reemplazarlo un familiar inmediato del owner o un American Player."));
      if (nationality.candidateImmediateFamily === "no" && !candidateCounts) decision.push(localText(language, "The proposed substitute does not satisfy the special replacement categories for the team owner.", "El sustituto propuesto no cumple las categorías especiales para reemplazar al team owner."));
    }
    if (specialRestriction && nationality.outgoingRole === "designatedSponsor") {
      american.push(localText(language, "When Rule 1.f's designated-sponsor restriction applies, the replacement must be the team owner, an immediate family member of the owner, or an American Player.", "Cuando aplica la restricción de Rule 1.f para el designated sponsor, el reemplazo debe ser el team owner, un familiar inmediato del owner o un American Player."));
      if (nationality.candidateIsTeamOwner === "no" && nationality.candidateImmediateFamily === "no" && !candidateCounts) decision.push(localText(language, "The proposed substitute does not satisfy the special replacement categories for the designated sponsor.", "El sustituto propuesto no cumple las categorías especiales para reemplazar al designated sponsor."));
    }

    if (nationality.affiliateHostException === "yes") american.push(localText(language, "Tournament Conditions IV.A(3)/IV.B(2) contain a host-country exception for National or Circuit Events at a USPA Affiliate Member Club: the Registered Player Member required by Rule 1.f may be replaced by an Affiliate Player Member who is a citizen of the host country.", "Tournament Conditions IV.A(3)/IV.B(2) contienen una excepción del país anfitrión para National o Circuit Events en un USPA Affiliate Member Club: el Registered Player Member requerido por Rule 1.f puede ser reemplazado por un Affiliate Player Member ciudadano del país anfitrión."));
    if (upper !== null && upper >= 16) american.push(localText(language, "Because this event is 16 goals or higher, also check Rule 1.f(6)-(8) for Homegrown / extra-American one-goal credits and whether the substitute preserves the credit.", "Como el evento es de 16 goles o más, también hay que revisar Rule 1.f(6)-(8) por créditos Homegrown / American Player adicional y si el sustituto conserva ese crédito."));
  } else if (nationality.uspaNpcEvent === "unknown") {
    missing.push(localText(language, "Whether this is a USPA or NPC Event. Rule 1.f's American Rule is written for USPA/NPC Events.", "Si se trata de un USPA o NPC Event. La American Rule de Rule 1.f está redactada para eventos USPA/NPC."));
  } else {
    american.push(localText(language, "Rule 1.f does not automatically decide a non-USPA/NPC event; check that event's own conditions.", "Rule 1.f no resuelve automáticamente un evento que no sea USPA/NPC; hay que revisar sus condiciones propias."));
  }

  eligibility.push(localText(language, "The substitute must otherwise have been eligible to start the game: current membership/credentials, handicap in order, no applicable suspension, and no prior play for another team in the same Event unless a specific Tournament Condition permits it.", "El sustituto además debe haber sido elegible para iniciar el partido: membresía/credenciales vigentes, handicap en orden, sin suspensión aplicable y sin haber jugado para otro equipo en el mismo Event salvo una Tournament Condition específica."));
  if (answers.unable === "no" && answers.endPeriod === "no") decision.push(localText(language, "Even an otherwise eligible substitute cannot make this change during the period if the player being replaced can continue.", "Aunque el sustituto sea elegible, el cambio no puede hacerse durante el período si el jugador reemplazado puede continuar."));

  if (!decision.length) decision.push(missing.length ? localText(language, "A final ruling cannot be made yet because one or more facts change the answer.", "Todavía no puede cerrarse la decisión porque faltan uno o más datos que cambian la respuesta.") : localText(language, "No disqualifying condition has been identified from the facts entered, subject to the Tournament Conditions.", "No se detectó una condición que lo vuelva inelegible con los datos cargados, sujeto a las Tournament Conditions."));

  const refs = [
    localText(language, "Outdoor Rule 1.f - American Rule and sponsor-related substitution restrictions.", "Outdoor Rule 1.f - American Rule y restricciones vinculadas al sponsor."),
    localText(language, "Outdoor Rule 2.d - individual player handicap limits, including the 3/4 Rule.", "Outdoor Rule 2.d - límites individuales de handicap, incluida la 3/4 Rule."),
    localText(language, "Outdoor Rule 3.b-c - timing, substitute eligibility, and aggregate handicap.", "Outdoor Rule 3.b-c - momento del cambio, elegibilidad y handicap agregado."),
    localText(language, "Tournament Conditions IV.A(3)/IV.B(2) - Affiliate Member Club host-country exception.", "Tournament Conditions IV.A(3)/IV.B(2) - excepción del país anfitrión en Affiliate Member Clubs."),
  ];

  const sections: AnalysisSection[] = [
    { id: "decision", title: localText(language, "Decision", "Decisión"), items: decision, tone: missing.length ? "warning" : "pass" },
    { id: "handicap", title: localText(language, "Handicap check", "Control de handicap"), items: handicap, tone: "info" },
    { id: "american", title: localText(language, "American Rule / nationality", "American Rule / nacionalidad"), items: american, tone: "info" },
    { id: "eligibility", title: localText(language, "Other eligibility checks", "Otros controles de elegibilidad"), items: eligibility, tone: "info" },
  ];
  if (missing.length) sections.push({ id: "missing", title: localText(language, "Facts still needed", "Datos que todavía faltan"), items: Array.from(new Set(missing)), tone: "warning" });
  sections.push({ id: "references", title: localText(language, "Rule references", "Referencias reglamentarias"), items: refs, tone: "info" });
  return sections.filter((section) => section.items.length > 0);
}

export function parseSubstitutionNationality(text: string): Partial<SubstitutionNationalityInputs> {
  const n = normalize(text);
  const out: Partial<SubstitutionNationalityInputs> = {};
  if (/(uspa|npc) event/.test(n) || /evento uspa|evento npc/.test(n)) out.uspaNpcEvent = "yes";
  if (/non[- ]?playing sponsor|sponsor no jugador/.test(n)) out.sponsorType = "nonplaying";
  if (/playing sponsor|sponsor jugador/.test(n)) out.sponsorType = "playing";
  if (/team owner|dueno del equipo|dueño del equipo/.test(n)) out.outgoingRole = "teamOwner";
  if (/designated sponsor/.test(n)) out.outgoingRole = "designatedSponsor";
  if (/registered player member/.test(n) || /canadian affiliate player member/.test(n) || /califica como american player/.test(n)) out.candidateAmerican = "yes";
  if (/does not qualify as an american player|no califica como american player/.test(n)) out.candidateAmerican = "no";
  const remaining = n.match(/(\d+)\s+(?:american players?|jugadores? american(?:os)?).*?(?:remain|remaining|quedan|queda)/);
  if (remaining) out.americanPlayersRemaining = Number(remaining[1]);
  if (/affiliate member club/.test(n) && /(host country|pais anfitrion|país anfitrión)/.test(n)) out.affiliateHostException = "yes";
  if (/gauntlet of polo/.test(n)) out.gauntlet = "yes";
  return out;
}

export function bestMatchingApplication(rule: Rule, query: string) {
  const items = rule.applications ?? [];
  if (!items.length || !query.trim()) return null;
  const toks = words(query);
  let best: { item: (typeof items)[number]; score: number } | null = null;
  for (const item of items) {
    const hay = normalize(`${item.label} ${item.text}`);
    let score = 0;
    for (const token of toks) if (hay.includes(token)) score += token.length > 5 ? 3 : 1;
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score > 0 ? best.item : null;
}
