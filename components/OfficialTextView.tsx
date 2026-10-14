"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatOfficialTextBlocks, type OfficialParsedTable } from "@/lib/official-text-format";
import { getOfficialSourceNotice, getOfficialStructuredTable, type OfficialStructuredTable } from "@/lib/official-structured-tables";
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

function ParsedTable({ table, compact = false }: { table: OfficialParsedTable; compact?: boolean }) {
  const className = [
    "officialHtmlTable",
    compact ? "officialHtmlTableCompact" : "",
    compact ? `officialHtmlTableCols${table.columnCount}` : "",
  ].filter(Boolean).join(" ");

  const rows = table.rows;
  const header = table.hasHeader ? rows[0] : null;
  const bodyRows = table.hasHeader ? rows.slice(1) : rows;

  return (
    <table className={className}>
      {header ? (
        <thead>
          <tr>
            {header.map((cell, index) => <th key={index}>{cell}</th>)}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {bodyRows.map((row, rowIndex) => (
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

function StructuredTable({ table, compact = false }: { table: OfficialStructuredTable; compact?: boolean }) {
  const className = [
    "officialHtmlTable",
    compact ? "officialHtmlTableCompact" : "",
    compact ? `officialHtmlTableCols${table.columns.length}` : "",
  ].filter(Boolean).join(" ");

  return (
    <table className={className}>
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
  const sourceNotice = useMemo(() => getOfficialSourceNotice(sourceKey), [sourceKey]);
  const blocks = useMemo(() => formatOfficialTextBlocks(text, title ?? ""), [text, title]);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (sourceNotice && !structuredTable) {
    return (
      <div className={["officialText", "officialTextStructured", className].filter(Boolean).join(" ")}>
        <div className="officialSourceNotice">
          <strong>{language === "en" ? "Visual source" : "Fuente visual"}</strong>
          <p>{language === "en" ? sourceNotice.en : sourceNotice.es}</p>
        </div>
      </div>
    );
  }

  if (structuredTable) {
    return (
      <div className={["officialText", "officialTextStructured", className].filter(Boolean).join(" ")}>
        <div className="officialTableBlock officialHtmlTableBlock officialPdfTableBlock">
          <button
            type="button"
            className="officialTableHint officialTableTapHint officialPdfTableAction"
            onClick={() => setExpanded("structured")}
          >
            ⤢ {language === "en" ? "Enlarge table" : "Ampliar cuadro"}
          </button>
          <div
            className="officialPdfTableFrame"
            role="button"
            tabIndex={0}
            aria-label={language === "en" ? "Open enlarged table" : "Abrir cuadro ampliado"}
            onClick={() => setExpanded("structured")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setExpanded("structured");
              }
            }}
          >
            <StructuredTable table={structuredTable} compact />
          </div>
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
        <div className="officialTableBlock officialPdfTableBlock" key={index}>
          <button
            type="button"
            className="officialTableHint officialTableTapHint officialPdfTableAction"
            onClick={() => setExpanded(String(index))}
          >
            ⤢ {language === "en" ? "Enlarge table" : "Ampliar cuadro"}
          </button>

          {block.table ? (
            <div
              className="officialPdfTableFrame"
              role="button"
              tabIndex={0}
              aria-label={language === "en" ? "Open enlarged table" : "Abrir cuadro ampliado"}
              onClick={() => setExpanded(String(index))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setExpanded(String(index));
                }
              }}
            >
              <ParsedTable table={block.table} compact />
            </div>
          ) : (
            <FitToWidthPreview
              ariaLabel={language === "en" ? "Open enlarged table" : "Abrir cuadro ampliado"}
              onExpand={() => setExpanded(String(index))}
            >
              <pre className="officialTableText officialTableTextCompact">{block.text}</pre>
            </FitToWidthPreview>
          )}

          {expanded === String(index) ? (
            <TableLightbox title={title} language={language} onClose={() => setExpanded(null)}>
              {block.table
                ? <ParsedTable table={block.table} />
                : <pre className="officialTableText">{block.text}</pre>}
            </TableLightbox>
          ) : null}
        </div>
      ) : (
        <div className="officialProseBlock" key={index}>{block.text}</div>
      ))}
    </div>
  );
}
