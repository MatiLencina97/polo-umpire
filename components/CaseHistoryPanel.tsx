"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CASE_HISTORY_EVENT,
  clearCaseHistory,
  deleteCaseRecord,
  loadCaseHistory,
  type CaseRecord,
} from "@/lib/case-history";
import type { Language } from "@/lib/types";

type Props = {
  language: Language;
  installedRulebookVersion: string;
  onReuse: (record: CaseRecord) => void;
};

function statusLabel(status: CaseRecord["outcome"]["status"], language: Language) {
  const en: Record<CaseRecord["outcome"]["status"], string> = {
    foul: "FOUL",
    "no-foul": "NO FOUL",
    "needs-info": "MORE FACTS NEEDED",
    procedure: "PROCEDURE",
    conflict: "CONFLICT",
    clear: "CHECKS CLEAR",
    reference: "REFERENCE",
  };
  const es: Record<CaseRecord["outcome"]["status"], string> = {
    foul: "FALTA",
    "no-foul": "NO FOUL",
    "needs-info": "FALTAN DATOS",
    procedure: "PROCEDIMIENTO",
    conflict: "CONFLICTO",
    clear: "CONTROLES OK",
    reference: "REFERENCIA",
  };
  return (language === "en" ? en : es)[status];
}

function formatCaseDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CaseHistoryPanel({ language, installedRulebookVersion, onReuse }: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  const [history, setHistory] = useState<CaseRecord[]>([]);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [query, setQuery] = useState("");

  function refresh() {
    setHistory(loadCaseHistory());
  }

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(CASE_HISTORY_EVENT, onChange);
    return () => window.removeEventListener(CASE_HISTORY_EVENT, onChange);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((record) =>
      [
        record.situation,
        record.outcome.headline,
        record.outcome.summary,
        record.eventContext ?? "",
        record.discipline,
        record.rulebookVersion,
        ...record.references.map((ref) => ref.label),
        ...record.facts.flatMap((fact) => [fact.label, fact.value]),
      ].join(" ").toLowerCase().includes(q),
    );
  }, [history, query]);

  function remove(record: CaseRecord) {
    if (!window.confirm(tr("Delete this saved case?", "¿Eliminar este caso guardado?"))) return;
    deleteCaseRecord(record.id);
    if (selected?.id === record.id) setSelected(null);
  }

  function removeAll() {
    if (!history.length) return;
    if (!window.confirm(tr("Delete all saved cases from this device?", "¿Eliminar todos los casos guardados de este dispositivo?"))) return;
    clearCaseHistory();
    setSelected(null);
  }

  function exportCases() {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "umpire-polo-cases.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="card caseHistoryHeader">
        <div>
          <p className="eyebrow">{tr("CASE HISTORY · LOCAL", "HISTORIAL DE CASOS · LOCAL")}</p>
          <h2>{tr("Saved rulings", "Decisiones guardadas")}</h2>
          <p className="muted">{tr(
            "Cases stay on this device. Each snapshot keeps the play or situation, facts used, ruling, cited sources, event context and Rulebook version.",
            "Los casos quedan en este dispositivo. Cada snapshot conserva la jugada o situación, hechos usados, decisión, fuentes citadas, contexto del evento y versión del Rulebook.",
          )}</p>
        </div>
        <div className="caseHistoryActions">
          <button className="secondaryAction" onClick={exportCases} disabled={!history.length}>{tr("Export JSON", "Exportar JSON")}</button>
          <button className="secondaryAction dangerGhost" onClick={removeAll} disabled={!history.length}>{tr("Clear all", "Borrar todo")}</button>
        </div>
        <input
          className="searchInput"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tr("Search cases, rules, event or ruling…", "Buscar casos, reglas, evento o decisión…")}
        />
      </div>

      {!filtered.length ? (
        <div className="card caseHistoryEmpty">
          <strong>{history.length ? tr("No cases match this search.", "No hay casos que coincidan con esta búsqueda.") : tr("No saved cases yet.", "Todavía no hay casos guardados.")}</strong>
          <p>{tr(
            "Save a ruling from Match Mode or Full Analysis and it will appear here.",
            "Guardá una decisión desde Match Mode o Análisis completo y va a aparecer acá.",
          )}</p>
        </div>
      ) : (
        <div className="caseHistoryList">
          {filtered.map((record) => (
            <article className="caseHistoryCard" key={record.id}>
              <div className="caseHistoryCardTop">
                <div className={"caseStatus " + record.outcome.status}>{statusLabel(record.outcome.status, language)}</div>
                <span>{formatCaseDate(record.createdAt, language)}</span>
              </div>
              <h3>{record.outcome.headline}</h3>
              <p className="caseSituation">{record.situation}</p>
              <div className="caseMeta">
                <span>{record.discipline === "outdoor" ? "Outdoor" : "Arena"}</span>
                <span>{record.source === "match" ? tr("Match Mode", "Modo Partido") : tr("Full analysis", "Análisis completo")}</span>
                <span>Rulebook {record.rulebookVersion}</span>
                {record.eventContext ? <span>{record.eventContext}</span> : null}
              </div>
              {record.references.length ? (
                <div className="caseRefChips">
                  {record.references.slice(0,5).map((ref,index) => <span key={ref.kind + ref.label + index}>{ref.label}</span>)}
                  {record.references.length > 5 ? <span>+{record.references.length - 5}</span> : null}
                </div>
              ) : null}
              <div className="caseCardActions">
                <button onClick={() => setSelected(record)}>{tr("Review", "Revisar")}</button>
                <button onClick={() => onReuse(record)}>{tr("Use as new query", "Usar como nueva consulta")}</button>
                <button className="deleteCaseButton" onClick={() => remove(record)}>{tr("Delete", "Eliminar")}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}>
          <article className="ruleModal caseHistoryModal" role="dialog" aria-modal="true" aria-label={selected.outcome.headline}>
            <button className="modalClose" onClick={() => setSelected(null)} aria-label={tr("Close", "Cerrar")}>×</button>
            <p className="eyebrow">{tr("SAVED CASE", "CASO GUARDADO")} · {formatCaseDate(selected.createdAt, language)}</p>
            <div className={"caseStatus modalStatus " + selected.outcome.status}>{statusLabel(selected.outcome.status, language)}</div>
            <h2>{selected.outcome.headline}</h2>
            {selected.rulebookVersion !== installedRulebookVersion ? (
              <div className="caseVersionWarning">
                <strong>{tr("Different installed Rulebook version", "Versión de Rulebook instalada diferente")}</strong>
                <span>{tr(
                  "This case was decided under Rulebook " + selected.rulebookVersion + ". The currently installed version is " + installedRulebookVersion + ".",
                  "Este caso fue decidido con el Rulebook " + selected.rulebookVersion + ". La versión instalada actualmente es " + installedRulebookVersion + ".",
                )}</span>
              </div>
            ) : null}

            <div className="caseHistorySection">
              <strong>{tr("Situation", "Situación")}</strong>
              <p>{selected.situation}</p>
            </div>
            <div className="caseHistorySection">
              <strong>{tr("Ruling", "Decisión")}</strong>
              <p>{selected.outcome.summary}</p>
            </div>
            {selected.eventContext ? (
              <div className="caseHistorySection">
                <strong>{tr("Event context", "Contexto del evento")}</strong>
                <p>{selected.eventContext}</p>
              </div>
            ) : null}
            {selected.facts.length ? (
              <div className="caseHistorySection">
                <strong>{tr("Facts used", "Hechos utilizados")}</strong>
                <ul>{selected.facts.map((fact,index) => <li key={fact.label + index}><b>{fact.label}</b>: {fact.value}</li>)}</ul>
              </div>
            ) : null}
            {selected.references.length ? (
              <div className="caseHistorySection">
                <strong>{tr("Sources captured at the time", "Fuentes capturadas en ese momento")}</strong>
                <div className="caseReferenceList">
                  {selected.references.map((ref,index) => (
                    <div key={ref.kind + ref.label + index}>
                      <b>{ref.label}{ref.page ? " · p. " + ref.page : ""}</b>
                      {ref.excerpt ? <p>{ref.excerpt}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="caseModalActions">
              <button className="primaryAction" onClick={() => { onReuse(selected); setSelected(null); }}>{tr("Use as new query", "Usar como nueva consulta")}</button>
              <button className="secondaryAction" onClick={() => remove(selected)}>{tr("Delete case", "Eliminar caso")}</button>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
