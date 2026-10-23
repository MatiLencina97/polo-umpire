import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/feedback-admin";
import { getFeedbackDashboard, setFeedbackReviewStatus, setLearningGapStatus } from "@/lib/feedback-db";

const allowedStatuses = new Set(["open", "reviewed", "dismissed"]);
const allowedLearningStatuses = new Set(["observed", "candidate", "investigating", "dismissed"]);

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (!adminAuthorized(request.headers.get("authorization"))) return unauthorized();

  try {
    const dashboard = await getFeedbackDashboard();
    return NextResponse.json(
      { ok: true, dashboard },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("POLO_UMPIRE_FEEDBACK_ADMIN_READ_FAILED", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "dashboard-unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!adminAuthorized(request.headers.get("authorization"))) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const kind = candidate.kind === "learning-gap" ? "learning-gap" : "feedback";
  const id = typeof candidate.id === "string" ? candidate.id.trim().slice(0, 120) : "";
  const status = typeof candidate.status === "string" ? candidate.status : "";

  if (kind === "learning-gap") {
    if (!id || !allowedLearningStatuses.has(status)) {
      return NextResponse.json({ ok: false, error: "invalid-learning-update" }, { status: 400 });
    }
    const reviewNote = typeof candidate.reviewNote === "string" ? candidate.reviewNote.trim().slice(0, 500) : null;
    try {
      const updated = await setLearningGapStatus(
        id,
        status as "observed" | "candidate" | "investigating" | "dismissed",
        reviewNote,
      );
      return NextResponse.json(
        { ok: updated },
        { status: updated ? 200 : 404, headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      console.error("POLO_UMPIRE_LEARNING_GAP_ADMIN_UPDATE_FAILED", error instanceof Error ? error.message : "unknown");
      return NextResponse.json({ ok: false, error: "dashboard-unavailable" }, { status: 503 });
    }
  }

  if (!id || !allowedStatuses.has(status)) {
    return NextResponse.json({ ok: false, error: "invalid-review-update" }, { status: 400 });
  }

  try {
    const updated = await setFeedbackReviewStatus(id, status as "open" | "reviewed" | "dismissed");
    return NextResponse.json(
      { ok: updated },
      { status: updated ? 200 : 404, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("POLO_UMPIRE_FEEDBACK_ADMIN_UPDATE_FAILED", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "dashboard-unavailable" }, { status: 503 });
  }
}
