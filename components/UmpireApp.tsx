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
  substitutionEligibilityText,
  scenarioDefs,
  scenarioQuestions,
  scoreRule,
  topicDefs,
} from "@/lib/engine";
import type {
  ChoiceValue,
  Discipline,
  Rule,
  RuleDb,
  ResolverMode,
  RuleManifest,
  ScenarioId,
  TopicId,
} from "@/lib/types";

type Tab = "resolver" | "buscar" | "reglamento" | "estado";
type SearchFilter = "all" | Discipline;

const quickPlays = [
  "Un jugador cruza delante del que venía siguiendo la línea y lo obliga a frenar.",
  "Durante un ride-off un caballo pierde el equilibrio por el contacto.",
  "Un atacante bloquea a un defensor para liberar a su compañero.",
  "Un jugador intenta un hook y el swing pasa muy cerca del caballo rival.",
];

const quickRuleSituations = [
  "En un torneo de 8 goles, se cae un jugador de 5 goles y tiene que ser reemplazado. ¿Qué condiciones debe tener su reemplazo para ser elegible?",
  "Un jugador se lesiona durante el período y el equipo quiere reemplazar también a otro compañero.",
  "El único sustituto disponible baja al equipo por debajo del límite inferior del evento.",
  "Un jugador reemplazado por agotamiento se recupera y quiere volver a mitad del siguiente período.",
];

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
        setLoadError("No pude abrir la copia local del Rulebook. Volvé a abrir la app una vez con conexión para completar la instalación offline.");
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
  const confidence = answerCount === questionCount && questionCount > 0
    ? "Alta"
    : answerCount >= Math.ceil(questionCount / 2) && questionCount > 0
      ? "Media"
      : "Baja";

  function analyze() {
    if (!situation.trim() || !db) return;
    setAnswers({});
    setShowResolution(false);

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
        setSubstitutionInputs({
          eventUpper: parsed.eventUpper != null ? String(parsed.eventUpper) : "",
          teamTotalBefore: parsed.teamTotalBefore != null ? String(parsed.teamTotalBefore) : "",
          outgoingHandicap: parsed.outgoingHandicap != null ? String(parsed.outgoingHandicap) : "",
          candidateHandicap: parsed.candidateHandicap != null ? String(parsed.candidateHandicap) : "",
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

  async function checkUpdates() {
    if (!navigator.onLine) {
      setUpdateStatus("Sin conexión: la copia local instalada sigue activa.");
      return;
    }
    setUpdateStatus("Comprobando versión publicada…");
    try {
      const response = await fetch(`/data/manifest.json?ts=${Date.now()}`, { cache: "no-store" });
      const remote = (await response.json()) as RuleManifest;
      setUpdateStatus(`Versión publicada: ${remote.activeVersion}. El Rulebook local está disponible sin conexión.`);
    } catch {
      setUpdateStatus("No pude comprobar actualizaciones ahora. La copia local sigue disponible.");
    }
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brandBlock">
          <div className="brandMark">PU</div>
          <div>
            <div className="brandName">POLO UMPIRE</div>
            <div className="brandSub">USPA Rulebook Assistant</div>
          </div>
        </div>
        <div className="statusStack">
          <span className={`badge ${networkOnline ? "online" : "offline"}`}>● {networkOnline ? "ONLINE" : "OFFLINE"}</span>
          <span className={`offlineIndicator ${offlineReady ? "ready" : "warming"}`}>
            {offlineReady ? "✓ OFFLINE READY" : "Preparando offline…"}
          </span>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">REGLAMENTO OFICIAL · COPIA LOCAL</p>
        <h1>Decidí la regla. Aun sin señal.</h1>
        <p className="heroText">El motor crítico funciona en el teléfono: reglas, búsqueda, preguntas guiadas y referencias siguen disponibles en modo avión.</p>
        <div className="versionPill">
          <strong>Rulebook {manifest?.activeVersion ?? "2026"}</strong>
          <span>{manifest ? `${manifest.counts.outdoor} Outdoor · ${manifest.counts.arena} Arena` : "Cargando reglas…"}</span>
        </div>
      </section>

      <nav className="tabs" aria-label="Secciones">
        {(["resolver", "buscar", "reglamento", "estado"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "resolver" ? "Resolver" : item === "buscar" ? "Buscar" : item === "reglamento" ? "Reglamento" : "Offline"}
          </button>
        ))}
      </nav>

      {loadError && <div className="errorBanner">{loadError}</div>}

      {tab === "resolver" && (
        <section className="view">
          <div className="card primaryCard">
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">PASO 1</p>
                <h2>{resolverMode === "play" ? "¿Qué ocurrió en la jugada?" : "¿Qué situación reglamentaria necesitás resolver?"}</h2>
              </div>
              <div className="segmented" role="group" aria-label="Disciplina">
                {(["outdoor", "arena"] as Discipline[]).map((d) => (
                  <button key={d} className={discipline === d ? "active" : ""} onClick={() => setDiscipline(d)}>
                    {d === "outdoor" ? "Outdoor" : "Arena"}
                  </button>
                ))}
              </div>
            </div>

            <div className="segmented resolverMode" role="group" aria-label="Tipo de consulta">
              <button className={resolverMode === "play" ? "active" : ""} onClick={() => { setResolverMode("play"); setTopic(null); setScenario(null); setShowResolution(false); }}>Jugada</button>
              <button className={resolverMode === "situation" ? "active" : ""} onClick={() => { setResolverMode("situation"); setTopic(null); setScenario(null); setShowResolution(false); }}>Situación reglamentaria</button>
            </div>

            <textarea
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
              placeholder={resolverMode === "play" ? "Ej.: Azul venía siguiendo la línea y Rojo cruzó adelante, obligándolo a frenar…" : "Ej.: Un jugador lesionado es reemplazado y luego quiere volver a mitad del siguiente chukker…"}
              rows={5}
            />
            <div className="quickchips">
              {(resolverMode === "play" ? quickPlays : quickRuleSituations).map((text, index) => (
                <button key={text} onClick={() => setSituation(text)}>Ejemplo {index + 1}</button>
              ))}
            </div>
            <button className="primaryAction" onClick={analyze} disabled={!db}>{resolverMode === "play" ? "Analizar jugada" : "Analizar situación"}</button>
          </div>

          {resolverMode === "situation" && !scenario && genericSituationRules.length > 0 && (
            <div className="card" id="questions">
              <p className="eyebrow">ANÁLISIS LOCAL</p>
              <h2>Encontré reglas relacionadas</h2>
              <p className="muted">Todavía no hay un árbol guiado específico para esta familia, pero el buscador local encontró los artículos con mayor coincidencia. Podés aplicar el reglamento y abrir el texto oficial.</p>
              <div className="candidateList">
                {genericSituationRules.slice(0, 3).map((rule) => <RuleCard key={rule.id} rule={rule} onOpen={setSelectedRule} />)}
              </div>
              <button className="primaryAction" onClick={() => { setShowResolution(true); setTimeout(() => document.getElementById("resolution")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20); }}>Aplicar reglamento</button>
            </div>
          )}

          {((resolverMode === "play" && topic) || (resolverMode === "situation" && scenario)) && (
            <div className="card" id="questions">
              <p className="eyebrow">PASO 2</p>
              <h2>{resolverMode === "play" ? "Necesito precisar la jugada" : "Necesito precisar la situación"}</h2>
              <p className="muted">{resolverMode === "play"
                ? `Posibles familias: ${rankedTopics.filter((item) => item.score > 0).slice(0, 3).map((item) => item.label).join(" · ") || (topic ? topicDefs[topic].label : "")}`
                : `Familia detectada: ${scenario ? scenarioDefs[scenario].label : rankedScenarios[0]?.label ?? "Regla general"}`}</p>
              {resolverMode === "situation" && scenario === "substitutes" && discipline === "outdoor" ? (
                <div className="callout secondaryCallout">
                  <strong>Chequeo de handicap del reemplazo</strong>
                  <p>La app aplica dos límites distintos: el máximo individual de la 3/4 Rule y el máximo agregado del equipo después de la sustitución.</p>
                  <div className="questionList">
                    {[
                      ["eventUpper", "Límite superior del torneo"],
                      ["teamTotalBefore", "Handicap total del equipo antes del cambio"],
                      ["outgoingHandicap", "Handicap del jugador que sale"],
                      ["candidateHandicap", "Handicap del reemplazante (opcional)"],
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
                          placeholder="Ej.: 8"
                        />
                      </div>
                    ))}
                  </div>
                  <p>{substitutionEligibilityText(discipline, {
                    eventUpper: substitutionInputs.eventUpper === "" ? null : Number(substitutionInputs.eventUpper),
                    teamTotalBefore: substitutionInputs.teamTotalBefore === "" ? null : Number(substitutionInputs.teamTotalBefore),
                    outgoingHandicap: substitutionInputs.outgoingHandicap === "" ? null : Number(substitutionInputs.outgoingHandicap),
                    candidateHandicap: substitutionInputs.candidateHandicap === "" ? null : Number(substitutionInputs.candidateHandicap),
                  })}</p>
                </div>
              ) : null}
              <div className="questionList">
                {activeQuestions.map((question) => (
                  <div className="question" key={question.key}>
                    <strong>{question.label}</strong>
                    <div className="choices">
                      {question.options.map(([value, label]) => (
                        <button
                          key={value}
                          className={answers[question.key] === value ? "selected" : ""}
                          onClick={() => setAnswers((current) => ({ ...current, [question.key]: value }))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button className="primaryAction" onClick={() => {
                setShowResolution(true);
                setTimeout(() => document.getElementById("resolution")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
              }}>Aplicar reglamento</button>
            </div>
          )}

          {showResolution && ((resolverMode === "play" && topic) || resolverMode === "situation") && (
            <div className="card resultCard" id="resolution">
              <div className="analysisHeader">
                <div>
                  <p className="eyebrow">RESULTADO</p>
                  <h2>{mainRule ? `${discipline === "outdoor" ? "Outdoor" : "Arena"} Rule ${mainRule.rule} · ${mainRule.title}` : "Regla relacionada"}</h2>
                </div>
                <span className="confidence">Confianza {confidence}</span>
              </div>
              <div className="callout">
                <strong>{resolverMode === "play" ? "Cómo se aplica a esta jugada" : "Cómo se aplica a esta situación"}</strong>
                <p>{resolverMode === "play" && topic
                  ? applicationText(topic, answers)
                  : scenario
                    ? scenarioApplicationText(scenario, discipline, answers)
                    : "La app encontró las reglas con mayor coincidencia textual. Revisá el artículo principal y la interpretación/ejemplo relacionado para confirmar los hechos que cambian la aplicación."}</p>
              </div>
              {resolverMode === "situation" && scenario === "substitutes" && discipline === "outdoor" ? (
                <div className="callout secondaryCallout">
                  <strong>Elegibilidad por handicap</strong>
                  <p>{substitutionEligibilityText(discipline, {
                    eventUpper: substitutionInputs.eventUpper === "" ? null : Number(substitutionInputs.eventUpper),
                    teamTotalBefore: substitutionInputs.teamTotalBefore === "" ? null : Number(substitutionInputs.teamTotalBefore),
                    outgoingHandicap: substitutionInputs.outgoingHandicap === "" ? null : Number(substitutionInputs.outgoingHandicap),
                    candidateHandicap: substitutionInputs.candidateHandicap === "" ? null : Number(substitutionInputs.candidateHandicap),
                  })}</p>
                </div>
              ) : null}
              <p className="muted">{resolverMode === "play"
                ? "La app no fuerza una penalidad cuando el Rulebook deja discreción al Umpire. Muestra la regla sustantiva y la regla de selección de penalidad para mantener trazabilidad."
                : "Para situaciones administrativas o de elegibilidad, la app prioriza el artículo aplicable y sus Interpretations/Examples; cuando todavía no existe un árbol guiado específico, muestra las mejores coincidencias del Rulebook local."}</p>
              {resolverMode === "situation" && mainRule && bestMatchingApplication(mainRule, situation) ? (
                <div className="callout secondaryCallout">
                  <strong>Interpretation / Example más cercano</strong>
                  <p>{bestMatchingApplication(mainRule, situation)?.text}</p>
                </div>
              ) : null}
              <h3>Artículos relacionados</h3>
              <div className="candidateList">
                {(resolverMode === "play" ? resolutionRules : (scenarioRules.length ? scenarioRules : genericSituationRules)).map((rule) => <RuleCard key={rule.id} rule={rule} onOpen={setSelectedRule} />)}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "buscar" && (
        <section className="view">
          <div className="card">
            <p className="eyebrow">BÚSQUEDA LOCAL</p>
            <h2>Buscá por regla o por situación</h2>
            <input
              className="searchInput"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="crossing, ride-off, hook, Rule 24, bloquear…"
            />
            <div className="segmented searchSegmented">
              {(["all", "outdoor", "arena"] as SearchFilter[]).map((filter) => (
                <button key={filter} className={searchFilter === filter ? "active" : ""} onClick={() => setSearchFilter(filter)}>
                  {filter === "all" ? "Todas" : filter === "outdoor" ? "Outdoor" : "Arena"}
                </button>
              ))}
            </div>
          </div>
          <div className="candidateList searchResults">
            {searchedRules.map((rule) => <RuleCard key={rule.id} rule={rule} onOpen={setSelectedRule} />)}
            {!searchedRules.length && <div className="card muted">No encontré coincidencias. Probá con otras palabras.</div>}
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
        </section>
      )}

      {tab === "estado" && (
        <section className="view">
          <div className="card offlineCard">
            <p className="eyebrow">ESTADO DEL DISPOSITIVO</p>
            <h2>{offlineReady ? "Listo para arbitrar sin señal" : "Preparando copia offline"}</h2>
            <div className="statusRows">
              <div><span>Aplicación</span><strong>{offlineReady ? "✓ Cacheada" : "Preparando"}</strong></div>
              <div><span>Rulebook</span><strong>{manifest?.activeVersion ?? "2026"}</strong></div>
              <div><span>Outdoor Rules</span><strong>{manifest ? `✓ ${manifest.counts.outdoor}` : "…"}</strong></div>
              <div><span>Arena Rules</span><strong>{manifest ? `✓ ${manifest.counts.arena}` : "…"}</strong></div>
              <div><span>Umpire Guide</span><strong>{manifest ? `✓ ${manifest.counts.umpireGuidePages} págs.` : "…"}</strong></div>
              <div><span>Conexión actual</span><strong>{networkOnline ? "Online" : "Offline"}</strong></div>
            </div>
            <div className="offlineTest">
              <strong>Prueba recomendada</strong>
              <p>Cuando diga “OFFLINE READY”, activá modo avión, cerrá la pestaña, volvé a abrir la app y resolvé una jugada. El core no debe depender de Vercel, Supabase ni un LLM.</p>
            </div>
            <button className="secondaryAction" onClick={() => void checkUpdates()}>Comprobar versión publicada</button>
            {updateStatus && <p className="updateStatus">{updateStatus}</p>}
          </div>
        </section>
      )}

      <footer>
        <span>Polo Umpire v0.4</span>
        <span>Fuente instalada: USPA Rulebook {manifest?.activeVersion ?? "2026"}</span>
      </footer>

      {selectedRule && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedRule(null);
        }}>
          <article className="ruleModal" role="dialog" aria-modal="true" aria-label={`Rule ${selectedRule.rule}`}>
            <button className="modalClose" onClick={() => setSelectedRule(null)} aria-label="Cerrar">×</button>
            <p className="eyebrow">{selectedRule.discipline.toUpperCase()} · RULEBOOK {manifest?.activeVersion ?? "2026"}</p>
            <h2>Rule {selectedRule.rule} · {selectedRule.title}</h2>
            <div className="sourceMeta">USPA Rulebook {manifest?.activeVersion ?? "2026"} · página {pageLabel(selectedRule)}</div>
            <pre className="officialText">{selectedRule.text}</pre>
            {selectedRule.applications?.length ? (
              <div className="interpretations">
                <h3>Interpretations & Examples detectados</h3>
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
