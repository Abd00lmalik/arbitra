/*
 * @file middleware.ts
 * @description Next.js middleware enforcing Web3Auth authentication checks for protected routes.
 */

import { NextRequest, NextResponse } from "next/server";

/* Routes that require authentication */
const PROTECTED_ROUTES = [
  "/marketplace",
  "/upload",
  "/portfolio",
  "/verify",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* Skip API routes, static files, and public assets */
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/fonts") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  /* Check if this is a protected route */
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (!isProtected) {
    return NextResponse.next();
  }

  /* Check for auth session cookie */
  const sessionCookie = request.cookies.get("arbitra_session");
  const hasSession = !!sessionCookie?.value;

  if (!hasSession) {
    /* Redirect to register with the original destination as next parameter */
    const redirectUrl = new URL("/register", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  /* Match all routes except static files */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
