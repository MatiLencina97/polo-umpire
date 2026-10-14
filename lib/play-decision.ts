import type { ChoiceValue, Discipline, Language, TopicId } from "./types";

export type DecisionTone = "pass" | "fail" | "warning" | "info";

export type PlayDecision = {
  status: "foul" | "no-foul" | "needs-info" | "procedure";
  headline: string;
  summary: string;
  references: string[];
  missing: string[];
  penalty: string[];
  sections: Array<{ id: string; title: string; tone: DecisionTone; items: string[] }>;
};

const t = (language: Language, en: string, es: string) => language === "en" ? en : es;
const unknown = (value?: ChoiceValue) => !value || value === "unknown";

function makeDecision(args: {
  status: PlayDecision["status"];
  headline: string;
  summary: string;
  references: string[];
  missing?: string[];
  penalty?: string[];
  language: Language;
}) : PlayDecision {
  const missing = args.missing ?? [];
  const penalty = args.penalty ?? [];
  const sections: PlayDecision["sections"] = [
    {
      id: "ruling",
      title: t(args.language, "Ruling", "Decisión"),
      tone: args.status === "foul" ? "fail" : args.status === "no-foul" ? "pass" : args.status === "needs-info" ? "warning" : "info",
      items: [args.summary],
    },
  ];
  if (missing.length) sections.push({
    id: "missing",
    title: t(args.language, "Decisive facts still missing", "Datos decisivos que todavía faltan"),
    tone: "warning",
    items: missing,
  });
  if (penalty.length) sections.push({
    id: "penalty",
    title: t(args.language, "Penalty considerations", "Consideraciones de penalidad"),
    tone: "info",
    items: penalty,
  });
  sections.push({
    id: "refs",
    title: t(args.language, "Controlling provisions", "Disposiciones de control"),
    tone: "info",
    items: args.references.map((ref) => "Rule " + ref),
  });
  return { ...args, missing, penalty, sections };
}

export function decidePlay(
  topic: TopicId,
  discipline: Discipline,
  answers: Record<string, ChoiceValue>,
  language: Language,
): PlayDecision {
  const a = answers;

  if (discipline === "arena") {
    const refs: Record<TopicId,string[]> = {
      row: ["11","12","10"],
      dangerous: ["13","10"],
      blocking: ["13","10"],
      mallet: ["15","10"],
      conduct: ["14","10"],
      restart: ["7","8","9","10","16"],
    };
    return makeDecision({
      status: "needs-info",
      headline: t(language, "Arena ruling requires the Arena-specific facts", "La decisión de Arena requiere hechos específicos de Arena"),
      summary: t(language, "The Arena rule family is identified, but this deterministic engine does not yet reduce every Arena variation to a single call. Use the listed Arena provisions and complete the missing graph facts before closing the ruling.", "La familia de reglas Arena está identificada, pero este motor determinístico todavía no reduce todas las variantes de Arena a una sola decisión. Usá las disposiciones listadas y completá los datos faltantes del grafo antes de cerrar la decisión."),
      references: refs[topic],
      missing: [t(language, "Complete the Arena-specific missing facts shown above.", "Completá los datos faltantes específicos de Arena que aparecen arriba.")],
      language,
    });
  }

  if (topic === "row") {
    if (a.rowEntitled === "no") {
      return makeDecision({
        status: "no-foul",
        headline: t(language, "No ROW foul on that premise", "No hay falta de ROW bajo esa premisa"),
        summary: t(language, "If the affected player was not entitled to the Right of Way, Rule 24.c cannot be used to call a crossing/entry foul in that player's favor. Another rule may still apply.", "Si el jugador afectado no tenía derecho al Right of Way, Rule 24.c no puede usarse para cobrar un cruce/ingreso a su favor. Aun así podría aplicar otra regla."),
        references: ["24.a","24.b","24.c"],
        language,
      });
    }
    if (unknown(a.rowEntitled)) {
      return makeDecision({
        status: "needs-info",
        headline: t(language, "First establish who had the ROW", "Primero hay que establecer quién tenía el ROW"),
        summary: t(language, "A crossing decision cannot be closed until the affected player's entitlement to the Right of Way is established from the Line of the Ball and the players' relative positions.", "No se puede cerrar una decisión de crossing hasta establecer el derecho del jugador afectado al Right of Way según la Line of the Ball y las posiciones relativas."),
        references: ["23.a","24.a","24.b","24.f","24.g","24.h"],
        missing: [t(language, "Was the affected player actually entitled to the ROW?", "¿El jugador afectado tenía realmente el ROW?")],
        language,
      });
    }
    if (a.risk === "yes" && a.lineChanged === "yes") {
      if (a.clearanceTime === "no") {
        return makeDecision({
          status: "foul",
          headline: t(language, "ROW foul after a line change", "Falta de ROW después de un cambio de línea"),
          summary: t(language, "The player had the ROW, the line changed, the opponent was not given the necessary time to clear, and the action created risk or forced an adjustment. Those facts satisfy the core Rule 24.c/24.d foul analysis.", "El jugador tenía el ROW, la línea cambió, no se dio al oponente el tiempo necesario para despejar y la acción creó riesgo u obligó a ajustar. Esos hechos encajan con el análisis central de falta de Rule 24.c/24.d."),
          references: ["24.c","24.d","35.b"],
          penalty: [t(language, "Do not infer a fixed penalty. Rule 35.b requires the Umpire to weigh danger/unfair advantage, field location, player positions and frequency.", "No infieras una penalidad fija. Rule 35.b exige ponderar peligro/ventaja injusta, ubicación, posición de jugadores y frecuencia.")],
          language,
        });
      }
      if (unknown(a.clearanceTime)) {
        return makeDecision({
          status: "needs-info",
          headline: t(language, "Likely ROW issue, but clearance time is decisive", "Probable cuestión de ROW, pero el tiempo para despejar es decisivo"),
          summary: t(language, "After a change in the Line of the Ball, Rule 24.d requires the opponent to receive the necessary time to clear the new ROW. The risk/check fact points toward a foul, but that clearance fact must be established.", "Después de un cambio de Line of the Ball, Rule 24.d exige dar al oponente el tiempo necesario para despejar el nuevo ROW. El riesgo/frenada apunta a una falta, pero hay que establecer ese dato de despeje."),
          references: ["24.c","24.d"],
          missing: [t(language, "Was the opponent given the necessary time to clear the new ROW?", "¿Se le dio al oponente el tiempo necesario para despejar el nuevo ROW?")],
          language,
        });
      }
    }
    if (a.risk === "yes") {
      return makeDecision({
        status: "foul",
        headline: t(language, "ROW entry/crossing foul", "Falta por ingreso/cruce del ROW"),
        summary: t(language, "The affected player had the ROW and was forced to check, alter course, or face collision danger. Rule 24.c prohibits entry/crossing unless speed and distance create not the slightest risk.", "El jugador afectado tenía el ROW y fue obligado a frenar, alterar su curso o enfrentar peligro de colisión. Rule 24.c prohíbe ingresar/cruzar salvo que velocidad y distancia no creen el menor riesgo."),
        references: ["24.c","35.b"],
        penalty: [t(language, "Penalty remains discretionary under Rule 35.b; assess danger/advantage, location, position and repetition.", "La penalidad sigue siendo discrecional bajo Rule 35.b; evaluá peligro/ventaja, ubicación, posición y reiteración.")],
        language,
      });
    }
    if (a.risk === "no") {
      return makeDecision({
        status: "no-foul",
        headline: t(language, "No ROW foul shown by the entered facts", "Los datos cargados no muestran falta de ROW"),
        summary: t(language, "If the ROW holder maintained pace and direction with no collision risk, Rule 24.c's interpretation supports a no-foul result for the entry/crossing itself.", "Si el titular del ROW mantuvo velocidad y dirección sin riesgo de colisión, la interpretación de Rule 24.c respalda no cobrar falta por el ingreso/cruce en sí."),
        references: ["24.c"],
        language,
      });
    }
    return makeDecision({
      status: "needs-info",
      headline: t(language, "Risk is the decisive fact", "El riesgo es el dato decisivo"),
      summary: t(language, "Rule 24.c turns on speed, distance and whether the ROW holder had to check or alter course.", "Rule 24.c depende de velocidad, distancia y de si el titular del ROW tuvo que frenar o alterar el curso."),
      references: ["24.c"],
      missing: [t(language, "Did the action create risk or force the ROW holder to check/alter course?", "¿La acción creó riesgo u obligó al titular del ROW a frenar/cambiar curso?")],
      language,
    });
  }

  if (topic === "dangerous") {
    if (a.balance === "yes") {
      return makeDecision({
        status: "foul",
        headline: t(language, "Dangerous Riding", "Dangerous Riding"),
        summary: t(language, "Rule 26.a states that when a mount is knocked off balance, a dangerous ride-off has occurred. The Umpire should still identify the aggressor and weigh the surrounding factors.", "Rule 26.a establece que cuando un caballo pierde el equilibrio ha ocurrido un dangerous ride-off. El Umpire igualmente debe identificar al agresor y ponderar los factores del contexto."),
        references: ["26.a","26.a(1)","26.a(3)","26.a(4)","26.a(6)","35.b"],
        penalty: [t(language, "Rule 35 controls penalty severity; do not assign a mandatory Penalty 2/3/4 solely from the label Dangerous Riding.", "Rule 35 controla la severidad; no asignes automáticamente Penalty 2/3/4 sólo por la etiqueta Dangerous Riding.")],
        language,
      });
    }
    if (a.speedAngle === "yes" || a.blind === "yes") {
      return makeDecision({
        status: "needs-info",
        headline: t(language, "Dangerous Riding indicators are present", "Hay indicadores de Dangerous Riding"),
        summary: t(language, "Relative speed, position, angle and lack of readiness are express Rule 26.a factors. They support a dangerous-riding analysis, but the Rule leaves the ultimate judgment to the Umpire unless a mount was knocked off balance.", "Velocidad relativa, posición, ángulo y falta de preparación son factores expresos de Rule 26.a. Respaldan el análisis de dangerous riding, pero la regla deja el juicio final al Umpire salvo que un caballo haya perdido el equilibrio."),
        references: ["26.a","26.a(1)","26.a(3)","26.a(4)","26.a(6)","35.b"],
        missing: [t(language, "Assess whether the force/risk was undue under the total circumstances.", "Evaluá si la fuerza/riesgo fue indebida según el conjunto de circunstancias.")],
        language,
      });
    }
    if (a.balance === "no" && a.speedAngle === "no" && a.blind === "no") {
      return makeDecision({
        status: "needs-info",
        headline: t(language, "No automatic Dangerous Riding indicator — Umpire judgment required", "No hay un indicador automático de Dangerous Riding — se requiere juicio del Umpire"),
        summary: t(language, "The entered facts do not show the strongest modeled Rule 26.a indicators, but Rule 26's factors are not exhaustive and the Rulebook does not authorize the app to convert their absence into a definitive no-foul. The Umpire must still assess the total circumstances, including force, relative size/position, fatigue, other dangerous acts, and the aggressor.", "Los hechos cargados no muestran los indicadores modelados más fuertes de Rule 26.a, pero los factores de Rule 26 no son exhaustivos y el Rulebook no autoriza a la app a convertir su ausencia en un no-foul definitivo. El Umpire todavía debe evaluar el conjunto de circunstancias, incluyendo fuerza, tamaño/posición relativa, fatiga, otros actos peligrosos y al agresor."),
        references: ["26.a"],
        missing: [t(language, "Umpire assessment of the total circumstances and any other Rule 26 danger factor not captured by the quick questions.", "Valoración del Umpire sobre el conjunto de circunstancias y cualquier otro factor de peligro de Rule 26 no capturado por las preguntas rápidas.")],
        language,
      });
    }
    return makeDecision({
      status: "needs-info",
      headline: t(language, "More riding facts are required", "Faltan más datos del ride-off"),
      summary: t(language, "Dangerous Riding is determined from the total circumstances.", "Dangerous Riding se determina según el conjunto de circunstancias."),
      references: ["26.a"],
      missing: [t(language, "Horse balance, relative speed/angle/position and opponent readiness.", "Equilibrio del caballo, velocidad/ángulo/posición relativa y preparación del oponente.")],
      language,
    });
  }

  if (topic === "blocking") {
    if (a.marking === "no") {
      return makeDecision({
        status: "no-foul",
        headline: t(language, "Improper Blocking not established", "Improper Blocking no establecido"),
        summary: t(language, "Rule 26A requires that the offensive player prevent a defender from marking or making the relevant play. If that did not happen, the blocking offense is not established on these facts.", "Rule 26A requiere que el atacante impida al defensor marcar o hacer la jugada relevante. Si eso no ocurrió, la infracción de blocking no queda establecida."),
        references: ["26A"],
        language,
      });
    }
    if (a.marking === "yes" && a.restartBlock === "yes") {
      return makeDecision({
        status: "foul",
        headline: t(language, "Improper Blocking", "Improper Blocking"),
        summary: t(language, "During a knock-in, Penalty 5.a/5.b, or free hit from out of bounds, an offensive player may not block a defender from marking the teammate who has a play on the ball. Contact is not required.", "Durante knock-in, Penalty 5.a/5.b o free hit por pelota afuera, un atacante no puede bloquear al defensor que intenta marcar al compañero con jugada sobre la pelota. No se requiere contacto."),
        references: ["26A","35.b"],
        penalty: [t(language, "Award an appropriate penalty; if the blocking was also dangerous, analyze Rule 26 separately.", "Otorgá una penalidad apropiada; si el bloqueo además fue peligroso, analizá Rule 26 por separado.")],
        language,
      });
    }
    if (a.marking === "yes" && a.restartBlock === "no" && a.slow === "yes") {
      return makeDecision({
        status: "foul",
        headline: t(language, "Improper Blocking in open play", "Improper Blocking en juego abierto"),
        summary: t(language, "In open play, Rule 26A prohibits a teammate from blocking a defender within two horse lengths when the ball carrier stops or slows to a slow canter/walk.", "En juego abierto, Rule 26A prohíbe que un compañero bloquee a un defensor dentro de dos largos cuando el portador se detiene o reduce a slow canter/walk."),
        references: ["26A","35.b"],
        language,
      });
    }
    if (a.marking === "yes" && a.restartBlock === "no" && a.slow === "no") {
      return makeDecision({
        status: "no-foul",
        headline: t(language, "Rule 26A blocking condition not met", "No se cumple la condición de blocking de Rule 26A"),
        summary: t(language, "Outside the specified restart context, the open-play part of Rule 26A requires the ball carrier to stop or slow to a slow canter/walk within the stated distance.", "Fuera del contexto específico de restart, la parte de juego abierto de Rule 26A exige que el portador se detenga o reduzca a slow canter/walk dentro de la distancia indicada."),
        references: ["26A"],
        language,
      });
    }
    return makeDecision({
      status: "needs-info",
      headline: t(language, "Blocking context is incomplete", "El contexto del blocking está incompleto"),
      summary: t(language, "Rule 26A depends on the restart/open-play context and whether the defender was actually prevented from marking or playing.", "Rule 26A depende del contexto restart/juego abierto y de si realmente se impidió al defensor marcar o jugar."),
      references: ["26A"],
      missing: [t(language, "Confirm the context and whether the defender was prevented from making the relevant play.", "Confirmá el contexto y si se impidió al defensor hacer la jugada relevante.")],
      language,
    });
  }

  if (topic === "mallet") {
    if (a.strokeDanger === "yes") {
      if (a.strokeEnteredByOpponent === "yes") {
        return makeDecision({
          status: "needs-info",
          headline: t(language, "Another player may have created the mallet danger", "Otro jugador puede haber creado el peligro del mallet"),
          summary: t(language, "Rule 28.d says the mallet user is responsible unless another player is clearly at fault by riding into the stroke. The app should not assign the mallet foul until the Umpire determines who created the danger; Rule 26.h may also apply if a player deliberately rode into the stroke.", "Rule 28.d dice que el usuario del mallet es responsable salvo que otro jugador sea claramente responsable por entrar en el stroke. La app no debe asignar la falta de mallet hasta que el Umpire determine quién creó el peligro; Rule 26.h también puede aplicar si un jugador entró deliberadamente en el stroke."),
          references: ["28.d","26.h"],
          missing: [t(language, "Umpire determination of who created the danger and whether the entry into the stroke was deliberate/dangerous.", "Determinación del Umpire sobre quién creó el peligro y si el ingreso al stroke fue deliberado/peligroso.")],
          language,
        });
      }
      if (a.strokeEnteredByOpponent === "no") {
        return makeDecision({
          status: "foul",
          headline: t(language, "Dangerous / improper use of the mallet", "Uso peligroso / impropio del mallet"),
          summary: t(language, "Rule 28.d makes the player responsible for using the mallet safely. The entered facts identify dangerous use and do not indicate that another player clearly created the danger by riding into the stroke.", "Rule 28.d hace responsable al jugador de usar el mallet de forma segura. Los hechos cargados identifican un uso peligroso y no indican que otro jugador haya creado claramente el peligro entrando en el stroke."),
          references: ["28.d","35.b"],
          penalty: [t(language, "If deliberate or sufficiently dangerous, Rule 33 / Penalty 10 may also become relevant.", "Si fue deliberado o suficientemente peligroso, también pueden volverse relevantes Rule 33 / Penalty 10.")],
          language,
        });
      }
      return makeDecision({
        status: "needs-info",
        headline: t(language, "Who created the mallet danger is decisive", "Es decisivo saber quién creó el peligro del mallet"),
        summary: t(language, "Before assigning responsibility under Rule 28.d, determine whether another player clearly rode into an already established stroke and created the danger.", "Antes de asignar responsabilidad bajo Rule 28.d, determiná si otro jugador entró claramente en un stroke ya establecido y creó el peligro."),
        references: ["28.d","26.h"],
        missing: [t(language, "Did another player clearly ride into the established stroke and create the danger?", "¿Otro jugador entró claramente en el stroke ya establecido y creó el peligro?")],
        language,
      });
    }
    if (a.hookPosition === "no" || a.hookTiming === "no" || a.hookClear === "no") {
      return makeDecision({
        status: "foul",
        headline: t(language, "Illegal hook / mallet action", "Hook / acción de mallet ilegal"),
        summary: t(language, "Rule 28.a permits a hook only from the same side of the opponent's mount as the ball or directly behind, while the opponent is in the permitted stroke/hook phase, with the mallet clear of the mount and without excessive force.", "Rule 28.a permite el hook sólo desde el mismo lado del caballo rival que la pelota o directamente detrás, mientras el rival está en la fase permitida de stroke/hook, con el mallet libre del caballo y sin fuerza excesiva."),
        references: ["28.a","35.b"],
        language,
      });
    }
    if (a.hookPosition === "yes" && a.hookTiming === "yes" && a.hookClear === "yes" && a.strokeDanger === "no") {
      return makeDecision({
        status: "no-foul",
        headline: t(language, "Hook appears legal on the entered facts", "El hook parece legal con los datos cargados"),
        summary: t(language, "The Rule 28.a positioning, timing and clearance conditions have been satisfied and no dangerous use was identified.", "Se cumplen las condiciones de posición, timing y clearance de Rule 28.a y no se identificó uso peligroso."),
        references: ["28.a","28.d"],
        language,
      });
    }
    return makeDecision({
      status: "needs-info",
      headline: t(language, "Hook legality needs more detail", "La legalidad del hook necesita más detalle"),
      summary: t(language, "Rule 28.a turns on the hooker's position, the opponent's stroke phase and whether the mallet crosses any part of the mount / is used with excessive force.", "Rule 28.a depende de la posición del jugador que hookea, la fase del stroke rival y de si el mallet cruza alguna parte del caballo / se usa con fuerza excesiva."),
      references: ["28.a","28.d"],
      missing: [t(language, "Complete the hook position, timing and clearance/safety facts.", "Completá posición, timing y clearance/seguridad del hook.")],
      language,
    });
  }

  if (topic === "conduct") {
    if (a.conductMatches === "yes") {
      const repeated = a.repeat === "yes";
      return makeDecision({
        status: "foul",
        headline: repeated ? t(language, "Unsportsmanlike conduct with escalation", "Conducta antideportiva con escalamiento") : t(language, "Unsportsmanlike conduct", "Conducta antideportiva"),
        summary: repeated
          ? t(language, "The conduct falls within Rule 33.a and repetition requires escalation under Rule 33.b and Rule 34. Card/suspension consequences depend on the player's offense count and severity.", "La conducta entra en Rule 33.a y la reiteración requiere escalamiento bajo Rule 33.b y Rule 34. Las consecuencias de tarjeta/suspensión dependen del número de infracciones y severidad.")
          : t(language, "Conduct within Rule 33.a requires the Umpire to assess a yellow card, together with the appropriate penalty consequences under Rule 33.b.", "La conducta comprendida en Rule 33.a exige al Umpire imponer una yellow card, junto con las consecuencias de penalidad apropiadas bajo Rule 33.b."),
        references: repeated ? ["33.a","33.b","34","35.b"] : ["33.a","33.b(1)","35.b"],
        penalty: [t(language, "Do not collapse all misconduct into the same sanction: Rule 33.b contains offense-count and severity-specific card/suspension consequences.", "No reduzcas toda conducta a la misma sanción: Rule 33.b contiene consecuencias de tarjeta/suspensión específicas según número de infracción y severidad.")],
        language,
      });
    }
    if (a.conductMatches === "no") {
      return makeDecision({
        status: "no-foul",
        headline: t(language, "Rule 33 conduct not established", "Conducta de Rule 33 no establecida"),
        summary: t(language, "The entered behavior has not been identified as unsportsmanlike conduct under Rule 33.a. Another playing rule may still apply.", "La conducta cargada no fue identificada como unsportsmanlike conduct bajo Rule 33.a. Otra regla de juego todavía puede aplicar."),
        references: ["33.a"],
        language,
      });
    }
    return makeDecision({
      status: "needs-info",
      headline: t(language, "Identify the conduct first", "Primero identificá la conducta"),
      summary: t(language, "Rule 33.a lists the relevant forms of unsportsmanlike conduct. The card procedure should not be applied until the behavior is characterized.", "Rule 33.a enumera las formas relevantes de conducta antideportiva. El procedimiento de tarjetas no debe aplicarse hasta caracterizar la conducta."),
      references: ["33.a","33.b"],
      missing: [t(language, "Does the behavior match Rule 33.a (appealing, abuse, arguing, dangerous/rough conduct, post-whistle hit, etc.)?", "¿La conducta encaja en Rule 33.a (appealing, abuso, discusión, conducta peligrosa/brusca, golpe después del whistle, etc.)?")],
      language,
    });
  }

  if (a.early === "yes") {
    const restartType = a.restartType;
    const refs = restartType === "throwin" ? ["20.a","20.b","36"] : restartType === "knockin" ? ["22.a","36"] : restartType === "penalty" ? ["36"] : ["20","22","36"];
    return makeDecision({
      status: "procedure",
      headline: t(language, "Restart / execution violation", "Infracción de reanudación / ejecución"),
      summary: t(language, "A play made before the Umpire calls Play is a procedure issue. The consequence depends on the specific restart or penalty being executed.", "Una jugada realizada antes de que el Umpire llame Play es una cuestión de procedimiento. La consecuencia depende de la reanudación o penalidad específica que se estaba ejecutando."),
      references: refs,
      missing: restartType === "unknown" || !restartType ? [t(language, "What restart was being executed?", "¿Qué reanudación se estaba ejecutando?")] : [],
      language,
    });
  }
  if (a.dead === "yes") {
    const restartType = a.restartType;
    if (restartType === "throwin" || restartType === "knockin" || restartType === "penalty") {
      const refs = restartType === "throwin"
        ? ["20.a","20.b","36"]
        : restartType === "knockin"
          ? ["22.a","36"]
          : ["36"];
      const label = restartType === "throwin"
        ? t(language, "Throw-in", "Throw-in")
        : restartType === "knockin"
          ? t(language, "Knock-in", "Knock-in")
          : t(language, "Penalty / free hit", "Penalty / free hit");
      return makeDecision({
        status: "procedure",
        headline: t(language, label + " restart identified", "Reanudación " + label + " identificada"),
        summary: t(
          language,
          "Play was dead, no early-play violation was entered, and the restart type is identified. Apply the cited restart procedure before the Umpire calls Play.",
          "La pelota estaba muerta, no se indicó una ejecución anticipada y el tipo de reanudación está identificado. Aplicá el procedimiento citado antes de que el Umpire llame Play.",
        ),
        references: refs,
        language,
      });
    }

    return makeDecision({
      status: "needs-info",
      headline: t(language, "Dead-ball restart depends on why play stopped", "La reanudación de dead ball depende de por qué se detuvo el juego"),
      summary: t(language, "Rules 21 and 22 contain different restart routes for end line, foul, injury, equipment, inadvertent whistle and other stoppages.", "Rules 21 y 22 contienen reanudaciones diferentes para end line, falta, lesión, equipo, inadvertent whistle y otras detenciones."),
      references: ["21","22","36"],
      missing: [t(language, "Identify the stoppage/restart type.", "Identificá el tipo de detención/reanudación.")],
      language,
    });
  }
  return makeDecision({
    status: "needs-info",
    headline: t(language, "Restart context is incomplete", "El contexto de reanudación está incompleto"),
    summary: t(language, "The restart cannot be resolved from the current facts alone.", "La reanudación no puede resolverse sólo con los datos actuales."),
    references: ["20","21","22","36"],
    missing: [t(language, "Was play dead, and what restart procedure was underway?", "¿La pelota estaba muerta y qué procedimiento de reanudación estaba en curso?")],
    language,
  });
}
