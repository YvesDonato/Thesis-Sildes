import { NextResponse } from "next/server";
import { isAdminFromRequest } from "../../../lib/admin-auth";
import { saveSlideNotes } from "../../../lib/deck-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminFromRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    slideIndex?: number;
    notes?: string;
  };

  const slideIndex = Number(body.slideIndex);
  const notes = typeof body.notes === "string" ? body.notes : "";

  if (!Number.isFinite(slideIndex)) {
    return NextResponse.json(
      { ok: false, error: "slideIndex must be a number" },
      { status: 400 },
    );
  }

  try {
    const savedNotes = await saveSlideNotes(slideIndex, notes);
    return NextResponse.json(
      { ok: true, notes: savedNotes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save notes";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
