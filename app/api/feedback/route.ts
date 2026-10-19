import { NextRequest, NextResponse } from "next/server";
import { insertFeedback, type StoredFeedback } from "@/lib/feedback-db";

const allowedRatings = new Set(["useful", "needs-review"]);
const allowedReasons = new Set(["clear", "rules-helped", "disagree-call", "missing-fact", "missing-rule", "unclear", "other"]);
const allowedValidationLevels = new Set(["direct-rule-support", "umpire-judgment", "insufficient-coverage"]);

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function cleanString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clientKey(request: NextRequest) {
  // Used transiently for best-effort abuse protection only. It is never logged or persisted.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || null;
}

function rateLimited(request: NextRequest) {
  const now = Date.now();
  const key = clientKey(request);
  if (!key) return false;

  if (rateBuckets.size > 500) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now >= bucket.resetAt) rateBuckets.delete(bucketKey);
    }
  }

  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_PER_WINDOW;
}

function parseRecord(body: any): StoredFeedback | null {
  if (!body || typeof body !== "object") return null;
  if (!cleanString(body.id, 120)) return null;
  if (!allowedRatings.has(body.rating)) return null;

  const createdAt = cleanString(body.createdAt, 60);
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;

  const context = body.context && typeof body.context === "object" ? body.context : null;
  if (!context) return null;
  if (context.source !== "match" && context.source !== "analysis") return null;
  if (context.discipline !== "outdoor" && context.discipline !== "arena") return null;
  if (context.resolverMode !== "play" && context.resolverMode !== "situation") return null;

  const reason = body.reason == null ? null : cleanString(body.reason, 60);
  if (reason && !allowedReasons.has(reason)) return null;

  const validationLevel = context.validationLevel == null ? null : cleanString(context.validationLevel, 80);
  if (validationLevel && !allowedValidationLevels.has(validationLevel)) return null;

  const outcomeStatus = cleanString(context.outcomeStatus, 60);
  const headline = cleanString(context.headline, 180);
  const rulebookVersion = cleanString(context.rulebookVersion, 40);
  const appVersion = cleanString(context.appVersion, 40);
  if (!outcomeStatus || !headline || !rulebookVersion || !appVersion) return null;

  const ruleRefs: string[] = Array.isArray(context.ruleRefs)
    ? Array.from(new Set<string>(
        context.ruleRefs
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim().slice(0, 40))
          .filter((item: string) => Boolean(item)),
      )).slice(0, 20)
    : [];

  return {
    id: cleanString(body.id, 120),
    createdAt: new Date(createdAt).toISOString(),
    rating: body.rating,
    reason,
    note: cleanString(body.note, 300) || null,
    source: context.source,
    discipline: context.discipline,
    resolverMode: context.resolverMode,
    topic: cleanString(context.topic, 80) || null,
    scenario: cleanString(context.scenario, 80) || null,
    outcomeStatus,
    validationLevel,
    headline,
    rulebookVersion,
    ruleRefs,
    appVersion,
  };
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429, headers: { "retry-after": "60" } });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 12_000) {
    return NextResponse.json({ ok: false, error: "payload-too-large" }, { status: 413 });
  }

  try {
    const body = await request.json();
    const record = parseRecord(body);
    if (!record) {
      return NextResponse.json({ ok: false, error: "invalid-feedback" }, { status: 400 });
    }

    const result = await insertFeedback(record);

    return NextResponse.json(
      { ok: true, duplicate: !result.inserted },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("POLO_UMPIRE_FEEDBACK_STORE_FAILED", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "feedback-store-unavailable" }, { status: 503 });
  }
}
