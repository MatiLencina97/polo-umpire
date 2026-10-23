"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";
import {
  applicationText,
  bestMatchingApplication,
  classifyTopic,
  classifyScenario,
  playClarifierCandidates,
  playClarifierLabel,
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
  normalizeEventProfile,
  profileSummary,
  profileToCaseFacts,
  profileToSubstitutionFacts,
  type EventProfile,
} from "@/lib/event-profile";
import { decidePlay } from "@/lib/play-decision";
import { auditLevelLabel, auditPlayDecision } from "@/lib/decision-audit";
import { officialGuidanceMetrics } from "@/lib/official-guidance";
import { playDecisionRuleTrail, substitutionDecisionRuleTrail, substitutionExternalTrail, type DecisionRuleLink } from "@/lib/decision-links";
import { complexRuleFocuses, complexText } from "@/lib/complex-rules";
import MatchMode from "@/components/MatchMode";
import DecisionRuleTrail from "@/components/DecisionRuleTrail";
import RowEntitlementHelper from "@/components/RowEntitlementHelper";
import CaseHistoryPanel from "@/components/CaseHistoryPanel";
import VoiceInputButton from "@/components/VoiceInputButton";
import HowItWorksPanel from "@/components/HowItWorksPanel";
import OfflineStatusPanel from "@/components/OfflineStatusPanel";
import DecisionFeedback from "@/components/DecisionFeedback";
import OfficialTextView from "@/components/OfficialTextView";
import { saveCaseRecord, type CaseRecord } from "@/lib/case-history";
import { flushPendingFeedback } from "@/lib/decision-feedback";
import { localStore, safeStorageGet, safeStorageRemove, safeStorageSet } from "@/lib/browser-storage";
import { applyMatchAnswer, relevantMatchKeys } from "@/lib/match-flow";
import { extractExplicitPlayFacts, type ExtractedPlayFact } from "@/lib/play-fact-extractor";
import {
  bestProvisionsForRules,
  getProvision,
  parseRuleProvisions,
  resolveProvisions,
  type RuleProvision,
} from "@/lib/subarticles";
import {
  externalMatchesForLabels,
  externalPageLabel,
  searchExternalSections,
  type ExternalSectionMatch,
} from "@/lib/external-resources";
import type {
  ChoiceValue,
  Discipline,
  ExternalResource,
  ExternalResourceDb,
  ExternalSection,
  Language,
  Rule,
  RuleDb,
  ResolverMode,
  RuleManifest,
  ScenarioId,
  TopicId,
} from "@/lib/types";

type Tab = "resolver" | "buscar" | "reglamento" | "historial";
type InfoWindow = "how" | "offline" | null;
type SearchFilter = "all" | Discipline;
type FontSizePreference = "small" | "normal" | "large";
type ThemePreference = "light" | "dark";
type ResolverExperience = "analysis" | "match";

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
  rowEntitled: "Was the affected player actually entitled to the Right of Way at that moment?",
  risk: "Did the action force the player with the Right of Way to check, change course, or face collision risk?",
  lineChanged: "Had the Line of the Ball changed immediately before the action?",
  clearanceTime: "If the line changed, was the opponent given the necessary time to clear the new ROW?",
  parallel: "Were the players parallel or nearly parallel at the relevant moment?",
  balance: "Was either horse knocked off balance or displaced with force?",
  speedAngle: "Was there a significant difference in speed, position, or a strong converging angle?",
  blind: "Did the contact catch the opponent unprepared (blind-side) or create unnecessary risk?",
  restartBlock: "Did this occur during a knock-in, Penalty 5.a/5.b, or a free hit from out of bounds?",
  marking: "Did the attacker prevent the defender from marking a teammate who had a play on the ball?",
  slow: "In open play, did the ball carrier slow to a slow canter/walk while the block occurred within two horse lengths?",
  strokeDanger: "Did the swing or hook create danger to another player or horse?",
  strokeEnteredByOpponent: "If there was danger, did another player clearly ride into an already established stroke and create that danger?",
  hookPosition: "Was the hook made from the same side of the opponent's mount as the ball, or directly from behind?",
  hookTiming: "Was the opponent in the act of hitting at the ball or hooking/striking the mallet?",
  hookClear: "Was the mallet clear of the opponent's mount, below shoulder level, and used without excessive force?",
  conductMatches: "Does the behavior fit Rule 33.a (appealing, abuse, arguing with officials, rough/dangerous conduct, post-whistle hit, etc.)?",
  deliberate: "Was the conduct deliberate, abusive, or contrary to the spirit of the game?",
  repeat: "Was there a similar prior foul, warning, or card?",
  dead: "Was the ball out of play or the clock stopped?",
  restartType: "What type of restart was being executed?",
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

function ExternalSourceCard({
  match,
  onOpen,
}: {
  match: ExternalSectionMatch;
  onOpen: (resource: ExternalResource, section: ExternalSection) => void;
}) {
  const compact = match.section.text.replace(/\s+/g, " ").trim();
  return (
    <button className="externalSourceCard" onClick={() => onOpen(match.resource, match.section)}>
      <span className="candidateTop">
        <strong>{match.resource.shortTitle} · {match.section.title}</strong>
        <span className="ruleTag">p. {externalPageLabel(match.section)}</span>
      </span>
      <span className="candidateExcerpt">{compact.slice(0, 270)}{compact.length > 270 ? "…" : ""}</span>
    </button>
  );
}

export default function UmpireApp() {
  const [tab, setTab] = useState<Tab>("resolver");
  const [discipline, setDiscipline] = useState<Discipline>("outdoor");
  const [resolverMode, setResolverMode] = useState<ResolverMode>("play");
  const [db, setDb] = useState<RuleDb | null>(null);
  const [externalDb, setExternalDb] = useState<ExternalResourceDb | null>(null);
  const [manifest, setManifest] = useState<RuleManifest | null>(null);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineVerifiedAt, setOfflineVerifiedAt] = useState<string | null>(null);
  const [offlineMissingCount, setOfflineMissingCount] = useState(0);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [installedAsPwa, setInstalledAsPwa] = useState(false);
  const offlineRepairingRef = useRef(false);
  const lastOfflineRepairRef = useRef(0);
  const [loadError, setLoadError] = useState("");
  const [substitutionInputs, setSubstitutionInputs] = useState({
    eventUpper: "",
    teamTotalBefore: "",
    outgoingHandicap: "",
    candidateHandicap: "",
  });
  const [situation, setSituation] = useState("");
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [rankedTopics, setRankedTopics] = useState<ReturnType<typeof classifyTopic>["ranked"]>([]);
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const [rankedScenarios, setRankedScenarios] = useState<ReturnType<typeof classifyScenario>>([]);
  const [genericSituationRules, setGenericSituationRules] = useState<Rule[]>([]);
  const [answers, setAnswers] = useState<Record<string, ChoiceValue>>({});
  const [autoDetectedFacts, setAutoDetectedFacts] = useState<ExtractedPlayFact[]>([]);
  const [showResolution, setShowResolution] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [selectedProvision, setSelectedProvision] = useState<RuleProvision | null>(null);
  const [selectedExternal, setSelectedExternal] = useState<{ resource: ExternalResource; section: ExternalSection | null } | null>(null);
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
  const [resolverExperience, setResolverExperience] = useState<ResolverExperience>("analysis");
  const [savedAnalysisFingerprint, setSavedAnalysisFingerprint] = useState("");
  const [analysisSaveError, setAnalysisSaveError] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [infoWindow, setInfoWindow] = useState<InfoWindow>(null);
  const [theme, setTheme] = useState<ThemePreference>("light");

  const tr = (en: string, es: string) => language === "en" ? en : es;
  const eventProfileConfigured = Boolean(
    eventProfile.name.trim()
    || eventProfile.club.trim()
    || eventProfile.upperHandicap !== null
    || eventProfile.lowerHandicap !== null
    || eventProfile.eventType !== "unknown"
    || eventProfile.sponsorStructure !== "unknown"
    || eventProfile.format.trim()
    || eventProfile.conditionsKnown !== "unknown"
    || eventProfile.conditionsNotes.trim()
  );
  const eventProfileApplies = eventProfile.discipline === discipline;
  const activeEventProfile = eventProfileApplies
    ? eventProfile
    : { ...defaultEventProfile, discipline };
  const activeEventContext = eventProfileConfigured && eventProfileApplies
    ? profileSummary(eventProfile)
    : undefined;

  const optionLabel = (value: string, fallback: string) => {
    if (language === "es") return fallback;
    if (value === "yes") return "Yes";
    if (value === "no") return "No";
    if (value === "unknown") return "Not sure";
    if (value === "na") return "Not applicable";
    if (value === "knockin") return "Knock-in";
    if (value === "throwin") return "Throw-in";
    if (value === "penalty") return "Penalty / free hit";
    if (value === "other") return "Other";
    return fallback;
  };
  const questionLabel = (key: string, fallback: string) => language === "en" ? (questionLabelsEn[key] ?? fallback) : fallback;
  const topicLabel = (id: string, fallback: string) => language === "en" ? (topicLabelsEn[id] ?? fallback) : fallback;

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalledAsPwa(standalone);
    setNetworkOnline(navigator.onLine);

    const requestPersistentStorage = async () => {
      try {
        if (!navigator.storage?.persisted) {
          setStoragePersistent(null);
          return;
        }

        const alreadyPersistent = await navigator.storage.persisted();
        if (alreadyPersistent) {
          setStoragePersistent(true);
          return;
        }

        if (navigator.storage.persist) {
          const granted = await navigator.storage.persist();
          setStoragePersistent(granted);
        } else {
          setStoragePersistent(false);
        }
      } catch {
        setStoragePersistent(null);
      }
    };

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
        setLoadError("");

        if (nextManifest.resourcesFile) {
          try {
            const resourcesPath = nextManifest.resourcesFile.startsWith("/")
              ? nextManifest.resourcesFile
              : "/" + nextManifest.resourcesFile;
            const resourcesResponse = await fetch(resourcesPath);
            if (resourcesResponse.ok) setExternalDb((await resourcesResponse.json()) as ExternalResourceDb);
          } catch {
            setExternalDb(null);
          }
        }
      } catch {
        setLoadError("Could not open the local Rulebook copy. Open the app once with a connection to finish the offline installation.");
      }
    };

    const collectOfflineUrls = () => {
      const urls = new Set<string>([
        "/",
        "/manifest.webmanifest",
        "/logo.png",
        "/data/manifest.json",
        "/data/rules-2026.json",
        "/data/resources-2026.json",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ]);

      const addLocal = (value: string | null | undefined) => {
        if (!value) return;
        try {
          const url = new URL(value, location.origin);
          if (url.origin === location.origin) urls.add(url.pathname + url.search);
        } catch {
          // Ignore malformed asset URLs.
        }
      };

      performance
        .getEntriesByType("resource")
        .forEach((entry) => addLocal(entry.name));

      document
        .querySelectorAll<HTMLScriptElement>("script[src]")
        .forEach((element) => addLocal(element.src));

      document
        .querySelectorAll<HTMLLinkElement>('link[href][rel="stylesheet"], link[href][rel="preload"], link[href][rel="modulepreload"], link[href][rel="icon"], link[href][rel="manifest"]')
        .forEach((element) => addLocal(element.href));

      document
        .querySelectorAll<HTMLImageElement>("img[src]")
        .forEach((element) => addLocal(element.src));

      return Array.from(urls);
    };

    const queryOfflineStatus = async (registration: ServiceWorkerRegistration) => {
      const active = registration.active;
      if (!active) return;

      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => channel.port1.close(), 4000);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        setOfflineReady(Boolean(event.data?.ready));
        setOfflineVerifiedAt(typeof event.data?.verifiedAt === "string" ? event.data.verifiedAt : null);
        setOfflineMissingCount(Array.isArray(event.data?.missing) ? event.data.missing.length : 0);
        channel.port1.close();
      };
      active.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    };

    const prepareOffline = async (force = false) => {
      if (!("serviceWorker" in navigator)) return;
      const now = Date.now();
      if (offlineRepairingRef.current) return;
      if (!force && now - lastOfflineRepairRef.current < 60_000) return;

      offlineRepairingRef.current = true;
      lastOfflineRepairRef.current = now;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (navigator.onLine) {
          try {
            await registration.update();
          } catch {
            // The installed worker remains usable when update checks fail.
          }
        }

        await navigator.serviceWorker.ready;
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        const urls = collectOfflineUrls();

        if (worker) {
          worker.postMessage({ type: navigator.onLine ? "REPAIR_OFFLINE" : "WARM_CACHE", urls });
        }

        await queryOfflineStatus(registration);
      } catch {
        setOfflineReady(false);
      } finally {
        offlineRepairingRef.current = false;
      }
    };

    const onOnline = () => {
      setNetworkOnline(true);
      void flushPendingFeedback();
      void prepareOffline(true);
      void load();
    };
    const onOffline = () => setNetworkOnline(false);
    const onFocus = () => {
      if (navigator.onLine) void prepareOffline();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void prepareOffline();
    };

    const message = (event: MessageEvent) => {
      if (event.data?.type !== "OFFLINE_READY") return;
      setOfflineReady(Boolean(event.data?.ready));
      setOfflineVerifiedAt(typeof event.data?.verifiedAt === "string" ? event.data.verifiedAt : null);
      setOfflineMissingCount(Array.isArray(event.data?.missing) ? event.data.missing.length : 0);
    };

    const onControllerChange = () => {
      if (navigator.onLine) void prepareOffline(true);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", message);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    const repairInterval = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") void prepareOffline();
    }, 6 * 60 * 60 * 1000);

    if (navigator.onLine) void flushPendingFeedback();
    void requestPersistentStorage();
    void load();
    void prepareOffline(true);

    return () => {
      window.clearInterval(repairInterval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", message);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    const storage = localStore();
    const savedLanguage = safeStorageGet(storage, "polo-umpire-language");
    if (savedLanguage === "en" || savedLanguage === "es") setLanguage(savedLanguage);

    const savedFontSize = safeStorageGet(storage, "polo-umpire-font-size");
    if (savedFontSize === "small" || savedFontSize === "normal" || savedFontSize === "large") {
      setFontSize(savedFontSize);
    }

    const savedTheme = safeStorageGet(storage, "polo-umpire-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);

    const savedExperience = safeStorageGet(storage, "umpire-polo-resolver-experience");
    if (savedExperience === "analysis" || savedExperience === "match") setResolverExperience(savedExperience);

    const savedProfile = safeStorageGet(storage, "umpire-polo-event-profile");
    if (savedProfile) {
      try {
        const parsed = normalizeEventProfile(JSON.parse(savedProfile));
        setEventProfile(parsed);
        setProfileDraft(parsed);
        setDiscipline(parsed.discipline);
      } catch {
        // Keep the safe local defaults if the saved profile is invalid.
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!sideMenuOpen && !infoWindow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (infoWindow) setInfoWindow(null);
      else setSideMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sideMenuOpen, infoWindow]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    safeStorageSet(localStore(), "polo-umpire-language", next);
  }

  function changeFontSize(next: FontSizePreference) {
    setFontSize(next);
    safeStorageSet(localStore(), "polo-umpire-font-size", next);
  }

  function changeTheme(next: ThemePreference) {
    setTheme(next);
    safeStorageSet(localStore(), "polo-umpire-theme", next);
  }

  function changeResolverExperience(next: ResolverExperience) {
    setResolverExperience(next);
    safeStorageSet(localStore(), "umpire-polo-resolver-experience", next);
    if (next === "match") {
      setResolverMode("play");
      setShowResolution(false);
    }
  }

  function resetDerivedResolverState() {
    setTopic(null);
    setScenario(null);
    setRankedTopics([]);
    setRankedScenarios([]);
    setGenericSituationRules([]);
    setAnswers({});
    setAutoDetectedFacts([]);
    setCaseFacts({});
    setSubstitutionInputs({ eventUpper: "", teamTotalBefore: "", outgoingHandicap: "", candidateHandicap: "" });
    setNationalityInputs({ ...defaultNationalityInputs });
    setFollowUpText("");
    setFollowUps([]);
    setSelectedMissingFactKey("");
    setShowResolution(false);
    setSavedAnalysisFingerprint("");
    setAnalysisSaveError(false);
  }

  function changeDiscipline(nextDiscipline: Discipline) {
    if (nextDiscipline === discipline) return;
    setDiscipline(nextDiscipline);
    resetDerivedResolverState();
  }

  function openEventProfile() {
    setProfileDraft({ ...eventProfile });
    setProfileOpen(true);
  }

  function saveEventProfile() {
    const next = { ...profileDraft };
    setEventProfile(next);
    setProfileDraft(next);
    if (next.discipline !== discipline) setDiscipline(next.discipline);
    resetDerivedResolverState();
    safeStorageSet(localStore(), "umpire-polo-event-profile", JSON.stringify(next));
    setProfileOpen(false);
  }

  function clearEventProfile() {
    const next = { ...defaultEventProfile, discipline };
    setEventProfile(next);
    setProfileDraft(next);
    resetDerivedResolverState();
    safeStorageRemove(localStore(), "umpire-polo-event-profile");
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

  const searchedExternal = useMemo(
    () => search.trim() ? searchExternalSections(externalDb, search, 12) : [],
    [externalDb, search],
  );

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
    ? (topic
        ? relevantMatchKeys(topic, answers).flatMap((key) => {
            const question = questions[topic].find((candidate) => candidate.key === key);
            return question ? [question] : [];
          })
        : [])
    : (scenario ? scenarioQuestions[scenario] : []);

  const answerCount = activeQuestions.filter((question) => {
    const value = answers[question.key];
    return Boolean(value) && value !== "unknown";
  }).length;
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

  const playDecision = resolverMode === "play" && topic
    ? decidePlay(topic, discipline, answers, language)
    : null;

  const playMainRule = playDecision
    ? resolutionRules.find((rule) =>
        playDecision.references.some((ref) => ref === rule.rule || ref.startsWith(rule.rule + "."))
      ) ?? resolutionRules[0]
    : resolutionRules[0];

  const mainRule = resolverMode === "play"
    ? playMainRule
    : scenarioRules[0] ?? genericSituationRules[0];

  const playDecisionAudit = resolverMode === "play" && topic && playDecision
    ? auditPlayDecision(topic, discipline, answers, playDecision)
    : null;

  const effectivePlayStatus = playDecision && playDecisionAudit?.level === "insufficient-coverage" && playDecision.status !== "needs-info"
    ? "needs-info"
    : playDecision?.status;

  const guidanceMetrics = db ? officialGuidanceMetrics(db) : null;

  const precisePlayProvisions: RuleProvision[] = db && playDecision
    ? resolveProvisions(db, discipline, playDecision.references)
    : [];

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

  const externalContextQuery = [
    situation,
    eventProfile.conditionsNotes,
    eventProfile.eventType,
    eventProfile.club,
    ...Object.entries(caseFacts).map(([key,value]) => key + " " + String(value ?? "")),
    ...(crossRuleState?.checks.map((check) => check.source + " " + check.summary) ?? []),
  ].filter(Boolean).join(" ");

  const externalLabels = Array.from(new Set([
    ...(universalGraph?.external ?? []),
    ...(scenario === "substitutes" ? ["Tournament Conditions", "Constitution / By-Laws"] : []),
  ]));

  const externalEvidence = externalMatchesForLabels(externalDb, externalLabels, externalContextQuery, 8);

  const analysisRuleTrail: DecisionRuleLink[] = db
    ? resolverMode === "play" && topic && playDecision
      ? playDecisionRuleTrail({ db, discipline, topic, answers, decision: playDecision, language })
      : scenario === "substitutes" && crossRuleState
        ? substitutionDecisionRuleTrail({ db, discipline, checks: crossRuleState.checks, language })
        : (scenarioRules.length ? scenarioRules : genericSituationRules)
            .map((rule) => parseRuleProvisions(rule)[0])
            .filter(Boolean)
            .map((provision) => ({
              provision,
              role: tr("Related governing rule identified from the situation", "Regla de control relacionada identificada a partir de la situación"),
            }))
    : [];

  const analysisExternalTrail = scenario === "substitutes"
    ? substitutionExternalTrail({ db: externalDb, query: externalContextQuery, language })
    : externalEvidence;

  const currentAnalysisFingerprint = JSON.stringify({
    situation,
    resolverMode,
    discipline,
    answers,
    caseFacts,
    substitutionInputs,
    nationalityInputs,
    eventProfile,
    rulebook: manifest?.activeVersion ?? "2026",
  });

  const analysisFeedbackStatus = resolverMode === "play" && playDecision
    ? (effectivePlayStatus ?? playDecision.status)
    : scenario === "substitutes" && crossRuleState
      ? crossRuleState.status
      : "reference";

  const analysisFeedbackHeadline = resolverMode === "play" && playDecision
    ? playDecision.headline
    : scenario === "substitutes" && crossRuleState
      ? crossRuleState.status === "fail"
        ? tr("Eligibility conflict found", "Conflicto de elegibilidad detectado")
        : crossRuleState.status === "needs-info"
          ? tr("More eligibility facts needed", "Faltan datos de elegibilidad")
          : tr("Triggered eligibility checks are clear", "Los controles de elegibilidad activados están OK")
      : universalGraph?.label ?? mainRule?.title ?? tr("Rule situation analysis", "Análisis de situación reglamentaria");

  const analysisFeedbackValidation = resolverMode === "play"
    ? playDecisionAudit?.level ?? null
    : scenario === "substitutes" && crossRuleState
      ? "cross-rule-" + crossRuleState.status
      : "reference";

  const openExternal = (resource: ExternalResource, section: ExternalSection | null = null) => {
    setSelectedExternal({ resource, section });
  };

  const availableMissingFacts: CaseFactDefinition[] = scenario === "substitutes" && crossRuleState
    ? []
    : (universalGraph?.missingFacts ?? []);

  const selectedGenericFact = availableMissingFacts.find((item) => item.key === selectedMissingFactKey)
    ?? availableMissingFacts[0]
    ?? null;

  const situationProvisionMatches = resolverMode === "situation"
    ? bestProvisionsForRules(
        scenarioRules.length ? scenarioRules : genericSituationRules,
        [situation, ...Object.entries(caseFacts).map(([key,value]) => key + " " + String(value ?? ""))].join(" "),
        6,
      )
    : [];

  const unresolvedQuestions = activeQuestions.filter((question) => !answers[question.key] || answers[question.key] === "unknown");
  const answeredQuestions = activeQuestions.filter((question) => answers[question.key] && answers[question.key] !== "unknown");
  const activeAutoDetectedFacts = autoDetectedFacts.filter((fact) => answers[fact.key] === fact.value);

  function analyze() {
    if (!situation.trim() || !db) return;
    setSavedAnalysisFingerprint("");
    setAnalysisSaveError(false);
    setAnswers({});
    setAutoDetectedFacts([]);
    setShowResolution(false);
    setFollowUpText("");
    setFollowUps([]);
    const profileCrossFacts = profileToSubstitutionFacts(activeEventProfile);
    const profileCaseFacts = profileToCaseFacts(activeEventProfile);
    setNationalityInputs({ ...defaultNationalityInputs, ...profileCrossFacts });
    setCaseFacts(profileCaseFacts);
    setSelectedMissingFactKey("");

    if (resolverMode === "play") {
      const detected = classifyTopic(situation);
      setRankedTopics(detected.ranked);
      setTopic(detected.topic);
      if (detected.topic) {
        const extracted = extractExplicitPlayFacts(situation, detected.topic);
        setAnswers(extracted.answers);
        setAutoDetectedFacts(extracted.facts);
      }
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
            : activeEventProfile.upperHandicap != null
              ? String(activeEventProfile.upperHandicap)
              : "",
          teamTotalBefore: parsed.teamTotalBefore != null ? String(parsed.teamTotalBefore) : "",
          outgoingHandicap: parsed.outgoingHandicap != null ? String(parsed.outgoingHandicap) : "",
          candidateHandicap: parsed.candidateHandicap != null ? String(parsed.candidateHandicap) : "",
        });
        setNationalityInputs({
          ...defaultNationalityInputs,
          ...profileToSubstitutionFacts(activeEventProfile),
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

  function saveAnalysisCase() {
    if (!showResolution) return;

    const eventContext = activeEventContext;

    let status: CaseRecord["outcome"]["status"] = "reference";
    let headline = universalGraph?.label ?? tr("Rule situation analysis", "Análisis de situación reglamentaria");
    let summary = scenario
      ? localizedScenarioApplicationText(scenario, discipline, answers, language)
      : tr(
          "The saved case records the closest Rulebook provisions and governing sources found from the facts entered.",
          "El caso guardado registra las disposiciones y fuentes de control más cercanas encontradas a partir de los hechos cargados.",
        );

    if (resolverMode === "play" && playDecision) {
      status = effectivePlayStatus ?? playDecision.status;
      headline = playDecision.headline;
      summary = playDecision.summary;
    } else if (resolverMode === "situation" && scenario === "substitutes" && crossRuleState) {
      status = crossRuleState.status === "fail" ? "conflict" : crossRuleState.status === "needs-info" ? "needs-info" : "clear";
      headline = crossRuleState.status === "fail"
        ? tr("Eligibility conflict found", "Conflicto de elegibilidad detectado")
        : crossRuleState.status === "needs-info"
          ? tr("More eligibility facts needed", "Faltan datos de elegibilidad")
          : tr("Triggered eligibility checks are clear", "Los controles de elegibilidad activados están OK");
      const decisionSection = substitutionSections.find((section) => section.id === "decision");
      summary = decisionSection?.items.join(" ")
        || crossRuleState.checks.map((check) => check.summary).filter(Boolean).slice(0,3).join(" ");
    }

    const facts = [
      ...answeredQuestions.map((question) => ({
        label: questionLabel(question.key, question.label),
        value: optionLabel(answers[question.key], answers[question.key]),
      })),
      ...Object.entries(caseFacts)
        .filter(([,value]) => value !== null && value !== undefined && value !== "" && value !== "unknown")
        .map(([key,value]) => ({
          label: key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()),
          value: String(value),
        })),
    ];

    if (resolverMode === "situation" && scenario === "substitutes") {
      const substitutionLabels: Record<string,string> = {
        eventUpper: tr("Event upper limit", "Límite superior del evento"),
        teamTotalBefore: tr("Original team handicap", "Handicap original del equipo"),
        outgoingHandicap: tr("Outgoing player handicap", "Handicap del jugador que sale"),
        candidateHandicap: tr("Proposed substitute handicap", "Handicap del sustituto propuesto"),
      };
      for (const [key,value] of Object.entries(substitutionInputs)) {
        if (value !== "") facts.push({ label: substitutionLabels[key] ?? key, value });
      }
      for (const [key,value] of Object.entries(nationalityInputs)) {
        if (value === null || value === undefined || value === "" || value === "unknown") continue;
        facts.push({
          label: key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()),
          value: String(value),
        });
      }
    }

    const ruleReferences = analysisRuleTrail.length
      ? analysisRuleTrail.map(({ provision }) => ({
          kind: "rule" as const,
          label: provision.label,
          page: provision.pageEnd && provision.pageEnd !== provision.pageStart
            ? provision.pageStart + "–" + provision.pageEnd
            : String(provision.pageStart),
          excerpt: provision.text.slice(0,600),
        }))
      : (scenarioRules.length ? scenarioRules : genericSituationRules).map((rule) => ({
          kind: "rule" as const,
          label: (rule.discipline === "outdoor" ? "Outdoor" : "Arena") + " Rule " + rule.rule + " · " + rule.title,
          page: pageLabel(rule),
          excerpt: excerpt(rule),
        }));

    const externalReferences = externalEvidence.map((item) => ({
      kind: "external" as const,
      label: item.resource.shortTitle + " · " + item.section.title,
      page: externalPageLabel(item.section),
      excerpt: item.section.text.slice(0,600),
      resourceId: item.resource.id,
      sectionId: item.section.id,
    }));

    const savedRecord = saveCaseRecord({
      source: "analysis",
      resolverMode,
      discipline,
      language,
      situation,
      eventContext,
      rulebookVersion: manifest?.activeVersion ?? "2026",
      outcome: { status, headline, summary },
      facts,
      references: [...ruleReferences, ...externalReferences],
    });
    if (savedRecord) {
      setSavedAnalysisFingerprint(currentAnalysisFingerprint);
      setAnalysisSaveError(false);
    } else {
      setAnalysisSaveError(true);
    }
  }

  function reuseSavedCase(record: CaseRecord) {
    changeDiscipline(record.discipline);
    setResolverMode(record.resolverMode);
    setResolverExperience(record.source === "match" && record.resolverMode === "play" ? "match" : "analysis");
    setSituation(record.situation);
    setTopic(null);
    setScenario(null);
    setRankedTopics([]);
    setRankedScenarios([]);
    setGenericSituationRules([]);
    setAnswers({});
    setCaseFacts({});
    setShowResolution(false);
    setSavedAnalysisFingerprint("");
    setAnalysisSaveError(false);
    setTab("resolver");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 30);
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

  function openInfoWindow(next: Exclude<InfoWindow, null>) {
    setSideMenuOpen(false);
    setInfoWindow(next);
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
          <img className="brandLogo" src="/logo.png" alt="Polo Umpire Assistant" />
          <div>
            <div className="brandName">POLO UMPIRE ASSISTANT</div>
            <div className="brandSub">Rulebook Assistant</div>
          </div>
        </div>
        <button
          className="sideMenuTrigger"
          onClick={() => setSideMenuOpen(true)}
          aria-label={tr("Open menu", "Abrir menú")}
          aria-expanded={sideMenuOpen}
          aria-controls="app-side-menu"
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </header>

      <section className="hero">
        <p className="eyebrow">{tr("OFFICIAL RULEBOOK · LOCAL COPY", "REGLAMENTO OFICIAL · COPIA LOCAL")}</p>
        <h1>{tr("Resolve the rule. Even without signal.", "Resolvé la regla. Aun sin señal.")}</h1>
        <p className="heroText">{tr("The critical engine runs on the device: rules, local search, guided questions and references stay available in airplane mode.", "El motor crítico funciona en el dispositivo: reglas, búsqueda local, preguntas guiadas y referencias siguen disponibles en modo avión.")}</p>
        <div className="versionPill">
          <strong>Rulebook {manifest?.activeVersion ?? "2026"}</strong>
          <span>{manifest ? manifest.counts.outdoor + " Outdoor · " + manifest.counts.arena + " Arena" + (manifest.counts.resourceSections ? " · " + manifest.counts.resourceSections + " source sections" : "") : tr("Loading rules…", "Cargando reglas…")}</span>
        </div>
        <button className="eventProfileBar" onClick={openEventProfile}>
          <span>
            <small>{tr("EVENT PROFILE", "PERFIL DEL EVENTO")}</small>
            <strong>{eventProfile.name.trim() ? profileSummary(eventProfile) : tr("No event profile configured", "Sin perfil de evento configurado")}</strong>
          </span>
          <b>{eventProfile.name.trim() ? tr("Edit", "Editar") : tr("Set up", "Configurar")} →</b>
        </button>
      </section>

      <nav className="tabs" aria-label={tr("Primary sections", "Secciones principales")}>
        {(["resolver", "buscar", "reglamento", "historial"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "resolver"
              ? tr("Resolve", "Resolver")
              : item === "buscar"
                ? tr("Search", "Buscar")
                : item === "reglamento"
                  ? tr("Rulebook", "Reglamento")
                  : tr("Cases", "Casos")}
          </button>
        ))}
      </nav>

      {sideMenuOpen ? (
        <div className="sideMenuBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSideMenuOpen(false);
        }}>
          <aside id="app-side-menu" className="sideMenuDrawer" role="dialog" aria-modal="true" aria-label={tr("Menu", "Menú")}>
            <div className="sideMenuHeader">
              <div>
                <p className="eyebrow">{tr("MENU", "MENÚ")}</p>
                <h2>{tr("Settings & information", "Ajustes e información")}</h2>
              </div>
              <button className="sideMenuClose" onClick={() => setSideMenuOpen(false)} aria-label={tr("Close menu", "Cerrar menú")}>×</button>
            </div>

            <div className="sideMenuNav">
              <button className={infoWindow === "how" ? "active" : ""} onClick={() => openInfoWindow("how")}>
                <span className="sideMenuIcon" aria-hidden="true">?</span>
                <span>
                  <b>{tr("How it works", "Cómo funciona")}</b>
                  <small>{tr("Decision method, validation levels and limits", "Método de decisión, niveles de validación y límites")}</small>
                </span>
                <strong>›</strong>
              </button>
              <button className={infoWindow === "offline" ? "active" : ""} onClick={() => openInfoWindow("offline")}>
                <span className={"sideMenuIcon status " + (offlineReady ? "ready" : "warming")} aria-hidden="true">●</span>
                <span>
                  <b>{tr("Offline & validation status", "Offline y estado de validación")}</b>
                  <small>{offlineReady ? tr("Local Rulebook ready without signal", "Rulebook local listo sin señal") : tr("Preparing local offline copy", "Preparando copia local offline")}</small>
                </span>
                <strong>›</strong>
              </button>
            </div>

            <div className="sideMenuDivider"></div>

            <div className="sideMenuSetting">
              <div className="sideMenuSettingTitle">
                <span>{tr("Language", "Idioma")}</span>
                <small>{language === "en" ? "English" : "Español"}</small>
              </div>
              <div className="sideMenuSegmented" role="group" aria-label={tr("Language", "Idioma")}>
                <button className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")}>English</button>
                <button className={language === "es" ? "active" : ""} onClick={() => changeLanguage("es")}>Español</button>
              </div>
            </div>

            <div className="sideMenuSetting">
              <div className="sideMenuSettingTitle">
                <span>{tr("Text size", "Tamaño de texto")}</span>
                <small>{fontSize === "small" ? tr("Small", "Chico") : fontSize === "large" ? tr("Large", "Grande") : tr("Normal", "Normal")}</small>
              </div>
              <div className="sideMenuSegmented fontMenu" role="group" aria-label={tr("Text size", "Tamaño de texto")}>
                <button className={fontSize === "small" ? "active" : ""} onClick={() => changeFontSize("small")}>A−</button>
                <button className={fontSize === "normal" ? "active" : ""} onClick={() => changeFontSize("normal")}>A</button>
                <button className={fontSize === "large" ? "active" : ""} onClick={() => changeFontSize("large")}>A+</button>
              </div>
            </div>

            <div className="sideMenuSetting">
              <div className="sideMenuSettingTitle">
                <span>{tr("Appearance", "Apariencia")}</span>
                <small>{theme === "dark" ? tr("Dark", "Oscuro") : tr("Light", "Claro")}</small>
              </div>
              <div className="sideMenuSegmented" role="group" aria-label={tr("Appearance", "Apariencia")}>
                <button className={theme === "light" ? "active" : ""} onClick={() => changeTheme("light")}>☀ {tr("Light", "Claro")}</button>
                <button className={theme === "dark" ? "active" : ""} onClick={() => changeTheme("dark")}>☾ {tr("Dark", "Oscuro")}</button>
              </div>
            </div>

            <div className="sideMenuDivider"></div>

            <div className="sideMenuStatus">
              <div>
                <span className={"connectionDot " + (networkOnline ? "online" : "offline")}></span>
                <b>{networkOnline ? tr("Online", "Online") : tr("Offline", "Offline")}</b>
              </div>
              <div>
                <span className={"connectionDot " + (offlineReady ? "ready" : "warming")}></span>
                <b>{offlineReady ? tr("Offline copy ready", "Copia offline lista") : tr("Offline copy preparing", "Preparando copia offline")}</b>
              </div>
              <small>Rulebook {manifest?.activeVersion ?? "2026"}</small>
            </div>
          </aside>
        </div>
      ) : null}

      {loadError && <div className="errorBanner">{loadError}</div>}

      {tab === "resolver" && (
        <section className="view">
          <div className="resolverExperienceSwitch" role="group" aria-label={tr("Resolver mode", "Modo de resolución")}>
            <button className={resolverExperience === "analysis" ? "active" : ""} onClick={() => changeResolverExperience("analysis")}>
              <span>◫</span>
              <b>{tr("Full analysis", "Análisis completo")}</b>
            </button>
            <button className={resolverExperience === "match" ? "active" : ""} onClick={() => changeResolverExperience("match")}>
              <span>⚡</span>
              <b>{tr("Match mode", "Modo partido")}</b>
            </button>
          </div>

          {resolverExperience === "match" && db ? (
            <MatchMode
              key={discipline}
              language={language}
              discipline={discipline}
              db={db}
              externalDb={externalDb}
              situation={situation}
              onSituationChange={setSituation}
              eventContext={activeEventContext}
              rulebookVersion={manifest?.activeVersion ?? "2026"}
              onOpenRule={setSelectedRule}
              onOpenProvision={setSelectedProvision}
              onOpenExternal={openExternal}
            />
          ) : null}

          <div className={resolverExperience === "match" ? "fullAnalysisHidden" : ""}>
          <div className="card primaryCard">
            {eventProfileConfigured ? (
              <div className="caseContextStrip">
                <span>{eventProfileApplies
                  ? tr("Using event context", "Usando contexto del evento")
                  : tr("Event profile not applied to this discipline", "El perfil del evento no se aplica a esta disciplina")}</span>
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
                  <button key={d} className={discipline === d ? "active" : ""} onClick={() => changeDiscipline(d)}>
                    {d === "outdoor" ? "Outdoor" : "Arena"}
                  </button>
                ))}
              </div>
            </div>

            <div className="segmented resolverMode" role="group" aria-label={tr("Query type", "Tipo de consulta")}>
              <button className={resolverMode === "play" ? "active" : ""} onClick={() => { setResolverMode("play"); setTopic(null); setScenario(null); setRankedTopics([]); setRankedScenarios([]); setShowResolution(false); }}>{tr("Play", "Jugada")}</button>
              <button className={resolverMode === "situation" ? "active" : ""} onClick={() => { setResolverMode("situation"); setTopic(null); setScenario(null); setRankedTopics([]); setRankedScenarios([]); setShowResolution(false); }}>{tr("Rule situation", "Situación reglamentaria")}</button>
            </div>

            <div className="voiceTextareaWrap">
              <textarea
                value={situation}
                onChange={(event) => setSituation(event.target.value)}
                placeholder={resolverMode === "play" ? tr("Example: Blue was following the line and Red crossed in front, forcing Blue to check…", "Ej.: Azul venía siguiendo la línea y Rojo cruzó adelante, obligándolo a frenar…") : tr("Example: A player is injured and must be replaced. What makes the substitute eligible?", "Ej.: Un jugador se lesiona y debe ser reemplazado. ¿Qué hace elegible al sustituto?")}
                rows={5}
              />
              <VoiceInputButton value={situation} onChange={setSituation} language={language} />
            </div>
            <div className="quickchips">
              {(resolverMode === "play" ? quickPlays[language] : quickRuleSituations[language]).map((text, index) => (
                <button key={text} onClick={() => setSituation(text)}>{tr("Example", "Ejemplo")} {index + 1}</button>
              ))}
            </div>
            <button className="primaryAction" onClick={analyze} disabled={!db}>{resolverMode === "play" ? tr("Analyze play", "Analizar jugada") : tr("Analyze situation", "Analizar situación")}</button>
          </div>

          {resolverMode === "play" && !topic && rankedTopics.length > 0 ? (
            <div className="card" id="questions">
              <p className="eyebrow">{tr("CLARIFY THE PLAY", "ACLARÁ LA JUGADA")}</p>
              <h2>{tr("Which part of the play needs the ruling?", "¿Qué parte de la jugada necesitás resolver?")}</h2>
              <p className="muted">{rankedTopics.some((item) => item.score > 0)
                ? tr(
                    "The description can lead to more than one rule path. Choose the observable action that matters and the app will continue the ruling from there.",
                    "La descripción puede llevar a más de un camino reglamentario. Elegí el hecho observable que importa y la app continúa la resolución desde ahí.",
                  )
                : tr(
                    "Choose what actually happened on the field. You do not need to identify the rule family yourself.",
                    "Elegí qué ocurrió realmente en cancha. No necesitás identificar vos la familia de reglas.",
                  )}</p>
              <div className="quickchips">
                {playClarifierCandidates(rankedTopics).map((id) => (
                  <button
                    key={id}
                    onClick={() => {
                      const extracted = extractExplicitPlayFacts(situation, id);
                      setTopic(id);
                      setAnswers(extracted.answers);
                      setAutoDetectedFacts(extracted.facts);
                      setShowResolution(false);
                    }}
                  >
                    {playClarifierLabel(id, language)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
                {universalGraph.external.map((external) => {
                  const source = externalEvidence.find((item) => item.requestedLabel === external);
                  return source ? (
                    <button className="ruleGraphNode externalNode available graphRuleButton" key={external} onClick={() => openExternal(source.resource, source.section)}>
                      <b>{external}</b>
                      <span>{source.section.title} · p. {externalPageLabel(source.section)}</span>
                    </button>
                  ) : (
                    <div className="ruleGraphNode externalNode" key={external}>
                      <b>{external}</b>
                      <span>{tr("External controlling section", "Sección externa de control")}</span>
                    </div>
                  );
                })}
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
              {resolverMode === "play" && topic === "row" && db ? (
                <RowEntitlementHelper
                  language={language}
                  resolveProvision={(ref) => getProvision(db, discipline, ref)}
                  onOpenProvision={setSelectedProvision}
                  onApply={(hasRow, refs) => setAnswers((current) => {
                    const nextAnswers = applyMatchAnswer("row", current, "rowEntitled", hasRow ? "yes" : "no");
                    nextAnswers.rowEntitlementDerived = refs.join(",");
                    return nextAnswers;
                  })}
                />
              ) : null}
              {resolverMode === "play" && activeAutoDetectedFacts.length ? (
                <div className="callout secondaryCallout">
                  <strong>{tr("Facts detected directly from your description", "Datos detectados directamente de tu descripción")}</strong>
                  <p>{tr(
                    "These answers were prefilled only when the wording stated the fact explicitly. You can change any of them below before applying the Rulebook.",
                    "Estas respuestas se precargaron sólo cuando la descripción expresó el dato de forma explícita. Podés cambiar cualquiera abajo antes de aplicar el reglamento.",
                  )}</p>
                  <div className="quickchips">
                    {activeAutoDetectedFacts.map((fact) => (
                      <span className="ruleTag" key={fact.key}>
                        {language === "en" ? fact.reasonEn : fact.reasonEs}
                      </span>
                    ))}
                  </div>
                </div>
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
                          onClick={() => setAnswers((current) => {
                            if (!topic) return current;
                            return applyMatchAnswer(topic, current, question.key, value);
                          })}
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

              <div className="umpireFinalAuthority">
                <strong>{tr("Final authority: Umpire", "Autoridad final: Umpire")}</strong>
                <span>{tr(
                  "This assistant supports the call with the installed Rulebook. It does not replace the Umpire's observation, judgment or authority.",
                  "Este asistente apoya la decisión con el Rulebook instalado. No reemplaza la observación, el juicio ni la autoridad del Umpire.",
                )}</span>
              </div>

              <DecisionRuleTrail
                language={language}
                ruleLinks={analysisRuleTrail}
                externalLinks={analysisExternalTrail}
                onOpenProvision={setSelectedProvision}
                onOpenExternal={(resource, section) => openExternal(resource, section)}
              />

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
              ) : resolverMode === "play" && playDecision ? (
                <>
                  {playDecisionAudit ? (
                    <div className={"decisionAuditBadge analysisAudit " + playDecisionAudit.level}>
                      <b>{auditLevelLabel(playDecisionAudit.level, language)}</b>
                      <span>{language === "en" ? playDecisionAudit.reasonEn : playDecisionAudit.reasonEs}</span>
                    </div>
                  ) : null}
                  <div className={"decisionBanner " + effectivePlayStatus}>
                    <span>{effectivePlayStatus === "foul" ? tr("FOUL", "FALTA") : effectivePlayStatus === "no-foul" ? tr("NO FOUL INDICATED", "NO SE INDICA FALTA") : effectivePlayStatus === "procedure" ? tr("PROCEDURE", "PROCEDIMIENTO") : tr("MORE FACTS NEEDED", "FALTAN DATOS")}</span>
                    <strong>{playDecision.headline}</strong>
                  </div>
                  <div className="resultSections">
                    {playDecision.sections.map((section) => (
                      <section className={"resultSection " + section.tone} key={section.id}>
                        <h3>{section.title}</h3>
                        <ul>{section.items.map((item,index) => <li key={index}>{item}</li>)}</ul>
                      </section>
                    ))}
                    {answeredQuestions.length ? (
                      <section className="resultSection pass">
                        <h3>{tr("Facts used", "Hechos utilizados")}</h3>
                        <ul>
                          {answeredQuestions.map((question) => <li key={question.key}><b>{questionLabel(question.key, question.label)}</b>: {optionLabel(answers[question.key], answers[question.key])}</li>)}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                  {playDecisionAudit ? (
                    <div className="auditScopePanel analysisAuditScope">
                      <strong>{tr("Validation scope", "Alcance de validación")}</strong>
                      <p>{language === "en" ? playDecisionAudit.scopeEn : playDecisionAudit.scopeEs}</p>
                    </div>
                  ) : null}
                  {precisePlayProvisions.length ? (
                    <div className="preciseProvisions">
                      <p className="eyebrow">{tr("PRECISE PROVISIONS", "DISPOSICIONES PRECISAS")}</p>
                      {precisePlayProvisions.map((provision) => (
                        <div className="provisionCard" key={provision.id}>
                          <strong>{provision.label}</strong>
                          <p>{provision.text.length > 420 ? provision.text.slice(0,420) + "…" : provision.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="resultSections">
                  <section className="resultSection info">
                    <h3>{tr("Interpretation", "Interpretación")}</h3>
                    <p>{scenario
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
                  {situationProvisionMatches.length ? (
                    <section className="resultSection info">
                      <h3>{tr("Most relevant subarticles", "Subartículos más relevantes")}</h3>
                      <ul>{situationProvisionMatches.map((provision) => <li key={provision.id}><b>{provision.label}</b>: {provision.text.slice(0,220)}{provision.text.length > 220 ? "…" : ""}</li>)}</ul>
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

              {externalEvidence.length ? (
                <>
                  <h3 className="externalEvidenceHeading">{tr("External governing sources", "Fuentes externas de control")}</h3>
                  <p className="muted">{tr(
                    "These installed Rulebook sections can modify, qualify, or control the playing-rule answer.",
                    "Estas secciones instaladas del Rulebook pueden modificar, condicionar o controlar la respuesta de las reglas de juego.",
                  )}</p>
                  <div className="externalEvidenceList">
                    {externalEvidence.map((item) => (
                      <ExternalSourceCard key={item.resource.id + "-" + item.section.id} match={item} onOpen={openExternal} />
                    ))}
                  </div>
                </>
              ) : null}

              <div className="caseSaveBar">
                <div>
                  <strong>{tr("Save this ruling to Case History", "Guardar esta decisión en el Historial")}</strong>
                  <span>{tr("Stored locally with facts, sources, event context and Rulebook version.", "Se guarda localmente con hechos, fuentes, contexto del evento y versión del Rulebook.")}</span>
                </div>
                <button
                  className="secondaryAction"
                  onClick={saveAnalysisCase}
                  disabled={savedAnalysisFingerprint === currentAnalysisFingerprint}
                >
                  {savedAnalysisFingerprint === currentAnalysisFingerprint ? tr("✓ Saved", "✓ Guardado") : tr("Save case", "Guardar caso")}
                </button>
              </div>
              {analysisSaveError ? (
                <p className="matchSaveError">{tr(
                  "This ruling could not be saved on this device. Browser storage may be unavailable or full.",
                  "No se pudo guardar esta decisión en el dispositivo. El almacenamiento del navegador puede estar bloqueado o lleno.",
                )}</p>
              ) : null}

              <DecisionFeedback
                language={language}
                context={{
                  source: "analysis",
                  discipline,
                  resolverMode,
                  topic,
                  scenario,
                  outcomeStatus: analysisFeedbackStatus,
                  validationLevel: analysisFeedbackValidation,
                  headline: analysisFeedbackHeadline,
                  rulebookVersion: manifest?.activeVersion ?? "2026",
                  ruleRefs: analysisRuleTrail.map((item) => item.provision.ref),
                  appVersion: APP_VERSION,
                }}
              />

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
                <div className="voiceTextareaWrap compactVoiceWrap">
                  <textarea value={followUpText} onChange={(event) => setFollowUpText(event.target.value)} placeholder={tr("Example: What if the team originally totaled 7 goals? What if the substitute is Argentine but a USPA Registered Player Member?", "Ej.: ¿Y si el equipo originalmente era de 7? ¿Y si el sustituto es argentino pero es USPA Registered Player Member?")} rows={3} />
                  <VoiceInputButton value={followUpText} onChange={setFollowUpText} language={language} compact />
                </div>
                <button className="primaryAction" onClick={submitFollowUp} disabled={!followUpText.trim()}>{tr("Ask follow-up", "Repreguntar")}</button>
              </div>
            </div>
          )}
          </div>
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
            {search.trim() && searchedExternal.length ? (
              <>
                <div className="searchSectionDivider">{tr("Governing sources", "Fuentes de control")}</div>
                {searchedExternal.map((item) => (
                  <ExternalSourceCard key={item.resource.id + "-" + item.section.id} match={item} onOpen={openExternal} />
                ))}
              </>
            ) : null}
            {!searchedRules.length && !searchedExternal.length && <div className="card muted">{tr("No matches found. Try different terms.", "No encontré coincidencias. Probá con otras palabras.")}</div>}
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
          {db ? (
            <div className="card complexRulesCatalog">
              <p className="eyebrow">{tr("HIGH-COMPLEXITY RULES", "REGLAS DE ALTA COMPLEJIDAD")}</p>
              <h2>{tr("Rules we audit most aggressively", "Reglas que auditamos con mayor profundidad")}</h2>
              <p className="muted">{tr(
                "These are the areas where several provisions interact or where the Rulebook intentionally leaves observation/discretion to the Umpire. Each card separates what the app can derive from what must remain human judgment.",
                "Estas son las áreas donde interactúan varias disposiciones o donde el Rulebook deja intencionalmente observación/discreción al Umpire. Cada tarjeta separa lo que la app puede derivar de lo que debe seguir siendo juicio humano.",
              )}</p>
              <div className="complexRulesGrid">
                {complexRuleFocuses.map((focus) => {
                  const copy = complexText(focus, language);
                  return (
                    <article className="complexRuleCard" key={focus.id}>
                      <div className="complexRuleTop">
                        <strong>{focus.title}</strong>
                        <span>{focus.discipline === "outdoor" ? "Outdoor" : "Arena"}</span>
                      </div>
                      <p><b>{tr("Why it is confusing:", "Por qué es confusa:")}</b> {copy.why}</p>
                      <p className="certaintyLine"><b>{tr("What we can make certain:", "Qué podemos volver certero:")}</b> {copy.certainty}</p>
                      <p className="judgmentLine"><b>{tr("Still Umpire judgment:", "Sigue siendo juicio del Umpire:")}</b> {copy.judgment}</p>
                      <div className="complexRuleLinks">
                        {[...focus.refs, ...focus.related].map((ref) => {
                          const provision = getProvision(db, focus.discipline, ref);
                          return provision ? (
                            <button key={ref} onClick={() => setSelectedProvision(provision)}>{provision.label}</button>
                          ) : null;
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {externalDb ? (
            <div className="card externalResourceCatalog">
              <p className="eyebrow">{tr("GOVERNING SOURCES · OFFLINE", "FUENTES DE CONTROL · OFFLINE")}</p>
              <h2>{tr("Tournament Conditions, policies and official supporting sections", "Tournament Conditions, políticas y secciones oficiales de apoyo")}</h2>
              <p className="muted">{tr(
                "These sources are indexed locally with Rulebook page ranges and can be opened without a connection.",
                "Estas fuentes están indexadas localmente con las páginas del Rulebook y se pueden abrir sin conexión.",
              )}</p>
              <div className="externalResourceGrid">
                {externalDb.resources.map((resource) => (
                  <button key={resource.id} onClick={() => openExternal(resource, null)}>
                    <strong>{resource.shortTitle}</strong>
                    <span>{resource.sections.length} {tr("sections", "secciones")} · p. {externalPageLabel(resource)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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

      {tab === "historial" && (
        <section className="view">
          <CaseHistoryPanel
            language={language}
            installedRulebookVersion={manifest?.activeVersion ?? "2026"}
            onReuse={reuseSavedCase}
          />
        </section>
      )}

      {infoWindow === "how" && db ? (
        <div className="infoWindowBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setInfoWindow(null);
        }}>
          <section className="infoWindowPanel" role="dialog" aria-modal="true" aria-label={tr("How it works", "Cómo funciona")}>
            <header className="infoWindowHeader">
              <div>
                <p className="eyebrow">{tr("REFERENCE WINDOW", "VENTANA DE CONSULTA")}</p>
                <h2>{tr("How it works", "Cómo funciona")}</h2>
              </div>
              <button className="infoWindowClose" onClick={() => setInfoWindow(null)} aria-label={tr("Close and return", "Cerrar y volver")}>×</button>
            </header>
            <div className="infoWindowScroll">
              <HowItWorksPanel
                language={language}
                db={db}
                externalDb={externalDb}
                rulebookVersion={manifest?.activeVersion ?? "2026"}
                metrics={guidanceMetrics}
                onOpenProvision={setSelectedProvision}
                onOpenExternal={(resource, section) => openExternal(resource, section)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {infoWindow === "offline" ? (
        <div className="infoWindowBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setInfoWindow(null);
        }}>
          <section className="infoWindowPanel compactInfoWindow" role="dialog" aria-modal="true" aria-label={tr("Offline & validation status", "Offline y estado de validación")}>
            <header className="infoWindowHeader">
              <div>
                <p className="eyebrow">{tr("REFERENCE WINDOW", "VENTANA DE CONSULTA")}</p>
                <h2>{tr("Offline & validation status", "Offline y estado de validación")}</h2>
              </div>
              <button className="infoWindowClose" onClick={() => setInfoWindow(null)} aria-label={tr("Close and return", "Cerrar y volver")}>×</button>
            </header>
            <div className="infoWindowScroll">
              <OfflineStatusPanel
                language={language}
                offlineReady={offlineReady}
                offlineVerifiedAt={offlineVerifiedAt}
                offlineMissingCount={offlineMissingCount}
                storagePersistent={storagePersistent}
                installedAsPwa={installedAsPwa}
                networkOnline={networkOnline}
                manifest={manifest}
                metrics={guidanceMetrics}
                updateStatus={updateStatus}
                onCheckUpdates={() => void checkUpdates()}
              />
            </div>
          </section>
        </div>
      ) : null}

      <footer>
        <span>Polo Umpire Assistant v{APP_VERSION}</span>
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

      {selectedExternal && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedExternal(null);
        }}>
          <article className="ruleModal externalResourceModal" role="dialog" aria-modal="true" aria-label={selectedExternal.resource.title}>
            <button className="modalClose" onClick={() => setSelectedExternal(null)} aria-label={tr("Close", "Cerrar")}>×</button>
            <p className="eyebrow">{tr("OFFICIAL GOVERNING SOURCE", "FUENTE OFICIAL DE CONTROL")} · RULEBOOK {manifest?.activeVersion ?? "2026"}</p>
            <h2>{selectedExternal.resource.title}</h2>
            {selectedExternal.section ? (
              <>
                <div className="sourceMeta">{selectedExternal.section.title} · {tr("page", "página")} {externalPageLabel(selectedExternal.section)}</div>
                <button className="externalBackToIndex" onClick={() => setSelectedExternal({ resource: selectedExternal.resource, section: null })}>
                  ← {tr("All sections", "Todas las secciones")}
                </button>
                <OfficialTextView text={selectedExternal.section.text} title={selectedExternal.section.title} language={language} sourceKey={selectedExternal.section.id} />
              </>
            ) : (
              <>
                <div className="sourceMeta">USPA Rulebook {manifest?.activeVersion ?? "2026"} · {tr("pages", "páginas")} {externalPageLabel(selectedExternal.resource)}</div>
                <div className="externalSectionIndex">
                  {selectedExternal.resource.sections.map((section) => (
                    <button key={section.id} onClick={() => setSelectedExternal({ resource: selectedExternal.resource, section })}>
                      <strong>{section.title}</strong>
                      <span>p. {externalPageLabel(section)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </article>
        </div>
      )}

      {selectedProvision && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedProvision(null);
        }}>
          <article className="ruleModal provisionModal" role="dialog" aria-modal="true" aria-label={selectedProvision.label}>
            <button className="modalClose" onClick={() => setSelectedProvision(null)} aria-label={tr("Close", "Cerrar")}>×</button>
            <p className="eyebrow">{tr("EXACT CONTROLLING PROVISION", "DISPOSICIÓN EXACTA DE CONTROL")} · RULEBOOK {manifest?.activeVersion ?? "2026"}</p>
            <h2>{selectedProvision.label}</h2>
            <div className="sourceMeta">
              {selectedProvision.discipline === "outdoor" ? "Outdoor" : "Arena"} · {tr("page", "página")} {selectedProvision.pageStart}
            </div>
            <OfficialTextView text={selectedProvision.text} title={selectedProvision.label} language={language} className="provisionOfficialText" />
            {db ? (() => {
              const parent = db.rules.find((rule) => rule.discipline === selectedProvision.discipline && rule.rule === selectedProvision.rule);
              return parent ? (
                <button
                  className="secondaryAction provisionFullRule"
                  onClick={() => {
                    setSelectedProvision(null);
                    setSelectedRule(parent);
                  }}
                >
                  {tr("Open full Rule " + parent.rule, "Abrir Rule " + parent.rule + " completa")}
                </button>
              ) : null;
            })() : null}
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
            {parseRuleProvisions(selectedRule).filter((item) => item.level === 1).length ? (
              <details className="subarticleIndex">
                <summary>{tr("Browse by subarticle", "Ver por subartículo")}</summary>
                <div className="subarticleList">
                  {parseRuleProvisions(selectedRule).filter((item) => item.level === 1).map((provision) => (
                    <div key={provision.id}>
                      <strong>{provision.label}</strong>
                      <p>{provision.text}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            <OfficialTextView text={selectedRule.text} title={`Rule ${selectedRule.rule} · ${selectedRule.title}`} language={language} />
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
