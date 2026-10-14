"use client";

import { useEffect, useMemo, useState } from "react";

type GroupMetric = {
  key: string;
  useful: number;
  needsReview: number;
  total: number;
  usefulnessRate: number;
  reviewRequestRate: number;
};

type ReviewItem = {
  id: string;
  createdAt: string;
  reason: string | null;
  note: string | null;
  source: "match" | "analysis";
  discipline: "outdoor" | "arena";
  resolverMode: "play" | "situation";
  topic: string | null;
  scenario: string | null;
  outcomeStatus: string;
  validationLevel: string | null;
  headline: string;
  rulebookVersion: string;
  ruleRefs: string[];
  appVersion: string;
  reviewStatus: "open" | "reviewed" | "dismissed";
};

type Dashboard = {
  totals: {
    useful: number;
    needsReview: number;
    total: number;
    openReviews: number;
    usefulnessRate: number;
    reviewRequestRate: number;
  };
  byTopic: GroupMetric[];
  byVersion: GroupMetric[];
  byReason: GroupMetric[];
  byRule: GroupMetric[];
  reviews: ReviewItem[];
};

function pct(value: number) {
  return Math.round(value * 100) + "%";
}

function MetricTable({ title, rows }: { title: string; rows: GroupMetric[] }) {
  return (
    <section className="feedbackAdminPanel">
      <h2>{title}</h2>
      {rows.length ? (
        <div className="feedbackAdminTableWrap">
          <table className="feedbackAdminTable">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Útil</th>
                <th>Revisión</th>
                <th>n</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{pct(row.usefulnessRate)}</td>
                  <td>{pct(row.reviewRequestRate)}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">Todavía no hay feedback para este grupo.</p>}
    </section>
  );
}

export default function FeedbackAdminDashboard() {
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unauthorized" | "error">("idle");

  useEffect(() => {
    const saved = sessionStorage.getItem("polo-feedback-admin-token");
    if (saved) {
      setToken(saved);
      void load(saved);
    }
  }, []);

  async function load(nextToken = token) {
    if (!nextToken.trim()) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/admin/feedback", {
        headers: { authorization: "Bearer " + nextToken.trim() },
        cache: "no-store",
      });
      if (response.status === 401) {
        setDashboard(null);
        setStatus("unauthorized");
        return;
      }
      if (!response.ok) throw new Error("dashboard-fetch-failed");
      const data = await response.json();
      sessionStorage.setItem("polo-feedback-admin-token", nextToken.trim());
      setDashboard(data.dashboard);
      setStatus("ready");
    } catch {
      setDashboard(null);
      setStatus("error");
    }
  }

  async function updateReview(id: string, reviewStatus: ReviewItem["reviewStatus"]) {
    const response = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + token.trim(),
      },
      body: JSON.stringify({ id, status: reviewStatus }),
      cache: "no-store",
    });
    if (response.ok) await load(token);
  }

  const openReviews = useMemo(
    () => dashboard?.reviews.filter((item) => item.reviewStatus === "open") ?? [],
    [dashboard],
  );

  if (!dashboard) {
    return (
      <main className="feedbackAdminShell">
        <section className="feedbackAdminLogin">
          <p className="eyebrow">POLO UMPIRE ASSISTANT · ADMIN</p>
          <h1>Feedback & Quality</h1>
          <p>Este panel está protegido. La clave se valida únicamente en el servidor y se conserva sólo durante esta sesión del navegador.</p>
          <label>
            <span>Clave de administrador</span>
            <input
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load();
              }}
            />
          </label>
          <button className="primaryAction" onClick={() => void load()} disabled={!token.trim() || status === "loading"}>
            {status === "loading" ? "Ingresando…" : "Abrir dashboard"}
          </button>
          {status === "unauthorized" ? <p className="feedbackAdminError">Clave incorrecta.</p> : null}
          {status === "error" ? <p className="feedbackAdminError">No se pudo cargar el dashboard.</p> : null}
          <a href="/">← Volver a Polo Umpire Assistant</a>
        </section>
      </main>
    );
  }

  const totals = dashboard.totals;

  return (
    <main className="feedbackAdminShell">
      <header className="feedbackAdminHeader">
        <div>
          <p className="eyebrow">POLO UMPIRE ASSISTANT · ADMIN</p>
          <h1>Feedback & Quality</h1>
          <p className="muted">Métricas de utilidad y solicitudes de revisión. No representan “accuracy”.</p>
        </div>
        <div className="feedbackAdminHeaderActions">
          <button onClick={() => void load()}>Actualizar</button>
          <button onClick={() => {
            sessionStorage.removeItem("polo-feedback-admin-token");
            setDashboard(null);
            setToken("");
            setStatus("idle");
          }}>Salir</button>
        </div>
      </header>

      <section className="feedbackAdminStats">
        <article><span>Feedback total</span><strong>{totals.total}</strong></article>
        <article><span>Usefulness rate</span><strong>{pct(totals.usefulnessRate)}</strong><small>n={totals.total}</small></article>
        <article><span>Review-request rate</span><strong>{pct(totals.reviewRequestRate)}</strong><small>n={totals.total}</small></article>
        <article><span>Revisiones abiertas</span><strong>{totals.openReviews}</strong></article>
      </section>

      <section className="feedbackAdminGrid">
        <MetricTable title="Por tópico / escenario" rows={dashboard.byTopic} />
        <MetricTable title="Por versión" rows={dashboard.byVersion} />
        <MetricTable title="Por motivo" rows={dashboard.byReason} />
        <MetricTable title="Por regla / referencia" rows={dashboard.byRule} />
      </section>

      <section className="feedbackAdminPanel feedbackReviewQueue">
        <div className="feedbackReviewHeading">
          <div>
            <p className="eyebrow">REVIEW QUEUE</p>
            <h2>Casos que necesitan revisión</h2>
          </div>
          <span>{openReviews.length} abiertos</span>
        </div>

        {dashboard.reviews.length ? (
          <div className="feedbackReviewList">
            {dashboard.reviews.map((item) => (
              <article key={item.id} className={"feedbackReviewItem " + item.reviewStatus}>
                <div className="feedbackReviewMeta">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <span>{item.discipline}</span>
                  <span>{item.topic ?? item.scenario ?? "general"}</span>
                  <span>v{item.appVersion}</span>
                  <span>{item.validationLevel ?? "—"}</span>
                </div>
                <h3>{item.headline}</h3>
                <p><strong>Motivo:</strong> {item.reason ?? "sin motivo"}</p>
                {item.note ? <p><strong>Nota:</strong> {item.note}</p> : null}
                <p><strong>Reglas:</strong> {item.ruleRefs.length ? item.ruleRefs.join(" · ") : "—"}</p>
                <div className="feedbackReviewActions">
                  <button className={item.reviewStatus === "open" ? "selected" : ""} onClick={() => void updateReview(item.id, "open")}>Abierto</button>
                  <button className={item.reviewStatus === "reviewed" ? "selected" : ""} onClick={() => void updateReview(item.id, "reviewed")}>Revisado</button>
                  <button className={item.reviewStatus === "dismissed" ? "selected" : ""} onClick={() => void updateReview(item.id, "dismissed")}>Descartar</button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="muted">Todavía no hay solicitudes de revisión.</p>}
      </section>
    </main>
  );
}
