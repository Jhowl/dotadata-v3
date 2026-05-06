import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { rateLimit } from "@/lib/rate-limit";

const API_WINDOW_MS = 60_000;
const API_LIMIT = 120;

const intlMiddleware = createIntlMiddleware(routing);

const getClientIp = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const limit = rateLimit(`api:${ip}`, API_LIMIT, API_WINDOW_MS);

    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(API_LIMIT),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(limit.resetAt),
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(API_LIMIT));
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    response.headers.set("X-RateLimit-Reset", String(limit.resetAt));
    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Locale-prefixed paths and the root
    "/",
    "/(en|ru)/:path*",
    // Everything else except _next/_vercel/files
    "/((?!api|_next|_vercel|.*\\..*).*)",
    // /api/* for rate limiting
    "/api/:path*",
  ],
};
