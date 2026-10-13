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

  if (topic === "dangerous") {
    if (hasUnknownRelevantFact(topic, answers)) {
      return {
        level: "insufficient-coverage",
        reasonEn: "One or more decisive Dangerous Riding facts are still unknown.",
        reasonEs: "Uno o más hechos decisivos de Dangerous Riding todavía son desconocidos.",
        scopeEn: "Do not close the call until the Umpire has evaluated the missing observed facts.",
        scopeEs: "No cierres la decisión hasta que el Umpire haya evaluado los hechos observados faltantes.",
      };
    }
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

  if (hasUnknownRelevantFact(topic, answers) || decision.status === "needs-info") {
    return {
      level: "insufficient-coverage",
      reasonEn: "One or more decisive facts are missing, unknown, or outside the currently validated decision model.",
      reasonEs: "Falta uno o más hechos decisivos, son desconocidos o están fuera del modelo de decisión actualmente validado.",
      scopeEn: "Do not treat this result as a final call. Review the cited official provisions.",
      scopeEs: "No tomes este resultado como decisión final. Revisá las disposiciones oficiales citadas.",
    };
  }

  if (topic === "row") {
    if (answers.rowEntitlementDerived) {
      return {
        level: "direct-rule-support",
        reasonEn: "ROW entitlement was derived through a modeled Rule 24(e)-(h) physical-fact branch, and the crossing/line-change conclusion is tied to the cited Rule 24 provisions.",
        reasonEs: "La titularidad del ROW fue derivada mediante una rama modelada de hechos físicos de Rule 24(e)-(h), y la conclusión sobre cruce/cambio de línea está ligada a las disposiciones citadas de Rule 24.",
        scopeEn: "Direct Rule Support means the logic is explicit if the physical facts entered by the Umpire are accurate. Observation of those facts and the final call remain with the Umpire.",
        scopeEs: "Apoyo Directo de Regla significa que la lógica es expresa si los hechos físicos cargados por el Umpire son correctos. La observación de esos hechos y la decisión final siguen siendo del Umpire.",
      };
    }
    return {
      level: "umpire-judgment",
      reasonEn: "The Rule 24 application is directly supported, but ROW entitlement was entered as an Umpire-established fact rather than derived through the Rule 24(e)-(h) helper.",
      reasonEs: "La aplicación de Rule 24 tiene apoyo directo, pero la titularidad del ROW fue cargada como un hecho establecido por el Umpire en vez de derivarse mediante el asistente de Rule 24(e)-(h).",
      scopeEn: "Use the Rule 24 entitlement helper when possible. Otherwise the ruling is reliable only if the entered ROW entitlement and observed risk facts are correct.",
      scopeEs: "Usá el asistente de titularidad de Rule 24 cuando sea posible. De lo contrario, la decisión es confiable sólo si la titularidad de ROW cargada y los hechos de riesgo observados son correctos.",
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
