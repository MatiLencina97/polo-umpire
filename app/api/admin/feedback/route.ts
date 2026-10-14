import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/feedback-admin";
import { getFeedbackDashboard, setFeedbackReviewStatus } from "@/lib/feedback-db";

const allowedStatuses = new Set(["open", "reviewed", "dismissed"]);

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

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim().slice(0, 120) : "";
    const status = typeof body?.status === "string" ? body.status : "";

    if (!id || !allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, error: "invalid-review-update" }, { status: 400 });
    }

    const updated = await setFeedbackReviewStatus(id, status as "open" | "reviewed" | "dismissed");
    return NextResponse.json(
      { ok: updated },
      { status: updated ? 200 : 404, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
}
