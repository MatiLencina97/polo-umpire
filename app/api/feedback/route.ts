import { NextRequest, NextResponse } from "next/server";

const allowedRatings = new Set(["useful", "needs-review"]);
const allowedReasons = new Set(["clear", "rules-helped", "disagree-call", "missing-fact", "missing-rule", "unclear", "other"]);

function cleanString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 12_000) {
    return NextResponse.json({ ok: false, error: "payload-too-large" }, { status: 413 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || !allowedRatings.has(body.rating)) {
      return NextResponse.json({ ok: false, error: "invalid-feedback" }, { status: 400 });
    }

    const context = body.context && typeof body.context === "object" ? body.context : {};
    const record = {
      event: "umpire_feedback",
      id: cleanString(body.id, 120),
      createdAt: cleanString(body.createdAt, 60),
      rating: body.rating,
      reason: allowedReasons.has(body.reason) ? body.reason : null,
      note: cleanString(body.note, 300) || null,
      source: context.source === "match" || context.source === "analysis" ? context.source : "unknown",
      discipline: context.discipline === "outdoor" || context.discipline === "arena" ? context.discipline : "unknown",
      resolverMode: context.resolverMode === "play" || context.resolverMode === "situation" ? context.resolverMode : "unknown",
      topic: cleanString(context.topic, 80) || null,
      scenario: cleanString(context.scenario, 80) || null,
      outcomeStatus: cleanString(context.outcomeStatus, 60),
      validationLevel: cleanString(context.validationLevel, 80) || null,
      headline: cleanString(context.headline, 180),
      rulebookVersion: cleanString(context.rulebookVersion, 40),
      ruleRefs: Array.isArray(context.ruleRefs)
        ? context.ruleRefs.filter((item: unknown): item is string => typeof item === "string").slice(0, 20).map((item: string) => item.slice(0, 40))
        : [],
      appVersion: cleanString(context.appVersion, 40),
    };

    // Intentionally do not log the original free-text play description, event name,
    // player names, or any device identifier.
    console.info("POLO_UMPIRE_FEEDBACK", JSON.stringify(record));

    return NextResponse.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
}
