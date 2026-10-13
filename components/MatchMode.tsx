"use client";

import { useMemo, useState } from "react";
import { classify, questions } from "@/lib/engine";
import { decidePlay } from "@/lib/play-decision";
import { resolveProvisions } from "@/lib/subarticles";
import { matchProgress } from "@/lib/match-flow";
import { externalMatchesForLabels, externalPageLabel } from "@/lib/external-resources";
import { saveCaseRecord } from "@/lib/case-history";
import type { ChoiceValue, Discipline, ExternalResource, ExternalResourceDb, ExternalSection, Language, Rule, RuleDb, TopicId } from "@/lib/types";

type Props = {
  language: Language;
  discipline: Discipline;
  db: RuleDb;
  externalDb: ExternalResourceDb | null;
  situation: string;
  onSituationChange: (value: string) => void;
  eventContext?: string;
  rulebookVersion: string;
  onOpenRule: (rule: Rule) => void;
  onOpenExternal: (resource: ExternalResource, section: ExternalSection | null) => void;
};

const topicNames: Record<TopicId, { en: string; es: string }> = {
  row: { en: "Right of Way / Crossing", es: "Right of Way / Crossing" },
  dangerous: { en: "Dangerous Riding", es: "Dangerous Riding" },
  blocking: { en: "Improper Blocking", es: "Improper Blocking" },
  mallet: { en: "Mallet / Hook", es: "Mallet / Hook" },
  conduct: { en: "Unsportsmanlike Conduct", es: "Conducta antideportiva" },
  restart: { en: "Restart / Dead Ball", es: "Reanudación / Dead Ball" },
};

const questionLabelsEn: Record<string, string> = {
  rowEntitled: "Was the affected player actually entitled to the Right of Way?",
  risk: "Did the action force the ROW holder to check, change course, or face collision risk?",
  lineChanged: "Had the Line of the Ball changed immediately before the action?",
  clearanceTime: "Was the opponent given the necessary time to clear the new ROW?",
  balance: "Was either horse knocked off balance or displaced with force?",
  speedAngle: "Was there a significant speed/position difference or a strong converging angle?",
  blind: "Was the opponent unprepared for the contact or otherwise exposed to unnecessary risk?",
  restartBlock: "Was this during a knock-in, Penalty 5.a/5.b, or a free hit from out of bounds?",
  marking: "Did the attacker prevent the defender from marking a teammate who had a play on the ball?",
  slow: "In open play, had the ball carrier stopped or slowed to a slow canter/walk within two horse lengths?",
  strokeDanger: "Did the swing or hook create danger to a player or horse?",
  hookPosition: "Was the hook made from the ball side of the opponent's mount, or directly from behind?",
  hookTiming: "Was the opponent in the act of hitting at the ball or hooking/striking the mallet?",
  hookClear: "Was the mallet clear of the opponent's mount, below shoulder level, and without excessive force?",
  conductMatches: "Does the behavior fit Rule 33.a (appealing, abuse, arguing, dangerous/rough conduct, post-whistle hit, etc.)?",
  repeat: "Was there already a similar foul, warning, or card?",
  dead: "Was the ball out of play or the clock stopped?",
  restartType: "What restart was being executed?",
  early: "Did anyone hit or play before the Umpire called Play?",
};

function labelForQuestion(key: string, fallback: string, language: Language) {
  return language === "en" ? (questionLabelsEn[key] ?? fallback) : fallback;
}

function labelForOption(value: string, fallback: string, language: Language) {
  if (language === "es") return fallback;
  if (value === "yes") return "YES";
  if (value === "no") return "NO";
  if (value === "unknown") return "NOT SURE";
  if (value === "na") return "N/A";
  if (value === "knockin") return "KNOCK-IN";
  if (value === "throwin") return "THROW-IN";
  if (value === "penalty") return "PENALTY / FREE HIT";
  if (value === "other") return "OTHER";
  return fallback.toUpperCase();
}

export default function MatchMode({
  language,
  discipline,
  db,
  externalDb,
  situation,
  onSituationChange,
  eventContext,
  rulebookVersion,
  onOpenRule,
  onOpenExternal,
}: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [answers, setAnswers] = useState<Record<string, ChoiceValue>>({});
  const [started, setStarted] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [savedCaseId, setSavedCaseId] = useState("");

  const progress = topic ? matchProgress(topic, answers) : null;
  const activeKeys = progress?.keys ?? [];
  const topicQuestions = topic ? questions[topic].filter((question) => activeKeys.includes(question.key)) : [];
  const currentQuestion = progress?.currentKey
    ? topicQuestions.find((question) => question.key === progress.currentKey) ?? null
    : null;
  const answeredCount = progress?.answeredKeys.length ?? 0;
  const complete = Boolean(progress?.complete);

  const decision = topic ? decidePlay(topic, discipline, answers, language) : null;
  const hasCriticalUnknown = topicQuestions.some((question) => answers[question.key] === "unknown");
  const displayedStatus = hasCriticalUnknown && decision && decision.status !== "needs-info"
    ? "needs-info"
    : decision?.status;

  const provisions = useMemo(
    () => decision ? resolveProvisions(db, discipline, decision.references) : [],
    [db, discipline, decision],
  );

  const matchExternalLabels: Record<TopicId, string[]> = {
    row: ["Umpire Guide"],
    dangerous: ["Umpire Guide"],
    blocking: ["Umpire Guide"],
    mallet: ["Umpire Guide"],
    conduct: ["Policies", "Sport-Related Conduct Procedures"],
    restart: ["Tournament Conditions", "Umpire Guide"],
  };
  const governingSources = topic
    ? externalMatchesForLabels(externalDb, matchExternalLabels[topic], situation + " " + (decision?.summary ?? ""), 3)
    : [];

  function begin() {
    if (!situation.trim()) return;
    const ranked = classify(situation);
    setTopic(ranked[0]?.score ? ranked[0].id : "row");
    setAnswers({});
    setStarted(true);
    setShowWhy(false);
    setShowTopics(false);
    setSavedCaseId("");
    setTimeout(() => document.getElementById("match-question")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }

  function reset() {
    setTopic(null);
    setAnswers({});
    setStarted(false);
    setShowWhy(false);
    setShowTopics(false);
    setSavedCaseId("");
    onSituationChange("");
  }

  function chooseTopic(next: TopicId) {
    setTopic(next);
    setAnswers({});
    setShowWhy(false);
    setShowTopics(false);
    setSavedCaseId("");
  }

  function answer(key: string, value: ChoiceValue) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setSavedCaseId("");
    setTimeout(() => document.getElementById("match-question")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  function saveCurrentCase() {
    if (!topic || !decision || !complete) return;
    const status = (displayedStatus ?? decision.status) as "foul" | "no-foul" | "needs-info" | "procedure";
    const headline = hasCriticalUnknown && decision.status !== "needs-info"
      ? tr("The call cannot be closed with an unknown decisive fact.", "No se puede cerrar la decisión con un dato decisivo desconocido.")
      : decision.headline;

    const ruleReferences = provisions.map((provision) => {
      const parent = db.rules.find((item) => item.discipline === discipline && item.rule === provision.rule);
      const page = parent
        ? (parent.pageEnd && parent.pageEnd !== parent.pageStart ? parent.pageStart + "–" + parent.pageEnd : String(parent.pageStart))
        : undefined;
      return {
        kind: "rule" as const,
        label: provision.label,
        page,
        excerpt: provision.text.slice(0, 600),
      };
    });

    const externalReferences = governingSources.map((item) => ({
      kind: "external" as const,
      label: item.resource.shortTitle + " · " + item.section.title,
      page: externalPageLabel(item.section),
      excerpt: item.section.text.slice(0, 600),
      resourceId: item.resource.id,
      sectionId: item.section.id,
    }));

    const record = saveCaseRecord({
      source: "match",
      resolverMode: "play",
      discipline,
      language,
      situation,
      eventContext,
      rulebookVersion,
      outcome: {
        status,
        headline,
        summary: decision.summary,
      },
      facts: topicQuestions
        .filter((question) => answers[question.key] !== undefined && answers[question.key] !== "")
        .map((question) => ({
          label: labelForQuestion(question.key, question.label, language),
          value: labelForOption(String(answers[question.key]), String(answers[question.key]), language),
        })),
      references: [...ruleReferences, ...externalReferences],
    });
    setSavedCaseId(record.id);
  }

  return (
    <div className="matchModeShell">
      <div className="matchModeHeader">
        <div>
          <p className="eyebrow">{tr("MATCH MODE", "MODO PARTIDO")}</p>
          <h2>{tr("Fast ruling on the field", "Decisión rápida en cancha")}</h2>
          <p>{tr(
            "Describe the play. The app asks only the facts that can change the call, one at a time.",
            "Describí la jugada. La app pregunta sólo los hechos que pueden cambiar la decisión, de a uno.",
          )}</p>
        </div>
        <div className="matchDiscipline">{discipline === "outdoor" ? "OUTDOOR" : "ARENA"}</div>
      </div>

      {eventContext ? (
        <div className="matchContext">
          <span>{tr("EVENT", "EVENTO")}</span>
          <strong>{eventContext}</strong>
        </div>
      ) : null}

      {!started ? (
        <div className="matchStartCard">
          <textarea
            className="matchSituationInput"
            value={situation}
            onChange={(event) => onSituationChange(event.target.value)}
            rows={5}
            autoFocus
            placeholder={tr(
              "Example: Blue had the line. Red crossed from the left and Blue had to check.",
              "Ej.: Blue tenía la línea. Red cruzó desde la izquierda y Blue tuvo que frenar.",
            )}
          />
          <button className="matchPrimaryButton" onClick={begin} disabled={!situation.trim()}>
            {tr("START QUICK RULING", "INICIAR DECISIÓN RÁPIDA")}
          </button>
          <p className="matchOfflineLine">✓ {tr("Runs locally · available offline", "Funciona localmente · disponible offline")}</p>
        </div>
      ) : (
        <>
          <div className="matchTopicBar">
            <span>{tr("Detected", "Detectado")}: <strong>{topic ? topicNames[topic][language] : "—"}</strong></span>
            <button onClick={() => setShowTopics((current) => !current)}>{tr("Change", "Cambiar")}</button>
          </div>

          {showTopics ? (
            <div className="matchTopicPicker">
              {(Object.keys(topicNames) as TopicId[]).map((id) => (
                <button key={id} className={topic === id ? "selected" : ""} onClick={() => chooseTopic(id)}>
                  {topicNames[id][language]}
                </button>
              ))}
            </div>
          ) : null}

          {!complete && currentQuestion ? (
            <section className="matchQuestionCard" id="match-question">
              <div className="matchQuestionMeta">
                <span>{tr("QUESTION", "PREGUNTA")} {answeredCount + 1}</span>
                <span>{topic ? topicNames[topic][language] : ""}</span>
              </div>
              <h3>{labelForQuestion(currentQuestion.key, currentQuestion.label, language)}</h3>
              <div className="matchAnswers">
                {currentQuestion.options.map(([value, label]) => (
                  <button key={value} onClick={() => answer(currentQuestion.key, value)}>
                    {labelForOption(value, label, language)}
                  </button>
                ))}
              </div>
              {answeredCount > 0 ? (
                <button
                  className="matchBackButton"
                  onClick={() => {
                    const previous = [...topicQuestions].reverse().find((question) => answers[question.key] !== undefined && answers[question.key] !== "");
                    if (!previous) return;
                    setAnswers((current) => {
                      const next = { ...current };
                      delete next[previous.key];
                      return next;
                    });
                  }}
                >
                  ← {tr("Back one answer", "Volver una respuesta")}
                </button>
              ) : null}
            </section>
          ) : null}

          {complete && decision ? (
            <section className={"matchVerdict " + displayedStatus}>
              {progress?.earlyResolved ? (
                <div className="matchEarlyResolved">
                  ⚡ {tr("Decisive fact reached · non-decisive questions skipped", "Dato decisivo alcanzado · se omitieron preguntas no decisivas")}
                </div>
              ) : null}
              <div className="matchVerdictTop">
                <span>
                  {displayedStatus === "foul"
                    ? tr("FOUL", "FALTA")
                    : displayedStatus === "no-foul"
                      ? tr("NO FOUL", "NO FOUL")
                      : displayedStatus === "procedure"
                        ? tr("PROCEDURE", "PROCEDIMIENTO")
                        : tr("MORE FACTS NEEDED", "FALTAN DATOS")}
                </span>
                <small>{decision.references.slice(0, 3).map((ref) => "Rule " + ref).join(" · ")}</small>
              </div>
              <h2>{hasCriticalUnknown && decision.status !== "needs-info"
                ? tr("The call cannot be closed with an unknown decisive fact.", "No se puede cerrar la decisión con un dato decisivo desconocido.")
                : decision.headline}</h2>
              <p>{decision.summary}</p>

              {decision.penalty.length ? (
                <div className="matchPenalty">
                  <strong>{tr("Penalty", "Penalidad")}</strong>
                  <p>{decision.penalty[0]}</p>
                </div>
              ) : null}

              <div className="matchVerdictActions">
                <button className="matchWhyButton" onClick={() => setShowWhy((current) => !current)}>
                  {showWhy ? tr("Hide details", "Ocultar detalle") : tr("Why?", "¿Por qué?")}
                </button>
                <button className="matchSaveCase" onClick={saveCurrentCase} disabled={Boolean(savedCaseId)}>
                  {savedCaseId ? tr("✓ Saved", "✓ Guardado") : tr("Save case", "Guardar caso")}
                </button>
                <button className="matchNewPlay" onClick={reset}>{tr("New play", "Nueva jugada")}</button>
              </div>

              {showWhy ? (
                <div className="matchWhyPanel">
                  <div>
                    <strong>{tr("Facts used", "Hechos utilizados")}</strong>
                    <ul>
                      {topicQuestions.filter((question) => answers[question.key] !== undefined && answers[question.key] !== "").map((question) => (
                        <li key={question.key}>
                          {labelForQuestion(question.key, question.label, language)} <b>{labelForOption(String(answers[question.key] ?? ""), String(answers[question.key] ?? ""), language)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {decision.missing.length || hasCriticalUnknown ? (
                    <div>
                      <strong>{tr("What is still uncertain", "Qué sigue incierto")}</strong>
                      <ul>
                        {decision.missing.map((item, index) => <li key={index}>{item}</li>)}
                        {hasCriticalUnknown ? <li>{tr("At least one answer was marked Not sure.", "Al menos una respuesta fue marcada como No estoy seguro.")}</li> : null}
                      </ul>
                    </div>
                  ) : null}

                  <div>
                    <strong>{tr("Official provisions", "Disposiciones oficiales")}</strong>
                    <div className="matchProvisionList">
                      {provisions.map((provision) => {
                        const rule = db.rules.find((item) => item.discipline === discipline && item.rule === provision.rule);
                        return (
                          <button key={provision.id} onClick={() => rule && onOpenRule(rule)}>
                            <b>{provision.label}</b>
                            <span>{provision.text.length > 250 ? provision.text.slice(0, 250) + "…" : provision.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {governingSources.length ? (
                    <div>
                      <strong>{tr("Governing sources", "Fuentes de control")}</strong>
                      <div className="matchProvisionList">
                        {governingSources.map((item) => (
                          <button key={item.resource.id + "-" + item.section.id} onClick={() => onOpenExternal(item.resource, item.section)}>
                            <b>{item.resource.shortTitle} · {item.section.title}</b>
                            <span>p. {externalPageLabel(item.section)} · {item.section.text.slice(0,220)}{item.section.text.length > 220 ? "…" : ""}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
