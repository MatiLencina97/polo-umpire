"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatOfficialTextBlocks } from "@/lib/official-text-format";
import { getOfficialStructuredTable, type OfficialStructuredTable } from "@/lib/official-structured-tables";
import type { Language } from "@/lib/types";

function FitToWidthPreview({
  children,
  onExpand,
  ariaLabel,
}: {
  children: ReactNode;
  onExpand: () => void;
  ariaLabel: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const update = () => {
      const frame = frameRef.current;
      const content = contentRef.current;
      if (!frame || !content) return;

      const naturalWidth = content.scrollWidth;
      const naturalHeight = content.scrollHeight;
      const availableWidth = frame.clientWidth;
      if (!naturalWidth || !availableWidth) return;

      const nextScale = Math.min(1, availableWidth / naturalWidth);
      setScale(nextScale);
      setHeight(Math.ceil(naturalHeight * nextScale));
    };

    update();
    const observer = new ResizeObserver(update);
    if (frameRef.current) observer.observe(frameRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("orientationchange", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, [children]);

  return (
    <div
      ref={frameRef}
      className="officialFitPreview"
      style={{ height }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onExpand}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onExpand();
        }
      }}
    >
      <div
        ref={contentRef}
        className="officialFitPreviewContent"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function StructuredTable({ table, compact = false }: { table: OfficialStructuredTable; compact?: boolean }) {
  return (
    <table className={compact ? "officialHtmlTable officialHtmlTableCompact" : "officialHtmlTable"}>
      <thead>
        <tr>
          {table.columns.map((column) => <th key={column}>{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => cellIndex === 0
              ? <th scope="row" key={cellIndex}>{cell}</th>
              : <td key={cellIndex}>{cell}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableLightbox({
  children,
  title,
  language,
  onClose,
}: {
  children: ReactNode;
  title?: string;
  language: Language;
  onClose: () => void;
}) {
  return (
    <div className="officialTableLightbox" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="officialTableLightboxCard" role="dialog" aria-modal="true" aria-label={title ?? "Table"}>
        <button className="officialTableLightboxClose" onClick={onClose} aria-label={language === "en" ? "Close enlarged table" : "Cerrar tabla ampliada"}>×</button>
        {title ? <h3>{title}</h3> : null}
        <div className="officialTableLightboxHint">
          {language === "en" ? "Zoom or scroll to inspect the table" : "Podés hacer zoom o desplazarte para revisar el cuadro"}
        </div>
        <div className="officialTableLightboxViewport">{children}</div>
      </div>
    </div>
  );
}

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
  const [expanded, setExpanded] = useState<string | null>(null);

  if (structuredTable) {
    return (
      <div className={["officialText", "officialTextStructured", className].filter(Boolean).join(" ")}>
        <div className="officialTableBlock officialHtmlTableBlock">
          <div className="officialTableHint officialTableTapHint" aria-hidden="true">
            ⤢ {language === "en" ? "Tap to enlarge" : "Tocá para ampliar"}
          </div>
          <FitToWidthPreview
            ariaLabel={language === "en" ? "Open enlarged table" : "Abrir cuadro ampliado"}
            onExpand={() => setExpanded("structured")}
          >
            <StructuredTable table={structuredTable} compact />
          </FitToWidthPreview>
        </div>

        {expanded === "structured" ? (
          <TableLightbox title={title} language={language} onClose={() => setExpanded(null)}>
            <StructuredTable table={structuredTable} />
          </TableLightbox>
        ) : null}
      </div>
    );
  }

  return (
    <div className={["officialText", "officialTextStructured", className].filter(Boolean).join(" ")}>
      {blocks.map((block, index) => block.kind === "table" ? (
        <div className="officialTableBlock" key={index}>
          <div className="officialTableHint officialTableTapHint" aria-hidden="true">
            ⤢ {language === "en" ? "Tap to enlarge" : "Tocá para ampliar"}
          </div>
          <FitToWidthPreview
            ariaLabel={language === "en" ? "Open enlarged table" : "Abrir cuadro ampliado"}
            onExpand={() => setExpanded(String(index))}
          >
            <pre className="officialTableText officialTableTextCompact">{block.text}</pre>
          </FitToWidthPreview>

          {expanded === String(index) ? (
            <TableLightbox title={title} language={language} onClose={() => setExpanded(null)}>
              <pre className="officialTableText">{block.text}</pre>
            </TableLightbox>
          ) : null}
        </div>
      ) : (
        <div className="officialProseBlock" key={index}>{block.text}</div>
      ))}
    </div>
  );
}
