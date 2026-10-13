"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applicationText,
  bestMatchingApplication,
  classify,
  classifyScenario,
  questions,
  relatedRuleNumbers,
  scenarioApplicationText,
  parseSubstitutionHandicaps,
  parseSubstitutionNationality,
  localizedApplicationText,
  localizedScenarioApplicationText,
  scenarioDefs,
  scenarioQuestions,
  scoreRule,
  topicDefs,
} from "@/lib/engine";
import {
  buildSubstitutionCrossRuleState,
  defaultSubstitutionCrossFacts,
  parseSubstitutionCrossFacts,
  type SubstitutionCrossFacts,
} from "@/lib/cross-rule";
import {
  buildUniversalRuleGraph,
  factLabel,
  factOptionLabel,
  factWhy,
  graphCoverage,
  ruleGraphFamilies,
  type CaseFactDefinition,
  type CaseFactValue,
} from "@/lib/rule-graphs";
import {
  defaultEventProfile,
  profileSummary,
  profileToCaseFacts,
  profileToSubstitutionFacts,
  type EventProfile,
} from "@/lib/event-profile";
import type {
  ChoiceValue,
  Discipline,
  Language,
  Rule,
  RuleDb,
  ResolverMode,
  RuleManifest,
  ScenarioId,
  TopicId,
} from "@/lib/types";

type Tab = "resolver" | "buscar" | "reglamento" | "estado";
type SearchFilter = "all" | Discipline;
type FontSizePreference = "small" | "normal" | "large";

const quickPlays: Record<Language, string[]> = {
  en: [
    "A player crosses in front of the player following the line and forces him to check.",
    "During a ride-off, a horse is knocked off balance by the contact.",
    "An attacker blocks a defender to free a teammate.",
    "A player attempts a hook and the swing passes very close to the opponent's horse.",
  ],
  es: [
    "Un jugador cruza delante del que venía siguiendo la línea y lo obliga a frenar.",
    "Durante un ride-off un caballo pierde el equilibrio por el contacto.",
    "Un atacante bloquea a un defensor para liberar a su compañero.",
    "Un jugador intenta un hook y el swing pasa muy cerca del caballo rival.",
  ],
};

const quickRuleSituations: Record<Language, string[]> = {
  en: [
    "In an 8-goal tournament, a 5-goal player is injured and must be replaced. What conditions must the substitute meet to be eligible?",
    "The injured player is the team's only countable American Player. Can a foreign substitute replace him?",
    "The only available substitute would take the team below the event's lower handicap limit.",
    "A player replaced for exhaustion recovers and wants to return halfway through the next period.",
  ],
  es: [
    "En un torneo de 8 goles, se cae un jugador de 5 goles y tiene que ser reemplazado. ¿Qué condiciones debe tener su reemplazo para ser elegible?",
    "El jugador lesionado es el único American Player computable del equipo. ¿Puede reemplazarlo un extranjero?",
    "El único sustituto disponible baja al equipo por debajo del límite inferior del evento.",
    "Un jugador reemplazado por agotamiento se recupera y quiere volver a mitad del siguiente período.",
  ],
};

const defaultNationalityInputs = defaultSubstitutionCrossFacts;

const questionLabelsEn: Record<string, string> = {
  risk: "Did the action force the player with the possible Right of Way to check, change course, or face collision risk?",
  lineChanged: "Had the Line of the Ball changed immediately before the action?",
  parallel: "Were the players parallel or nearly parallel at the relevant moment?",
  balance: "Was either horse knocked off balance or displaced with force?",
  speedAngle: "Was there a significant difference in speed, position, or a strong converging angle?",
  blind: "Did the contact catch the opponent unprepared (blind-side) or create unnecessary risk?",
  restartBlock: "Did this occur during a knock-in, Penalty 5.a/5.b, or a free hit from out of bounds?",
  marking: "Did the attacker prevent the defender from marking a teammate who had a play on the ball?",
  slow: "In open play, did the ball carrier slow to a slow canter/walk while the block occurred within two horse lengths?",
  strokeDanger: "Did the swing or hook create danger to another player or horse?",
  sameSide: "Was the hook made from the same side of the horse as the player making the stroke?",
  deliberate: "Was the conduct deliberate, abusive, or contrary to the spirit of the game?",
  repeat: "Was there a similar prior foul, warning, or card?",
  dead: "Was the ball out of play or the clock stopped?",
  early: "Did anyone hit or play before the Umpire called Play?",
  endPeriod: "Is the substitution being made at the end of a period?",
  unable: "If during a period, has the player being replaced been declared unable to continue?",
  openSpot: "Is the position already open because the team has been playing short?",
  doubleSub: "Is this an injury during the period and the team wants a double substitution?",
  eligible: "Are the proposed substitutes otherwise eligible to play in this game/Event?",
  upperLimit: "Would the substitution cause the team's aggregate handicap to exceed the event upper limit?",
  penalty7: "Is the substitution related to a Penalty 7 removal?",
};

const topicLabelsEn: Record<string, string> = {
  row: "Right of Way / Crossing",
  dangerous: "Dangerous Riding",
  blocking: "Improper Blocking",
  mallet: "Mallet / Hook",
  conduct: "Unsportsmanlike Conduct",
  restart: "Restart / Dead Ball",
};

function pageLabel(rule: Rule) {
  return rule.pageEnd && rule.pageEnd !== rule.pageStart
    ? `${rule.pageStart}–${rule.pageEnd}`
    : `${rule.pageStart}`;
}

function excerpt(rule: Rule) {
  const compact = rule.text.replace(/\s+/g, " ").trim();
  return compact.length > 285 ? `${compact.slice(0, 285)}…` : compact;
}

function RuleCard({ rule, onOpen }: { rule: Rule; onOpen: (rule: Rule) => void }) {
  return (
    <button className="candidate" onClick={() => onOpen(rule)}>
      <span className="candidateTop">
        <strong>{rule.discipline === "outdoor" ? "Outdoor" : "Arena"} Rule {rule.rule} · {rule.title}</strong>
        <span className="ruleTag">p. {pageLabel(rule)}</span>
      </span>
      <span className="candidateExcerpt">{excerpt(rule)}</span>
    </button>
  );
}

export default function UmpireApp() {
  const [tab, setTab] = useState<Tab>("resolver");
  const [discipline, setDiscipline] = useState<Discipline>("outdoor");
  const [resolverMode, setResolverMode] = useState<ResolverMode>("play");
  const [db, setDb] = useState<RuleDb | null>(null);
  const [manifest, setManifest] = useState<RuleManifest | null>(null);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [substitutionInputs, setSubstitutionInputs] = useState({
    eventUpper: "",
    teamTotalBefore: "",
    outgoingHandicap: "",
    candidateHandicap: "",
  });
  const [situation, setSituation] = useState("");
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [rankedTopics, setRankedTopics] = useState<ReturnType<typeof classify>>([]);
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const [rankedScenarios, setRankedScenarios] = useState<ReturnType<typeof classifyScenario>>([]);
  const [genericSituationRules, setGenericSituationRules] = useState<Rule[]>([]);
  const [answers, setAnswers] = useState<Record<string, ChoiceValue>>({});
  const [showResolution, setShowResolution] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [fontSize, setFontSize] = useState<FontSizePreference>("normal");
  const [nationalityInputs, setNationalityInputs] = useState<SubstitutionCrossFacts>({ ...defaultNationalityInputs });
  const [followUpText, setFollowUpText] = useState("");
  const [followUps, setFollowUps] = useState<Array<{ question: string; answer: string; ruleIds: string[] }>>([]);
  const [caseFacts, setCaseFacts] = useState<Record<string, CaseFactValue>>({});
  const [selectedMissingFactKey, setSelectedMissingFactKey] = useState("");
  const [eventProfile, setEventProfile] = useState<EventProfile>({ ...defaultEventProfile });
  const [profileDraft, setProfileDraft] = useState<EventProfile>({ ...defaultEventProfile });
  const [profileOpen, setProfileOpen] = useState(false);

  const tr = (en: string, es: string) => language === "en" ? en : es;
  const optionLabel = (value: string, fallback: string) => {
    if (language === "es") return fallback;
    if (value === "yes") return "Yes";
    if (value === "no") return "No";
    if (value === "unknown") return "Not sure";
    if (value === "na") return "Not applicable";
    return fallback;
  };
  const questionLabel = (key: string, fallback: string) => language === "en" ? (questionLabelsEn[key] ?? fallback) : fallback;
  const topicLabel = (id: string, fallback: string) => language === "en" ? (topicLabelsEn[id] ?? fallback) : fallback;

  useEffect(() => {
    setNetworkOnline(navigator.onLine);
    const on = () => setNetworkOnline(true);
    const off = () => setNetworkOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const load = async () => {
      try {
        const manifestResponse = await fetch("/data/manifest.json");
        if (!manifestResponse.ok) throw new Error("manifest");
        const nextManifest = (await manifestResponse.json()) as RuleManifest;
        const rulesPath = nextManifest.rulesFile.startsWith("/")
          ? nextManifest.rulesFile
          : `/${nextManifest.rulesFile}`;
        const dbResponse = await fetch(rulesPath);
        if (!dbResponse.ok) throw new Error("rules");
        const nextDb = (await dbResponse.json()) as RuleDb;
        setManifest(nextManifest);
        setDb(nextDb);
      } catch {
        setLoadError("Could not open the local Rulebook copy. Open the app once with a connection to finish the offline installation.");
      }
    };

    const prepareOffline = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const urls = Array.from(
          new Set([
            "/",
            "/manifest.webmanifest",
            "/data/manifest.json",
            "/data/rules-2026.json",
            "/icons/icon-192.png",
            "/icons/icon-512.png",
            ...performance
              .getEntriesByType("resource")
              .map((entry) => entry.name)
              .filter((url) => url.startsWith(location.origin))
              .map((url) => new URL(url).pathname),
          ]),
        );

        const worker = registration.active ?? registration.waiting ?? registration.installing;
        worker?.postMessage({ type: "WARM_CACHE", urls });

        const channel = new MessageChannel();
        const active = registration.active;
        if (active) {
          active.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
          channel.port1.onmessage = (event) => setOfflineReady(Boolean(event.data?.ready));
        }
      } catch {
        setOfflineReady(false);
      }
    };

    const message = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_READY") setOfflineReady(true);
    };
    navigator.serviceWorker?.addEventListener("message", message);

    void load();
    void prepareOffline();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, []);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("polo-umpire-language");
    if (savedLanguage === "en" || savedLanguage === "es") setLanguage(savedLanguage);

    const savedFontSize = localStorage.getItem("polo-umpire-font-size");
    if (savedFontSize === "small" || savedFontSize === "normal" || savedFontSize === "large") {
      setFontSize(savedFontSize);
    }

    const savedProfile = localStorage.getItem("umpire-polo-event-profile");
    if (savedProfile) {
      try {
        const parsed = { ...defaultEventProfile, ...JSON.parse(savedProfile) } as EventProfile;
        setEventProfile(parsed);
        setProfileDraft(parsed);
        setDiscipline(parsed.discipline);
      } catch {
        // Keep the safe local defaults if the saved profile is invalid.
      }
    }
  }, []);

  function changeLanguage(next: Language) {
    setLanguage(next);
    localStorage.setItem("polo-umpire-language", next);
  }

  function changeFontSize(next: FontSizePreference) {
    setFontSize(next);
    localStorage.setItem("polo-umpire-font-size", next);
  }

  function openEventProfile() {
    setProfileDraft({ ...eventProfile });
    setProfileOpen(true);
  }

  function saveEventProfile() {
    const next = { ...profileDraft };
    setEventProfile(next);
    setProfileDraft(next);
    setDiscipline(next.discipline);
    localStorage.setItem("umpire-polo-event-profile", JSON.stringify(next));
    setProfileOpen(false);
  }

  function clearEventProfile() {
    const next = { ...defaultEventProfile, discipline };
    setEventProfile(next);
    setProfileDraft(next);
    localStorage.removeItem("umpire-polo-event-profile");
  }

  const searchedRules = useMemo(() => {
    if (!db) return [];
    return db.rules
      .filter((rule) => searchFilter === "all" || rule.discipline === searchFilter)
      .map((rule) => ({ rule, score: scoreRule(rule, search) }))
      .filter((item) => !search || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, search ? 24 : 12)
      .map((item) => item.rule);
  }, [db, search, searchFilter]);

  const resolutionRules = useMemo(() => {
    if (!db || !topic) return [];
    const nums = relatedRuleNumbers(topic, discipline);
    const rules = nums
      .map((num) => db.rules.find((rule) => rule.discipline === discipline && rule.rule === num))
      .filter(Boolean) as Rule[];
    const penaltyRule = db.rules.find((rule) =>
      discipline === "outdoor"
        ? rule.discipline === "outdoor" && rule.rule === "35"
        : rule.discipline === "arena" && rule.rule === "10",
    );
    const all = penaltyRule ? [...rules, penaltyRule] : rules;
    return all.filter((rule, index) => all.findIndex((candidate) => candidate.id === rule.id) === index);
  }, [db, discipline, topic]);

  const scenarioRules = useMemo(() => {
    if (!db || !scenario) return [];
    const nums = scenarioDefs[scenario][discipline];
    return nums
      .map((num) => db.rules.find((rule) => rule.discipline === discipline && rule.rule === num))
      .filter(Boolean) as Rule[];
  }, [db, discipline, scenario]);

  const activeQuestions = resolverMode === "play"
    ? (topic ? questions[topic] : [])
    : (scenario ? scenarioQuestions[scenario] : []);

  const mainRule = resolverMode === "play" ? resolutionRules[0] : scenarioRules[0] ?? genericSituationRules[0];
  const answerCount = Object.keys(answers).length;
  const questionCount = activeQuestions.length;
  const completeness = answerCount === questionCount && questionCount > 0
    ? "high"
    : answerCount >= Math.ceil(questionCount / 2) && questionCount > 0
      ? "medium"
      : "low";

  const handicapValues = {
    eventUpper: substitutionInputs.eventUpper === "" ? null : Number(substitutionInputs.eventUpper),
    teamTotalBefore: substitutionInputs.teamTotalBefore === "" ? null : Number(substitutionInputs.teamTotalBefore),
    outgoingHandicap: substitutionInputs.outgoingHandicap === "" ? null : Number(substitutionInputs.outgoingHandicap),
    candidateHandicap: substitutionInputs.candidateHandicap === "" ? null : Number(substitutionInputs.candidateHandicap),
  };

  const crossRuleState = scenario === "substitutes"
    ? buildSubstitutionCrossRuleState({
        discipline,
        handicap: handicapValues,
        facts: nationalityInputs,
        answers,
        language,
      })
    : null;

  const substitutionSections = crossRuleState?.sections ?? [];

  const universalSeedRules = resolverMode === "play"
    ? resolutionRules.map((rule) => rule.rule)
    : (scenarioRules.length ? scenarioRules : genericSituationRules).map((rule) => rule.rule);

  const universalGraph = db && situation.trim()
    ? buildUniversalRuleGraph({
        db,
        discipline,
        query: situation,
        seedRules: universalSeedRules,
        facts: caseFacts,
        language,
      })
    : null;

  const availableMissingFacts: CaseFactDefinition[] = scenario === "substitutes" && crossRuleState
    ? []
    : (universalGraph?.missingFacts ?? []);

  const selectedGenericFact = availableMissingFacts.find((item) => item.key === selectedMissingFactKey)
    ?? availableMissingFacts[0]
    ?? null;

  const unresolvedQuestions = activeQuestions.filter((question) => !answers[question.key] || answers[question.key] === "unknown");
  const answeredQuestions = activeQuestions.filter((question) => answers[question.key] && answers[question.key] !== "unknown");

  function analyze() {
    if (!situation.trim() || !db) return;
    setAnswers({});
    setShowResolution(false);
    setFollowUpText("");
    setFollowUps([]);
    const profileCrossFacts = profileToSubstitutionFacts(eventProfile);
    const profileCaseFacts = profileToCaseFacts(eventProfile);
    setNationalityInputs({ ...defaultNationalityInputs, ...profileCrossFacts });
    setCaseFacts(profileCaseFacts);
    setSelectedMissingFactKey("");

    if (resolverMode === "play") {
      const ranked = classify(situation);
      setRankedTopics(ranked);
      setTopic(ranked[0]?.score ? ranked[0].id : "row");
      setScenario(null);
      setGenericSituationRules([]);
    } else {
      const ranked = classifyScenario(situation);
      setRankedScenarios(ranked);
      const detected = ranked[0]?.score ? ranked[0].id : null;
      setScenario(detected);
      setTopic(null);
      if (detected === "substitutes") {
        const parsed = parseSubstitutionHandicaps(situation);
        const nationality = parseSubstitutionNationality(situation);
        const crossFacts = parseSubstitutionCrossFacts(situation);
        setSubstitutionInputs({
          eventUpper: parsed.eventUpper != null
            ? String(parsed.eventUpper)
            : eventProfile.upperHandicap != null
              ? String(eventProfile.upperHandicap)
              : "",
          teamTotalBefore: parsed.teamTotalBefore != null ? String(parsed.teamTotalBefore) : "",
          outgoingHandicap: parsed.outgoingHandicap != null ? String(parsed.outgoingHandicap) : "",
          candidateHandicap: parsed.candidateHandicap != null ? String(parsed.candidateHandicap) : "",
        });
        setNationalityInputs({
          ...defaultNationalityInputs,
          ...profileToSubstitutionFacts(eventProfile),
          ...nationality,
          ...crossFacts,
        });
      }
      const rankedRules = db.rules
        .filter((rule) => rule.discipline === discipline)
        .map((rule) => ({ rule, score: scoreRule(rule, situation) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.rule);
      setGenericSituationRules(rankedRules);
    }

    setTimeout(() => document.getElementById("questions")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  }

  function submitFollowUp() {
    const question = followUpText.trim();
    if (!question || !db) return;

    let answer = "";
    let rules: Rule[] = [];

    if (resolverMode === "situation" && scenario === "substitutes" && discipline === "outdoor") {
      const parsed = parseSubstitutionHandicaps(question);
      const parsedNationality = parseSubstitutionNationality(question);
      const parsedCrossFacts = parseSubstitutionCrossFacts(question);
      const merged = {
        eventUpper: parsed.eventUpper != null ? String(parsed.eventUpper) : substitutionInputs.eventUpper,
        teamTotalBefore: parsed.teamTotalBefore != null ? String(parsed.teamTotalBefore) : substitutionInputs.teamTotalBefore,
        outgoingHandicap: parsed.outgoingHandicap != null ? String(parsed.outgoingHandicap) : substitutionInputs.outgoingHandicap,
        candidateHandicap: parsed.candidateHandicap != null ? String(parsed.candidateHandicap) : substitutionInputs.candidateHandicap,
      };
      const mergedNationality = { ...nationalityInputs, ...parsedNationality, ...parsedCrossFacts };
      setSubstitutionInputs(merged);
      setNationalityInputs(mergedNationality);
      const sections = buildSubstitutionCrossRuleState({
        discipline,
        handicap: {
          eventUpper: merged.eventUpper === "" ? null : Number(merged.eventUpper),
          teamTotalBefore: merged.teamTotalBefore === "" ? null : Number(merged.teamTotalBefore),
          outgoingHandicap: merged.outgoingHandicap === "" ? null : Number(merged.outgoingHandicap),
          candidateHandicap: merged.candidateHandicap === "" ? null : Number(merged.candidateHandicap),
        },
        facts: mergedNationality,
        answers,
        language,
      }).sections;
      answer = sections
        .filter((section) => section.id === "decision" || section.id === "american" || section.id === "missing")
        .flatMap((section) => section.items)
        .join(" ");
      rules = scenarioRules;
    } else {
      const context = [situation, ...followUps.flatMap((turn) => [turn.question, turn.answer]), question].join(" ");
      rules = db.rules
        .filter((rule) => rule.discipline === discipline)
        .map((rule) => ({ rule, score: scoreRule(rule, context) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item) => item.rule);

      const best = rules[0];
      const application = best ? bestMatchingApplication(best, context) : null;
      if (best) {
        answer = language === "en"
          ? "With the previous context, this follow-up points mainly to " + (discipline === "outdoor" ? "Outdoor" : "Arena") + " Rule " + best.rule + " · " + best.title + ". " + (application?.text ?? "I did not find a specific Interpretation/Example for this variation; open the related article to confirm the official text.")
          : "Con el contexto anterior, esta repregunta apunta principalmente a " + (discipline === "outdoor" ? "Outdoor" : "Arena") + " Rule " + best.rule + " · " + best.title + ". " + (application?.text ?? "No encontré una Interpretation/Example específica para esta variante; abrí el artículo relacionado para confirmar el texto oficial.");
      } else {
        answer = tr("I cannot close this follow-up with enough local support yet. Rephrase it by adding the fact that changes from the previous situation.", "No puedo cerrar esta repregunta con suficiente respaldo local todavía. Reformulala agregando el hecho que cambia respecto de la situación anterior.");
      }
    }

    setFollowUps((current) => [...current, { question, answer, ruleIds: rules.map((rule) => rule.id) }]);
    setFollowUpText("");
    setTimeout(() => document.getElementById("follow-up")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 20);
  }

  async function checkUpdates() {
    if (!navigator.onLine) {
      setUpdateStatus(tr("No connection: the installed local copy remains active.", "Sin conexión: la copia local instalada sigue activa."));
      return;
    }
    setUpdateStatus(tr("Checking published version…", "Comprobando versión publicada…"));
    try {
      const response = await fetch("/data/manifest.json?ts=" + Date.now(), { cache: "no-store" });
      const remote = (await response.json()) as RuleManifest;
      setUpdateStatus(tr("Published version: " + remote.activeVersion + ". The local Rulebook remains available offline.", "Versión publicada: " + remote.activeVersion + ". El Rulebook local está disponible sin conexión."));
    } catch {
      setUpdateStatus(tr("Could not check updates right now. The local copy remains available.", "No pude comprobar actualizaciones ahora. La copia local sigue disponible."));
    }
  }

  return (
    <main className={"appShell font-" + fontSize}>
      <header className="topbar">
        <div className="brandBlock">
          <img className="brandLogo" src="/logo.png" alt="Umpire Polo Assistant" />
          <div>
            <div className="brandName">UMPIRE POLO ASSISTANT</div>
            <div className="brandSub">Rulebook Assistant</div>
          </div>
        </div>
        <div className="topbarActions">
          <div className="fontSizeSwitch" role="group" aria-label={tr("Text size", "Tamaño de texto")}>
            <button
              className={fontSize === "small" ? "active" : ""}
              onClick={() => changeFontSize("small")}
              aria-pressed={fontSize === "small"}
              title={tr("Smaller text", "Texto más chico")}
            >
              A−
            </button>
            <button
              className={fontSize === "normal" ? "active" : ""}
              onClick={() => changeFontSize("normal")}
              aria-pressed={fontSize === "normal"}
              title={tr("Default text size", "Tamaño de texto normal")}
            >
              A
            </button>
            <button
              className={fontSize === "large" ? "active" : ""}
              onClick={() => changeFontSize("large")}
              aria-pressed={fontSize === "large"}
              title={tr("Larger text", "Texto más grande")}
            >
              A+
            </button>
          </div>
          <div className="languageSwitch" aria-label={tr("Language", "Idioma")}>
            <button className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")}>EN</button>
            <button className={language === "es" ? "active" : ""} onClick={() => changeLanguage("es")}>ES</button>
          </div>
          <div className="statusStack">
            <span className={"badge " + (networkOnline ? "online" : "offline")}>● {networkOnline ? "ONLINE" : "OFFLINE"}</span>
            <span className={"offlineIndicator " + (offlineReady ? "ready" : "warming")}>
              {offlineReady ? "✓ OFFLINE READY" : tr("Preparing offline…", "Preparando offline…")}
            </span>
          </div>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">{tr("OFFICIAL RULEBOOK · LOCAL COPY", "REGLAMENTO OFICIAL · COPIA LOCAL")}</p>
        <h1>{tr("Resolve the rule. Even without signal.", "Resolvé la regla. Aun sin señal.")}</h1>
        <p className="heroText">{tr("The critical engine runs on the device: rules, local search, guided questions and references stay available in airplane mode.", "El motor crítico funciona en el dispositivo: reglas, búsqueda local, preguntas guiadas y referencias siguen disponibles en modo avión.")}</p>
        <div className="versionPill">
          <strong>Rulebook {manifest?.activeVersion ?? "2026"}</strong>
          <span>{manifest ? manifest.counts.outdoor + " Outdoor · " + manifest.counts.arena + " Arena" : tr("Loading rules…", "Cargando reglas…")}</span>
        </div>
        <button className="eventProfileBar" onClick={openEventProfile}>
          <span>
            <small>{tr("EVENT PROFILE", "PERFIL DEL EVENTO")}</small>
            <strong>{eventProfile.name.trim() ? profileSummary(eventProfile) : tr("No event profile configured", "Sin perfil de evento configurado")}</strong>
          </span>
          <b>{eventProfile.name.trim() ? tr("Edit", "Editar") : tr("Set up", "Configurar")} →</b>
        </button>
      </section>

      <nav className="tabs" aria-label={tr("Sections", "Secciones")}>
        {(["resolver", "buscar", "reglamento", "estado"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "resolver" ? tr("Resolve", "Resolver") : item === "buscar" ? tr("Search", "Buscar") : item === "reglamento" ? tr("Rulebook", "Reglamento") : "Offline"}
          </button>
        ))}
      </nav>

      {loadError && <div className="errorBanner">{loadError}</div>}

      {tab === "resolver" && (
        <section className="view">
          <div className="card primaryCard">
            {eventProfile.name.trim() || eventProfile.upperHandicap !== null || eventProfile.eventType !== "unknown" ? (
              <div className="caseContextStrip">
                <span>{tr("Using event context", "Usando contexto del evento")}</span>
                <strong>{profileSummary(eventProfile)}</strong>
                <button onClick={openEventProfile}>{tr("Change", "Cambiar")}</button>
              </div>
            ) : null}
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">{tr("STEP 1", "PASO 1")}</p>
                <h2>{resolverMode === "play" ? tr("What happened in the play?", "¿Qué ocurrió en la jugada?") : tr("What rule situation do you need to resolve?", "¿Qué situación reglamentaria necesitás resolver?")}</h2>
              </div>
              <div className="segmented" role="group" aria-label={tr("Discipline", "Disciplina")}>
                {(["outdoor", "arena"] as Discipline[]).map((d) => (
                  <button key={d} className={discipline === d ? "active" : ""} onClick={() => setDiscipline(d)}>
                    {d === "outdoor" ? "Outdoor" : "Arena"}
                  </button>
                ))}
              </div>
            </div>

            <div className="segmented resolverMode" role="group" aria-label={tr("Query type", "Tipo de consulta")}>
              <button className={resolverMode === "play" ? "active" : ""} onClick={() => { setResolverMode("play"); setTopic(null); setScenario(null); setShowResolution(false); }}>{tr("Play", "Jugada")}</button>
              <button className={resolverMode === "situation" ? "active" : ""} onClick={() => { setResolverMode("situation"); setTopic(null); setScenario(null); setShowResolution(false); }}>{tr("Rule situation", "Situación reglamentaria")}</button>
            </div>

            <textarea
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
              placeholder={resolverMode === "play" ? tr("Example: Blue was following the line and Red crossed in front, forcing Blue to check…", "Ej.: Azul venía siguiendo la línea y Rojo cruzó adelante, obligándolo a frenar…") : tr("Example: A player is injured and must be replaced. What makes the substitute eligible?", "Ej.: Un jugador se lesiona y debe ser reemplazado. ¿Qué hace elegible al sustituto?")}
              rows={5}
            />
            <div className="quickchips">
              {(resolverMode === "play" ? quickPlays[language] : quickRuleSituations[language]).map((text, index) => (
                <button key={text} onClick={() => setSituation(text)}>{tr("Example", "Ejemplo")} {index + 1}</button>
              ))}
            </div>
            <button className="primaryAction" onClick={analyze} disabled={!db}>{resolverMode === "play" ? tr("Analyze play", "Analizar jugada") : tr("Analyze situation", "Analizar situación")}</button>
          </div>

          {resolverMode === "situation" && !scenario && genericSituationRules.length > 0 && universalGraph && (
            <div className="card" id="questions">
              <p className="eyebrow">{tr("CROSS-RULE ANALYSIS", "ANÁLISIS DE REGLAS CRUZADAS")}</p>
              <h2>{universalGraph.label}</h2>
              <p className="muted">{tr(
                "The engine found the closest rule family, expanded its direct Rulebook references and added external controlling sections that can change the answer.",
                "El motor encontró la familia de reglas más cercana, expandió sus referencias directas del Rulebook y agregó secciones externas que pueden cambiar la respuesta.",
              )}</p>

              <div className="universalGraphSummary">
                <div className="graphFamilyBadge">{universalGraph.family.rules.map((r) => "Rule " + r).join(" · ")}</div>
                <div className="graphCoverageBadge">{universalGraph.coverage.covered.length}/{universalGraph.coverage.total} {tr("rules mapped", "reglas mapeadas")}</div>
              </div>

              <div className="ruleGraphNodes universalNodes">
                {universalGraph.rules.slice(0,10).map((rule) => (
                  <button className="ruleGraphNode graphRuleButton" key={rule.id} onClick={() => setSelectedRule(rule)}>
                    <b>{rule.discipline === "outdoor" ? "Outdoor" : "Arena"} Rule {rule.rule}</b>
                    <span>{rule.title}</span>
                  </button>
                ))}
                {universalGraph.external.map((external) => (
                  <div className="ruleGraphNode externalNode" key={external}>
                    <b>{external}</b>
                    <span>{tr("External controlling section", "Sección externa de control")}</span>
                  </div>
                ))}
              </div>

              {selectedGenericFact ? (
                <div className="missingFactPicker">
                  <p className="eyebrow">{tr("FACTS THAT CAN CHANGE THE RULING", "DATOS QUE PUEDEN CAMBIAR LA DECISIÓN")}</p>
                  <label>
                    <span>{tr("Choose a missing fact to complete", "Elegí un dato faltante para completar")}</span>
                    <select
                      value={selectedGenericFact.key}
                      onChange={(event) => setSelectedMissingFactKey(event.target.value)}
                    >
                      {availableMissingFacts.map((item) => <option key={item.key} value={item.key}>{factLabel(item, language)}</option>)}
                    </select>
                  </label>
                  <h3>{factLabel(selectedGenericFact, language)}</h3>
                  <p className="muted">{factWhy(selectedGenericFact, language)}</p>
                  {selectedGenericFact.kind === "choice" ? (
                    <div className="choices">
                      {selectedGenericFact.options?.map((option) => (
                        <button
                          key={option[0]}
                          className={caseFacts[selectedGenericFact.key] === option[0] ? "selected" : ""}
                          onClick={() => {
                            setCaseFacts((current) => ({ ...current, [selectedGenericFact.key]: option[0] }));
                            setSelectedMissingFactKey("");
                          }}
                        >
                          {factOptionLabel(option, language)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="searchInput"
                      type={selectedGenericFact.kind === "number" ? "number" : "text"}
                      value={caseFacts[selectedGenericFact.key] ?? ""}
                      onChange={(event) => setCaseFacts((current) => ({
                        ...current,
                        [selectedGenericFact.key]: selectedGenericFact.kind === "number"
                          ? (event.target.value === "" ? null : Number(event.target.value))
                          : event.target.value,
                      }))}
                      onBlur={() => setSelectedMissingFactKey("")}
                      placeholder={tr("Enter the fact if you know it", "Completá el dato si lo sabés")}
                    />
                  )}
                  <p className="nextFactCount">{availableMissingFacts.length} {tr("decision-changing fact(s) still open", "dato(s) potencialmente decisivos todavía abiertos")}.</p>
                </div>
              ) : (
                <div className="nextFactCard resolved"><strong>{tr("All critical facts in this graph have been completed.", "Todos los datos críticos de este grafo fueron completados.")}</strong></div>
              )}

              <h3>{tr("Closest provisions after the facts entered", "Artículos más cercanos con los datos cargados")}</h3>
              <div className="candidateList">
                {universalGraph.evidenceRules.slice(0,4).map((rule) => <RuleCard key={rule.id} rule={rule} onOpen={setSelectedRule} />)}
              </div>
              <button className="primaryAction" onClick={() => { setShowResolution(true); setTimeout(() => document.getElementById("resolution")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20); }}>{tr("Apply cross-rule analysis", "Aplicar análisis cruzado")}</button>
            </div>
          )}

          {((resolverMode === "play" && topic) || (resolverMode === "situation" && scenario)) && (
            <div className="card" id="questions">
              <p className="eyebrow">{tr("STEP 2", "PASO 2")}</p>
              <h2>{resolverMode === "play" ? tr("I need a few facts about the play", "Necesito precisar la jugada") : tr("I need a few facts about the situation", "Necesito precisar la situación")}</h2>
              <p className="muted">{resolverMode === "play"
                ? tr("Possible families: ", "Posibles familias: ") + (rankedTopics.filter((item) => item.score > 0).slice(0, 3).map((item) => topicLabel(item.id, item.label)).join(" · ") || (topic ? topicLabel(topic, topicDefs[topic].label) : ""))
                : tr("Detected family: ", "Familia detectada: ") + (scenario ? scenarioDefs[scenario].label : rankedScenarios[0]?.label ?? tr("General rule", "Regla general"))}</p>
              {resolverMode === "situation" && scenario === "substitutes" && discipline === "outdoor" && crossRuleState ? (
                <div className="crossRuleWorkspace">
                  <div className="callout secondaryCallout">
                    <strong>{tr("Handicap facts", "Datos de handicap")}</strong>
                    <p>{tr("These feed Rule 2.d and Rule 3.c automatically. You do not need to decide yourself whether the substitute is eligible.", "Estos datos alimentan Rule 2.d y Rule 3.c automáticamente. No tenés que decidir vos mismo si el sustituto es elegible.")}</p>
                    <div className="questionList compactGrid">
                      {[
                        ["eventUpper", tr("Event upper limit", "Límite superior del evento")],
                        ["teamTotalBefore", tr("Original team handicap", "Handicap original del equipo")],
                        ["outgoingHandicap", tr("Outgoing player handicap", "Handicap del jugador que sale")],
                        ["candidateHandicap", tr("Proposed substitute handicap (optional)", "Handicap del sustituto propuesto (opcional)")],
                      ].map(([key, label]) => (
                        <div className="question" key={key}>
                          <strong>{label}</strong>
                          <input
                            className="searchInput"
                            inputMode="decimal"
                            type="number"
                            step="0.5"
                            value={substitutionInputs[key as keyof typeof substitutionInputs]}
                            onChange={(event) => setSubstitutionInputs((current) => ({ ...current, [key]: event.target.value }))}
                            placeholder="8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ruleGraph">
                    <div className="ruleGraphHeader">
                      <div>
                        <p className="eyebrow">{tr("CROSS-RULE ENGINE", "MOTOR DE REGLAS CRUZADAS")}</p>
                        <h3>{tr("The app is checking more than the substitution rule", "La app está revisando más que la regla de sustitución")}</h3>
                      </div>
                      <span className={"crossStatus " + crossRuleState.status}>
                        {crossRuleState.status === "fail" ? tr("Conflict found", "Conflicto detectado") : crossRuleState.status === "needs-info" ? tr("Needs facts", "Faltan datos") : tr("Checks clear", "Controles OK")}
                      </span>
                    </div>
                    <div className="ruleGraphNodes">
                      {crossRuleState.graph.map((node, index) => (
                        <div className="ruleGraphNode" key={node.id}>
                          <b>{node.source}</b>
                          <span>{node.label}</span>
                          {index < crossRuleState.graph.length - 1 ? <i>→</i> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="crossChecks">
                    {crossRuleState.checks.map((check) => (
                      <div className={"crossCheck " + check.status} key={check.id}>
                        <div>
                          <span className="crossCheckSource">{check.source}</span>
                          <strong>{check.title}</strong>
                        </div>
                        <p>{check.summary}</p>
                      </div>
                    ))}
                  </div>

                  {crossRuleState.nextQuestions.length ? (() => {
                    const selectedCrossFact = crossRuleState.nextQuestions.find((item) => String(item.key) === selectedMissingFactKey)
                      ?? crossRuleState.nextQuestions[0];
                    return (
                      <div className="nextFactCard">
                        <p className="eyebrow">{tr("MISSING FACTS", "DATOS FALTANTES")}</p>
                        <label className="missingFactSelect">
                          <span>{tr("Choose which missing fact you want to complete", "Elegí qué dato faltante querés completar")}</span>
                          <select value={String(selectedCrossFact.key)} onChange={(event) => setSelectedMissingFactKey(event.target.value)}>
                            {crossRuleState.nextQuestions.map((item) => <option key={String(item.key)} value={String(item.key)}>{item.label}</option>)}
                          </select>
                        </label>
                        <h3>{selectedCrossFact.label}</h3>
                        <p className="muted">{selectedCrossFact.why}</p>
                        {selectedCrossFact.kind === "number" ? (
                          <input
                            className="searchInput"
                            type="number"
                            step="1"
                            value={(nationalityInputs[selectedCrossFact.key] as number | null) ?? ""}
                            onChange={(event) => setNationalityInputs((current) => ({
                              ...current,
                              [selectedCrossFact.key]: event.target.value === "" ? null : Number(event.target.value),
                            }))}
                            onBlur={() => setSelectedMissingFactKey("")}
                            placeholder="0"
                          />
                        ) : (
                          <div className="choices">
                            {selectedCrossFact.options?.map(([value, label]) => (
                              <button
                                key={value}
                                className={nationalityInputs[selectedCrossFact.key] === value ? "selected" : ""}
                                onClick={() => {
                                  setNationalityInputs((current) => ({ ...current, [selectedCrossFact.key]: value }));
                                  setSelectedMissingFactKey("");
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="nextFactCount">{crossRuleState.nextQuestions.length} {tr("fact(s) still open", "dato(s) todavía abiertos")}.</p>
                      </div>
                    );
                  })() : (
                    <div className="nextFactCard resolved">
                      <strong>{tr("All currently triggered cross-rule questions are answered.", "Todas las preguntas cruzadas activadas actualmente están respondidas.")}</strong>
                    </div>
                  )}                </div>
              ) : null}
              <div className="questionList">
                {activeQuestions.map((question) => (
                  <div className="question" key={question.key}>
                    <strong>{questionLabel(question.key, question.label)}</strong>
                    <div className="choices">
                      {question.options.map(([value, label]) => (
                        <button
                          key={value}
                          className={answers[question.key] === value ? "selected" : ""}
                          onClick={() => setAnswers((current) => ({ ...current, [question.key]: value }))}
                        >
                          {optionLabel(value, label)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {universalGraph && resolverMode === "play" ? (
                <div className="ruleGraph compactRuleGraph">
                  <div className="ruleGraphHeader">
                    <div>
                      <p className="eyebrow">{tr("RELATED RULE GRAPH", "GRAFO DE REGLAS RELACIONADAS")}</p>
                      <h3>{universalGraph.label}</h3>
                    </div>
                    <span className="graphCoverageBadge">{universalGraph.coverage.covered.length}/{universalGraph.coverage.total}</span>
                  </div>
                  <div className="ruleGraphNodes">
                    {universalGraph.rules.slice(0,8).map((rule) => (
                      <button className="ruleGraphNode graphRuleButton" key={rule.id} onClick={() => setSelectedRule(rule)}>
                        <b>Rule {rule.rule}</b><span>{rule.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <button className="primaryAction" onClick={() => {
                setShowResolution(true);
                setTimeout(() => document.getElementById("resolution")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
              }}>{tr("Apply rulebook", "Aplicar reglamento")}</button>
            </div>
          )}

          {showResolution && ((resolverMode === "play" && topic) || resolverMode === "situation") && (
            <div className="card resultCard" id="resolution">
              <div className="analysisHeader">
                <div>
                  <p className="eyebrow">{tr("RESULT", "RESULTADO")}</p>
                  <h2>{mainRule ? (discipline === "outdoor" ? "Outdoor" : "Arena") + " Rule " + mainRule.rule + " · " + mainRule.title : tr("Related rule", "Regla relacionada")}</h2>
                </div>
                <span className="confidence">{tr("Input completeness", "Datos completos")}: {completeness === "high" ? tr("High", "Alta") : completeness === "medium" ? tr("Medium", "Media") : tr("Low", "Baja")}</span>
              </div>

              {universalGraph && !(resolverMode === "situation" && scenario === "substitutes") ? (
                <div className="resultRulePath">
                  <strong>{tr("Rule interaction graph", "Grafo de interacción de reglas")}: {universalGraph.label}</strong>
                  <span>{universalGraph.family.rules.map((rule) => "Rule " + rule).join("  →  ")}{universalGraph.external.length ? "  →  " + universalGraph.external.join(" / ") : ""}</span>
                </div>
              ) : null}

              {resolverMode === "situation" && scenario === "substitutes" && crossRuleState ? (
                <>
                  <div className="resultRulePath">
                    <strong>{tr("Rule interaction path", "Ruta de interacción de reglas")}</strong>
                    <span>{crossRuleState.graph.map((node) => node.source).join("  →  ")}</span>
                  </div>
                  <div className="resultSections">
                  {substitutionSections.map((section) => (
                    <section className={"resultSection " + (section.tone ?? "info")} key={section.id}>
                      <h3>{section.title}</h3>
                      <ul>
                        {section.items.map((item, index) => <li key={index}>{item}</li>)}
                      </ul>
                    </section>
                  ))}
                  </div>
                </>
              ) : (
                <div className="resultSections">
                  <section className="resultSection info">
                    <h3>{tr("Interpretation", "Interpretación")}</h3>
                    <p>{resolverMode === "play" && topic
                      ? localizedApplicationText(topic, answers, language)
                      : scenario
                        ? localizedScenarioApplicationText(scenario, discipline, answers, language)
                        : tr("The app found the closest rules in the local Rulebook. Review the official provision and related Interpretation/Example before closing the ruling.", "La app encontró las reglas más cercanas en el Rulebook local. Revisá la disposición oficial y la Interpretation/Example relacionada antes de cerrar la decisión.")}</p>
                  </section>
                  {answeredQuestions.length ? (
                    <section className="resultSection pass">
                      <h3>{tr("Facts used", "Hechos utilizados")}</h3>
                      <ul>
                        {answeredQuestions.map((question) => <li key={question.key}><b>{questionLabel(question.key, question.label)}</b>: {optionLabel(answers[question.key], answers[question.key])}</li>)}
                      </ul>
                    </section>
                  ) : null}
                  {unresolvedQuestions.length ? (
                    <section className="resultSection warning">
                      <h3>{tr("Facts still unclear", "Datos todavía no claros")}</h3>
                      <ul>{unresolvedQuestions.map((question) => <li key={question.key}>{questionLabel(question.key, question.label)}</li>)}</ul>
                    </section>
                  ) : null}
                </div>
              )}

              {resolverMode === "situation" && mainRule && bestMatchingApplication(mainRule, situation) ? (
                <section className="resultSection officialExample">
                  <h3>{tr("Closest official Interpretation / Example", "Interpretation / Example oficial más cercana")}</h3>
                  <p>{bestMatchingApplication(mainRule, situation)?.text}</p>
                </section>
              ) : null}

              <h3>{tr("Related provisions", "Artículos relacionados")}</h3>
              <div className="candidateList">
                {(resolverMode === "play" ? resolutionRules : (scenarioRules.length ? scenarioRules : genericSituationRules)).map((rule) => <RuleCard key={rule.id} rule={rule} onOpen={setSelectedRule} />)}
              </div>

              <div className="callout secondaryCallout" id="follow-up">
                <strong>{tr("Still unclear? Ask a follow-up without starting over.", "¿Quedó alguna duda? Repreguntá sin empezar de nuevo.")}</strong>
                <p className="muted">{tr("The app keeps the original situation, your answers, handicap data and nationality/eligibility facts.", "La app conserva la situación original, tus respuestas, los datos de handicap y los datos de nacionalidad/elegibilidad.")}</p>
                {followUps.length ? (
                  <div className="questionList">
                    {followUps.map((turn, index) => (
                      <div className="question" key={turn.question + "-" + index}>
                        <strong>{tr("You", "Vos")}: {turn.question}</strong>
                        <p>{turn.answer}</p>
                        {turn.ruleIds.length ? (
                          <div className="quickchips">
                            {turn.ruleIds.map((id) => {
                              const rule = db?.rules.find((candidate) => candidate.id === id);
                              return rule ? <button key={id} onClick={() => setSelectedRule(rule)}>Rule {rule.rule}</button> : null;
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <textarea value={followUpText} onChange={(event) => setFollowUpText(event.target.value)} placeholder={tr("Example: What if the team originally totaled 7 goals? What if the substitute is Argentine but a USPA Registered Player Member?", "Ej.: ¿Y si el equipo originalmente era de 7? ¿Y si el sustituto es argentino pero es USPA Registered Player Member?")} rows={3} />
                <button className="primaryAction" onClick={submitFollowUp} disabled={!followUpText.trim()}>{tr("Ask follow-up", "Repreguntar")}</button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "buscar" && (
        <section className="view">
          <div className="card">
            <p className="eyebrow">{tr("LOCAL SEARCH", "BÚSQUEDA LOCAL")}</p>
            <h2>{tr("Search by rule or situation", "Buscá por regla o por situación")}</h2>
            <input
              className="searchInput"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr("crossing, ride-off, hook, Rule 24, substitute…", "crossing, ride-off, hook, Rule 24, bloquear…")}
            />
            <div className="segmented searchSegmented">
              {(["all", "outdoor", "arena"] as SearchFilter[]).map((filter) => (
                <button key={filter} className={searchFilter === filter ? "active" : ""} onClick={() => setSearchFilter(filter)}>
                  {filter === "all" ? tr("All", "Todas") : filter === "outdoor" ? "Outdoor" : "Arena"}
                </button>
              ))}
            </div>
          </div>
          <div className="candidateList searchResults">
            {searchedRules.map((rule) => <RuleCard key={rule.id} rule={rule} onOpen={setSelectedRule} />)}
            {!searchedRules.length && <div className="card muted">{tr("No matches found. Try different terms.", "No encontré coincidencias. Probá con otras palabras.")}</div>}
          </div>
        </section>
      )}

      {tab === "reglamento" && (
        <section className="view rulebookGrid">
          {(["outdoor", "arena"] as Discipline[]).map((d) => (
            <div className="card" key={d}>
              <p className="eyebrow">{d.toUpperCase()}</p>
              <h2>{d === "outdoor" ? "Outdoor Rules" : "Arena Rules"}</h2>
              <div className="ruleList">
                {db?.rules.filter((rule) => rule.discipline === d).map((rule) => (
                  <button className="ruleItem" key={rule.id} onClick={() => setSelectedRule(rule)}>
                    <b>Rule {rule.rule}</b><span>{rule.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="card graphCatalogCard">
            <p className="eyebrow">{tr("RULE INTERACTION CATALOG", "CATÁLOGO DE INTERACCIONES")}</p>
            <h2>{tr("All mapped rule graphs", "Todos los grafos de reglas mapeados")}</h2>
            <p className="muted">{tr(
              "Every Outdoor and Arena rule is assigned to at least one interaction graph. Cross-references in the local Rulebook are expanded automatically during analysis.",
              "Cada regla Outdoor y Arena está asignada al menos a un grafo de interacción. Las referencias cruzadas del Rulebook local se expanden automáticamente durante el análisis.",
            )}</p>
            <div className="coverageSummary">
              <span>Outdoor {graphCoverage("outdoor").covered.length}/{graphCoverage("outdoor").total}</span>
              <span>Arena {graphCoverage("arena").covered.length}/{graphCoverage("arena").total}</span>
            </div>
            <div className="graphCatalog">
              {ruleGraphFamilies.map((family) => (
                <div className="graphCatalogItem" key={family.id}>
                  <strong>{language === "en" ? family.titleEn : family.titleEs}</strong>
                  <span>{family.discipline === "outdoor" ? "Outdoor" : "Arena"} · {family.rules.map((rule) => "Rule " + rule).join(", ")}</span>
                  {family.external.length ? <small>+ {family.external.join(" · ")}</small> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "estado" && (
        <section className="view">
          <div className="card offlineCard">
            <p className="eyebrow">{tr("DEVICE STATUS", "ESTADO DEL DISPOSITIVO")}</p>
            <h2>{offlineReady ? tr("Ready to umpire without signal", "Listo para arbitrar sin señal") : tr("Preparing offline copy", "Preparando copia offline")}</h2>
            <div className="statusRows">
              <div><span>{tr("Application", "Aplicación")}</span><strong>{offlineReady ? tr("✓ Cached", "✓ Cacheada") : tr("Preparing", "Preparando")}</strong></div>
              <div><span>Rulebook</span><strong>{manifest?.activeVersion ?? "2026"}</strong></div>
              <div><span>Outdoor Rules</span><strong>{manifest ? `✓ ${manifest.counts.outdoor}` : "…"}</strong></div>
              <div><span>Arena Rules</span><strong>{manifest ? `✓ ${manifest.counts.arena}` : "…"}</strong></div>
              <div><span>Umpire Guide</span><strong>{manifest ? `✓ ${manifest.counts.umpireGuidePages} págs.` : "…"}</strong></div>
              <div><span>{tr("Current connection", "Conexión actual")}</span><strong>{networkOnline ? "Online" : "Offline"}</strong></div>
            </div>
            <div className="offlineTest">
              <strong>{tr("Recommended test", "Prueba recomendada")}</strong>
              <p>{tr("When it says OFFLINE READY, enable airplane mode, close the tab, reopen the app, and resolve a play. The core should not depend on Vercel, Supabase, or an LLM.", "Cuando diga OFFLINE READY, activá modo avión, cerrá la pestaña, volvé a abrir la app y resolvé una jugada. El core no debe depender de Vercel, Supabase ni un LLM.")}</p>
            </div>
            <button className="secondaryAction" onClick={() => void checkUpdates()}>{tr("Check published version", "Comprobar versión publicada")}</button>
            {updateStatus && <p className="updateStatus">{updateStatus}</p>}
          </div>
        </section>
      )}

      <footer>
        <span>Umpire Polo Assistant v0.12</span>
        <span>{tr("Installed source", "Fuente instalada")}: USPA Rulebook {manifest?.activeVersion ?? "2026"}</span>
      </footer>

      {profileOpen && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProfileOpen(false);
        }}>
          <article className="ruleModal eventProfileModal" role="dialog" aria-modal="true" aria-label={tr("Event Profile", "Perfil del Evento")}>
            <button className="modalClose" onClick={() => setProfileOpen(false)} aria-label={tr("Close", "Cerrar")}>×</button>
            <p className="eyebrow">{tr("TOURNAMENT CONTEXT", "CONTEXTO DEL TORNEO")}</p>
            <h2>{tr("Event Profile", "Perfil del Evento")}</h2>
            <p className="muted">{tr(
              "Set this once before the tournament. The assistant will reuse these facts in every ruling and will only ask again when the play itself can change the answer.",
              "Configurá esto una vez antes del torneo. El asistente reutilizará estos datos en cada decisión y sólo volverá a preguntar cuando la jugada pueda cambiar la respuesta.",
            )}</p>

            <div className="profileGrid">
              <label className="profileField profileWide">
                <span>{tr("Event name", "Nombre del evento")}</span>
                <input className="searchInput" value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder={tr("Example: Autumn 8 Goal", "Ej.: Copa Otoño 8 Goles")} />
              </label>

              <label className="profileField">
                <span>{tr("Discipline", "Disciplina")}</span>
                <select value={profileDraft.discipline} onChange={(event) => setProfileDraft((current) => ({ ...current, discipline: event.target.value as Discipline }))}>
                  <option value="outdoor">Outdoor</option>
                  <option value="arena">Arena</option>
                </select>
              </label>

              <label className="profileField">
                <span>{tr("Event classification", "Clasificación del Event")}</span>
                <select value={profileDraft.eventType} onChange={(event) => setProfileDraft((current) => ({ ...current, eventType: event.target.value as EventProfile["eventType"] }))}>
                  <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
                  <option value="uspa">USPA Event</option>
                  <option value="npc">NPC Event</option>
                  <option value="club">Club Event</option>
                  <option value="other">{tr("Other", "Otro")}</option>
                </select>
              </label>

              <label className="profileField">
                <span>{tr("Upper handicap limit", "Límite superior de handicap")}</span>
                <input className="searchInput" type="number" step="0.5" value={profileDraft.upperHandicap ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, upperHandicap: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="8" />
              </label>

              <label className="profileField">
                <span>{tr("Lower handicap limit", "Límite inferior de handicap")}</span>
                <input className="searchInput" type="number" step="0.5" value={profileDraft.lowerHandicap ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, lowerHandicap: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="6" />
              </label>

              <label className="profileField">
                <span>{tr("Sponsor structure", "Estructura del sponsor")}</span>
                <select value={profileDraft.sponsorStructure} onChange={(event) => setProfileDraft((current) => ({ ...current, sponsorStructure: event.target.value as EventProfile["sponsorStructure"] }))}>
                  <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
                  <option value="playing">Playing sponsor</option>
                  <option value="nonplaying">Non-playing sponsor</option>
                </select>
              </label>

              <label className="profileField">
                <span>{tr("Host-club exception known to apply?", "¿Sabemos si aplica la excepción del club anfitrión?")}</span>
                <select value={profileDraft.affiliateHostException} onChange={(event) => setProfileDraft((current) => ({ ...current, affiliateHostException: event.target.value }))}>
                  <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
                  <option value="yes">{tr("Yes", "Sí")}</option>
                  <option value="no">No</option>
                </select>
              </label>

              <label className="profileField">
                <span>{tr("Club / venue", "Club / sede")}</span>
                <input className="searchInput" value={profileDraft.club} onChange={(event) => setProfileDraft((current) => ({ ...current, club: event.target.value }))} placeholder={tr("Club name", "Nombre del club")} />
              </label>

              <label className="profileField">
                <span>{tr("Format", "Formato")}</span>
                <input className="searchInput" value={profileDraft.format} onChange={(event) => setProfileDraft((current) => ({ ...current, format: event.target.value }))} placeholder={tr("Standard, round robin, etc.", "Standard, round robin, etc.")} />
              </label>

              <label className="profileField">
                <span>{tr("Tournament Conditions available?", "¿Tenemos las Tournament Conditions?")}</span>
                <select value={profileDraft.conditionsKnown} onChange={(event) => setProfileDraft((current) => ({ ...current, conditionsKnown: event.target.value }))}>
                  <option value="unknown">{tr("Not sure", "No estoy seguro")}</option>
                  <option value="yes">{tr("Yes", "Sí")}</option>
                  <option value="no">No</option>
                </select>
              </label>

              <label className="profileField profileWide">
                <span>{tr("Tournament Conditions / local notes", "Tournament Conditions / notas locales")}</span>
                <textarea rows={4} value={profileDraft.conditionsNotes} onChange={(event) => setProfileDraft((current) => ({ ...current, conditionsNotes: event.target.value }))} placeholder={tr("Add any event-specific condition that could change a ruling.", "Agregá cualquier condición específica del evento que pueda cambiar una decisión.")} />
              </label>
            </div>

            <div className="profileActions">
              <button className="secondaryAction" onClick={clearEventProfile}>{tr("Clear profile", "Borrar perfil")}</button>
              <button className="primaryAction" onClick={saveEventProfile}>{tr("Save & use profile", "Guardar y usar perfil")}</button>
            </div>
            <p className="profileOfflineNote">✓ {tr("Saved on this device and available offline.", "Guardado en este dispositivo y disponible offline.")}</p>
          </article>
        </div>
      )}

      {selectedRule && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedRule(null);
        }}>
          <article className="ruleModal" role="dialog" aria-modal="true" aria-label={`Rule ${selectedRule.rule}`}>
            <button className="modalClose" onClick={() => setSelectedRule(null)} aria-label={tr("Close", "Cerrar")}>×</button>
            <p className="eyebrow">{selectedRule.discipline.toUpperCase()} · RULEBOOK {manifest?.activeVersion ?? "2026"}</p>
            <h2>Rule {selectedRule.rule} · {selectedRule.title}</h2>
            <div className="sourceMeta">USPA Rulebook {manifest?.activeVersion ?? "2026"} · {tr("page", "página")} {pageLabel(selectedRule)}</div>
            <pre className="officialText">{selectedRule.text}</pre>
            {selectedRule.applications?.length ? (
              <div className="interpretations">
                <h3>{tr("Detected Interpretations & Examples", "Interpretations & Examples detectados")}</h3>
                {selectedRule.applications.map((item, index) => (
                  <details key={`${item.label}-${index}`}>
                    <summary>{item.label}</summary>
                    <p>{item.text}</p>
                  </details>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      )}
    </main>
  );
}
