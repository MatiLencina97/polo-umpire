"use client";

import { useMemo, useState } from "react";
import type { Language } from "@/lib/types";
import {
  defaultRowEntitlementFacts,
  deriveRowEntitlement,
  rowResultText,
  type RowEntitlementFacts,
} from "@/lib/row-entitlement";
import type { RuleProvision } from "@/lib/subarticles";

type Props = {
  language: Language;
  resolveProvision: (ref: string) => RuleProvision | null;
  onOpenProvision: (provision: RuleProvision) => void;
  onApply?: (hasRow: boolean, refs: string[]) => void;
};

export default function RowEntitlementHelper({ language, resolveProvision, onOpenProvision, onApply }: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  const [facts, setFacts] = useState<RowEntitlementFacts>({ ...defaultRowEntitlementFacts });
  const result = useMemo(() => deriveRowEntitlement(facts), [facts]);
  const text = rowResultText(result, language);

  const set = (key: keyof RowEntitlementFacts, value: string) => setFacts((current) => ({ ...current, [key]: value }));

  return (
    <section className="rowEntitlementHelper">
      <div className="rowHelperHeader">
        <div>
          <p className="eyebrow">{tr("RULE 24 ENTITLEMENT CHECK", "CHECK DE TITULARIDAD · RULE 24")}</p>
          <h3>{tr("Derive ROW from physical facts", "Derivar el ROW desde hechos físicos")}</h3>
        </div>
        <span>{tr("This reduces reliance on the question “who had ROW?”", "Esto reduce la dependencia de la pregunta “¿quién tenía ROW?”")}</span>
      </div>

      <label>
        <span>{tr("First: is the affected player using the ball directly in front / near side in a way that endangers an opponent who could otherwise hook or hit?", "Primero: ¿el jugador afectado lleva la pelota delante / near side de una forma que pone en peligro a un oponente que de otro modo podría hookear o pegar?")}</span>
        <select value={facts.nearSideDanger} onChange={(event) => set("nearSideDanger", event.target.value)}>
          <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
          <option value="no">{tr("No", "No")}</option>
          <option value="yes">{tr("Yes", "Sí")}</option>
        </select>
      </label>

      {facts.nearSideDanger === "yes" ? (
        <label>
          <span>{tr("Does a Rule 24(e) exception apply: legal ride-off, players parallel/nearly parallel, or opponent far enough behind to complete the play safely?", "¿Aplica una excepción de Rule 24(e): ride-off legal, jugadores paralelos/casi paralelos, u oponente suficientemente atrás para completar la jugada con seguridad?")}</span>
          <select value={facts.nearSideException} onChange={(event) => set("nearSideException", event.target.value)}>
            <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
            <option value="yes">{tr("Yes", "Sí")}</option>
            <option value="no">No</option>
          </select>
        </label>
      ) : null}

      {facts.nearSideDanger !== "unknown" && !(facts.nearSideDanger === "yes" && facts.nearSideException !== "yes") ? (
        <label>
          <span>{tr("What is the physical relationship between the affected player and the opponent?", "¿Cuál es la relación física entre el jugador afectado y el oponente?")}</span>
          <select value={facts.relation} onChange={(event) => set("relation", event.target.value)}>
            <option value="unknown">{tr("Choose / not sure", "Elegir / no estoy seguro")}</option>
            <option value="affected-following">{tr("Affected player follows the ball; opponent meets it", "El afectado sigue la pelota; el oponente viene meeting")}</option>
            <option value="affected-meeting">{tr("Affected player meets the ball; opponent follows it", "El afectado viene meeting; el oponente sigue la pelota")}</option>
            <option value="both-follow-or-meet">{tr("Both are following, or both are meeting", "Ambos siguen, o ambos vienen meeting")}</option>
            <option value="affected-pair-vs-single">{tr("Affected player is in the two-player engaged pair vs one player", "El afectado integra la pareja de dos jugadores engaged contra uno")}</option>
            <option value="opponent-pair-vs-affected">{tr("Opponent is in the two-player engaged pair vs affected player alone", "El oponente integra la pareja de dos jugadores engaged contra el afectado solo")}</option>
          </select>
        </label>
      ) : null}

      {(facts.relation === "affected-following" || facts.relation === "affected-meeting") ? (
        <label>
          <span>{facts.relation === "affected-following"
            ? tr("Is the meeting opponent exactly on the LOB with the LOB on the off side?", "¿El oponente que viene meeting está exactamente sobre la LOB con la LOB en el off side?")
            : tr("Is the affected meeting player exactly on the LOB with the LOB on the off side?", "¿El afectado que viene meeting está exactamente sobre la LOB con la LOB en el off side?")}</span>
          <select value={facts.meetingExactOffside} onChange={(event) => set("meetingExactOffside", event.target.value)}>
            <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
            <option value="yes">{tr("Yes", "Sí")}</option>
            <option value="no">No</option>
          </select>
        </label>
      ) : null}

      {facts.relation === "both-follow-or-meet" ? (
        <>
          <label>
            <span>{tr("Who is clearly parallel to / at the lesser angle to the LOB?", "¿Quién está claramente paralelo / con menor ángulo respecto de la LOB?")}</span>
            <select value={facts.lesserAngle} onChange={(event) => set("lesserAngle", event.target.value)}>
              <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
              <option value="affected">{tr("Affected player", "Jugador afectado")}</option>
              <option value="opponent">{tr("Opponent", "Oponente")}</option>
              <option value="approximately-equal">{tr("Approximately equal angles on opposite sides", "Ángulos aproximadamente iguales en lados opuestos")}</option>
            </select>
          </label>
          {facts.lesserAngle === "approximately-equal" ? (
            <label>
              <span>{tr("Who has the LOB on the off side?", "¿Quién tiene la LOB en el off side?")}</span>
              <select value={facts.equalAngleOffside} onChange={(event) => set("equalAngleOffside", event.target.value)}>
                <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
                <option value="affected">{tr("Affected player", "Jugador afectado")}</option>
                <option value="opponent">{tr("Opponent", "Oponente")}</option>
              </select>
            </label>
          ) : null}
        </>
      ) : null}

      {(facts.relation === "affected-pair-vs-single" || facts.relation === "opponent-pair-vs-affected") ? (
        <label>
          <span>{tr("Are the two players riding in the same direction exactly on the LOB and simultaneously making a play against each other?", "¿Los dos jugadores van en la misma dirección exactamente sobre la LOB y simultáneamente están haciendo una jugada entre sí?")}</span>
          <select value={facts.pairEngagedExactLine} onChange={(event) => set("pairEngagedExactLine", event.target.value)}>
            <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
            <option value="yes">{tr("Yes", "Sí")}</option>
            <option value="no">No</option>
          </select>
        </label>
      ) : null}

      <div className={"rowHelperResult " + result.status}>
        <strong>{text.headline}</strong>
        <p>{text.summary}</p>
        <div className="rowHelperRefs">
          {result.refs.map((ref) => {
            const provision = resolveProvision(ref);
            return provision ? <button key={ref} onClick={() => onOpenProvision(provision)}>{provision.label}</button> : null;
          })}
        </div>
        {onApply && result.status === "affected-has-row" ? (
          <button className="rowApply" onClick={() => onApply(true, result.refs)}>{tr("Use: affected player HAS ROW", "Usar: el afectado TIENE ROW")}</button>
        ) : null}
        {onApply && result.status === "affected-no-row" ? (
          <button className="rowApply" onClick={() => onApply(false, result.refs)}>{tr("Use: affected player does NOT have ROW", "Usar: el afectado NO TIENE ROW")}</button>
        ) : null}
      </div>
    </section>
  );
}
