import type { TopicId } from "./types";

const stopWords = new Set([
  "a","an","and","at","after","before","by","for","from","he","her","hers","him","his","in","into","is","it","of","on","or","she","the","their","them","they","to","was","were","with",
  "al","con","de","del","el","en","la","las","lo","los","por","que","se","su","un","una","y",
  "blue","red","player","jugador","jugadora","opponent","oponente","rival","team","equipo","ball",
]);

const tokenAliases: Record<string, string> = {
  ponies: "horse",
  pony: "horse",
  mount: "horse",
  mounts: "horse",
  caballo: "horse",
  caballos: "horse",
  petiso: "horse",
  petisos: "horse",
  bocha: "ball",
  pelota: "ball",
  pelotas: "ball",
  taco: "mallet",
  tacos: "mallet",
  stick: "mallet",
  malet: "mallet",
  malett: "mallet",
  ump: "umpire",
  umpier: "umpire",
  umpirre: "umpire",
  referee: "umpire",
  ref: "umpire",
  arbitro: "umpire",
  juez: "umpire",
  crossed: "cross",
  crosses: "cross",
  crossing: "cross",
  cruzo: "cross",
  cruza: "cross",
  cruzando: "cross",
  cruzar: "cross",
  blocked: "block",
  blocks: "block",
  blocking: "block",
  bloqueo: "block",
  bloquea: "block",
  bloquear: "block",
  screened: "screen",
  screens: "screen",
  screening: "screen",
  picked: "pick",
  picks: "pick",
  picking: "pick",
  marked: "mark",
  marks: "mark",
  marking: "mark",
  marcar: "mark",
  hooked: "hook",
  hooks: "hook",
  hooking: "hook",
  hookeo: "hook",
  engancho: "hook",
  swing: "swing",
  swung: "swing",
  argued: "argue",
  arguing: "argue",
  argues: "argue",
  protesto: "protest",
  protesta: "protest",
  protestando: "protest",
  appealed: "appeal",
  appealing: "appeal",
  yelled: "yell",
  shouted: "yell",
  grito: "yell",
  insulto: "abuse",
  puteo: "abuse",
  abusive: "abuse",
  abused: "abuse",
  closed: "close",
  closes: "close",
  route: "line",
  path: "line",
  unbalanced: "balance",
  outside: "out",
  area: "field",
  stopped: "stop",
  stops: "stop",
  detuvo: "stop",
  paro: "stop",
  went: "go",
  goes: "go",
  salio: "out",
  sale: "out",
  afuera: "out",
  rolled: "roll",
  rolls: "roll",
  lost: "lose",
  loses: "lose",
  perdio: "lose",
  pierde: "lose",
  bumped: "bump",
  choque: "collision",
  choco: "collision",
  collided: "collision",
  forced: "force",
  forcing: "force",
  forces: "force",
  shut: "close",
  obliga: "force",
  obligo: "force",
  hizo: "force",
  frenar: "check",
  freno: "check",
  checking: "check",
  checked: "check",
  dangerous: "danger",
  peligroso: "danger",
  peligrosa: "danger",
  boards: "board",
  tablas: "board",
  tabla: "board",
};

const phraseAliases: Array<[RegExp, string]> = [
  [/\bright of way\b/g, " row "],
  [/\bline of the ball\b/g, " line "],
  [/\bline of ball\b/g, " line "],
  [/\bright away\b/g, " row "],
  [/\bride[- ]?off\b/g, " rideoff "],
  [/\brideof\b/g, " rideoff "],
  [/\bpull(?:ed|s|ing)? up\b/g, " check "],
  [/\bslow(?:ed|s|ing)? down\b/g, " check "],
  [/\bchange(?:d|s|ing)? course\b/g, " change_course "],
  [/\bturn(?:ed|s|ing)? away\b/g, " change_course "],
  [/\bside line\b/g, " sideline "],
  [/\blinea lateral\b/g, " sideline "],
  [/\bend line\b/g, " endline "],
  [/\bfree hit\b/g, " freehit "],
  [/\bknock[- ]?in\b/g, " knockin "],
  [/\bthrow[- ]?in\b/g, " throwin "],
  [/\bdead ball\b/g, " deadball "],
  [/\bblind[- ]?side\b/g, " blindside "],
  [/\byellow card\b/g, " yellowcard "],
  [/\bred card\b/g, " redcard "],
  [/\bverbal abuse\b/g, " abuse "],
  [/\bmallet head\b/g, " mallet "],
  [/\bse le cruzo\b/g, " cross "],
  [/\bse cruzo adelante\b/g, " cross ahead "],
  [/\ble corto el paso\b/g, " cut off "],
  [/\ble cerro la linea\b/g, " close line "],
  [/\ble corto la linea\b/g, " cut line "],
  [/\ble hizo pantalla\b/g, " screen defender "],
  [/\ble puso una pantalla\b/g, " screen defender "],
  [/\bno lo dejo marcar\b/g, " prevent defender mark "],
  [/\bno la dejo marcar\b/g, " prevent defender mark "],
  [/\bperdio el equilibrio\b/g, " lose balance "],
  [/\bpierde el equilibrio\b/g, " lose balance "],
];

function baseNormalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalPlayText(value: string) {
  let text = baseNormalize(value);
  for (const [pattern, replacement] of phraseAliases) text = text.replace(pattern, replacement);
  text = text.trim().replace(/\s+/g, " ");

  return text
    .split(" ")
    .filter(Boolean)
    .map((token) => tokenAliases[token] ?? token)
    .join(" ");
}

function featureSet(value: string) {
  const canonical = canonicalPlayText(value);
  const tokens = canonical
    .split(" ")
    .filter((token) => token && !stopWords.has(token));

  const features = new Set<string>();
  for (const token of tokens) features.add(token);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    features.add(tokens[index] + "::" + tokens[index + 1]);
  }
  return features;
}

const playLanguageExamples: Record<TopicId, string[]> = {
  row: [
    "Red cut Blue off and forced him to check",
    "A player crossed in front of the ROW holder and he had to pull up",
    "Red rode into Blue's line and made him change course",
    "The player closed the line and the opponent had to check",
    "Se le cruzo adelante y lo obligo a frenar",
    "Le cerro la linea y lo hizo cambiar de rumbo",
    "Entro en su trayectoria y tuvo que desviarse",
    "Crossed the right of way too close and forced a check",
  ],
  dangerous: [
    "Hard ride off knocked the pony off balance",
    "Blind side contact at speed",
    "Came into the opponent at a steep angle",
    "Heavy collision displaced the horse",
    "Lo choco fuerte de costado",
    "El petiso perdio el equilibrio por el contacto",
    "Entro a mucha velocidad y hubo riesgo para el caballo",
    "Dangerous bump from behind",
  ],
  blocking: [
    "Attacker screened the defender to free a teammate",
    "Picked off the defender so the teammate could play",
    "Prevented the defender from marking the teammate",
    "Rode between defender and teammate and kept him away",
    "Le hizo pantalla al defensor para liberar al companero",
    "No lo dejo marcar a su companero",
    "Bloqueo al defensor para que no llegue a la pelota",
    "Set a pick on the defending player",
  ],
  mallet: [
    "Hooked from the wrong side",
    "Hook went under the opponent's horse",
    "Mallet struck the pony",
    "Swing passed dangerously close to the horse",
    "Reached across the horse to hook",
    "Hookeo del lado equivocado",
    "El taco toco al caballo rival",
    "El swing paso cerca del petiso",
  ],
  conduct: [
    "Argued with the umpire after the call",
    "Yelled abuse at the official",
    "Continued appealing to the umpire",
    "Hit the ball after the whistle",
    "Le grito al arbitro y siguio protestando",
    "Insulto al umpire",
    "Siguio discutiendo con el juez",
    "Golpeo despues del silbato",
  ],
  restart: [
    "Ball went out over the boards",
    "Ball crossed the sideline",
    "Ball crossed the end line",
    "Whistle stopped play",
    "Ball left the playing area",
    "Knock in before the umpire called Play",
    "La bocha salio por las tablas",
    "La pelota se fue por el lateral",
    "El arbitro detuvo el juego",
  ],
};

function diceSimilarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  if (overlap < 2) return 0;
  return (2 * overlap) / (left.size + right.size);
}

export function playPrototypeScore(value: string, topic: TopicId) {
  const input = featureSet(value);
  if (input.size < 2) return 0;

  let best = 0;
  for (const example of playLanguageExamples[topic]) {
    best = Math.max(best, diceSimilarity(input, featureSet(example)));
  }

  if (best >= 0.72) return 5;
  if (best >= 0.58) return 4;
  if (best >= 0.46) return 3;
  if (best >= 0.36) return 2;
  return 0;
}

const negativeContext: Partial<Record<TopicId, RegExp[]>> = {
  restart: [
    /\bball (?:did not|didnt|never) (?:go|roll|cross) out\b/,
    /\bball (?:stayed|remained) (?:in|inside|in play)\b/,
    /\bball never left the field\b/,
    /\b(?:no salio|no se fue) afuera\b/,
    /\b(?:siguio|quedo) (?:adentro|en juego)\b/,
  ],
  row: [
    /\bdid not cross (?:the )?(?:line|row)\b/,
    /\bno (?:se )?cruzo\b/,
    /\bno (?:lo|la) obligo a (?:frenar|desviar)\b/,
  ],
  blocking: [
    /\bdid not block\b/,
    /\bwas not blocked\b/,
    /\bdefender was free to mark\b/,
    /\bno hubo bloqueo\b/,
    /\blo dejo marcar\b/,
    /\bla dejo marcar\b/,
  ],
  mallet: [
    /\bdid not hook\b/,
    /\bno hook\b/,
    /\bwithout (?:a )?hook\b/,
    /\bmallet was not involved\b/,
    /\bno uso (?:el )?(?:taco|mallet)\b/,
    /\bsin hook\b/,
  ],
  conduct: [
    /\bdid not (?:argue|appeal|protest|yell)\b/,
    /\bno (?:protesto|discutio|grito|insulto)\b/,
  ],
};

export function playTopicContextPenalty(value: string, topic: TopicId) {
  const raw = baseNormalize(value);
  const canonical = canonicalPlayText(value);
  const patterns = negativeContext[topic] ?? [];
  return patterns.some((pattern) => pattern.test(raw) || pattern.test(canonical)) ? -8 : 0;
}
