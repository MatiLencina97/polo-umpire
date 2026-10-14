"use client";

import { useMemo } from "react";
import { formatOfficialTextBlocks } from "@/lib/official-text-format";
import type { Language } from "@/lib/types";

export default function OfficialTextView({
  text,
  title,
  language,
  className = "",
}: {
  text: string;
  title?: string;
  language: Language;
  className?: string;
}) {
  const blocks = useMemo(() => formatOfficialTextBlocks(text, title ?? ""), [text, title]);

  return (
    <div className={["officialText", "officialTextStructured", className].filter(Boolean).join(" ")}>
      {blocks.map((block, index) => block.kind === "table" ? (
        <div className="officialTableBlock" key={index}>
          <div className="officialTableHint" aria-hidden="true">
            ↔ {language === "en" ? "Scroll horizontally to view all columns" : "Deslizá horizontalmente para ver todas las columnas"}
          </div>
          <div className="officialTableScroll">
            <pre className="officialTableText">{block.text}</pre>
          </div>
        </div>
      ) : (
        <div className="officialProseBlock" key={index}>{block.text}</div>
      ))}
    </div>
  );
}
