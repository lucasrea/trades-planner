import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isApp = pathname.startsWith("/app") || pathname === "/onboarding" || pathname === "/account";

  if (isApp && !session?.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && session?.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/onboarding", "/account", "/login", "/signup"],
};
