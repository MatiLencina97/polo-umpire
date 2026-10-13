export type Discipline = "outdoor" | "arena";
export type Language = "en" | "es";

export type Rule = {
  id: string;
  discipline: Discipline;
  rule: string;
  title: string;
  pageStart: number;
  pageEnd?: number;
  text: string;
  applications?: Array<{ label: string; text: string }>;
  keywords?: string[];
};

export type RuleDb = {
  source: Record<string, unknown>;
  rules: Rule[];
  umpireGuide: Array<Record<string, unknown>>;
};

export type ExternalSection = {
  id: string;
  ref: string;
  title: string;
  pageStart: number;
  pageEnd?: number;
  pdfPageStart?: number;
  pdfPageEnd?: number;
  text: string;
  keywords?: string[];
};

export type ExternalResource = {
  id: string;
  title: string;
  shortTitle: string;
  aliases?: string[];
  keywords?: string[];
  pageStart: number;
  pageEnd?: number;
  pdfPageStart?: number;
  pdfPageEnd?: number;
  sections: ExternalSection[];
};

export type ExternalResourceDb = {
  source: Record<string, unknown>;
  resources: ExternalResource[];
};

export type RuleManifest = {
  activeVersion: string;
  year: number;
  rulesFile: string;
  resourcesFile?: string;
  sha256: string;
  generatedAt: string;
  offlineReady: boolean;
  counts: {
    outdoor: number;
    arena: number;
    umpireGuidePages: number;
    resources?: number;
    resourceSections?: number;
  };
};

export type TopicId = "row" | "dangerous" | "blocking" | "mallet" | "conduct" | "restart";
export type ScenarioId = "substitutes";
export type ResolverMode = "play" | "situation";

export type TopicDefinition = {
  label: string;
  outdoor: string[];
  arena: string[];
  terms: string[];
};

export type ChoiceValue = string;
export type QuestionDefinition = {
  key: string;
  label: string;
  options: Array<[ChoiceValue, string]>;
};
