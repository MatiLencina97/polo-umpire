"use client";

import { useMemo, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";
import { classifyTopic, playClarifierCandidates, playClarifierLabel, questions } from "@/lib/engine";
import { extractExplicitPlayFacts } from "@/lib/play-fact-extractor";
import { buildCompoundPlayGraph } from "@/lib/compound-play-graph";
import { decidePlay } from "@/lib/play-decision";
import { getProvision, resolveProvisions } from "@/lib/subarticles";
import { applyMatchAnswer, matchProgress, rewindLastMatchAnswer } from "@/lib/match-flow";
import { externalMatchesForLabels, externalPageLabel } from "@/lib/external-resources";
import { saveCaseRecord } from "@/lib/case-history";
import { auditLevelLabel, auditPlayDecision } from "@/lib/decision-audit";
import { playDecisionRuleTrail } from "@/lib/decision-links";
import DecisionRuleTrail from "@/components/DecisionRuleTrail";
import RowEntitlementHelper from "@/components/RowEntitlementHelper";
import VoiceInputButton from "@/components/VoiceInputButton";
import DecisionFeedback from "@/components/DecisionFeedback";
import type { ChoiceValue, Discipline, ExternalResource, ExternalResourceDb, ExternalSection, Language, Rule, RuleDb, TopicId } from "@/lib/types";
import type { RuleProvision } from "@/lib/subarticles";

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
  onOpenProvision: (provision: RuleProvision) => void;
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
  strokeEnteredByOpponent: "If there was danger, did another player clearly ride into an already established stroke and create that danger?",
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
  onOpenProvision,
  onOpenExternal,
}: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [rankedTopics, setRankedTopics] = useState<ReturnType<typeof classifyTopic>["ranked"]>([]);
  const [answers, setAnswers] = useState<Record<string, ChoiceValue>>({});
  const [started, setStarted] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [savedCaseId, setSavedCaseId] = useState("");
  const [caseSaveError, setCaseSaveError] = useState(false);

  const extractedFacts = useMemo(
    () => topic ? extractExplicitPlayFacts(situation, topic) : { answers: {}, facts: [] },
    [situation, topic],
  );
  const effectiveAnswers = useMemo(
    () => ({ ...extractedFacts.answers, ...answers }),
    [extractedFacts, answers],
  );
  const activeDetectedFacts = extractedFacts.facts.filter(
    (fact) => answers[fact.key] === undefined || answers[fact.key] === fact.value,
  );
  const compoundGraph = useMemo(
    () => buildCompoundPlayGraph(situation, discipline, language),
    [situation, discipline, language],
  );

  const progress = topic ? matchProgress(topic, effectiveAnswers) : null;
  const activeKeys = progress?.keys ?? [];
  const topicQuestions = topic
    ? activeKeys.flatMap((key) => {
        const question = questions[topic].find((candidate) => candidate.key === key);
        return question ? [question] : [];
      })
    : [];
  const currentQuestion = progress?.currentKey
    ? topicQuestions.find((question) => question.key === progress.currentKey) ?? null
    : null;
  const answeredCount = progress?.answeredKeys.length ?? 0;
  const complete = Boolean(progress?.complete);

  const decision = topic ? decidePlay(topic, discipline, effectiveAnswers, language) : null;
  const decisionAudit = topic && decision ? auditPlayDecision(topic, discipline, effectiveAnswers, decision) : null;
  const hasCriticalUnknown = topicQuestions.some((question) => effectiveAnswers[question.key] === "unknown");
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

  const ruleTrail = topic && decision
    ? playDecisionRuleTrail({ db, discipline, topic, answers: effectiveAnswers, decision, language })
    : [];

  function begin() {
    if (!situation.trim()) return;
    const detected = classifyTopic(situation);
    setTopic(detected.topic);
    setRankedTopics(detected.ranked);
    setAnswers({});
    setStarted(true);
    setShowWhy(false);
    setShowTopics(!detected.topic);
    setSavedCaseId("");
    setCaseSaveError(false);
    setTimeout(() => document.getElementById("match-question")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }

  function reset() {
    setTopic(null);
    setRankedTopics([]);
    setAnswers({});
    setStarted(false);
    setShowWhy(false);
    setShowTopics(false);
    setSavedCaseId("");
    setCaseSaveError(false);
    onSituationChange("");
  }

  function chooseTopic(next: TopicId) {
    setTopic(next);
    setAnswers({});
    setShowWhy(false);
    setShowTopics(false);
    setSavedCaseId("");
    setCaseSaveError(false);
  }

  function answer(key: string, value: ChoiceValue) {
    if (!topic) return;
    setAnswers((current) => applyMatchAnswer(topic, { ...extractedFacts.answers, ...current }, key, value));
    setSavedCaseId("");
    setCaseSaveError(false);
    setTimeout(() => document.getElementById("match-question")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  function rewind() {
    if (!topic) return;
    const lastAnswered = [...(progress?.answeredKeys ?? [])].reverse()[0];
    if (!lastAnswered) return;
    setAnswers((current) => ({ ...current, [lastAnswered]: "unknown" }));
    setSavedCaseId("");
    setCaseSaveError(false);
    setShowWhy(false);
    setTimeout(() => document.getElementById("match-question")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function saveCurrentCase() {
    if (!topic || !decision || !complete) return;
    const status = (displayedStatus ?? decision.status) as "foul" | "no-foul" | "needs-info" | "procedure";
    const headline = hasCriticalUnknown && decision.status !== "needs-info"
      ? tr("The call cannot be closed with an unknown decisive fact.", "No se puede cerrar la decisión con un dato decisivo desconocido.")
      : decision.headline;

    const ruleReferences = ruleTrail.map(({ provision }) => ({
      kind: "rule" as const,
      label: provision.label,
      page: provision.pageEnd && provision.pageEnd !== provision.pageStart
        ? provision.pageStart + "–" + provision.pageEnd
        : String(provision.pageStart),
      excerpt: provision.text.slice(0, 600),
    }));

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
        .filter((question) => effectiveAnswers[question.key] !== undefined && effectiveAnswers[question.key] !== "")
        .map((question) => ({
          label: labelForQuestion(question.key, question.label, language),
          value: labelForOption(String(effectiveAnswers[question.key]), String(effectiveAnswers[question.key]), language),
        })),
      references: [...ruleReferences, ...externalReferences],
    });
    if (record) {
      setSavedCaseId(record.id);
      setCaseSaveError(false);
    } else {
      setCaseSaveError(true);
    }
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
          <div className="umpireAuthorityNotice">
            <strong>{tr("Decision support, not a replacement for the Umpire", "Apoyo a la decisión, no reemplazo del Umpire")}</strong>
            <span>{tr(
              "The app identifies rules, missing facts and validated branches. The final call always belongs to the Umpire.",
              "La app identifica reglas, hechos faltantes y ramas validadas. La decisión final siempre corresponde al Umpire.",
            )}</span>
          </div>
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
          <div className="voiceTextareaWrap matchVoiceWrap">
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
            <VoiceInputButton value={situation} onChange={onSituationChange} language={language} />
          </div>
          <button className="matchPrimaryButton" onClick={begin} disabled={!situation.trim()}>
            {tr("START QUICK RULING", "INICIAR DECISIÓN RÁPIDA")}
          </button>
          <p className="matchOfflineLine">✓ {tr(
            "Rulings run locally · voice dictation availability depends on the browser",
            "Las decisiones funcionan localmente · el dictado por voz depende del navegador",
          )}</p>
        </div>
      ) : (
        <>
          <div className="matchTopicBar">
            <span>{topic
              ? <>{tr("Detected", "Detectado")}: <strong>{topicNames[topic][language]}</strong></>
              : <strong>{tr("Clarify the play", "Aclará la jugada")}</strong>}</span>
            {topic ? (
              <button onClick={() => setShowTopics((current) => !current)}>{tr("Change", "Cambiar")}</button>
            ) : null}
          </div>

          {showTopics ? (
            <div className="matchTopicPicker">
              {(topic
                ? (Object.keys(topicNames) as TopicId[])
                : playClarifierCandidates(rankedTopics)
              ).map((id) => (
                <button key={id} className={topic === id ? "selected" : ""} onClick={() => chooseTopic(id)}>
                  {topic ? topicNames[id][language] : playClarifierLabel(id, language)}
                </button>
              ))}
            </div>
          ) : null}

          {compoundGraph.compound ? (
            <div className="ruleGraph compactRuleGraph">
              <div className="ruleGraphHeader">
                <div>
                  <p className="eyebrow">{tr("COMPOUND PLAY", "JUGADA COMPUESTA")}</p>
                  <h3>{tr("More than one rule path is active", "Hay más de una rama reglamentaria activa")}</h3>
                </div>
                <span className="graphCoverageBadge">{compoundGraph.nodes.length} {tr("paths", "ramas")}</span>
              </div>
              <div className="ruleGraphNodes">
                {compoundGraph.nodes.map((node) => (
                  <button
                    className="ruleGraphNode graphRuleButton"
                    key={node.topic}
                    onClick={() => chooseTopic(node.topic)}
                  >
                    <b>{topicNames[node.topic][language]}{node.primary ? " · " + tr("primary", "principal") : ""}</b>
                    <span>
                      {node.decision.status === "needs-info"
                        ? tr("Needs decisive facts", "Faltan datos decisivos")
                        : node.decision.status === "foul"
                          ? tr("Foul branch supported", "Rama de falta respaldada")
                          : node.decision.status === "no-foul"
                            ? tr("No-foul branch supported", "Rama no-foul respaldada")
                            : tr("Procedure branch", "Rama de procedimiento")}
                      {" · "}
                      {node.decision.references.slice(0, 3).map((ref) => "Rule " + ref).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
              <div className="crossChecks">
                {compoundGraph.relations.map((relation, index) => (
                  <div className="crossCheck warning" key={relation.from + "-" + relation.to + "-" + index}>
                    <div>
                      <span className="crossCheckSource">{tr("RELATION", "RELACIÓN")}</span>
                      <strong>{topicNames[relation.from][language]} ↔ {topicNames[relation.to][language]}</strong>
                    </div>
                    <p>{language === "en" ? relation.summaryEn : relation.summaryEs}</p>
                    <small><strong>{tr("Order:", "Orden:")}</strong> {language === "en" ? relation.priorityEn : relation.priorityEs}</small>
                  </div>
                ))}
              </div>
              <p className="muted">{tr(
                "The app keeps each branch separate. It does not automatically stack penalties; final penalty selection remains with the Umpire under the controlling penalty rule.",
                "La app mantiene cada rama separada. No suma penalidades automáticamente; la selección final de penalidad sigue correspondiendo al Umpire bajo la regla de penalidades aplicable.",
              )} {"Rule " + compoundGraph.penaltySelectionRef}.</p>
            </div>
          ) : null}

          {topic && activeDetectedFacts.length ? (
            <div className="matchContext">
              <span>{tr("DETECTED FROM YOUR DESCRIPTION", "DETECTADO EN TU DESCRIPCIÓN")}</span>
              <strong>{activeDetectedFacts.map((fact) => language === "en" ? fact.reasonEn : fact.reasonEs).join(" · ")}</strong>
              <button
                className="matchBackButton"
                onClick={() => setAnswers((current) => ({
                  ...current,
                  ...Object.fromEntries(activeDetectedFacts.map((fact) => [fact.key, "unknown"])),
                }))}
              >
                {tr("Review detected facts", "Revisar datos detectados")}
              </button>
            </div>
          ) : null}

          {!complete && currentQuestion ? (
            <section className="matchQuestionCard" id="match-question">
              <div className="matchQuestionMeta">
                <span>{tr("QUESTION", "PREGUNTA")} {answeredCount + 1}</span>
                <span>{topic ? topicNames[topic][language] : ""}</span>
              </div>
              <h3>{labelForQuestion(currentQuestion.key, currentQuestion.label, language)}</h3>
              {topic === "row" && currentQuestion.key === "rowEntitled" ? (
                <RowEntitlementHelper
                  language={language}
                  resolveProvision={(ref) => getProvision(db, discipline, ref)}
                  onOpenProvision={onOpenProvision}
                  onApply={(hasRow, refs) => {
                    setAnswers((current) => {
                      const nextAnswers = applyMatchAnswer("row", { ...extractedFacts.answers, ...current }, "rowEntitled", hasRow ? "yes" : "no");
                      nextAnswers.rowEntitlementDerived = refs.join(",");
                      return nextAnswers;
                    });
                    setSavedCaseId("");
                    setTimeout(() => document.getElementById("match-question")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
                  }}
                />
              ) : null}
              {topic === "row" && currentQuestion.key === "rowEntitled" ? (
                <p className="matchDirectAnswerHint">{tr(
                  "Or, if the Umpire has already established the ROW from the play, answer directly:",
                  "O, si el Umpire ya estableció el ROW a partir de la jugada, respondé directamente:",
                )}</p>
              ) : null}
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
                  onClick={rewind}
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
              {decisionAudit ? (
                <div className={"decisionAuditBadge " + decisionAudit.level}>
                  <b>{auditLevelLabel(decisionAudit.level, language)}</b>
                  <span>{language === "en" ? decisionAudit.reasonEn : decisionAudit.reasonEs}</span>
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
                <button className="matchWhyButton" onClick={rewind}>
                  ← {tr("Edit last answer", "Corregir última respuesta")}
                </button>
                <button className="matchWhyButton" onClick={() => setShowWhy((current) => !current)}>
                  {showWhy ? tr("Hide details", "Ocultar detalle") : tr("Why?", "¿Por qué?")}
                </button>
                <button className="matchSaveCase" onClick={saveCurrentCase} disabled={Boolean(savedCaseId)}>
                  {savedCaseId ? tr("✓ Saved", "✓ Guardado") : tr("Save case", "Guardar caso")}
                </button>
                <button className="matchNewPlay" onClick={reset}>{tr("New play", "Nueva jugada")}</button>
              </div>
              {caseSaveError ? (
                <p className="matchSaveError">{tr(
                  "This case could not be saved on this device. Browser storage may be unavailable or full.",
                  "No se pudo guardar este caso en el dispositivo. El almacenamiento del navegador puede estar bloqueado o lleno.",
                )}</p>
              ) : null}

              {topic ? (
                <DecisionFeedback
                  language={language}
                  context={{
                    source: "match",
                    discipline,
                    resolverMode: "play",
                    topic,
                    outcomeStatus: displayedStatus ?? decision.status,
                    validationLevel: decisionAudit?.level ?? null,
                    headline: hasCriticalUnknown && decision.status !== "needs-info"
                      ? tr("The call cannot be closed with an unknown decisive fact.", "No se puede cerrar la decisión con un dato decisivo desconocido.")
                      : decision.headline,
                    rulebookVersion,
                    ruleRefs: ruleTrail.map((item) => item.provision.ref),
                    appVersion: APP_VERSION,
                  }}
                />
              ) : null}

              {showWhy ? (
                <div className="matchWhyPanel">
                  <div>
                    <strong>{tr("Facts used", "Hechos utilizados")}</strong>
                    <ul>
                      {topicQuestions.filter((question) => effectiveAnswers[question.key] !== undefined && effectiveAnswers[question.key] !== "").map((question) => (
                        <li key={question.key}>
                          {labelForQuestion(question.key, question.label, language)} <b>{labelForOption(String(effectiveAnswers[question.key] ?? ""), String(effectiveAnswers[question.key] ?? ""), language)}</b>
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

                  {decisionAudit ? (
                    <div className="auditScopePanel">
                      <strong>{tr("Validation scope", "Alcance de validación")}</strong>
                      <p>{language === "en" ? decisionAudit.scopeEn : decisionAudit.scopeEs}</p>
                    </div>
                  ) : null}

                  <DecisionRuleTrail
                    language={language}
                    ruleLinks={ruleTrail}
                    externalLinks={governingSources}
                    onOpenProvision={onOpenProvision}
                    onOpenExternal={(resource, section) => onOpenExternal(resource, section)}
                  />

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
