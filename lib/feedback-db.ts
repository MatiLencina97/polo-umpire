import postgres from "postgres";

export type StoredFeedback = {
  id: string;
  createdAt: string;
  rating: "useful" | "needs-review";
  reason: string | null;
  note: string | null;
  source: "match" | "analysis";
  discipline: "outdoor" | "arena";
  resolverMode: "play" | "situation";
  topic: string | null;
  scenario: string | null;
  outcomeStatus: string;
  validationLevel: string | null;
  headline: string;
  rulebookVersion: string;
  ruleRefs: string[];
  appVersion: string;
};

export type StoredLearningGap = {
  fingerprint: string;
  createdAt: string;
  source: "match" | "analysis";
  discipline: "outdoor" | "arena";
  topic: string;
  reason: "missing-fact" | "unknown-fact" | "model-coverage" | "arena-coverage";
  decisionStatus: string;
  validationLevel: "insufficient-coverage";
  rulebookVersion: string;
  ruleRefs: string[];
  factState: Record<string, string>;
  missingFactKeys: string[];
  unknownFactKeys: string[];
  nextDecisiveFact: string | null;
  appVersion: string;
};

let client: ReturnType<typeof postgres> | null = null;

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!client) client = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10 });
  return client;
}

export async function insertFeedback(record: StoredFeedback) {
  const db = sql();
  const rows = await db`
    INSERT INTO feedback (
      id, created_at, rating, reason, note, source, discipline, resolver_mode,
      topic, scenario, outcome_status, validation_level, headline,
      rulebook_version, rule_refs, app_version
    ) VALUES (
      ${record.id}, ${record.createdAt}, ${record.rating}, ${record.reason},
      ${record.note}, ${record.source}, ${record.discipline}, ${record.resolverMode},
      ${record.topic}, ${record.scenario}, ${record.outcomeStatus},
      ${record.validationLevel}, ${record.headline}, ${record.rulebookVersion},
      ${db.json(record.ruleRefs)}, ${record.appVersion}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  return { inserted: rows.length === 1 };
}


function learningHypothesis(record: StoredLearningGap) {
  if (record.reason === "arena-coverage") {
    return "Expand deterministic Arena coverage for " + record.topic + " using the cited Arena provisions and add branch-specific regression cases.";
  }
  if (record.reason === "model-coverage") {
    return "Inspect the cited provisions for an unmodeled decision factor in the " + record.topic + " branch and add a deterministic branch only if the official text supports it.";
  }
  if (record.reason === "unknown-fact") {
    return "Improve extraction or clarification for the unresolved fact(s): " + record.unknownFactKeys.join(", ") + ". Do not infer their values.";
  }
  return "Improve the guided flow for the missing decisive fact(s): " + record.missingFactKeys.join(", ") + ".";
}

function learningTestPlan(record: StoredLearningGap) {
  const focus = record.nextDecisiveFact ?? record.missingFactKeys[0] ?? record.unknownFactKeys[0] ?? "unmodeled-factor";
  return [
    "Reproduce the structured gap for " + record.topic + " without storing the original play text.",
    "Add positive and negative cases around " + focus + ".",
    "Add a contradiction/unknown case so the engine preserves uncertainty.",
    "Run the full regression suite and offline durability tests before any promotion.",
    "Keep the candidate in review/shadow mode until official-rule support is confirmed.",
  ];
}

export async function upsertLearningGap(record: StoredLearningGap) {
  const db = sql();
  const hypothesis = learningHypothesis(record);
  const testPlan = learningTestPlan(record);
  const rows = await db`
    INSERT INTO learning_gaps (
      fingerprint, first_seen_at, last_seen_at, occurrences, source, discipline,
      topic, reason, decision_status, validation_level, rulebook_version,
      rule_refs, fact_state, missing_fact_keys, unknown_fact_keys,
      next_decisive_fact, last_app_version, hypothesis, test_plan, learning_status,
      auto_promotion
    ) VALUES (
      ${record.fingerprint}, ${record.createdAt}, ${record.createdAt}, 1, ${record.source},
      ${record.discipline}, ${record.topic}, ${record.reason}, ${record.decisionStatus},
      ${record.validationLevel}, ${record.rulebookVersion}, ${db.json(record.ruleRefs)},
      ${db.json(record.factState)}, ${db.json(record.missingFactKeys)},
      ${db.json(record.unknownFactKeys)}, ${record.nextDecisiveFact},
      ${record.appVersion}, ${hypothesis}, ${db.json(testPlan)}, 'observed', false
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
      last_seen_at = EXCLUDED.last_seen_at,
      occurrences = learning_gaps.occurrences + 1,
      last_app_version = EXCLUDED.last_app_version,
      learning_status = CASE
        WHEN learning_gaps.learning_status IN ('dismissed','investigating') THEN learning_gaps.learning_status
        WHEN learning_gaps.occurrences + 1 >= 3 THEN 'candidate'
        ELSE learning_gaps.learning_status
      END,
      hypothesis = EXCLUDED.hypothesis,
      test_plan = EXCLUDED.test_plan
    RETURNING fingerprint, occurrences, learning_status
  `;
  return rows[0] ?? null;
}

export async function setLearningGapStatus(
  fingerprint: string,
  status: "observed" | "candidate" | "investigating" | "dismissed",
  reviewNote: string | null = null,
) {
  const db = sql();
  const rows = await db`
    UPDATE learning_gaps
    SET learning_status = ${status},
        review_note = ${reviewNote}
    WHERE fingerprint = ${fingerprint}
    RETURNING fingerprint
  `;
  return rows.length === 1;
}

type GroupRow = {
  key: string | null;
  useful: number;
  needs_review: number;
  total: number;
};

function normalizeGroup(rows: GroupRow[]) {
  return rows.map((row) => ({
    key: row.key ?? "unknown",
    useful: Number(row.useful),
    needsReview: Number(row.needs_review),
    total: Number(row.total),
    usefulnessRate: Number(row.total) > 0 ? Number(row.useful) / Number(row.total) : 0,
    reviewRequestRate: Number(row.total) > 0 ? Number(row.needs_review) / Number(row.total) : 0,
  }));
}

export async function getFeedbackDashboard() {
  const db = sql();

  const [totals] = await db<[{ useful: number; needs_review: number; total: number; open_reviews: number }]>`
    SELECT
      COUNT(*) FILTER (WHERE rating = 'useful')::int AS useful,
      COUNT(*) FILTER (WHERE rating = 'needs-review')::int AS needs_review,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE rating = 'needs-review' AND review_status = 'open')::int AS open_reviews
    FROM feedback
  `;

  const byTopic = await db<GroupRow[]>`
    SELECT COALESCE(topic, scenario, 'unknown') AS key,
      COUNT(*) FILTER (WHERE rating = 'useful')::int AS useful,
      COUNT(*) FILTER (WHERE rating = 'needs-review')::int AS needs_review,
      COUNT(*)::int AS total
    FROM feedback
    GROUP BY COALESCE(topic, scenario, 'unknown')
    ORDER BY total DESC, key ASC
  `;

  const byVersion = await db<GroupRow[]>`
    SELECT app_version AS key,
      COUNT(*) FILTER (WHERE rating = 'useful')::int AS useful,
      COUNT(*) FILTER (WHERE rating = 'needs-review')::int AS needs_review,
      COUNT(*)::int AS total
    FROM feedback
    GROUP BY app_version
    ORDER BY total DESC, key DESC
  `;

  const byReason = await db<GroupRow[]>`
    SELECT COALESCE(reason, 'none') AS key,
      COUNT(*) FILTER (WHERE rating = 'useful')::int AS useful,
      COUNT(*) FILTER (WHERE rating = 'needs-review')::int AS needs_review,
      COUNT(*)::int AS total
    FROM feedback
    GROUP BY COALESCE(reason, 'none')
    ORDER BY total DESC, key ASC
  `;

  const byRule = await db<GroupRow[]>`
    SELECT ref AS key,
      COUNT(*) FILTER (WHERE rating = 'useful')::int AS useful,
      COUNT(*) FILTER (WHERE rating = 'needs-review')::int AS needs_review,
      COUNT(*)::int AS total
    FROM feedback
    CROSS JOIN LATERAL jsonb_array_elements_text(rule_refs) AS ref
    GROUP BY ref
    ORDER BY total DESC, key ASC
    LIMIT 50
  `;

  const reviews = await db`
    SELECT id, created_at, rating, reason, note, source, discipline, resolver_mode,
      topic, scenario, outcome_status, validation_level, headline,
      rulebook_version, rule_refs, app_version, review_status
    FROM feedback
    WHERE rating = 'needs-review'
    ORDER BY CASE review_status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 100
  `;

  const learningGaps = await db`
    SELECT fingerprint, first_seen_at, last_seen_at, occurrences, source, discipline,
      topic, reason, decision_status, validation_level, rulebook_version, rule_refs,
      fact_state, missing_fact_keys, unknown_fact_keys, next_decisive_fact,
      last_app_version, hypothesis, test_plan, learning_status, review_note, auto_promotion
    FROM learning_gaps
    ORDER BY
      CASE learning_status WHEN 'investigating' THEN 0 WHEN 'candidate' THEN 1 WHEN 'observed' THEN 2 ELSE 3 END,
      occurrences DESC,
      last_seen_at DESC
    LIMIT 100
  `;

  return {
    totals: {
      useful: Number(totals?.useful ?? 0),
      needsReview: Number(totals?.needs_review ?? 0),
      total: Number(totals?.total ?? 0),
      openReviews: Number(totals?.open_reviews ?? 0),
      usefulnessRate: Number(totals?.total ?? 0) > 0 ? Number(totals.useful) / Number(totals.total) : 0,
      reviewRequestRate: Number(totals?.total ?? 0) > 0 ? Number(totals.needs_review) / Number(totals.total) : 0,
    },
    byTopic: normalizeGroup(byTopic),
    byVersion: normalizeGroup(byVersion),
    byReason: normalizeGroup(byReason),
    byRule: normalizeGroup(byRule),
    reviews: reviews.map((row: any) => ({
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      reason: row.reason,
      note: row.note,
      source: row.source,
      discipline: row.discipline,
      resolverMode: row.resolver_mode,
      topic: row.topic,
      scenario: row.scenario,
      outcomeStatus: row.outcome_status,
      validationLevel: row.validation_level,
      headline: row.headline,
      rulebookVersion: row.rulebook_version,
      ruleRefs: Array.isArray(row.rule_refs) ? row.rule_refs : [],
      appVersion: row.app_version,
      reviewStatus: row.review_status,
    })),
    learningGaps: learningGaps.map((row: any) => ({
      fingerprint: row.fingerprint,
      firstSeenAt: new Date(row.first_seen_at).toISOString(),
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
      occurrences: Number(row.occurrences),
      source: row.source,
      discipline: row.discipline,
      topic: row.topic,
      reason: row.reason,
      decisionStatus: row.decision_status,
      validationLevel: row.validation_level,
      rulebookVersion: row.rulebook_version,
      ruleRefs: Array.isArray(row.rule_refs) ? row.rule_refs : [],
      factState: row.fact_state ?? {},
      missingFactKeys: Array.isArray(row.missing_fact_keys) ? row.missing_fact_keys : [],
      unknownFactKeys: Array.isArray(row.unknown_fact_keys) ? row.unknown_fact_keys : [],
      nextDecisiveFact: row.next_decisive_fact,
      appVersion: row.last_app_version,
      hypothesis: row.hypothesis,
      testPlan: Array.isArray(row.test_plan) ? row.test_plan : [],
      learningStatus: row.learning_status,
      reviewNote: row.review_note,
      autoPromotion: Boolean(row.auto_promotion),
    })),
  };
}

export async function setFeedbackReviewStatus(id: string, status: "open" | "reviewed" | "dismissed") {
  const db = sql();
  const rows = await db`
    UPDATE feedback SET review_status = ${status}
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length === 1;
}
