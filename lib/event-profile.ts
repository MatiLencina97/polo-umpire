import type { ChoiceValue, Discipline } from "./types";
import type { CaseFactValue } from "./rule-graphs";
import type { SubstitutionCrossFacts } from "./cross-rule";

export type EventType = "uspa" | "npc" | "club" | "other" | "unknown";
export type SponsorStructure = "playing" | "nonplaying" | "unknown";

export type EventProfile = {
  name: string;
  club: string;
  discipline: Discipline;
  eventType: EventType;
  upperHandicap: number | null;
  lowerHandicap: number | null;
  sponsorStructure: SponsorStructure;
  affiliateHostException: ChoiceValue;
  format: string;
  conditionsKnown: ChoiceValue;
  conditionsNotes: string;
};

export const defaultEventProfile: EventProfile = {
  name: "",
  club: "",
  discipline: "outdoor",
  eventType: "unknown",
  upperHandicap: null,
  lowerHandicap: null,
  sponsorStructure: "unknown",
  affiliateHostException: "unknown",
  format: "",
  conditionsKnown: "unknown",
  conditionsNotes: "",
};

export function profileToSubstitutionFacts(profile: EventProfile): Partial<SubstitutionCrossFacts> {
  return {
    uspaNpcEvent:
      profile.eventType === "uspa" || profile.eventType === "npc"
        ? "yes"
        : profile.eventType === "club" || profile.eventType === "other"
          ? "no"
          : "unknown",
    sponsorType: profile.sponsorStructure,
    affiliateHostException: profile.affiliateHostException,
  };
}

export function profileToCaseFacts(profile: EventProfile): Record<string, CaseFactValue> {
  const facts: Record<string, CaseFactValue> = {};

  if (profile.eventType !== "unknown") {
    facts.eventClassification =
      profile.eventType === "uspa"
        ? "USPA Event"
        : profile.eventType === "npc"
          ? "NPC Event"
          : profile.eventType === "club"
            ? "Club Event"
            : "Other Event";
  }

  if (profile.upperHandicap !== null) facts.eventUpperLimit = profile.upperHandicap;
  if (profile.format.trim()) {
    facts.matchFormat = profile.format.trim();
    facts.specialTournamentFormat = profile.format.trim();
    if (profile.discipline === "arena") facts.arenaFormatType = profile.format.trim();
  }

  if (profile.conditionsKnown !== "unknown") {
    facts.eventConditionsKnown = profile.conditionsKnown;
    facts.eventSpecificEquipment = profile.conditionsKnown;
    if (profile.discipline === "arena") facts.arenaEventConditions = profile.conditionsKnown;
  }

  if (profile.sponsorStructure !== "unknown") facts.sponsorStructure = profile.sponsorStructure;
  if (profile.conditionsNotes.trim()) facts.tournamentConditionsNotes = profile.conditionsNotes.trim();
  if (profile.club.trim()) facts.club = profile.club.trim();

  return facts;
}

export function profileSummary(profile: EventProfile) {
  const bits: string[] = [];
  bits.push(profile.discipline === "outdoor" ? "Outdoor" : "Arena");
  if (profile.upperHandicap !== null) bits.push(profile.upperHandicap + "-goal");
  if (profile.eventType !== "unknown") bits.push(profile.eventType.toUpperCase());
  if (profile.name.trim()) bits.unshift(profile.name.trim());
  return bits.join(" · ");
}
