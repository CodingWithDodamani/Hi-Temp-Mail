import { NextRequest, NextResponse } from "next/server";

/**
 * Minimal same-origin relay for the Mail.tm REST API.
 *
 * Mail.tm only sends `Access-Control-Allow-Origin` to its own frontend origin,
 * so direct browser calls from third-party apps are CORS-blocked. This handler
 * transparently forwards requests to https://api.mail.tm and adds permissive
 * CORS headers, so the single-file app works anywhere it can reach this route.
 */

const API_BASE = "https://api.mail.tm";
const TIMEOUT_MS = 20000;

export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "3600",
  };
}

async function relay(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${API_BASE}/${(path ?? []).join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");
  if (contentType) headers["Content-Type"] = contentType;
  if (authorization) headers["Authorization"] = authorization;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const resHeaders = new Headers(corsHeaders());
    const resContentType = res.headers.get("content-type");
    if (resContentType) resHeaders.set("Content-Type", resContentType);

    const body = res.status === 204 ? null : await res.text();
    return new NextResponse(body, { status: res.status, headers: resHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "relay error";
    return NextResponse.json(
      { message: `Relay error: ${message}` },
      { status: 502, headers: corsHeaders() },
    );
  }
}

async function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export {
  relay as GET,
  relay as POST,
  relay as PUT,
  relay as PATCH,
  relay as DELETE,
  preflight as OPTIONS,
};
