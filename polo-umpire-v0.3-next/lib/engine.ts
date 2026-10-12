import type { ChoiceValue, Discipline, QuestionDefinition, Rule, TopicDefinition, TopicId } from "./types";

export const topicDefs: Record<TopicId, TopicDefinition> = {
  row: {
    label: "Right of Way / Crossing",
    outdoor: ["24", "23"], arena: ["12", "11"],
    terms: ["right of way", "row", "cruce", "cruzar", "cruzo", "cruza", "linea", "línea", "cross", "crossing", "trayectoria", "paso", "frenar", "check", "alterar curso"],
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
    terms: ["insulto", "protesta", "protestar", "unsportsmanlike", "conducta", "tarjeta", "yellow card", "red card", "reiterada", "repetida"],
  },
  restart: {
    label: "Reanudación / pelota muerta",
    outdoor: ["20", "21", "22", "36"], arena: ["7", "8", "16"],
    terms: ["penalty", "penalidad", "knock in", "knock-in", "throw in", "throw-in", "bowl in", "play", "reanudar", "reanudacion", "pelota muerta", "dead ball"],
  },
};

export const questions: Record<TopicId, QuestionDefinition[]> = {
  row: [
    { key: "risk", label: "¿La acción obligó al jugador con el posible Right of Way a frenar, cambiar dirección o generó riesgo de colisión?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "lineChanged", label: "¿La línea de la pelota había cambiado inmediatamente antes de la acción?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
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
    { key: "slow", label: "Si fue durante juego abierto: ¿el jugador con pelota frenó o bajó a slow canter/walk y el bloqueo fue dentro de dos largos de caballo?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
  ],
  mallet: [
    { key: "strokeDanger", label: "¿El swing/hook puso en riesgo a otro jugador o caballo?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "sameSide", label: "¿El hook se hizo desde el mismo lado del caballo que el jugador que realizaba el stroke?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  conduct: [
    { key: "deliberate", label: "¿La conducta fue deliberada, abusiva o contraria al espíritu del juego?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "repeat", label: "¿Ya hubo faltas similares o una advertencia/tarjeta previa?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
  restart: [
    { key: "dead", label: "¿La pelota estaba fuera de juego o el reloj detenido?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "early", label: "¿Alguien golpeó/jugó antes de que el Umpire llamara “Play”?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
  ],
};

export const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const words = (value = "") => normalize(value).split(/[^a-z0-9]+/).filter((x) => x.length > 1);

export function classify(text: string) {
  const n = normalize(text);
  return (Object.entries(topicDefs) as Array<[TopicId, TopicDefinition]>).map(([id, t]) => {
    let score = 0;
    for (const term of t.terms) if (n.includes(normalize(term))) score += term.includes(" ") ? 3 : 2;
    return { id, score, label: t.label };
  }).sort((a, b) => b.score - a.score);
}

export function scoreRule(rule: Rule, query: string) {
  if (!query) return 1;
  const nq = normalize(query);
  const toks = words(query);
  let score = 0;
  if (normalize(rule.title).includes(nq)) score += 20;
  if (normalize(`rule ${rule.rule}`).includes(nq) || normalize(`regla ${rule.rule}`).includes(nq)) score += 20;
  for (const k of rule.keywords ?? []) if (nq.includes(normalize(k)) || normalize(k).includes(nq)) score += 8;
  const hay = normalize(`${rule.title} ${(rule.keywords ?? []).join(" ")} ${rule.text.slice(0, 5000)}`);
  for (const token of toks) if (hay.includes(token)) score += token.length > 5 ? 3 : 1;
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
    return "La acción debe evaluarse con los factores de Dangerous Riding. Si no hubo fuerza indebida, diferencia peligrosa de velocidad/ángulo ni riesgo innecesario, puede tratarse de un ride-off legal.";
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
    outdoor: ["3"],
    arena: ["3"],
    terms: [
      "substitute", "substitution", "sustituto", "suplente", "reemplazo", "reemplazar",
      "alternate", "alterno", "lesionado", "injury", "injured", "unable to continue",
      "no puede continuar", "handicap del equipo", "doble sustitucion", "double substitution",
    ],
  },
} as const;

export const scenarioQuestions: Record<keyof typeof scenarioDefs, QuestionDefinition[]> = {
  substitutes: [
    { key: "endPeriod", label: "¿La sustitución se quiere hacer al final de un período/chukker?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "unable", label: "Si es durante el período: ¿el jugador que sale fue declarado incapaz de continuar?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
    { key: "openSpot", label: "¿La posición ya estaba vacante porque el equipo venía jugando con menos jugadores?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
    { key: "doubleSub", label: "¿Se trata de una lesión durante el período y el equipo quiere hacer una doble sustitución?", options: [["yes", "Sí"], ["no", "No"], ["na", "No aplica"]] },
    { key: "eligible", label: "¿El/los sustitutos son elegibles para jugar ese partido/evento?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
    { key: "upperLimit", label: "¿La sustitución haría que el handicap agregado del equipo supere el límite superior del evento?", options: [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] },
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
