"use client";

import { useMemo } from "react";
import { formatOfficialTextBlocks } from "@/lib/official-text-format";
import { getOfficialStructuredTable } from "@/lib/official-structured-tables";
import type { Language } from "@/lib/types";

export default function OfficialTextView({
  text,
  title,
  language,
  className = "",
  sourceKey,
}: {
  text: string;
  title?: string;
  language: Language;
  className?: string;
  sourceKey?: string;
}) {
  const structuredTable = useMemo(() => getOfficialStructuredTable(sourceKey), [sourceKey]);
  const blocks = useMemo(() => formatOfficialTextBlocks(text, title ?? ""), [text, title]);

  if (structuredTable) {
    return (
      <div className={["officialText", "officialTextStructured", className].filter(Boolean).join(" ")}>
        <div className="officialTableBlock officialHtmlTableBlock">
          <div className="officialTableHint" aria-hidden="true">
            ↔ {language === "en" ? "Scroll horizontally to view all columns" : "Deslizá horizontalmente para ver todas las columnas"}
          </div>
          <div className="officialTableScroll officialHtmlTableScroll">
            <table className="officialHtmlTable">
              <thead>
                <tr>
                  {structuredTable.columns.map((column) => <th key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {structuredTable.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => cellIndex === 0
                      ? <th scope="row" key={cellIndex}>{cell}</th>
                      : <td key={cellIndex}>{cell}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

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
