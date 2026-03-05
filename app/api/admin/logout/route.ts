import { clearAdminSessionCookie } from "../../../lib/admin-auth";
import { redirectToAdmin } from "../../../lib/http-redirect";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = redirectToAdmin();
  clearAdminSessionCookie(response);
  return response;
}
