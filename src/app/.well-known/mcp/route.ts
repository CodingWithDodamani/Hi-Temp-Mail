import { NextRequest, NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
 * Hi Temp Mail — minimal MCP (Model Context Protocol) server.
 *
 * Stateless Streamable HTTP transport at /.well-known/mcp:
 *   POST JSON-RPC 2.0  →  initialize / tools/list / tools/call
 *   GET                →  human/agent-readable manifest (liveness + discovery)
 *
 * No auth, no sessions. Tools are read-only and backed by the same public
 * mail upstreams as the /api/mailtm relay, so this adds no new abuse surface.
 * ------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const SERVER_NAME = "hi-temp-mail-mcp";
const SERVER_VERSION = "1.0.0";
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL = "2025-06-18";
const UPSTREAM_TIMEOUT_MS = 8000;

const UPSTREAMS = ["https://api.mail.tm/domains", "https://api.mail.gw/domains"];

function baseHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
    Vary: "Accept",
  };
}

function jsonRpc(id: unknown, result: unknown, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { status, headers: baseHeaders() }
  );
}

function jsonRpcError(
  id: unknown,
  code: number,
  message: string,
  status = 400,
  data?: unknown
) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } },
    { status, headers: baseHeaders() }
  );
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** First successful (200 + non-empty) upstream response wins; both race in parallel. */
async function fetchDomains(): Promise<{ ok: boolean; status: number; body: string; source: string }> {
  const attempts = await Promise.allSettled(
    UPSTREAMS.map(async (url) => {
      const res = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS);
      const text = await res.text();
      return { url, status: res.status, body: text };
    })
  );
  for (const a of attempts) {
    if (a.status === "fulfilled" && a.value.status === 200 && a.value.body.trim() !== "") {
      return { ok: true, status: 200, body: a.value.body, source: a.value.url };
    }
  }
  const first = attempts.find((a) => a.status === "fulfilled") as
    | PromiseFulfilledResult<{ url: string; status: number; body: string }>
    | undefined;
  return {
    ok: false,
    status: first?.value.status ?? 502,
    body: first?.value.body ?? "All mail upstreams unreachable",
    source: first?.value.url ?? "none",
  };
}

const TOOLS = [
  {
    name: "get_domains",
    description:
      "List the active public disposable-email domains from Hi Temp Mail. Use a listed domain to build a mailbox address, then register it via POST /api/mailtm/accounts. Free, no auth.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "server_health",
    description:
      "Check that the Hi Temp Mail relay and its mail upstreams are reachable. Returns per-upstream status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

async function handleRpc(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonRpcError(null, -32700, "Parse error: body must be a JSON-RPC object");
  }
  const msg = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return jsonRpcError(msg.id ?? null, -32600, "Invalid Request");
  }

  switch (msg.method) {
    case "initialize": {
      const params = (msg.params ?? {}) as { protocolVersion?: unknown };
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : null;
      const negotiated =
        requested && SUPPORTED_PROTOCOLS.includes(requested) ? requested : LATEST_PROTOCOL;
      return jsonRpc(msg.id, {
        protocolVersion: negotiated,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
    }

    case "notifications/initialized":
      // Stateless server: acknowledge with 202 and no body.
      return new NextResponse(null, { status: 202, headers: baseHeaders() });

    case "tools/list":
      return jsonRpc(msg.id, { tools: TOOLS });

    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: unknown; arguments?: unknown };
      if (typeof params.name !== "string") {
        return jsonRpcError(msg.id, -32602, "Invalid params: tools/call requires a string `name`");
      }
      if (params.name === "get_domains") {
        const r = await fetchDomains();
        if (!r.ok) {
          return jsonRpcError(msg.id, -32000, `Mail upstreams unavailable (last status ${r.status})`, 502);
        }
        return jsonRpc(msg.id, {
          content: [{ type: "text", text: r.body }],
        });
      }
      if (params.name === "server_health") {
        const checks = await Promise.allSettled(
          UPSTREAMS.map(async (url) => {
            try {
              const res = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS);
              await res.arrayBuffer();
              return { upstream: url, reachable: res.status === 200, status: res.status };
            } catch (e) {
              return { upstream: url, reachable: false, error: e instanceof Error ? e.message : String(e) };
            }
          })
        );
        return jsonRpc(msg.id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  server: SERVER_NAME,
                  version: SERVER_VERSION,
                  relay: "ok",
                  upstreams: checks.map((c) =>
                    c.status === "fulfilled" ? c.value : { reachable: false, error: "settled-error" }
                  ),
                },
                null,
                2
              ),
            },
          ],
        });
      }
      return jsonRpcError(msg.id, -32602, `Unknown tool: ${params.name}`);
    }

    default:
      return jsonRpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON");
  }
  try {
    return await handleRpc(body);
  } catch (err) {
    return jsonRpcError(null, -32603, err instanceof Error ? err.message : "Internal error", 500);
  }
}

/** Liveness + discovery manifest for auditors, humans and agents. */
export async function GET() {
  return NextResponse.json(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      protocol: "mcp",
      transport: "streamable-http",
      endpoint: "/.well-known/mcp",
      supportedProtocolVersions: SUPPORTED_PROTOCOLS,
      stateless: true,
      auth: "none",
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      usage: {
        initialize: 'POST {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"your-agent","version":"0.0.0"}}}',
        listTools: 'POST {"jsonrpc":"2.0","id":2,"method":"tools/list"}',
        callTool: 'POST {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_domains"}}',
      },
      docs: "https://hitempmail.app/docs.html",
      openapi: "https://hitempmail.app/openapi.json",
    },
    { headers: { ...baseHeaders(), "Cache-Control": "public, max-age=300" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: baseHeaders() });
}
