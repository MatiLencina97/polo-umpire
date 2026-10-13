"use client";

import type { Language, RuleManifest } from "@/lib/types";

type Metrics = {
  total: number;
  examples: number;
  interpretations: number;
  rulesWithGuidance: number;
};

type Props = {
  language: Language;
  offlineReady: boolean;
  networkOnline: boolean;
  manifest: RuleManifest | null;
  metrics: Metrics | null;
  updateStatus: string;
  onCheckUpdates: () => void;
};

export default function OfflineStatusPanel({
  language,
  offlineReady,
  networkOnline,
  manifest,
  metrics,
  updateStatus,
  onCheckUpdates,
}: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;

  return (
    <div className="offlineWindowContent">
      <div className="card offlineCard">
        <p className="eyebrow">{tr("DEVICE STATUS", "ESTADO DEL DISPOSITIVO")}</p>
        <h2>{offlineReady ? tr("Ready to umpire without signal", "Listo para arbitrar sin señal") : tr("Preparing offline copy", "Preparando copia offline")}</h2>
        <div className="statusRows">
          <div><span>{tr("Application", "Aplicación")}</span><strong>{offlineReady ? tr("✓ Cached", "✓ Cacheada") : tr("Preparing", "Preparando")}</strong></div>
          <div><span>Rulebook</span><strong>{manifest?.activeVersion ?? "2026"}</strong></div>
          <div><span>Outdoor Rules</span><strong>{manifest ? `✓ ${manifest.counts.outdoor}` : "…"}</strong></div>
          <div><span>Arena Rules</span><strong>{manifest ? `✓ ${manifest.counts.arena}` : "…"}</strong></div>
          <div><span>Umpire Guide</span><strong>{manifest ? `✓ ${manifest.counts.umpireGuidePages} ${tr("pages", "págs.")}` : "…"}</strong></div>
          <div><span>{tr("Governing sources", "Fuentes de control")}</span><strong>{manifest?.counts.resourceSections ? `✓ ${manifest.counts.resources ?? 0} / ${manifest.counts.resourceSections} ${tr("sections", "secciones")}` : "…"}</strong></div>
          <div><span>{tr("Current connection", "Conexión actual")}</span><strong>{networkOnline ? "Online" : "Offline"}</strong></div>
        </div>

        <div className="validationAuditCard">
          <p className="eyebrow">{tr("VALIDATION & AUDIT", "VALIDACIÓN Y AUDITORÍA")}</p>
          <h3>{tr("What the app has actually verified", "Qué verificó realmente la app")}</h3>
          <div className="validationMetricGrid">
            <div><strong>{metrics?.total ?? "…"}</strong><span>{tr("official Interpretation/Example blocks indexed", "bloques oficiales de Interpretation/Example indexados")}</span></div>
            <div><strong>{metrics?.examples ?? "…"}</strong><span>{tr("official Examples", "Examples oficiales")}</span></div>
            <div><strong>{metrics?.interpretations ?? "…"}</strong><span>{tr("official Interpretations", "Interpretations oficiales")}</span></div>
            <div><strong>{metrics?.rulesWithGuidance ?? "…"}</strong><span>{tr("rules with official guidance", "reglas con guía oficial")}</span></div>
          </div>
          <div className="validationLegend">
            <div><b className="direct-rule-support">{tr("DIRECT RULE SUPPORT", "APOYO DIRECTO DE REGLA")}</b><span>{tr("The modeled branch follows an explicit provision when the entered facts are correct.", "La rama modelada sigue una disposición expresa si los hechos cargados son correctos.")}</span></div>
            <div><b className="umpire-judgment">{tr("UMPIRE JUDGMENT", "JUICIO DEL UMPIRE")}</b><span>{tr("The Rulebook requires observation or discretion that software should not replace.", "El Rulebook exige observación o discreción que el software no debe reemplazar.")}</span></div>
            <div><b className="insufficient-coverage">{tr("INSUFFICIENT VALIDATED COVERAGE", "COBERTURA VALIDADA INSUFICIENTE")}</b><span>{tr("The app refuses to close the call and sends the Umpire to the official provisions.", "La app se niega a cerrar la decisión y lleva al Umpire a las disposiciones oficiales.")}</span></div>
          </div>
          <p className="validationFootnote">{tr(
            "These are validation categories, not statistical probabilities. A 90% or 99% confidence number would be misleading without a large independently adjudicated benchmark.",
            "Estas son categorías de validación, no probabilidades estadísticas. Un número de 90% o 99% de certeza sería engañoso sin un benchmark grande e independientemente adjudicado.",
          )}</p>
        </div>

        <div className="offlineTest">
          <strong>{tr("Recommended test", "Prueba recomendada")}</strong>
          <p>{tr(
            "When it says OFFLINE READY, enable airplane mode, close the tab, reopen the app, and resolve a play. The core should not depend on Vercel, Supabase, or an LLM.",
            "Cuando diga OFFLINE READY, activá modo avión, cerrá la pestaña, volvé a abrir la app y resolvé una jugada. El core no debe depender de Vercel, Supabase ni un LLM.",
          )}</p>
        </div>
        <button className="secondaryAction" onClick={onCheckUpdates}>{tr("Check published version", "Comprobar versión publicada")}</button>
        {updateStatus && <p className="updateStatus">{updateStatus}</p>}
      </div>
    </div>
  );
}
