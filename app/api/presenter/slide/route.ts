import { NextResponse } from "next/server";
import { isAdminFromRequest } from "../../../lib/admin-auth";
import { setPresenterCursor } from "../../../lib/presenter-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminFromRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    slideIndex?: number;
    revealStep?: number;
  };
  const slideIndex = Number(body.slideIndex);
  const revealStep =
    body.revealStep === undefined ? 0 : Number(body.revealStep);

  if (!Number.isFinite(slideIndex)) {
    return NextResponse.json(
      { ok: false, error: "slideIndex must be a number" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(revealStep)) {
    return NextResponse.json(
      { ok: false, error: "revealStep must be a number" },
      { status: 400 },
    );
  }

  const state = setPresenterCursor(slideIndex, revealStep);
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}
