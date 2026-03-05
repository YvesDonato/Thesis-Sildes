import { NextResponse } from "next/server";

export function redirectToAdmin() {
  // Use relative redirects so reverse-proxy setups (Coolify, Traefik, Nginx)
  // keep the browser on the public host instead of upstream/internal hosts.
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/admin",
    },
  });
}
