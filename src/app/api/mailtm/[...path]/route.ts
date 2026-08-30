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
export const runtime = "edge";
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

    // DEBUG MODES
    const debug = req.nextUrl.searchParams.get("debug");
    if (debug === "1") {
      return NextResponse.json(
        { ok: true, path, search: req.nextUrl.search, method: req.method, debug: "relay reached handler" },
        { headers: corsHeaders() }
      );
    }
    if (debug === "fetch") {
      // Test if Vercel can fetch at all
      try {
        const test = await fetch("https://api.mail.tm/domains", { headers: { Accept: "application/json" } });
        const txt = await test.text();
        return NextResponse.json({ fetchOk: true, status: test.status, bodyPreview: txt.slice(0, 400), headers: Object.fromEntries(test.headers.entries()) }, { headers: corsHeaders() });
      } catch (e) {
        return NextResponse.json({ fetchOk: false, error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.slice(0, 800) : "" }, { status: 502, headers: corsHeaders() });
      }
    }
    if (debug === "ua") {
      try {
        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
        const test = await fetch("https://api.mail.tm/domains", { headers: { Accept: "application/json", "User-Agent": ua } });
        const txt = await test.text();
        return NextResponse.json({ fetchOk: true, status: test.status, bodyPreview: txt.slice(0, 600), headers: Object.fromEntries(test.headers.entries()) }, { headers: corsHeaders() });
      } catch (e) {
        return NextResponse.json({ fetchOk: false, error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.slice(0, 800) : "" }, { status: 502, headers: corsHeaders() });
      }
    }
    if (debug === "ua2") {
      try {
        const test = await fetch("https://api.mail.tm/domains", {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
          },
        });
        const txt = await test.text();
        return NextResponse.json({ fetchOk: true, status: test.status, bodyPreview: txt.slice(0, 600) }, { headers: corsHeaders() });
      } catch (e) {
        return NextResponse.json({ fetchOk: false, error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: corsHeaders() });
      }
    }
    if (debug === "multi") {
      const tests: Record<string, unknown> = {};
      // Test guerrillamail
      try {
        const r = await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address", { headers: { Accept: "application/json" } });
        const t = await r.text();
        tests["guerrilla"] = { status: r.status, body: t.slice(0, 500) };
      } catch (e) {
        tests["guerrilla"] = { error: e instanceof Error ? e.message : String(e) };
      }
      try {
        const r = await fetch("https://api.mail.tm/domains", { headers: { Accept: "application/json" } });
        const t = await r.text();
        tests["mailtm-direct"] = { status: r.status, body: t.slice(0, 300) };
      } catch (e) {
        tests["mailtm-direct"] = { error: e instanceof Error ? e.message : String(e) };
      }
      // Test mail.gw (same as mail.tm but different domain)
      try {
        const r = await fetch("https://api.mail.gw/domains", { headers: { Accept: "application/json" } });
        const t = await r.text();
        tests["mailgw"] = { status: r.status, body: t.slice(0, 400) };
      } catch (e) {
        tests["mailgw"] = { error: e instanceof Error ? e.message : String(e) };
      }
      // Test tempmail.lol
      try {
        const r = await fetch("https://api.tempmail.lol/generate", { headers: { Accept: "application/json" } });
        const t = await r.text();
        tests["tempmail.lol"] = { status: r.status, body: t.slice(0, 400) };
      } catch (e) {
        tests["tempmail.lol"] = { error: e instanceof Error ? e.message : String(e) };
      }
      return NextResponse.json(tests, { headers: corsHeaders() });
    }
    if (debug === "fetch2") {
      try {
        const test = await fetch("https://example.com", { headers: { Accept: "text/html" } });
        const txt = await test.text();
        return NextResponse.json({ fetchOk: true, status: test.status, bodyPreview: txt.slice(0, 200) }, { headers: corsHeaders() });
      } catch (e) {
        return NextResponse.json({ fetchOk: false, error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: corsHeaders() });
      }
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
