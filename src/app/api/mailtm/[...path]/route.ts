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
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "3600",
  };
}

async function relay(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  // Entire handler wrapped — any throw must return JSON, not empty 500
  try {
    // Vercel/Next 15+ : params is a Promise, locally it may be plain object — handle both
    let path: string[] | undefined;
    try {
      const p = await (ctx as unknown as { params: Promise<{ path?: string[] }> | { path?: string[] } }).params;
      path = (p as { path?: string[] })?.path;
    } catch {
      path = undefined;
    }

    // DEBUG MODE: if you see this JSON, routing works — fetch is the culprit
    const debug = req.nextUrl.searchParams.get("debug");
    if (debug === "1") {
      return NextResponse.json(
        { ok: true, path, search: req.nextUrl.search, method: req.method, debug: "relay reached handler" },
        { headers: corsHeaders() }
      );
    }

    const target = `${API_BASE}/${(path ?? []).join("/")}${req.nextUrl.search}`;

    const headers: Record<string, string> = { Accept: "application/json" };
    const contentType = req.headers.get("content-type");
    const authorization = req.headers.get("authorization");
    if (contentType) headers["Content-Type"] = contentType;
    if (authorization) headers["Authorization"] = authorization;

    // Body handling — only for methods that allow it
    let body: string | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        body = await req.text();
        if (body === "") body = undefined;
      } catch {
        body = undefined;
      }
    }

    // Timeout using AbortController (more compatible than AbortSignal.timeout on some Node versions)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(target, {
        method: req.method,
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const resHeaders = new Headers(corsHeaders());
    const resContentType = res.headers.get("content-type");
    if (resContentType) resHeaders.set("Content-Type", resContentType);

    // Binary-safe passthrough (attachment downloads stream through here too).
    // arrayBuffer() keeps JSON responses working while preserving bytes exactly.
    if (res.status === 204) {
      return new NextResponse(null, { status: 204, headers: resHeaders });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, { status: res.status, headers: resHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "relay error";
    const stack = err instanceof Error ? err.stack : String(err);
    // Include target in logs for Vercel Runtime Logs
    console.error("[mailtm relay] error:", message, stack);
    return NextResponse.json(
      { message: `Relay error: ${message}`, stack: stack?.slice(0, 500) },
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
