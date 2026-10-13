"use client";

import type { ExternalResource, ExternalSection, Language } from "@/lib/types";
import type { ExternalSectionMatch } from "@/lib/external-resources";
import type { DecisionRuleLink } from "@/lib/decision-links";
import type { RuleProvision } from "@/lib/subarticles";
import { externalPageLabel } from "@/lib/external-resources";

type Props = {
  language: Language;
  ruleLinks: DecisionRuleLink[];
  externalLinks?: ExternalSectionMatch[];
  onOpenProvision: (provision: RuleProvision) => void;
  onOpenExternal: (resource: ExternalResource, section: ExternalSection) => void;
};

export default function DecisionRuleTrail({
  language,
  ruleLinks,
  externalLinks = [],
  onOpenProvision,
  onOpenExternal,
}: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  if (!ruleLinks.length && !externalLinks.length) return null;

  return (
    <section className="decisionRuleTrail">
      <div className="decisionRuleTrailHeader">
        <div>
          <p className="eyebrow">{tr("WHY THIS DECISION", "POR QUÉ ESTA DECISIÓN")}</p>
          <h3>{tr("Rules needed to understand the call", "Reglas necesarias para entender la decisión")}</h3>
        </div>
        <span>{tr("Tap any rule to open the exact provision.", "Tocá cualquier regla para abrir la disposición exacta.")}</span>
      </div>

      <div className="decisionRuleTrailList">
        {ruleLinks.map((item, index) => (
          <button
            className="decisionRuleTrailItem"
            key={item.provision.id + "-" + index}
            onClick={() => onOpenProvision(item.provision)}
          >
            <span className="trailIndex">{index + 1}</span>
            <span className="trailBody">
              <b>{item.provision.label}</b>
              <small>{item.role}</small>
            </span>
            <span className="trailPage">p. {item.provision.pageStart}</span>
          </button>
        ))}

        {externalLinks.map((item, index) => (
          <button
            className="decisionRuleTrailItem externalTrail"
            key={item.resource.id + "-" + item.section.id}
            onClick={() => onOpenExternal(item.resource, item.section)}
          >
            <span className="trailIndex">{ruleLinks.length + index + 1}</span>
            <span className="trailBody">
              <b>{item.resource.shortTitle} · {item.section.title}</b>
              <small>{tr(
                "Event/governing source that can qualify or override the playing-rule analysis",
                "Fuente del evento/de control que puede condicionar o prevalecer sobre el análisis de las reglas de juego",
              )}</small>
            </span>
            <span className="trailPage">p. {externalPageLabel(item.section)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
