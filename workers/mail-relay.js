/**
 * Hi Temp Mail — Cloudflare Worker mail relay (optional, user-hosted).
 *
 * WHY THIS EXISTS
 * ---------------
 * Mail.tm IP-bans shared serverless egress (e.g. Vercel datacenters: every
 * request dies with an empty 500), and browsers can't call api.mail.tm
 * directly (it only sends CORS headers to its own mail.tm origin). This
 * Worker runs on Cloudflare's anycast edge — different IPs, different
 * reputation — so it can reach the upstreams where Vercel cannot.
 *
 * WHAT IT DOES
 * ------------
 * Transparently forwards `{worker}/<api-path>?<query>` to
 * `https://api.mail.tm/<api-path>?<query>`, falling back to
 * `https://api.mail.gw/...` on empty-500 / 502-504, exactly like the bundled
 * Next.js relay (src/app/api/mailtm/[...path]/route.ts). Adds permissive
 * CORS headers, forwards only Content-Type + Authorization, passes bodies
 * and bytes through untouched (attachment downloads work).
 *
 * COST: free tier (100k req/day) is plenty for personal/small use.
 */

const UPSTREAMS = ["https://api.mail.tm", "https://api.mail.gw"];
const TIMEOUT_MS = 8000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "3600",
  };
}

async function fetchWithTimeout(url, init, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      const url = new URL(req.url);
      const apiPath = url.pathname.replace(/^\/+/, "");
      const suffix = url.search || "";

      const fwd = {};
      fwd["Accept"] = "application/json";
      const ct = req.headers.get("content-type");
      const auth = req.headers.get("authorization");
      if (ct) fwd["Content-Type"] = ct;
      if (auth) fwd["Authorization"] = auth;

      let body;
      if (req.method !== "GET" && req.method !== "HEAD") {
        const buf = await req.arrayBuffer().catch(() => null);
        body = buf && buf.byteLength ? buf : undefined;
      }

      let res = null;
      for (const base of UPSTREAMS) {
        const target = `${base}/${apiPath}${suffix}`;
        try {
          const r = await fetchWithTimeout(target, { method: req.method, headers: fwd, body }, TIMEOUT_MS);
          if (r.status >= 500 && r.status <= 599) {
            const isPrimary = base.includes("api.mail.tm");
            if (isPrimary) continue; // fall through to mail.gw
          }
          res = r;
          break;
        } catch (e) {
          console.warn(`[mail-relay] ${target} failed:`, e && e.message ? e.message : String(e));
          continue;
        }
      }

      if (!res) {
        return Response.json(
          { message: "Relay error: all mail upstreams unreachable" },
          { status: 502, headers: { ...corsHeaders(), "Cache-Control": "no-store" } }
        );
      }

      const outHeaders = new Headers(corsHeaders());
      outHeaders.set("Cache-Control", "no-store");
      const resCT = res.headers.get("content-type");
      if (resCT) outHeaders.set("Content-Type", resCT);

      if (res.status === 204) {
        return new Response(null, { status: 204, headers: outHeaders });
      }
      const buf = await res.arrayBuffer();
      return new Response(buf, { status: res.status, headers: outHeaders });
    } catch (err) {
      const message = err && err.message ? err.message : "relay error";
      return Response.json(
        { message: `Relay error: ${message}` },
        { status: 502, headers: { ...corsHeaders(), "Cache-Control": "no-store" } }
      );
    }
  },
};
