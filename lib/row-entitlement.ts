import type { ChoiceValue, Language } from "./types";

export type RowEntitlementFacts = {
  nearSideDanger: ChoiceValue;
  nearSideException: ChoiceValue;
  relation: ChoiceValue;
  meetingExactOffside: ChoiceValue;
  lesserAngle: ChoiceValue;
  equalAngleOffside: ChoiceValue;
  pairEngagedExactLine: ChoiceValue;
};

export const defaultRowEntitlementFacts: RowEntitlementFacts = {
  nearSideDanger: "unknown",
  nearSideException: "unknown",
  relation: "unknown",
  meetingExactOffside: "unknown",
  lesserAngle: "unknown",
  equalAngleOffside: "unknown",
  pairEngagedExactLine: "unknown",
};

export type RowEntitlementResult = {
  status: "affected-has-row" | "affected-no-row" | "restricted" | "needs-info";
  headlineEn: string;
  headlineEs: string;
  summaryEn: string;
  summaryEs: string;
  refs: string[];
  decisiveFact?: string;
};

const result = (
  status: RowEntitlementResult["status"],
  refs: string[],
  headlineEn: string,
  headlineEs: string,
  summaryEn: string,
  summaryEs: string,
  decisiveFact?: string,
): RowEntitlementResult => ({ status, refs, headlineEn, headlineEs, summaryEn, summaryEs, decisiveFact });

export function deriveRowEntitlement(facts: RowEntitlementFacts): RowEntitlementResult {
  if (facts.nearSideDanger === "yes") {
    if (facts.nearSideException === "yes") {
      // Rule 24.e permits the near-side position, but entitlement still depends on f/g/h.
    } else if (facts.nearSideException === "no") {
      return result(
        "restricted",
        ["24.e"],
        "Rule 24(e) controls before the normal ROW comparison",
        "Rule 24(e) controla antes de la comparación normal de ROW",
        "The affected player is using the near-side/front position in a way that endangers an opponent who could otherwise hook or hit, and none of Rule 24(e)'s stated exceptions applies. Do not award ROW merely from Rules 24(f) or 24(g).",
        "El jugador afectado usa la posición near-side/delante de una forma que pone en peligro a un oponente que de otro modo podría hookear o pegar, y no aplica ninguna de las excepciones expresas de Rule 24(e). No se debe otorgar ROW solamente por Rules 24(f) o 24(g).",
        "24.e",
      );
    } else {
      return result(
        "needs-info",
        ["24.e"],
        "Confirm the Rule 24(e) near-side exception first",
        "Primero confirmá la excepción de Rule 24(e)",
        "Because Rule 24(e) takes precedence over Rules 24(f) and 24(g), entitlement cannot be derived until the legal ride-off / parallel / safely-behind exception is known.",
        "Como Rule 24(e) prevalece sobre Rules 24(f) y 24(g), no se puede derivar la titularidad hasta conocer si aplica la excepción de ride-off legal / paralelos / suficientemente atrás.",
      );
    }
  } else if (facts.nearSideDanger === "unknown") {
    return result(
      "needs-info",
      ["24.e"],
      "Near-side safety must be checked first",
      "Primero hay que verificar la seguridad del near-side",
      "Rule 24(e) expressly takes precedence over Rules 24(f) and 24(g).",
      "Rule 24(e) prevalece expresamente sobre Rules 24(f) y 24(g).",
    );
  }

  if (facts.relation === "affected-following") {
    if (facts.meetingExactOffside === "yes") {
      return result(
        "affected-no-row",
        ["24.f"],
        "The meeting opponent has the ROW",
        "El oponente que viene meeting tiene el ROW",
        "Under Rule 24(f), the normal advantage of the player following the ball is displaced when the meeting player is on the exact Line of the Ball with the LOB on the off side.",
        "Bajo Rule 24(f), la ventaja normal del jugador que sigue la pelota cede cuando el jugador que viene meeting está exactamente sobre la Line of the Ball con la LOB en el off side.",
        "24.f",
      );
    }
    if (facts.meetingExactOffside === "no") {
      return result(
        "affected-has-row",
        ["24.f"],
        "The affected player following the ball has the ROW",
        "El jugador afectado que sigue la pelota tiene el ROW",
        "Rule 24(f) gives the ROW to the player following the ball over a player meeting it unless the meeting player is on the exact LOB with the ball on the off side.",
        "Rule 24(f) da el ROW al jugador que sigue la pelota sobre quien viene meeting, salvo que este último esté exactamente sobre la LOB con la pelota en el off side.",
        "24.f",
      );
    }
    return result("needs-info", ["24.f"], "Exact-line/off-side fact is decisive", "El dato exact-line/off-side es decisivo", "Confirm whether the meeting opponent is exactly on the LOB with the LOB on the off side.", "Confirmá si el oponente que viene meeting está exactamente sobre la LOB con la LOB en el off side.");
  }

  if (facts.relation === "affected-meeting") {
    if (facts.meetingExactOffside === "yes") {
      return result(
        "affected-has-row",
        ["24.f"],
        "The affected player meeting the ball has the ROW",
        "El jugador afectado que viene meeting tiene el ROW",
        "The affected meeting player is exactly on the LOB with the LOB on the off side, which is the Rule 24(f) condition that prevails over a player following the ball.",
        "El jugador afectado que viene meeting está exactamente sobre la LOB con la LOB en el off side, condición de Rule 24(f) que prevalece sobre quien sigue la pelota.",
        "24.f",
      );
    }
    if (facts.meetingExactOffside === "no") {
      return result(
        "affected-no-row",
        ["24.f"],
        "The following opponent has the ROW",
        "El oponente que sigue la pelota tiene el ROW",
        "A meeting player who is not exactly on the LOB with the LOB on the off side does not displace the ROW of the player following the ball under Rule 24(f).",
        "Un jugador que viene meeting y no está exactamente sobre la LOB con la LOB en el off side no desplaza el ROW de quien sigue la pelota bajo Rule 24(f).",
        "24.f",
      );
    }
    return result("needs-info", ["24.f"], "Exact-line/off-side fact is decisive", "El dato exact-line/off-side es decisivo", "Confirm whether the affected meeting player is exactly on the LOB with the LOB on the off side.", "Confirmá si el jugador afectado que viene meeting está exactamente sobre la LOB con la LOB en el off side.");
  }

  if (facts.relation === "both-follow-or-meet") {
    if (facts.lesserAngle === "affected") {
      return result("affected-has-row", ["24.g"], "The affected player has the lesser angle", "El jugador afectado tiene el menor ángulo", "Rule 24(g)(1) awards ROW to the player parallel to or at the lesser angle to the LOB.", "Rule 24(g)(1) otorga el ROW al jugador paralelo o con menor ángulo respecto de la LOB.", "24.g");
    }
    if (facts.lesserAngle === "opponent") {
      return result("affected-no-row", ["24.g"], "The opponent has the lesser angle", "El oponente tiene el menor ángulo", "Rule 24(g)(1) awards ROW to the player parallel to or at the lesser angle to the LOB.", "Rule 24(g)(1) otorga el ROW al jugador paralelo o con menor ángulo respecto de la LOB.", "24.g");
    }
    if (facts.lesserAngle === "approximately-equal") {
      if (facts.equalAngleOffside === "affected") {
        return result("affected-has-row", ["24.g"], "Approximately equal angles: affected player has the LOB on the off side", "Ángulos aproximadamente iguales: el afectado tiene la LOB en el off side", "Rule 24(g)(2) gives ROW to the player with the LOB on the off side when the players are on opposite sides at approximately equal angles.", "Rule 24(g)(2) da el ROW al jugador con la LOB en el off side cuando están en lados opuestos con ángulos aproximadamente iguales.", "24.g");
      }
      if (facts.equalAngleOffside === "opponent") {
        return result("affected-no-row", ["24.g"], "Approximately equal angles: opponent has the LOB on the off side", "Ángulos aproximadamente iguales: el oponente tiene la LOB en el off side", "Rule 24(g)(2) gives ROW to the player with the LOB on the off side.", "Rule 24(g)(2) da el ROW al jugador con la LOB en el off side.", "24.g");
      }
      return result("needs-info", ["24.g"], "Off-side relationship breaks the tie", "La relación con el off side desempata", "Confirm which player has the LOB on the off side.", "Confirmá qué jugador tiene la LOB en el off side.");
    }
    return result("needs-info", ["24.g"], "Compare the players' angles to the LOB", "Compará los ángulos de los jugadores con la LOB", "Rule 24(g) first looks for the parallel/lesser-angle player.", "Rule 24(g) primero busca al jugador paralelo/con menor ángulo.");
  }

  if (facts.relation === "affected-pair-vs-single") {
    if (facts.pairEngagedExactLine === "yes") {
      return result("affected-has-row", ["24.h"], "The two-player pair has the ROW over the single player", "La pareja de dos jugadores tiene el ROW sobre el jugador solo", "Rule 24(h) applies because the two players are riding in the same direction on the LOB and simultaneously making a play against each other.", "Rule 24(h) aplica porque los dos jugadores van en la misma dirección sobre la LOB y simultáneamente están haciendo una jugada entre sí.", "24.h");
    }
    if (facts.pairEngagedExactLine === "no") {
      return result("needs-info", ["24.h","24.f","24.g"], "Rule 24(h) does not automatically apply", "Rule 24(h) no aplica automáticamente", "The pair does not get ROW merely because there are two players. Analyze the relevant players under the ordinary Rule 24(f)/(g) tests.", "La pareja no obtiene ROW sólo por ser dos jugadores. Analizá a los jugadores relevantes bajo los tests ordinarios de Rule 24(f)/(g).");
    }
    return result("needs-info", ["24.h"], "Confirm exact LOB + active engagement", "Confirmá exact LOB + engagement activo", "Both conditions are necessary for the special two-player priority in Rule 24(h).", "Ambas condiciones son necesarias para la prioridad especial de dos jugadores de Rule 24(h).");
  }

  if (facts.relation === "opponent-pair-vs-affected") {
    if (facts.pairEngagedExactLine === "yes") {
      return result("affected-no-row", ["24.h"], "The opposing two-player pair has the ROW", "La pareja rival de dos jugadores tiene el ROW", "Rule 24(h) gives the pair priority over the single affected player when the pair is exactly on the LOB, riding the same direction and making a play against each other.", "Rule 24(h) da prioridad a la pareja sobre el jugador afectado solo cuando la pareja está exactamente sobre la LOB, va en la misma dirección y está haciendo una jugada entre sí.", "24.h");
    }
    if (facts.pairEngagedExactLine === "no") {
      return result("needs-info", ["24.h","24.f","24.g"], "The opposing pair does not automatically have ROW", "La pareja rival no tiene ROW automáticamente", "Two players do not have ROW merely because there are two of them. Continue with the ordinary Rule 24(f)/(g) comparison.", "Dos jugadores no tienen ROW sólo por ser dos. Continuá con la comparación ordinaria de Rule 24(f)/(g).");
    }
    return result("needs-info", ["24.h"], "Confirm exact LOB + active engagement", "Confirmá exact LOB + engagement activo", "Rule 24(h) needs both conditions.", "Rule 24(h) necesita ambas condiciones.");
  }

  return result(
    "needs-info",
    ["24.e","24.f","24.g","24.h"],
    "Choose the physical ROW relationship",
    "Elegí la relación física del ROW",
    "The app can derive common Rule 24 entitlement branches once the players' relationship to the LOB is identified.",
    "La app puede derivar ramas comunes de titularidad bajo Rule 24 una vez identificada la relación de los jugadores con la LOB.",
  );
}

export function rowResultText(result: RowEntitlementResult, language: Language) {
  return {
    headline: language === "en" ? result.headlineEn : result.headlineEs,
    summary: language === "en" ? result.summaryEn : result.summaryEs,
  };
}
