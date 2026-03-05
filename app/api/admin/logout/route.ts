import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", request.url), {
    status: 303,
  });
  clearAdminSessionCookie(response);
  return response;
}
