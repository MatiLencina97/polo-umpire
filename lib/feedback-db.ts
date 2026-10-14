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
