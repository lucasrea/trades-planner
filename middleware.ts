import { NextRequest, NextResponse } from "next/server";
import { decodeSession, sessionCookie } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decodeSession(request.cookies.get(sessionCookie.name)?.value);
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isApp = pathname.startsWith("/app") || pathname === "/onboarding" || pathname === "/account";

  if (isApp && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding", "/account", "/login", "/signup"],
};
