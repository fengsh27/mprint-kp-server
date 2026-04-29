import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");

  const csp = [
    "default-src 'self'",
    // Nonce allows Next.js inline hydration scripts; blocks everything else inline
    `script-src 'self' 'nonce-${nonce}'`,
    // Tailwind generates inline styles at runtime
    "style-src 'self' 'unsafe-inline'",
    // next/font serves fonts from /_next/static/media (same origin); SVG word clouds use data URIs
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // All fetch() calls go to same-origin /api/* routes
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  // Next.js reads x-nonce from the request and applies it to its own inline scripts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Apply to all routes except Next.js static assets
      source: "/((?!_next/static|_next/image|favicon.ico|images/).*)",
      // Skip prefetch requests so Next.js router prefetching still works
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
