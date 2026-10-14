export type OfficialTextBlock = {
  kind: "prose" | "table";
  text: string;
};

const TABLE_TITLE_HINT = /(misexecution|handicap matrix|heat index chart)/i;

function columnSeparatorCount(line: string) {
  const spaceGroups = line.match(/ {3,}/g)?.length ?? 0;
  const tabs = line.match(/	+/g)?.length ?? 0;
  return spaceGroups + tabs;
}

function looksLikeTableBlock(block: string, title: string) {
  const lines = block.split("
").filter((line) => line.trim().length > 0);
  if (!lines.length) return false;

  if (TABLE_TITLE_HINT.test(title)) return true;

  const columnLines = lines.filter((line) => columnSeparatorCount(line) > 0).length;
  const strongColumnLines = lines.filter((line) => columnSeparatorCount(line) >= 2).length;
  const tabLines = lines.filter((line) => /	/.test(line)).length;

  if (lines.length === 1) {
    return tabLines > 0 || strongColumnLines === 1;
  }

  if (tabLines >= 2) return true;
  if (strongColumnLines >= 2 && columnLines / lines.length >= 0.35) return true;
  return columnLines >= 3 && columnLines / lines.length >= 0.55;
}

export function formatOfficialTextBlocks(text: string, title = ""): OfficialTextBlock[] {
  const chunks = text
    .replace(//g, "")
    .split(/
[ 	]*
+/)
    .map((chunk) => chunk.trimEnd())
    .filter((chunk) => chunk.trim().length > 0);

  const classified = chunks.map<OfficialTextBlock>((chunk) => ({
    kind: looksLikeTableBlock(chunk, title) ? "table" : "prose",
    text: chunk,
  }));

  const merged: OfficialTextBlock[] = [];
  for (const block of classified) {
    const previous = merged[merged.length - 1];
    if (previous?.kind === block.kind) {
      previous.text += "

" + block.text;
    } else {
      merged.push({ ...block });
    }
  }

  return merged;
}
