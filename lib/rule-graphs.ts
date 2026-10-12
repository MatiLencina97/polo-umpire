import type { ChoiceValue, Discipline, Language, Rule, RuleDb } from "./types";
import { normalize, scoreRule } from "./engine";

export type CaseFactValue = string | number | null;

export type CaseFactDefinition = {
  key: string;
  labelEn: string;
  labelEs: string;
  whyEn: string;
  whyEs: string;
  kind: "choice" | "number" | "text";
  options?: Array<[ChoiceValue, string, string]>;
  critical?: boolean;
};

export type RuleGraphFamily = {
  id: string;
  discipline: Discipline;
  titleEn: string;
  titleEs: string;
  rules: string[];
  relatedRules?: string[];
  external: string[];
  terms: string[];
  facts: CaseFactDefinition[];
};

const ynu: Array<[ChoiceValue, string, string]> = [
  ["yes", "Yes", "Sí"],
  ["no", "No", "No"],
  ["unknown", "Not sure", "No estoy seguro"],
];

const fact = (
  key: string,
  labelEn: string,
  labelEs: string,
  whyEn: string,
  whyEs: string,
  kind: CaseFactDefinition["kind"] = "choice",
  options: CaseFactDefinition["options"] = ynu,
  critical = true,
): CaseFactDefinition => ({ key, labelEn, labelEs, whyEn, whyEs, kind, options: kind === "choice" ? options : undefined, critical });

export const ruleGraphFamilies: RuleGraphFamily[] = [
  {
    id: "outdoor-team-eligibility", discipline: "outdoor",
    titleEn: "Teams, players & substitutions", titleEs: "Equipos, jugadores y sustituciones",
    rules: ["1","2","3"], relatedRules: ["21","33"],
    external: ["Tournament Conditions", "Constitution / By-Laws"],
    terms: ["team","roster","player","substitute","substitution","alternate","handicap","american player","sponsor","eligibility","injury","equipo","jugador","sustituto","reemplazo","nacionalidad"],
    facts: [
      fact("eventClassification","Event classification","Clasificación del Event","Event type can change eligibility and Tournament Conditions.","El tipo de Event puede cambiar elegibilidad y Tournament Conditions.","choice",[["uspa","USPA Event","USPA Event"],["npc","NPC Event","NPC Event"],["club","Club Event","Club Event"],["unknown","Not sure","No estoy seguro"]]),
      fact("drawRosterStatus","Draw / roster status","Estado del draw / roster","Roster timing can change team-handicap and eligibility treatment.","El momento del roster/draw puede cambiar el tratamiento de handicap y elegibilidad."),
      fact("membershipStatus","Player membership / credentials","Membresía / credenciales del jugador","Rule 2 eligibility depends on current credentials and membership status.","La elegibilidad de Rule 2 depende de credenciales y membresía vigentes."),
      fact("suspensionStatus","Current suspension","Suspensión vigente","A current suspension is an eligibility issue.","Una suspensión vigente es una cuestión de elegibilidad."),
      fact("playedOtherTeam","Played for another team in the Event","Jugó para otro equipo en el Event","Rule 2 generally restricts playing for more than one team in an Event.","Rule 2 en general restringe jugar para más de un equipo en un Event."),
      fact("sponsorStructure","Sponsor structure","Estructura del sponsor","The American Rule count changes with playing vs non-playing sponsor structure.","El conteo de American Players cambia según el sponsor sea playing o non-playing.","choice",[["playing","Playing sponsor","Playing sponsor"],["nonplaying","Non-playing sponsor","Non-playing sponsor"],["unknown","Not sure","No estoy seguro"]]),
      fact("americanPlayerStatus","American Player status","Status de American Player","Rule 1.f uses a defined USPA membership status, not passport alone.","Rule 1.f usa un status de membresía USPA definido, no sólo el pasaporte."),
      fact("eventUpperLimit","Event upper handicap limit","Límite superior de handicap","Individual and aggregate handicap limits depend on the Event ceiling.","Los límites individuales y agregados dependen del máximo del Event.","number",undefined),
      fact("substitutionTiming","When the change occurs","Momento de la sustitución","Between-period and in-period substitutions follow different conditions.","Las sustituciones entre períodos y durante el período tienen condiciones distintas."),
    ],
  },
  {
    id: "outdoor-equipment-mounts", discipline: "outdoor",
    titleEn: "Player equipment, mounts & tack", titleEs: "Equipo del jugador, caballos y aperos",
    rules: ["4","5","6"], relatedRules: ["33"],
    external: ["Tournament Conditions", "Equine Medication Rules", "Equine Welfare Policies"],
    terms: ["helmet","equipment","mount","horse","pony","tack","spur","whip","bandage","shoe","mallet equipment","casco","caballo","montura","aperos","espuelas"],
    facts: [
      fact("equipmentItem","Equipment or tack involved","Elemento de equipo o apero involucrado","The applicable requirement depends on the specific item.","El requisito aplicable depende del elemento específico.","text",undefined),
      fact("safetyCondition","Is there a safety defect or dangerous condition?","¿Hay un defecto de seguridad o condición peligrosa?","Unsafe equipment or a horse-safety issue can change whether play may continue.","Un problema de seguridad del equipo o del caballo puede cambiar si se puede continuar."),
      fact("mountCondition","Condition of the mount","Condición del caballo","Lameness, blindness, fatigue or other mount conditions may trigger different provisions.","Cojera, ceguera, fatiga u otras condiciones del caballo pueden activar disposiciones distintas.","text",undefined),
      fact("medicationIssue","Medication / prohibited substance issue","Cuestión de medicación / sustancia","Medication issues are governed by a separate Equine Medication section.","Las cuestiones de medicación se rigen por una sección separada de Equine Medication."),
      fact("eventSpecificEquipment","Event-specific equipment condition","Condición específica de equipo del Event","Tournament Conditions may impose or modify equipment requirements.","Las Tournament Conditions pueden imponer o modificar requisitos de equipo.", "choice", ynu, false),
    ],
  },
  {
    id: "outdoor-officials-administration", discipline: "outdoor",
    titleEn: "Tournament administration, officials & protests", titleEs: "Administración, oficiales y protestas",
    rules: ["7","8","9","10","11"], relatedRules: ["2","12","17","19","26","26A","33","37"],
    external: ["Tournament Conditions", "Umpire Guide", "Policies", "Constitution / By-Laws"],
    terms: ["committee","umpire","referee","goal judge","timekeeper","scorer","protest","variance","official","host tournament committee","comite","árbitro","protesta"],
    facts: [
      fact("officialRole","Official / committee role involved","Rol del oficial / comité involucrado","Authority differs among Umpires, Referee, Host Tournament Committee and other officials.","La autoridad difiere entre Umpires, Referee, Host Tournament Committee y otros oficiales.","text",undefined),
      fact("issueTiming","When did the issue arise?","¿Cuándo surgió el problema?","Timing can determine who has authority and whether a protest or correction is still available.","El momento puede determinar quién tiene autoridad y si aún existe protesta/corrección.","text",undefined),
      fact("formalProtest","Is this a formal protest or an on-field ruling?","¿Es una protesta formal o una decisión en cancha?","Formal protests and field rulings use different procedures.","Las protestas formales y las decisiones en cancha usan procedimientos distintos."),
      fact("varianceApproved","Was a rule variance/deviation approved?","¿Fue aprobada una variación/desvío de reglas?","Approved variations can change the otherwise applicable rule.","Las variaciones aprobadas pueden cambiar la regla aplicable."),
      fact("eventConditionsKnown","Are the Event Tournament Conditions available?","¿Están disponibles las Tournament Conditions del Event?","Tournament Conditions can supersede Outdoor/Arena Rules for Association Events.","Las Tournament Conditions pueden prevalecer sobre Outdoor/Arena Rules en Association Events."),
    ],
  },
  {
    id: "outdoor-match-structure", discipline: "outdoor",
    titleEn: "Field, periods, game format & scoring", titleEs: "Cancha, períodos, formato y tanteador",
    rules: ["12","13","14","15","16","17","18","19"], relatedRules: ["22"],
    external: ["Tournament Conditions"],
    terms: ["field","period","chukker","clock","game","round robin","goal","score","handicap goal","overtime","cancha","periodo","chukker","reloj","gol","empate"],
    facts: [
      fact("matchFormat","Game / Event format","Formato de partido / Event","Round robin, standard game and special Event formats can use different procedures.","Round robin, partido estándar y formatos especiales pueden usar procedimientos diferentes.","text",undefined),
      fact("periodNumber","Period / chukker involved","Período / chukker involucrado","Some timing and restart rules depend on the period.","Algunas reglas de tiempo y reanudación dependen del período.","number",undefined),
      fact("clockState","Clock state","Estado del reloj","Running, stopped and final-period situations can produce different outcomes.","Reloj corriendo, detenido y situaciones de último período pueden producir resultados distintos.","text",undefined),
      fact("scoreState","Score / tie state","Tanteador / estado de empate","Winning, handicap goals and overtime depend on the score state.","Victoria, goles de handicap y overtime dependen del tanteador.","text",undefined),
      fact("specialTournamentFormat","Special Tournament Condition format?","¿Hay formato especial por Tournament Conditions?","Event conditions can alter scheduling, format and handicap-goal treatment.","Las condiciones del Event pueden alterar programación, formato y tratamiento de goles de handicap."),
    ],
  },
  {
    id: "outdoor-restart-flow", discipline: "outdoor",
    titleEn: "Commencement, interruption & resumption", titleEs: "Comienzo, interrupción y reanudación",
    rules: ["20","21","22"], relatedRules: ["9","12","14","15","35","36","37"],
    external: ["Tournament Conditions", "Umpire Guide"],
    terms: ["start","commence","dead ball","interrupted","resume","throw-in","knock-in","free hit","timeout","injury","restart","play","reanudar","pelota muerta","interrumpir"],
    facts: [
      fact("stoppageReason","Why was play stopped?","¿Por qué se detuvo el juego?","The restart method depends on the cause of the stoppage.","La forma de reanudar depende de la causa de la detención.","text",undefined),
      fact("ballLocation","Where was the ball when play stopped?","¿Dónde estaba la pelota al detenerse?","Field location can control the restart spot or procedure.","La ubicación puede controlar el lugar/procedimiento de reanudación.","text",undefined),
      fact("lastTouch","Who last played/touched the ball?","¿Quién jugó/tocó último la pelota?","Some restart procedures depend on the last play.","Algunas reanudaciones dependen de la última jugada.","text",undefined),
      fact("clockRunning","Was the clock running or stopped?","¿El reloj estaba corriendo o detenido?","Clock treatment is linked to the interruption reason.","El tratamiento del reloj se vincula con la causa de la interrupción."),
      fact("penaltyRestart","Is the restart following a foul/penalty?","¿La reanudación sigue a una falta/penalidad?","Penalty procedures can override the ordinary restart route.","Los procedimientos de penalidad pueden reemplazar la reanudación ordinaria."),
    ],
  },
  {
    id: "outdoor-line-row", discipline: "outdoor",
    titleEn: "Line of the Ball, Right of Way & stopping", titleEs: "Line of the Ball, Right of Way y detenerse",
    rules: ["23","24","25"], relatedRules: ["26","35"],
    external: ["Umpire Guide"],
    terms: ["line of the ball","right of way","row","cross","crossing","stopping on ball","line changed","línea","derecho de paso","cruce","frenar"],
    facts: [
      fact("lineCreatedBy","What created the current Line of the Ball?","¿Qué creó la Line of the Ball actual?","ROW analysis starts from the actual Line of the Ball.","El análisis de ROW parte de la Line of the Ball real.","text",undefined),
      fact("rowHolder","Who had the apparent Right of Way?","¿Quién tenía el aparente Right of Way?","The legality of entry/crossing depends on the ROW holder.","La legalidad del ingreso/cruce depende de quién tenía ROW.","text",undefined),
      fact("lineChanged","Did the line change immediately before the action?","¿Cambió la línea inmediatamente antes de la acción?","A line change affects the time an opponent must be given to clear."),
      fact("riskCreated","Did the action create collision risk or force a check/course change?","¿La acción creó riesgo de colisión u obligó a frenar/cambiar curso?","Speed and distance are central to whether entry/crossing is legal."),
      fact("relativeSpeedDistance","Relative speed and distance","Velocidad y distancia relativas","ROW legality depends on the actual risk created by speed and distance.","La legalidad del ROW depende del riesgo real creado por velocidad y distancia.","text",undefined),
    ],
  },
  {
    id: "outdoor-dangerous-improper", discipline: "outdoor",
    titleEn: "Dangerous riding, blocking & rough play", titleEs: "Dangerous Riding, blocking y juego brusco",
    rules: ["26","26A","27"], relatedRules: ["24","33","35"],
    external: ["Umpire Guide"],
    terms: ["dangerous riding","ride-off","blocking","rough","abusive play","blind side","zigzag","horse balance","bloqueo","juego peligroso","contacto"],
    facts: [
      fact("contactType","Type of contact / maneuver","Tipo de contacto / maniobra","Different dangerous-riding and blocking provisions target different actions.","Distintas disposiciones de dangerous riding y blocking apuntan a maniobras distintas.","text",undefined),
      fact("relativeSpeed","Relative speed","Velocidad relativa","Relative speed is an express dangerous-riding factor.","La velocidad relativa es un factor expreso de dangerous riding.","text",undefined),
      fact("contactAngle","Angle and relative position","Ángulo y posición relativa","Angle and position are express dangerous-riding factors.","Ángulo y posición son factores expresos de dangerous riding.","text",undefined),
      fact("horseBalance","Was a horse knocked off balance?","¿Un caballo perdió el equilibrio?","A horse knocked off balance is a strong indicator under the interpretation."),
      fact("blockingContext","Was this a restart block or open-play slow-can­ter block?","¿Fue bloqueo en restart o bloqueo en juego abierto con slow canter?","Rule 26A applies differently by context.","Rule 26A aplica distinto según el contexto.","text",undefined),
      fact("repeatDangerous","Was the conduct repeated or deliberate?","¿La conducta fue reiterada o deliberada?","Repeated or deliberate conduct can bring Rule 33/34 and penalty escalation into the graph."),
    ],
  },
  {
    id: "outdoor-mallet-actions", discipline: "outdoor",
    titleEn: "Mallet use & other player actions", titleEs: "Uso del mallet y otras acciones del jugador",
    rules: ["28","29","30","31","32"], relatedRules: ["33","35"],
    external: ["Umpire Guide"],
    terms: ["mallet","hook","stroke","dismounted","appeal","carry ball","outside assistance","taco","enganche","desmontado","apelar","asistencia externa"],
    facts: [
      fact("actionType","Action involved","Acción involucrada","Hook, stroke, dismount, appeal, carrying and assistance are governed by different articles.","Hook, stroke, desmontarse, apelar, llevar la pelota y asistencia se rigen por artículos distintos.","text",undefined),
      fact("malletDanger","Did the mallet action create danger?","¿La acción con el mallet creó peligro?","Danger changes both foul analysis and penalty selection."),
      fact("hookPosition","Relative position / side of the hook","Posición relativa / lado del hook","Hook legality depends on relative position and execution.","La legalidad del hook depende de posición relativa y ejecución.","text",undefined),
      fact("appealBehavior","How was the appeal made?","¿Cómo se hizo el reclamo?","An appeal can itself become a conduct issue depending on behavior.","Un reclamo puede convertirse en conducta antideportiva según cómo se haga.","text",undefined),
      fact("outsideHelp","Was outside assistance given?","¿Hubo asistencia externa?","Outside assistance can trigger its own rule and potentially conduct/penalty provisions."),
    ],
  },
  {
    id: "outdoor-conduct", discipline: "outdoor",
    titleEn: "Unsportsmanlike conduct & repeated fouls", titleEs: "Conducta antideportiva y faltas reiteradas",
    rules: ["33","34"], relatedRules: ["26","28","30","35","37"],
    external: ["Tournament Conditions", "Policies", "Sport-Related Conduct Procedures"],
    terms: ["unsportsmanlike","abuse","language","card","yellow","red","repeat foul","misconduct","conducta","insulto","tarjeta","reiterada"],
    facts: [
      fact("conductType","Conduct involved","Conducta involucrada","The rule distinguishes several forms of unsportsmanlike conduct.","La regla distingue distintas formas de conducta antideportiva.","text",undefined),
      fact("deliberateConduct","Was it deliberate?","¿Fue deliberada?","Intent and flagrancy can affect sanction severity."),
      fact("priorWarning","Prior warning/card/foul?","¿Hubo advertencia/tarjeta/falta previa?","Repetition can require escalation under Rule 34."),
      fact("offFieldConduct","Did it occur off the field / after play?","¿Ocurrió fuera de la cancha / después del juego?","Some conduct issues can extend beyond the immediate on-field foul procedure."),
      fact("injuryOrDanger","Did it create danger or injury?","¿Generó peligro o lesión?","Danger/injury can affect both foul characterization and penalty severity."),
    ],
  },
  {
    id: "outdoor-penalties", discipline: "outdoor",
    titleEn: "Penalty selection, procedures & specific penalties", titleEs: "Selección, procedimiento y penalidades específicas",
    rules: ["35","36","37"], relatedRules: ["22","24","26","28","33","34"],
    external: ["Tournament Conditions", "Umpire Guide"],
    terms: ["penalty","penalty 1","penalty 2","penalty 3","penalty 4","penalty 5","penalty 6","penalty 7","penalty 8","penalty 9","selection of penalties","specific penalties","penalidad"],
    facts: [
      fact("foulType","Underlying foul","Falta subyacente","Penalty selection follows the foul that was actually committed.","La selección de penalidad sigue a la falta realmente cometida.","text",undefined),
      fact("dangerDegree","Degree of danger / unfair advantage","Grado de peligro / ventaja injusta","Rule 35 expressly weighs danger and unfair advantage.","Rule 35 pondera expresamente peligro y ventaja injusta.","text",undefined),
      fact("fieldLocation","Location on the field","Ubicación en la cancha","Field location is an express penalty-selection factor.","La ubicación es un factor expreso de selección de penalidad.","text",undefined),
      fact("playerPosition","Position of the players","Posición de los jugadores","Player position is an express penalty-selection factor.","La posición de los jugadores es un factor expreso de selección de penalidad.","text",undefined),
      fact("foulFrequency","Frequency / repetition","Frecuencia / reiteración","Repeated fouls can justify escalation.","Las faltas reiteradas pueden justificar escalamiento.","text",undefined),
      fact("simultaneousFouls","Were fouls simultaneous?","¿Hubo faltas simultáneas?","Simultaneous fouls can alter the restart/penalty procedure."),
    ],
  },

  {
    id: "arena-facilities-equipment", discipline: "arena",
    titleEn: "Facilities, mounts & equipment", titleEs: "Instalaciones, caballos y equipo",
    rules: ["1","2"], relatedRules: ["3","16"],
    external: ["Tournament Conditions", "Alternative Format Arena Conditions", "Equine Medication Rules"],
    terms: ["arena","facility","wall","mount","equipment","tack","beach polo","snow polo","stadium","instalacion","caballo","equipo"],
    facts: [
      fact("arenaFormat","Standard or alternative-format arena?","¿Arena estándar o formato alternativo?","Alternative-format conditions can replace corresponding Arena provisions.","Las condiciones de formato alternativo pueden reemplazar disposiciones Arena correspondientes.","choice",[["standard","Standard arena","Arena estándar"],["alternative","Alternative format","Formato alternativo"],["unknown","Not sure","No estoy seguro"]]),
      fact("facilityIssue","Facility condition involved","Condición de la instalación","The exact facility requirement depends on the issue.","El requisito exacto depende del problema.","text",undefined),
      fact("equipmentIssue","Mount/equipment issue","Problema de caballo/equipo","Mount and tack conditions can affect safety and eligibility to continue.","Las condiciones del caballo y aperos pueden afectar seguridad y continuidad.","text",undefined),
      fact("medicationIssue","Medication issue?","¿Hay cuestión de medicación?","Equine Medication Rules are a separate controlling section."),
    ],
  },
  {
    id: "arena-players-officials", discipline: "arena",
    titleEn: "Players, alternates, handicaps & officials", titleEs: "Jugadores, alternates, handicaps y oficiales",
    rules: ["3","4","17","18"], relatedRules: ["16"],
    external: ["Tournament Conditions", "Umpire Guide", "Constitution / By-Laws"],
    terms: ["alternate","substitute","player","official","umpire","referee","handicap","protest","jugador","sustituto","oficial","protesta"],
    facts: [
      fact("arenaPlayerEligibility","Player membership / eligibility","Membresía / elegibilidad del jugador","Arena alternates must also satisfy player eligibility rules.","Los alternates de Arena también deben satisfacer reglas de elegibilidad."),
      fact("arenaTeamHandicap","Team and candidate handicap","Handicap del equipo y candidato","Arena substitution and scoring can depend on aggregate and individual handicap.","Sustitución y scoring de Arena pueden depender del handicap agregado e individual.","text",undefined),
      fact("arenaSubTiming","Timing / reason for alternate","Momento / motivo del alternate","In-period and between-period alternate rules differ.","Las reglas de alternate durante y entre períodos difieren.","text",undefined),
      fact("arenaOfficialRole","Official / protest authority involved","Autoridad oficial / protesta involucrada","Authority and protest routes depend on role and timing.","La autoridad y ruta de protesta dependen del rol y momento.","text",undefined),
      fact("arenaEventConditions","Applicable Tournament Conditions","Tournament Conditions aplicables","Event conditions may modify Arena procedures.","Las condiciones del Event pueden modificar procedimientos Arena."),
    ],
  },
  {
    id: "arena-periods-scoring", discipline: "arena",
    titleEn: "Periods, round robins & scoring", titleEs: "Períodos, round robins y scoring",
    rules: ["5","5A","6"], relatedRules: ["8","9"],
    external: ["Tournament Conditions"],
    terms: ["period","round robin","score","goal","handicap goal","tie","overtime","periodo","gol","empate"],
    facts: [
      fact("arenaFormatType","Game format","Formato de juego","Standard, round-robin and special formats can use different timing/scoring procedures.","Formatos estándar, round robin y especiales pueden usar tiempos/scoring distintos.","text",undefined),
      fact("arenaPeriod","Period involved","Período involucrado","Period number/timing may affect the procedure.","El número/momento del período puede afectar el procedimiento.","number",undefined),
      fact("arenaScore","Score and handicap state","Tanteador y handicap","Scoring questions require the current score/handicap context.","Las cuestiones de scoring requieren contexto de tanteador/handicap.","text",undefined),
      fact("arenaTie","Is the game tied at regulation?","¿El partido está empatado al final?","Tie procedures depend on the format."),
    ],
  },
  {
    id: "arena-deadball-resumption", discipline: "arena",
    titleEn: "Dead ball, resumption & interruption", titleEs: "Dead ball, reanudación e interrupción",
    rules: ["7","8","16"], relatedRules: ["9","10"],
    external: ["Tournament Conditions", "Umpire Guide"],
    terms: ["dead ball","resume","commence","interruption","timeout","injury","bowl-in","free hit","pelota muerta","reanudar","interrupcion"],
    facts: [
      fact("arenaStopReason","Why did play stop?","¿Por qué se detuvo el juego?","The restart depends on the stoppage reason.","La reanudación depende de la causa.","text",undefined),
      fact("arenaBallSpot","Ball / player position at stoppage","Posición de pelota/jugadores al detenerse","Position can change the restart.","La posición puede cambiar la reanudación.","text",undefined),
      fact("arenaPenaltyRestart","Was the stoppage caused by a foul/penalty?","¿La detención fue por falta/penalidad?","Penalty restart rules may control instead of ordinary dead-ball rules."),
      fact("arenaClock","Clock status","Estado del reloj","Clock treatment depends on the interruption.","El tratamiento del reloj depende de la interrupción.","text",undefined),
    ],
  },
  {
    id: "arena-penalties", discipline: "arena",
    titleEn: "Arena penalties & penalty selection", titleEs: "Penalidades Arena y selección de penalidad",
    rules: ["9","10"], relatedRules: ["6","11","13","14","15","16"],
    external: ["Umpire Guide", "Tournament Conditions"],
    terms: ["arena penalty","penalty","selection of penalty","foul","penalidad","falta"],
    facts: [
      fact("arenaUnderlyingFoul","Underlying foul","Falta subyacente","Penalty selection starts with the actual violation.","La selección de penalidad parte de la infracción real.","text",undefined),
      fact("arenaDanger","Degree of danger / advantage","Grado de peligro / ventaja","Arena Rule 10 also gives discretion based on the circumstances.","Arena Rule 10 también da discreción según las circunstancias.","text",undefined),
      fact("arenaLocation","Location in the arena","Ubicación en la arena","Position/location can change available penalties.","La posición/ubicación puede cambiar las penalidades disponibles.","text",undefined),
      fact("arenaRepeat","Repeated foul?","¿Falta reiterada?","Repetition can escalate sanction."),
    ],
  },
  {
    id: "arena-line-row", discipline: "arena",
    titleEn: "Line of the Ball & Right of Way", titleEs: "Line of the Ball y Right of Way",
    rules: ["11","12"], relatedRules: ["13","10"],
    external: ["Umpire Guide"],
    terms: ["line of the ball","right of way","row","cross","crossing","linea","cruce"],
    facts: [
      fact("arenaLine","Current Line of the Ball","Line of the Ball actual","ROW starts from the actual line.","ROW parte de la línea real.","text",undefined),
      fact("arenaRowHolder","Apparent ROW holder","Aparente titular del ROW","Crossing/entry depends on who held ROW.","Cruce/ingreso depende de quién tenía ROW.","text",undefined),
      fact("arenaRisk","Risk / forced check","Riesgo / frenada forzada","Risk is central to ROW infringement."),
      fact("arenaLineChange","Did the line change?","¿Cambió la línea?","A change can affect clearance time."),
    ],
  },
  {
    id: "arena-dangerous", discipline: "arena",
    titleEn: "Dangerous riding & improper play", titleEs: "Dangerous Riding e improper play",
    rules: ["13"], relatedRules: ["12","14","16","10"],
    external: ["Umpire Guide"],
    terms: ["dangerous riding","improper play","ride-off","blocking","contact","peligroso","contacto"],
    facts: [
      fact("arenaContact","Contact / maneuver","Contacto / maniobra","Different improper-play clauses depend on the maneuver.","Distintas cláusulas dependen de la maniobra.","text",undefined),
      fact("arenaSpeedAngle","Speed / angle / position","Velocidad / ángulo / posición","These facts control danger assessment.","Estos hechos controlan la evaluación del peligro.","text",undefined),
      fact("arenaHorseBalance","Horse knocked off balance?","¿Caballo perdió equilibrio?","Balance is a strong danger indicator."),
      fact("arenaDeliberate","Deliberate or repeated?","¿Deliberado o reiterado?","This can connect Rule 13 to conduct and penalty escalation."),
    ],
  },
  {
    id: "arena-conduct", discipline: "arena",
    titleEn: "Unsportsmanlike conduct", titleEs: "Conducta antideportiva",
    rules: ["14"], relatedRules: ["13","10","5"],
    external: ["Tournament Conditions", "Policies", "Sport-Related Conduct Procedures"],
    terms: ["unsportsmanlike","conduct","card","abuse","language","misconduct","conducta","tarjeta","insulto"],
    facts: [
      fact("arenaConductType","Conduct involved","Conducta involucrada","Different conduct can trigger different sanctions.","Distintas conductas pueden activar sanciones distintas.","text",undefined),
      fact("arenaPriorConduct","Prior warning/card?","¿Advertencia/tarjeta previa?","Prior conduct can matter to escalation."),
      fact("arenaOffField","On-field or off-field?","¿En cancha o fuera de cancha?","The applicable process can change by context."),
    ],
  },
  {
    id: "arena-mallet", discipline: "arena",
    titleEn: "Use of the mallet", titleEs: "Uso del mallet",
    rules: ["15"], relatedRules: ["13","10"],
    external: ["Umpire Guide"],
    terms: ["mallet","hook","stroke","taco","enganche"],
    facts: [
      fact("arenaMalletAction","Mallet action","Acción con el mallet","Hook/stroke rules depend on the action.","Las reglas de hook/stroke dependen de la acción.","text",undefined),
      fact("arenaMalletPosition","Relative position / side","Posición relativa / lado","Position determines legality.","La posición determina legalidad.","text",undefined),
      fact("arenaMalletDanger","Danger created?","¿Creó peligro?","Danger connects the mallet rule to penalty selection."),
    ],
  },
];

const familyRuleSet = (family: RuleGraphFamily) => new Set([...(family.rules ?? []), ...(family.relatedRules ?? [])]);

export function graphCoverage(discipline: Discipline) {
  const expected = discipline === "outdoor"
    ? ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","26A","27","28","29","30","31","32","33","34","35","36","37"]
    : ["1","2","3","4","5","5A","6","7","8","9","10","11","12","13","14","15","16","17","18"];
  const covered = new Set(ruleGraphFamilies.filter((family) => family.discipline === discipline).flatMap((family) => family.rules));
  return { covered: expected.filter((rule) => covered.has(rule)), missing: expected.filter((rule) => !covered.has(rule)), total: expected.length };
}

function familyScore(family: RuleGraphFamily, query: string, seedRules: string[]) {
  const n = normalize(query);
  let score = 0;
  for (const rule of seedRules) if (familyRuleSet(family).has(rule)) score += 18;
  for (const term of family.terms) if (n.includes(normalize(term))) score += term.includes(" ") ? 5 : 3;
  return score;
}

function extractRuleRefs(rule: Rule) {
  const refs = new Set<string>();
  for (const match of rule.text.matchAll(/\bRule\s+(\d+[A-Za-z]?)/g)) refs.add(match[1]);
  return [...refs].filter((value) => value !== rule.rule);
}

function isMissing(value: CaseFactValue | undefined) {
  return value === undefined || value === null || value === "" || value === "unknown";
}

export function buildUniversalRuleGraph(args: {
  db: RuleDb;
  discipline: Discipline;
  query: string;
  seedRules?: string[];
  facts: Record<string, CaseFactValue>;
  language: Language;
}) {
  const { db, discipline, query, facts, language } = args;
  let seedRules = args.seedRules ?? [];
  if (!seedRules.length && query.trim()) {
    seedRules = db.rules
      .filter((rule) => rule.discipline === discipline)
      .map((rule) => ({ rule: rule.rule, score: scoreRule(rule, query) }))
      .filter((item) => item.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0,3)
      .map((item) => item.rule);
  }

  const families = ruleGraphFamilies
    .filter((family) => family.discipline === discipline)
    .map((family) => ({ family, score: familyScore(family, query, seedRules) }))
    .sort((a,b) => b.score - a.score);

  const family = families[0]?.family ?? ruleGraphFamilies.find((item) => item.discipline === discipline)!;
  const ruleMap = new Map(db.rules.filter((rule) => rule.discipline === discipline).map((rule) => [rule.rule, rule]));
  const nodeRules = new Set<string>([...family.rules, ...(family.relatedRules ?? []), ...seedRules]);

  for (const number of [...nodeRules]) {
    const rule = ruleMap.get(number);
    if (!rule) continue;
    for (const ref of extractRuleRefs(rule)) if (ruleMap.has(ref)) nodeRules.add(ref);
  }

  const rules = [...nodeRules].map((number) => ruleMap.get(number)).filter(Boolean) as Rule[];
  const edges: Array<{ from: string; to: string; kind: "family" | "reference" | "external" }> = [];
  for (let i=1;i<family.rules.length;i++) edges.push({from:"rule-"+family.rules[i-1],to:"rule-"+family.rules[i],kind:"family"});
  for (const rule of rules) for (const ref of extractRuleRefs(rule)) if (nodeRules.has(ref)) edges.push({from:"rule-"+rule.rule,to:"rule-"+ref,kind:"reference"});
  for (const external of family.external) {
    const anchor = family.rules[0];
    edges.push({from:"rule-"+anchor,to:"external-"+normalize(external).replace(/[^a-z0-9]+/g,"-"),kind:"external"});
  }

  const criticalFacts = family.facts.filter((item) => item.critical !== false);
  const optionalFacts = family.facts.filter((item) => item.critical === false);
  const missingFacts = criticalFacts.filter((item) => isMissing(facts[item.key]));
  const completedFacts = family.facts.filter((item) => !isMissing(facts[item.key]));

  const enrichedQuery = [
    query,
    ...completedFacts.map((item) => item.labelEn + ": " + String(facts[item.key])),
  ].join(" ");

  const evidenceRules = db.rules
    .filter((rule) => rule.discipline === discipline)
    .map((rule) => ({ rule, score: scoreRule(rule, enrichedQuery) + (nodeRules.has(rule.rule) ? 4 : 0) }))
    .filter((item) => item.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0,6)
    .map((item) => item.rule);

  return {
    family,
    families: families.slice(0,3),
    rules,
    edges,
    external: family.external,
    missingFacts,
    optionalFacts,
    completedFacts,
    evidenceRules,
    coverage: graphCoverage(discipline),
    label: language === "en" ? family.titleEn : family.titleEs,
  };
}

export function factLabel(item: CaseFactDefinition, language: Language) {
  return language === "en" ? item.labelEn : item.labelEs;
}
export function factWhy(item: CaseFactDefinition, language: Language) {
  return language === "en" ? item.whyEn : item.whyEs;
}
export function factOptionLabel(option: [ChoiceValue,string,string], language: Language) {
  return language === "en" ? option[1] : option[2];
}
