export type OfficialParsedTable = {
  rows: string[][];
  columnCount: number;
  hasHeader: boolean;
};

export type OfficialTextBlock = {
  kind: "prose" | "table";
  text: string;
  table?: OfficialParsedTable;
};

const TABLE_TITLE_HINT = /(misexecution|handicap matrix|heat index chart|fees and charges|certified umpire requirements|professional umpires)/i;
const PAGE_HEADER = /^\s*2026 UNITED STATES POLO ASSOCIATION®\s*$/i;

function stripMarginFurniture(line: string) {
  // PDF side-tabs are extracted as isolated capital letters far away from the body text.
  let cleaned = line
    .replace(/\s{8,}[A-Z]\s*$/g, "")
    .replace(/^[A-Z]\s{5,}(?=\S)/g, "")
    .replace(/\s+$/g, "");

  return cleaned;
}

export function cleanOfficialSourceText(text: string) {
  const rawLines = String(text ?? "").replace(/\r/g, "").split("\n");
  const firstPass = rawLines
    .map(stripMarginFurniture)
    .filter((line) => !PAGE_HEADER.test(line));

  const isOrphan = (line: string) => /^[A-Z]$/.test(line.trim());

  const cleaned = firstPass.filter((line, index) => {
    if (!isOrphan(line)) return true;

    const nearby = firstPass.slice(Math.max(0, index - 2), Math.min(firstPass.length, index + 3));
    const orphanCount = nearby.filter(isOrphan).length;
    return orphanCount < 2;
  });

  return cleaned.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function splitTableCells(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (/\t/.test(trimmed)) {
    const cells = trimmed.split(/\t+/).map((cell) => cell.trim()).filter(Boolean);
    return cells.length >= 2 ? cells : null;
  }

  const separators = trimmed.match(/ {3,}/g)?.length ?? 0;
  if (separators >= 1) {
    const cells = trimmed.split(/ {3,}/).map((cell) => cell.trim()).filter(Boolean);
    return cells.length >= 2 ? cells : null;
  }

  return null;
}

function likelyHeader(cells: string[]) {
  const joined = cells.join(" ").toLowerCase();
  if (/(rule|penalty|outdoor|arena|goal level|certification|goal|event|club|situation|handicap)/i.test(joined)) return true;
  const letters = joined.replace(/[^a-z]/g, "");
  if (!letters) return false;
  const uppercaseCells = cells.filter((cell) => cell === cell.toUpperCase() && /[A-Z]/.test(cell)).length;
  return uppercaseCells >= Math.max(1, Math.ceil(cells.length / 2));
}

function normalizeRows(rows: string[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array(Math.max(0, columnCount - row.length)).fill("")]);
}

function parseTableRows(lines: string[]): OfficialParsedTable | null {
  const rows = lines
    .map((line) => splitTableCells(line))
    .filter((row): row is string[] => Boolean(row));

  if (rows.length < 2) return null;

  const columnCounts = rows.map((row) => row.length);
  const maxColumns = Math.max(...columnCounts);
  const multiColumnRows = rows.filter((row) => row.length >= 2).length;
  if (maxColumns < 2 || multiColumnRows < 2) return null;

  const normalized = normalizeRows(rows);
  return {
    rows: normalized,
    columnCount: maxColumns,
    hasHeader: likelyHeader(normalized[0]),
  };
}

function columnSeparatorCount(line: string) {
  const spaceGroups = line.match(/ {3,}/g)?.length ?? 0;
  const tabs = line.match(/\t+/g)?.length ?? 0;
  return spaceGroups + tabs;
}

function looksLikeTableBlock(block: string, title: string) {
  const lines = block.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) return false;

  if (TABLE_TITLE_HINT.test(title)) return true;

  const parsed = parseTableRows(lines);
  if (parsed && parsed.rows.length >= 3) return true;

  const columnLines = lines.filter((line) => columnSeparatorCount(line) > 0).length;
  const strongColumnLines = lines.filter((line) => columnSeparatorCount(line) >= 2).length;
  const tabLines = lines.filter((line) => /\t/.test(line)).length;

  if (lines.length === 1) {
    return tabLines > 0 || strongColumnLines === 1;
  }

  if (tabLines >= 2) return true;
  if (strongColumnLines >= 2 && columnLines / lines.length >= 0.35) return true;
  return columnLines >= 3 && columnLines / lines.length >= 0.55;
}

function classifyChunk(chunk: string, title: string): OfficialTextBlock {
  const lines = chunk.split("\n").filter((line) => line.trim().length > 0);
  const table = parseTableRows(lines);
  const kind = looksLikeTableBlock(chunk, title) ? "table" : "prose";
  return { kind, text: chunk, table: kind === "table" ? table ?? undefined : undefined };
}

function splitMixedChunk(chunk: string, title: string): OfficialTextBlock[] {
  const lines = chunk.split("\n");
  const result: OfficialTextBlock[] = [];
  let prose: string[] = [];
  let table: string[] = [];

  const flushProse = () => {
    const text = prose.join("\n").trimEnd();
    if (text.trim()) result.push({ kind: "prose", text });
    prose = [];
  };

  const flushTable = () => {
    const text = table.join("\n").trimEnd();
    if (text.trim()) result.push(classifyChunk(text, title));
    table = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parsed = splitTableCells(line);
    const nextParsed = index + 1 < lines.length ? splitTableCells(lines[index + 1]) : null;
    const previousParsed = index > 0 ? splitTableCells(lines[index - 1]) : null;
    const isBlank = !line.trim();

    const belongsToTable = Boolean(parsed) || (isBlank && Boolean(previousParsed) && Boolean(nextParsed));

    if (belongsToTable) {
      flushProse();
      if (!isBlank) table.push(line);
    } else {
      flushTable();
      prose.push(line);
    }
  }

  flushTable();
  flushProse();

  return result.length ? result : [classifyChunk(chunk, title)];
}

export function formatOfficialTextBlocks(text: string, title = ""): OfficialTextBlock[] {
  const cleaned = cleanOfficialSourceText(text);
  const chunks = cleaned
    .split(/\n[ \t]*\n+/)
    .map((chunk) => chunk.trimEnd())
    .filter((chunk) => chunk.trim().length > 0);

  const blocks = chunks.flatMap((chunk) => splitMixedChunk(chunk, title));

  const merged: OfficialTextBlock[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];

    // Never merge parsed tables: keeping each table run separate prevents unrelated
    // schedules/fee matrices from being fused together.
    if (previous?.kind === block.kind && block.kind === "prose") {
      previous.text += "\n\n" + block.text;
    } else {
      merged.push({ ...block });
    }
  }

  return merged;
}
