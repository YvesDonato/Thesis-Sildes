import { NextResponse } from "next/server";
import {
  ADMIN_PASSWORD,
  applyAdminSessionCookie,
} from "../../../lib/admin-auth";
import { redirectToAdmin } from "../../../lib/http-redirect";

export const dynamic = "force-dynamic";

async function readPassword(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
    };
    return body.password ?? "";
  }

  const formData = await request.formData();
  return String(formData.get("password") ?? "");
}

export async function POST(request: Request) {
  const password = await readPassword(request);
  const isFormRequest = !(
    (request.headers.get("content-type") ?? "").includes("application/json")
  );

  if (password !== ADMIN_PASSWORD) {
    if (isFormRequest) {
      return redirectToAdmin();
    }

    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 },
    );
  }

  const response = isFormRequest ? redirectToAdmin() : NextResponse.json({ ok: true });

  applyAdminSessionCookie(response);
  return response;
}
