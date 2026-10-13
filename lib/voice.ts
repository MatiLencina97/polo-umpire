import type { Language } from "./types";

export function speechLocale(language: Language) {
  return language === "es" ? "es-AR" : "en-US";
}

export function appendTranscript(existing: string, spoken: string) {
  const base = existing.trimEnd();
  const addition = spoken.trim();
  if (!addition) return existing;
  if (!base) return addition;
  const needsSpace = !/[\s\n]$/.test(existing);
  return existing + (needsSpace ? " " : "") + addition;
}
