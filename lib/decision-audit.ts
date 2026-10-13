import type { ChoiceValue, Discipline, TopicId } from "./types";
import type { PlayDecision } from "./play-decision";
import { matchProgress } from "./match-flow";

export type DecisionAuditLevel = "direct-rule-support" | "umpire-judgment" | "insufficient-coverage";

export type DecisionAudit = {
  level: DecisionAuditLevel;
  reasonEn: string;
  reasonEs: string;
  scopeEn: string;
  scopeEs: string;
};

function hasUnknownRelevantFact(topic: TopicId, answers: Record<string, ChoiceValue>) {
  const progress = matchProgress(topic, answers);
  return progress.keys.some((key) => answers[key] === "unknown" || answers[key] === undefined || answers[key] === "");
}

export function auditPlayDecision(
  topic: TopicId,
  discipline: Discipline,
  answers: Record<string, ChoiceValue>,
  decision: PlayDecision,
): DecisionAudit {
  if (discipline === "arena") {
    return {
      level: "insufficient-coverage",
      reasonEn: "Arena is not yet modeled deeply enough for a definitive automated call in every branch.",
      reasonEs: "Arena todavía no está modelado con suficiente profundidad como para dar una decisión automática definitiva en todas las ramas.",
      scopeEn: "Use the cited Arena provisions. The Umpire makes the final ruling.",
      scopeEs: "Usá las disposiciones Arena citadas. La decisión final corresponde al Umpire.",
    };
  }

  if (hasUnknownRelevantFact(topic, answers) || decision.status === "needs-info") {
    if (topic === "dangerous" && (answers.balance === "yes" || answers.speedAngle === "yes" || answers.blind === "yes")) {
      return {
        level: "umpire-judgment",
        reasonEn: "Rule 26 supplies relevant danger factors, but the Rulebook leaves the overall dangerous ride-off judgment to the Umpire except for specific strong indicators such as a mount being knocked off balance.",
        reasonEs: "Rule 26 aporta factores relevantes de peligro, pero el Rulebook deja la valoración general del dangerous ride-off al Umpire salvo indicadores fuertes específicos como que un caballo pierda el equilibrio.",
        scopeEn: "The app identifies the controlling rule and factors; the Umpire evaluates the observed contact and aggressor.",
        scopeEs: "La app identifica la regla y los factores de control; el Umpire evalúa el contacto observado y al agresor.",
      };
    }
    return {
      level: "insufficient-coverage",
      reasonEn: "One or more decisive facts are missing, unknown, or outside the currently validated decision model.",
      reasonEs: "Falta uno o más hechos decisivos, son desconocidos o están fuera del modelo de decisión actualmente validado.",
      scopeEn: "Do not treat this result as a final call. Review the cited official provisions.",
      scopeEs: "No tomes este resultado como decisión final. Revisá las disposiciones oficiales citadas.",
    };
  }

  if (topic === "row") {
    return {
      level: "umpire-judgment",
      reasonEn: "The Rule 24 application is directly supported, but the current model still accepts ROW entitlement as an Umpire-established fact rather than deriving every entitlement path in Rule 24(e)-(h).",
      reasonEs: "La aplicación de Rule 24 tiene apoyo directo, pero el modelo actual todavía recibe la titularidad del ROW como un hecho establecido por el Umpire en vez de derivar todas las vías de Rule 24(e)-(h).",
      scopeEn: "The ruling is reliable only if the entered ROW entitlement and observed risk facts are correct.",
      scopeEs: "La decisión es confiable sólo si la titularidad de ROW cargada y los hechos de riesgo observados son correctos.",
    };
  }

  if (topic === "dangerous") {
    if (answers.balance === "yes" && decision.status === "foul") {
      return {
        level: "direct-rule-support",
        reasonEn: "Rule 26 states that when a mount is knocked off balance, a dangerous ride-off has occurred.",
        reasonEs: "Rule 26 establece que cuando un caballo pierde el equilibrio ha ocurrido un dangerous ride-off.",
        scopeEn: "Identifying the aggressor and selecting the penalty still require Umpire judgment.",
        scopeEs: "Identificar al agresor y seleccionar la penalidad todavía requieren juicio del Umpire.",
      };
    }
    return {
      level: "umpire-judgment",
      reasonEn: "Rule 26 lists non-exhaustive factors and expressly requires judgment of the total circumstances.",
      reasonEs: "Rule 26 enumera factores no exhaustivos y exige valorar el conjunto de circunstancias.",
      scopeEn: "The app may identify indicators, but it should not convert their absence into a definitive no-foul.",
      scopeEs: "La app puede identificar indicadores, pero no debe convertir su ausencia en un no-foul definitivo.",
    };
  }

  if (topic === "blocking") {
    return {
      level: "direct-rule-support",
      reasonEn: "The modeled Rule 26A branches use the stated restart/open-play conditions and whether the defender was prevented from marking the relevant player.",
      reasonEs: "Las ramas modeladas de Rule 26A usan las condiciones expresas de restart/juego abierto y si se impidió al defensor marcar al jugador relevante.",
      scopeEn: decision.status === "no-foul"
        ? "This means Improper Blocking is not established on the entered facts; another foul may still exist."
        : "The Umpire still selects the appropriate penalty and checks for separate dangerous conduct.",
      scopeEs: decision.status === "no-foul"
        ? "Esto significa que Improper Blocking no queda establecido con los hechos cargados; todavía puede existir otra falta."
        : "El Umpire todavía selecciona la penalidad apropiada y verifica si hubo además conducta peligrosa.",
    };
  }

  if (topic === "mallet") {
    if (answers.strokeDanger === "yes") {
      return {
        level: "umpire-judgment",
        reasonEn: "Rule 28 directly requires safe mallet use, but whether a particular swing was dangerous or whether another player created the danger is an observed Umpire judgment.",
        reasonEs: "Rule 28 exige directamente un uso seguro del mallet, pero si un swing concreto fue peligroso o si otro jugador creó el peligro es una valoración observacional del Umpire.",
        scopeEn: "The app identifies the controlling provisions; the Umpire decides the factual responsibility.",
        scopeEs: "La app identifica las disposiciones de control; el Umpire decide la responsabilidad fáctica.",
      };
    }
    return {
      level: "direct-rule-support",
      reasonEn: "The hook branch is tied to the explicit Rule 28 positioning, timing, clearance and force conditions.",
      reasonEs: "La rama del hook está ligada a las condiciones expresas de Rule 28 sobre posición, timing, clearance y fuerza.",
      scopeEn: decision.status === "no-foul"
        ? "This is a no-foul only for the modeled mallet/hook issue, not a declaration that the entire play was legal."
        : "The Umpire retains authority over the final call and penalty.",
      scopeEs: decision.status === "no-foul"
        ? "Es un no-foul sólo respecto del aspecto modelado de mallet/hook, no una declaración de que toda la jugada fue legal."
        : "El Umpire conserva autoridad sobre la decisión final y la penalidad.",
    };
  }

  if (topic === "conduct") {
    return {
      level: "umpire-judgment",
      reasonEn: "Rule 33 can be directly controlling, but characterization, severity, repetition and card consequences depend on the conduct actually observed.",
      reasonEs: "Rule 33 puede ser directamente aplicable, pero la caracterización, severidad, reiteración y consecuencias de tarjetas dependen de la conducta realmente observada.",
      scopeEn: "Use the app as a structured checklist; the Umpire makes the final conduct ruling.",
      scopeEs: "Usá la app como checklist estructurado; el Umpire toma la decisión final sobre conducta.",
    };
  }

  return {
    level: "direct-rule-support",
    reasonEn: "The procedure classification is tied to the cited restart provisions and the entered restart facts.",
    reasonEs: "La clasificación de procedimiento está ligada a las disposiciones de reanudación citadas y a los hechos cargados.",
    scopeEn: "Exact penalty execution may still require the specific Rule 36 procedure and Umpire judgment.",
    scopeEs: "La ejecución exacta de la penalidad todavía puede requerir el procedimiento específico de Rule 36 y juicio del Umpire.",
  };
}

export function auditLevelLabel(level: DecisionAuditLevel, language: "en" | "es") {
  if (language === "en") {
    if (level === "direct-rule-support") return "DIRECT RULE SUPPORT";
    if (level === "umpire-judgment") return "UMPIRE JUDGMENT";
    return "INSUFFICIENT VALIDATED COVERAGE";
  }
  if (level === "direct-rule-support") return "APOYO DIRECTO DE REGLA";
  if (level === "umpire-judgment") return "JUICIO DEL UMPIRE";
  return "COBERTURA VALIDADA INSUFICIENTE";
}
