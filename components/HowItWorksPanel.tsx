"use client";

import type {
  ExternalResource,
  ExternalResourceDb,
  ExternalSection,
  Language,
  RuleDb,
} from "@/lib/types";
import type { RuleProvision } from "@/lib/subarticles";
import { getProvision } from "@/lib/subarticles";
import { externalMatchesForLabels } from "@/lib/external-resources";

type Metrics = {
  total: number;
  examples: number;
  interpretations: number;
  rulesWithGuidance: number;
};

type Props = {
  language: Language;
  db: RuleDb;
  externalDb: ExternalResourceDb | null;
  rulebookVersion: string;
  metrics: Metrics | null;
  onOpenProvision: (provision: RuleProvision) => void;
  onOpenExternal: (resource: ExternalResource, section: ExternalSection | null) => void;
};

export default function HowItWorksPanel({
  language,
  db,
  externalDb,
  rulebookVersion,
  metrics,
  onOpenProvision,
  onOpenExternal,
}: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;

  function openProvision(ref: string) {
    const provision = getProvision(db, "outdoor", ref);
    if (provision) onOpenProvision(provision);
  }

  const tcMatch = externalMatchesForLabels(
    externalDb,
    ["Tournament Conditions"],
    "Tournament Conditions event eligibility rules supersede playing rules",
    1,
  )[0];

  const examples = [
    {
      title: tr("Right of Way / Crossing", "Right of Way / Crossing"),
      text: tr(
        "The app separates Line of the Ball, ROW entitlement, crossing risk and line-change clearance instead of treating them as one rule.",
        "La app separa Line of the Ball, titularidad del ROW, riesgo del cruce y despeje después de un cambio de línea, en vez de tratarlos como una sola regla.",
      ),
      refs: ["23", "24.b", "24.c", "24.d", "24.f"],
    },
    {
      title: tr("Dangerous Riding", "Dangerous Riding"),
      text: tr(
        "A strong explicit indicator can support a direct branch, but the absence of a few danger factors is never converted into an automatic no-foul.",
        "Un indicador fuerte y expreso puede respaldar una rama directa, pero la ausencia de algunos factores de peligro nunca se convierte automáticamente en no-foul.",
      ),
      refs: ["26.a", "26.e", "35.b"],
    },
    {
      title: tr("Substitution eligibility", "Elegibilidad de sustituciones"),
      text: tr(
        "The assistant checks substitution timing and handicap together with player eligibility, the American Rule and event-specific governing conditions.",
        "El asistente controla timing y handicap de la sustitución junto con elegibilidad del jugador, American Rule y condiciones específicas del evento.",
      ),
      refs: ["3", "2.d", "1.f"],
    },
    {
      title: tr("Mallet / Hook responsibility", "Responsabilidad de Mallet / Hook"),
      text: tr(
        "The app distinguishes an illegal/dangerous mallet action from a situation where another player may have ridden into an established stroke and created the danger.",
        "La app distingue una acción ilegal/peligrosa del mallet de una situación en la que otro jugador puede haber entrado en un stroke ya establecido y creado el peligro.",
      ),
      refs: ["28.a", "28.d", "26.h"],
    },
  ];

  return (
    <section className="howItWorks">
      <div className="card howHero">
        <p className="eyebrow">{tr("HOW IT WORKS", "CÓMO FUNCIONA")}</p>
        <h2>{tr("How Umpire Polo Assistant reaches a ruling", "Cómo llega Umpire Polo Assistant a una decisión")}</h2>
        <p className="howHeroLead">{tr(
          "The app is a Rulebook-based decision-support system. It does not replace the Umpire and it does not use an AI opinion as the source of truth. It organizes the facts, applies validated rule branches, shows what is still uncertain, and links every important conclusion back to the installed Rulebook.",
          "La app es un sistema de apoyo a la decisión basado en el Rulebook. No reemplaza al Umpire y no usa una opinión de IA como fuente de verdad. Ordena los hechos, aplica ramas reglamentarias validadas, muestra qué sigue siendo incierto y vincula cada conclusión importante con el Rulebook instalado.",
        )}</p>
        <div className="howAuthority">
          <strong>{tr("The final call always belongs to the Umpire.", "La decisión final siempre corresponde al Umpire.")}</strong>
          <span>{tr(
            "The software can make the reasoning more consistent and auditable; it cannot replace what the Umpire actually saw on the field.",
            "El software puede hacer el razonamiento más consistente y auditable; no puede reemplazar lo que el Umpire realmente vio en la cancha.",
          )}</span>
        </div>
      </div>

      <div className="card howProcessCard">
        <p className="eyebrow">{tr("DECISION PROCESS", "PROCESO DE DECISIÓN")}</p>
        <h2>{tr("From the play to the cited rules", "De la jugada a las reglas citadas")}</h2>
        <div className="howSteps">
          {[
            [tr("1. Describe the play or rule situation", "1. Describí la jugada o situación reglamentaria"), tr(
              "You can type or dictate what happened. The app first identifies the most relevant rule family; it does not make the final call from the free-text description alone.",
              "Podés escribir o dictar lo que ocurrió. La app primero identifica la familia de reglas más relevante; no toma la decisión final sólo desde la descripción libre.",
            )],
            [tr("2. Separate conclusions from physical facts", "2. Separar conclusiones de hechos físicos"), tr(
              "For difficult rules, the assistant asks for facts that can change the result. In Rule 24, for example, it can derive common ROW branches from following/meeting, angle, off-side and two-player relationships.",
              "Para reglas difíciles, el asistente pregunta hechos que pueden cambiar el resultado. En Rule 24, por ejemplo, puede derivar ramas comunes de ROW a partir de following/meeting, ángulo, off-side y relaciones de dos jugadores.",
            )],
            [tr("3. Apply the validated rule branch", "3. Aplicar la rama reglamentaria validada"), tr(
              "The decision engine follows explicit rule logic. It does not generate a new rule or penalty because a language model thinks it sounds reasonable.",
              "El motor de decisión sigue lógica reglamentaria explícita. No genera una regla o penalidad nueva porque un modelo de lenguaje crea que suena razonable.",
            )],
            [tr("4. Check cross-rule and event dependencies", "4. Controlar dependencias entre reglas y del evento"), tr(
              "A question can require several rules at once. Substitution eligibility, for example, can involve Rules 1, 2 and 3 plus Tournament Conditions.",
              "Una consulta puede requerir varias reglas al mismo tiempo. La elegibilidad de una sustitución, por ejemplo, puede involucrar Rules 1, 2 y 3 más Tournament Conditions.",
            )],
            [tr("5. Assign a validation level", "5. Asignar un nivel de validación"), tr(
              "Before presenting a definitive result, the app checks whether the branch has direct rule support, still requires Umpire judgment, or does not yet have enough validated coverage.",
              "Antes de presentar un resultado definitivo, la app controla si la rama tiene apoyo directo de regla, todavía requiere juicio del Umpire o aún no tiene cobertura validada suficiente.",
            )],
            [tr("6. Show the complete rule trail", "6. Mostrar la cadena completa de reglas"), tr(
              "The “Why this decision” section lists every playing-rule provision and governing source needed to understand the conclusion. Every item can be opened directly.",
              "La sección “Por qué esta decisión” enumera cada disposición de juego y fuente de control necesaria para entender la conclusión. Cada elemento puede abrirse directamente.",
            )],
          ].map(([title, text], index) => (
            <article className="howStep" key={index}>
              <span>{index + 1}</span>
              <div>
                <strong>{title.replace(/^\d+\.\s*/, "")}</strong>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="howTwoColumn">
        <div className="card">
          <p className="eyebrow">{tr("VALIDATION LEVELS", "NIVELES DE VALIDACIÓN")}</p>
          <h2>{tr("What the labels actually mean", "Qué significan realmente las etiquetas")}</h2>
          <div className="howValidationList">
            <div className="direct">
              <b>{tr("DIRECT RULE SUPPORT", "APOYO DIRECTO DE REGLA")}</b>
              <p>{tr(
                "The entered facts match a modeled branch that is tied to explicit Rulebook provisions. This is the strongest software result, but it still assumes the Umpire observed and entered the facts correctly.",
                "Los hechos cargados coinciden con una rama modelada ligada a disposiciones expresas del Rulebook. Es el resultado más fuerte del software, pero todavía supone que el Umpire observó y cargó correctamente los hechos.",
              )}</p>
            </div>
            <div className="judgment">
              <b>{tr("UMPIRE JUDGMENT", "JUICIO DEL UMPIRE")}</b>
              <p>{tr(
                "The controlling rules are known, but the Rulebook requires observation, discretion or a factual judgment that software should not replace.",
                "Las reglas de control son conocidas, pero el Rulebook exige observación, discreción o una valoración fáctica que el software no debe reemplazar.",
              )}</p>
            </div>
            <div className="insufficient">
              <b>{tr("INSUFFICIENT VALIDATED COVERAGE", "COBERTURA VALIDADA INSUFICIENTE")}</b>
              <p>{tr(
                "The app does not have enough validated information to close the call. It should show what is missing and send the Umpire to the official provisions instead of inventing certainty.",
                "La app no tiene suficiente información validada para cerrar la decisión. Debe mostrar qué falta y llevar al Umpire a las disposiciones oficiales en vez de inventar certeza.",
              )}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">{tr("WHAT IT DOES NOT CLAIM", "LO QUE NO AFIRMA")}</p>
          <h2>{tr("No invented percentage of certainty", "No inventa un porcentaje de certeza")}</h2>
          <p className="muted">{tr(
            "The validation labels are not statistical probabilities. A number such as 95% would require a large set of independently adjudicated real cases. Until that benchmark exists, the app reports the type of support behind a decision instead of a misleading confidence score.",
            "Las etiquetas de validación no son probabilidades estadísticas. Un número como 95% requeriría un conjunto grande de casos reales adjudicados independientemente. Hasta tener ese benchmark, la app informa qué tipo de respaldo tiene una decisión en vez de mostrar una confianza engañosa.",
          )}</p>
          <div className="howMetrics">
            <div><strong>{metrics?.total ?? "…"}</strong><span>{tr("official Example / Interpretation blocks indexed", "bloques oficiales de Example / Interpretation indexados")}</span></div>
            <div><strong>{metrics?.rulesWithGuidance ?? "…"}</strong><span>{tr("playing rules with official guidance", "reglas de juego con guía oficial")}</span></div>
            <div><strong>774</strong><span>{tr("raw Outdoor quick-decision combinations audited", "combinaciones crudas del motor Outdoor auditadas")}</span></div>
            <div><strong>{rulebookVersion}</strong><span>{tr("installed Rulebook version", "versión de Rulebook instalada")}</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">{tr("EXAMPLES OF COMPLEX REASONING", "EJEMPLOS DE RAZONAMIENTO COMPLEJO")}</p>
        <h2>{tr("Tap the rules behind each type of decision", "Tocá las reglas detrás de cada tipo de decisión")}</h2>
        <div className="howExampleGrid">
          {examples.map((example) => (
            <article key={example.title} className="howExampleCard">
              <h3>{example.title}</h3>
              <p>{example.text}</p>
              <div className="howRuleLinks">
                {example.refs.map((ref) => {
                  const provision = getProvision(db, "outdoor", ref);
                  return provision ? (
                    <button key={ref} onClick={() => onOpenProvision(provision)}>{provision.label}</button>
                  ) : null;
                })}
              </div>
            </article>
          ))}
        </div>
        {tcMatch ? (
          <button className="howTournamentLink" onClick={() => onOpenExternal(tcMatch.resource, tcMatch.section)}>
            <span>
              <b>{tr("Tournament Conditions can change the answer", "Las Tournament Conditions pueden cambiar la respuesta")}</b>
              <small>{tr(
                "Open the installed governing source used by the cross-rule engine.",
                "Abrir la fuente de control instalada que usa el motor de reglas cruzadas.",
              )}</small>
            </span>
            <strong>→</strong>
          </button>
        ) : null}
      </div>

      <div className="card howVerifyCard">
        <p className="eyebrow">{tr("HOW TO VERIFY A RULING", "CÓMO VERIFICAR UNA DECISIÓN")}</p>
        <h2>{tr("You should be able to audit the app yourself", "Deberías poder auditar la app por tu cuenta")}</h2>
        <div className="howVerifyGrid">
          <div><b>1</b><span>{tr("Read the ruling and its validation level.", "Leé la decisión y su nivel de validación.")}</span></div>
          <div><b>2</b><span>{tr("Open “Why this decision”.", "Abrí “Por qué esta decisión”.")}</span></div>
          <div><b>3</b><span>{tr("Tap every Rule/subarticle used by the reasoning.", "Tocá cada Rule/subartículo usado por el razonamiento.")}</span></div>
          <div><b>4</b><span>{tr("Check Tournament Conditions when the event can change eligibility or procedure.", "Controlá Tournament Conditions cuando el evento pueda cambiar elegibilidad o procedimiento.")}</span></div>
          <div><b>5</b><span>{tr("If the app says Umpire Judgment, use the rules as the framework and make the call yourself.", "Si la app dice Juicio del Umpire, usá las reglas como marco y tomá vos la decisión.")}</span></div>
          <div><b>6</b><span>{tr("If anything conflicts with the official Rulebook, the official source and Umpire authority prevail.", "Si algo entra en conflicto con el Rulebook oficial, prevalecen la fuente oficial y la autoridad del Umpire.")}</span></div>
        </div>
      </div>

      <div className="card howLimitsCard">
        <p className="eyebrow">{tr("PRACTICAL LIMITS", "LÍMITES PRÁCTICOS")}</p>
        <h2>{tr("What can still introduce error", "Qué todavía puede introducir errores")}</h2>
        <ul>
          <li>{tr("Incorrect or incomplete facts entered by the user.", "Hechos incorrectos o incompletos cargados por el usuario.")}</li>
          <li>{tr("Voice transcription errors; dictated text should be reviewed before analysis.", "Errores de transcripción por voz; el texto dictado debe revisarse antes del análisis.")}</li>
          <li>{tr("A Tournament Condition or local condition that was not configured in the Event Profile.", "Una Tournament Condition o condición local que no fue configurada en el Perfil del Evento.")}</li>
          <li>{tr("Rules that intentionally depend on danger, intent, force, advantage, geometry or other observed Umpire judgment.", "Reglas que intencionalmente dependen de peligro, intención, fuerza, ventaja, geometría u otra valoración observada por el Umpire.")}</li>
          <li>{tr("Areas that have not yet reached the same deterministic coverage as the strongest Outdoor branches, especially some Arena situations.", "Áreas que todavía no alcanzaron la misma cobertura determinística que las ramas Outdoor más fuertes, especialmente algunas situaciones de Arena.")}</li>
        </ul>
        <p className="howSourceNote">{tr(
          "Source installed in this app: USPA Rulebook " + rulebookVersion + ". Umpire Polo Assistant is a decision-support tool and does not itself issue an official ruling.",
          "Fuente instalada en esta app: USPA Rulebook " + rulebookVersion + ". Umpire Polo Assistant es una herramienta de apoyo a la decisión y no emite por sí misma una decisión oficial.",
        )}</p>
      </div>
    </section>
  );
}
