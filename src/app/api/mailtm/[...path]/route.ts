import { NextRequest, NextResponse } from "next/server";

/**
 * Minimal same-origin relay for the Mail.tm REST API.
 *
 * Mail.tm only sends `Access-Control-Allow-Origin` to its own frontend origin,
 * so direct browser calls from third-party apps are CORS-blocked. This handler
 * transparently forwards requests to https://api.mail.tm and adds permissive
 * CORS headers, so the single-file app works anywhere it can reach this route.
 */

const API_PRIMARY = "https://api.mail.tm";
const API_FALLBACK = "https://api.mail.gw";
// Vercel Hobby kills functions at ~10s. 8s per upstream fails fast with JSON
// instead of a platform HTML 502. Worst case ~16s, fits Pro limits.
const TIMEOUT_MS = 8000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
// Pro honors this (up to plan limit); Hobby caps at 10s and ignores the rest.
export const maxDuration = 25;

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

    // Health check — https://hitempmail.vercel.app/api/mailtm/domains?health=1
    // Must return BEFORE building upstream URLs so ?health=1 never forwards.
    if (req.nextUrl.searchParams.get("health") === "1") {
      return NextResponse.json(
        { ok: true, path, search: req.nextUrl.search, method: req.method, primary: API_PRIMARY, fallback: API_FALLBACK },
        { headers: { ...corsHeaders(), "Cache-Control": "no-store" } }
      );
    }

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

    async function fetchWithTimeout(url: string): Promise<Response> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        return await fetch(url, {
          method: req.method,
          headers,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Strip internal probe params before forwarding to Mail.tm / Mail.gw.
    const forwardSearch = new URLSearchParams(req.nextUrl.searchParams);
    forwardSearch.delete("health");
    forwardSearch.delete("debug");
    const qs = forwardSearch.toString();
    const suffix = qs ? `?${qs}` : "";
    // Try primary (mail.tm), fallback to mail.gw if primary is blocked (5xx from Vercel IP)
    const targets = [
      `${API_PRIMARY}/${(path ?? []).join("/")}${suffix}`,
      `${API_FALLBACK}/${(path ?? []).join("/")}${suffix}`,
    ];

    let res: Response | null = null;
    let lastError: unknown = null;
    for (const target of targets) {
      try {
        const r = await fetchWithTimeout(target);
        // Vercel IPs get empty 500 from mail.tm; transient 502/503/504 also
        // deserve a fallback try before surfacing an error to the browser.
        if (r.status >= 500 && r.status <= 599) {
          const clone = r.clone();
          const txt = await clone.text().catch(() => "");
          const isPrimary = target.includes("api.mail.tm");
          if (isPrimary && (txt.trim() === "" || r.status === 502 || r.status === 503 || r.status === 504)) {
            console.warn(`[mailtm relay] ${target} returned ${r.status} — trying fallback ${API_FALLBACK}`);
            continue;
          }
        }
        res = r;
        break;
      } catch (e) {
        lastError = e;
        console.warn(`[mailtm relay] fetch failed for ${target}:`, e instanceof Error ? e.message : String(e));
        // Try next target
        continue;
      }
    }

    if (!res) {
      throw lastError ?? new Error("All upstreams failed");
    }

    const resHeaders = new Headers(corsHeaders());
    resHeaders.set("Cache-Control", "no-store");
    // Lets curl/logs tell relay errors apart from upstream errors.
    // Public upstream URL only — never includes auth headers.
    try {
      resHeaders.set("X-Relay-Upstream", res.url || "");
    } catch {
      /* header best-effort only */
    }
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
    // Timeout (AbortError) is a gateway timeout, not Bad Gateway — keep
    // "Request failed (502)" vs "(504)" distinguishable in the UI.
    const isTimeout = message.toLowerCase().includes("abort");
    return NextResponse.json(
      { message: `Relay error: ${message}`, stack: stack?.slice(0, 500) },
      { status: isTimeout ? 504 : 502, headers: { ...corsHeaders(), "Cache-Control": "no-store" } },
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
