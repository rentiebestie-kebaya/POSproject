import { NextResponse, type NextRequest } from "next/server";

const RESERVED_SUBDOMAINS = new Set(["app", "www"]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const { pathname } = request.nextUrl;

  // NOTE: no optimistic cookie-existence gate for /app here. Edge middleware
  // can't reach D1 (Next <15.2), so the real session is validated server-side
  // (/api/me, getAppSession) and the app shell gates on it in app/app/layout.tsx.
  // A middleware cookie check would also wrongly bounce the prototype signup
  // flow, which uses a mock localStorage session with no real cookie.

  if (
    pathname !== "/" ||
    host === "rentie.id" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    !host.endsWith(".rentie.id")
  ) {
    return NextResponse.next();
  }

  const subdomain = host.replace(".rentie.id", "");
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/book/${subdomain}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/"],
};
