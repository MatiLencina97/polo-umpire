export type OfficialStructuredTable = {
  columns: string[];
  rows: string[][];
  firstColumnLabel?: string;
};

const outdoorMisexecution: OfficialStructuredTable = {
  columns: [
    "Situation",
    "Penalty 2",
    "Penalty 3",
    "Penalty 4",
    "Penalty 6 (Safety)",
    "Penalty 5.a",
    "Penalty 5.b",
    "Knock-In",
  ],
  rows: [
    [
      "Swing and miss",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Live Ball",
      "Live Ball",
      "Live Ball",
      "Live Ball",
      "Live Ball",
    ],
    [
      "Ball hit or hit at before Umpire calls Play",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Less severe of Spot hit or Penalty 4 for defending team",
      "Spot hit for defending team",
      "Penalty 4 for defending team",
    ],
    [
      "Ball not hit or hit at on first approach",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Less severe of Spot hit or Penalty 4 for defending team",
      "Spot hit for defending team",
      "Penalty 4 for defending team",
    ],
    [
      "Attacking team – improper position",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
    ],
    [
      "Defending team – improper position",
      "If goal scored or prevented by improper position it counts; otherwise rehit for attacking team",
      "If goal scored or prevented by improper position it counts; otherwise Penalty 2 for attacking team",
      "If goal scored or prevented by improper position it counts; otherwise Penalty 3 for attacking team",
      "If goal scored or prevented by improper position it counts; otherwise Penalty 3 for attacking team",
      "If goal scored or prevented by improper position it counts; otherwise next more severe penalty for attacking team",
      "If goal scored or prevented by improper position it counts; otherwise Penalty 4 for attacking team",
      "Penalty 5.b for attacking team",
    ],
  ],
};

const arenaMisexecution: OfficialStructuredTable = {
  columns: [
    "Situation",
    "Penalty 2",
    "Penalty 3",
    "Penalty 4",
    "Penalty 5.a",
    "Penalty 5.b",
  ],
  rows: [
    [
      "Swing and miss",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Live Ball",
      "Live Ball",
    ],
    [
      "Ball hit or hit at before Umpire calls Play",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit no closer than center line for defending team",
      "Spot hit",
    ],
    [
      "Ball not hit or hit at on second approach",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit no closer than center line for defending team",
      "Spot hit for defending team or Penalty 4",
    ],
    [
      "Attacking team jumps line",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "N/A",
      "N/A",
    ],
    [
      "Defending team jumps line",
      "Re-hit if goal not scored",
      "Re-hit if goal not scored",
      "Re-hit if goal not scored",
      "N/A",
      "N/A",
    ],
    [
      "Contact by attacking team",
      "Spot hit for defending team (or move up for severity)",
      "Spot hit for defending team (or move up for severity)",
      "Spot hit for defending team (or move up for severity)",
      "Spot hit no closer than center line for defending team (or move up for severity)",
      "Spot hit for defending team (or move up for severity)",
    ],
    [
      "Contact by defending team",
      "Re-hit if goal not scored",
      "Re-hit if goal not scored (or move up for severity)",
      "Re-hit if goal not scored (or move up for severity)",
      "Re-hit if goal not scored (or move up for severity)",
      "Re-hit if goal not scored (or move up for severity)",
    ],
    [
      "Ball doesn’t reach end wall",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "Spot hit for defending team",
      "N/A",
      "N/A",
    ],
    [
      "Missed goal – first play violation by attacking team",
      "Penalty 5.b for defending team",
      "Penalty 5.b for defending team",
      "Penalty 5.b for defending team",
      "N/A",
      "N/A",
    ],
    [
      "Missed goal – 5 second violation by defending team",
      "Re-hit",
      "Re-hit",
      "Re-hit",
      "N/A",
      "N/A",
    ],
  ],
};

const outdoorHandicapMatrix: OfficialStructuredTable = {
  columns: [
    "Net difference in Team Handicaps",
    "2 periods",
    "3 periods",
    "4 periods",
    "5 periods",
    "6 periods",
  ],
  rows: [
    ["0", "0", "0", "0", "0", "0"],
    [".5", ".5", ".5", ".5", ".5", ".5"],
    ["1.0", ".5", ".5", ".5", ".5", "1.0"],
    ["1.5", ".5", ".5", "1.0", "1.5", "1.5"],
    ["2.0", ".5", "1.0", "1.5", "1.5", "2.0"],
    ["2.5", ".5", "1.5", "1.5", "2.5", "2.5"],
    ["3.0", "1.0", "1.5", "2.0", "2.5", "3.0"],
    ["3.5", "1.5", "1.5", "2.5", "2.5", "3.5"],
    ["4.0", "1.5", "2.0", "2.5", "3.5", "4.0"],
  ],
};

const arenaHandicapMatrix: OfficialStructuredTable = {
  columns: [
    "Net difference in Team Handicaps",
    "Two 7.5 minute periods / Three 5 minute periods",
    "Four 7.5 minute periods / Six 5 minute periods",
  ],
  rows: [
    ["1", ".5", "1"],
    ["2", "1", "2"],
    ["3", "1.5", "3"],
    ["4", "2", "4"],
    ["5", "2.5", "5"],
    ["6", "3", "6"],
  ],
};

const heatIndexSummary: OfficialStructuredTable = {
  columns: ["Category", "Heat Index"],
  rows: [
    ["Caution", "80–90"],
    ["Extreme Caution", "91–103"],
    ["Danger", "103–124"],
    ["Extreme Danger", "126+"],
  ],
};

const TABLES: Record<string, OfficialStructuredTable> = {
  "umpire-guide-outdoor-rules-misexecution-of-penalty-shots-knock-ins": outdoorMisexecution,
  "umpire-guide-arena-rules-misexecution-of-penalty-shots": arenaMisexecution,
  "umpire-guide-outdoor-handicap-matrix": outdoorHandicapMatrix,
  "umpire-guide-arena-handicap-matrix": arenaHandicapMatrix,
  "policies-noaa-s-national-weather-service-heat-index-chart": heatIndexSummary,
};

export function getOfficialStructuredTable(sourceKey?: string) {
  return sourceKey ? TABLES[sourceKey] ?? null : null;
}


const SOURCE_NOTICES: Record<string, { en: string; es: string }> = {
  "policies-henneke-body-condition-score-chart": {
    en: "This source page is a visual chart in the Rulebook. The current extracted text does not contain reliable chart data, so the app does not display the broken extraction.",
    es: "Esta página es un cuadro visual del Rulebook. La extracción actual no contiene datos confiables del cuadro, por eso la app no muestra el texto roto.",
  },
};

export function getOfficialSourceNotice(sourceKey?: string) {
  return sourceKey ? SOURCE_NOTICES[sourceKey] ?? null : null;
}
