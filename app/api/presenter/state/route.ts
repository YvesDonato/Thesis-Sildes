import { NextResponse } from "next/server";
import { getPresenterState } from "../../../lib/presenter-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPresenterState(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
