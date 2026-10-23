import { NextRequest, NextResponse } from "next/server";
import { upsertLearningGap, type StoredLearningGap } from "@/lib/feedback-db";

const allowedReasons = new Set(["missing-fact","unknown-fact","model-coverage","arena-coverage"]);
const allowedTopics = new Set(["row","dangerous","blocking","mallet","conduct","restart"]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function parse(body: any): StoredLearningGap | null {
  if (!body || typeof body !== "object") return null;
  const fingerprint = clean(body.fingerprint, 120);
  const createdAt = clean(body.createdAt, 60);
  if (!fingerprint.startsWith("gap-") || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  if (body.source !== "match" && body.source !== "analysis") return null;
  if (body.discipline !== "outdoor" && body.discipline !== "arena") return null;
  if (!allowedTopics.has(body.topic) || !allowedReasons.has(body.reason)) return null;
  if (body.validationLevel !== "insufficient-coverage") return null;

  const rawFactState = body.factState && typeof body.factState === "object" ? body.factState : {};
  const factState = Object.fromEntries(
    Object.entries(rawFactState)
      .filter(([key, value]) => typeof key === "string" && typeof value === "string")
      .slice(0, 20)
      .map(([key, value]) => [key.slice(0,80), String(value).slice(0,80)]),
  );

  return {
    fingerprint,
    createdAt: new Date(createdAt).toISOString(),
    source: body.source,
    discipline: body.discipline,
    topic: body.topic,
    reason: body.reason,
    decisionStatus: clean(body.decisionStatus, 60) || "needs-info",
    validationLevel: "insufficient-coverage",
    rulebookVersion: clean(body.rulebookVersion, 40) || "unknown",
    ruleRefs: cleanArray(body.ruleRefs, 20, 40),
    factState,
    missingFactKeys: cleanArray(body.missingFactKeys, 20, 80),
    unknownFactKeys: cleanArray(body.unknownFactKeys, 20, 80),
    nextDecisiveFact: clean(body.nextDecisiveFact, 80) || null,
    appVersion: clean(body.appVersion, 40) || "unknown",
  };
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 10_000) return NextResponse.json({ ok:false, error:"payload-too-large" }, { status:413 });

  try {
    const record = parse(await request.json());
    if (!record) return NextResponse.json({ ok:false, error:"invalid-learning-gap" }, { status:400 });
    const result = await upsertLearningGap(record);
    return NextResponse.json({ ok:true, result }, { headers:{ "cache-control":"no-store" } });
  } catch (error) {
    console.error("POLO_UMPIRE_LEARNING_GAP_STORE_FAILED", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok:false, error:"learning-gap-store-unavailable" }, { status:503 });
  }
}
