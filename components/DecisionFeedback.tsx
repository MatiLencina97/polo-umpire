"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildFeedbackRecord,
  flushPendingFeedback,
  submitFeedbackRecord,
  type FeedbackContext,
  type FeedbackRating,
  type FeedbackReason,
} from "@/lib/decision-feedback";
import type { Language } from "@/lib/types";

type Props = {
  language: Language;
  context: FeedbackContext;
};

const reasonOptions: Array<{ value: FeedbackReason; en: string; es: string }> = [
  { value: "disagree-call", en: "I disagree with the ruling", es: "No coincido con la decisión" },
  { value: "missing-fact", en: "A decisive fact is missing", es: "Falta un hecho decisivo" },
  { value: "missing-rule", en: "A relevant rule/source is missing", es: "Falta una regla/fuente relevante" },
  { value: "unclear", en: "The explanation is unclear", es: "La explicación no es clara" },
  { value: "other", en: "Other", es: "Otro" },
];

export default function DecisionFeedback({ language, context }: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  const fingerprint = useMemo(() => JSON.stringify(context), [context]);
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [reason, setReason] = useState<FeedbackReason | undefined>();
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [delivered, setDelivered] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setRating(null);
    setReason(undefined);
    setNote("");
    setSubmitted(false);
    setDelivered(null);
  }, [fingerprint]);

  useEffect(() => {
    void flushPendingFeedback();
    const onOnline = () => { void flushPendingFeedback(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  async function send(nextRating: FeedbackRating, nextReason?: FeedbackReason) {
    setSending(true);
    const record = buildFeedbackRecord(context, nextRating, nextReason, note);
    const result = await submitFeedbackRecord(record);
    setDelivered(result.delivered);
    setSubmitted(true);
    setSending(false);
  }

  if (submitted) {
    return (
      <div className="decisionFeedback submitted">
        <div>
          <strong>{tr("Thanks — this helps us audit the assistant.", "Gracias — esto nos ayuda a auditar el asistente.")}</strong>
          <span>{delivered
            ? tr("Feedback received.", "Feedback recibido.")
            : tr("Saved on this device and queued to send when a connection is available.", "Guardado en este dispositivo y en cola para enviarse cuando haya conexión.")}</span>
        </div>
        <button onClick={() => { setSubmitted(false); setRating(null); setReason(undefined); setNote(""); }}>
          {tr("Change", "Cambiar")}
        </button>
      </div>
    );
  }

  return (
    <section className="decisionFeedback">
      <div className="decisionFeedbackHeader">
        <div>
          <p className="eyebrow">{tr("UMPIRE FEEDBACK", "FEEDBACK DEL UMPIRE")}</p>
          <h3>{tr("Was this result useful?", "¿Te resultó útil este resultado?")}</h3>
          <p>{tr(
            "Your feedback helps us identify which rule branches are working well and which ones need more review.",
            "Tu feedback nos ayuda a identificar qué ramas reglamentarias funcionan bien y cuáles necesitan más revisión.",
          )}</p>
          <small className="feedbackPrivacy">{tr(
            "Anonymous by default: the original play description, event name and device identifier are not sent.",
            "Anónimo por defecto: no se envían la descripción original de la jugada, el nombre del evento ni un identificador del dispositivo.",
          )}</small>
        </div>
        <div className="feedbackPrimaryChoices">
          <button
            className={rating === "useful" ? "selected useful" : "useful"}
            onClick={() => { setRating("useful"); setReason("clear"); }}
          >
            <span>👍</span>{tr("Useful", "Útil")}
          </button>
          <button
            className={rating === "needs-review" ? "selected review" : "review"}
            onClick={() => { setRating("needs-review"); setReason(undefined); }}
          >
            <span>⚑</span>{tr("Needs review", "Necesita revisión")}
          </button>
        </div>
      </div>

      {rating === "needs-review" ? (
        <div className="feedbackDetails">
          <strong>{tr("What should we review?", "¿Qué deberíamos revisar?")}</strong>
          <div className="feedbackReasonGrid">
            {reasonOptions.map((item) => (
              <button
                key={item.value}
                className={reason === item.value ? "selected" : ""}
                onClick={() => setReason(item.value)}
              >
                {language === "en" ? item.en : item.es}
              </button>
            ))}
          </div>
          <label>
            <span>{tr("Optional note", "Nota opcional")}</span>
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={tr(
                "Example: I think Rule 24.d should also be considered here.",
                "Ej.: Creo que acá también debería considerarse Rule 24.d.",
              )}
            />
          </label>
          <small>{tr(
            "Please do not include names or personal information. The original play description is not sent with this feedback.",
            "No incluyas nombres ni información personal. La descripción original de la jugada no se envía con este feedback.",
          )}</small>
        </div>
      ) : null}

      {rating ? (
        <button
          className="feedbackSubmit"
          onClick={() => void send(rating, reason)}
          disabled={sending || (rating === "needs-review" && !reason)}
        >
          {sending ? tr("Sending…", "Enviando…") : tr("Send feedback", "Enviar feedback")}
        </button>
      ) : null}
    </section>
  );
}
