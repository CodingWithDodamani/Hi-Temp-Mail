/**
 * Agentic-readiness verification for Hi Temp Mail.
 *
 * Runs the same class of checks as the Is Agentic audit against a running
 * instance (local `next dev` or the deployed site):
 *
 *   BASE_URL=https://hitempmail.vercel.app npm run verify:agentic
 *   npm run verify:agentic   (defaults to http://127.0.0.1:3000)
 *
 * Exit code 0 = all checks pass, 1 = at least one failure.
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

let failures = 0;

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name} — ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. SSR homepage: real H1 + 500+ chars of text in raw HTML (no JS executed here).
await check("1 home SSR has H1 + 500 chars", async () => {
  const res = await fetch(`${BASE}/`);
  assert(res.status === 200, `status ${res.status}`);
  const html = await res.text();
  assert(/<h1[\s>]/i.test(html), "no <h1> in raw HTML");
  const len = stripTags(html).length;
  assert(len >= 500, `only ${len} chars of text`);
  assert(/Organization/.test(html), "no Organization JSON-LD");
  assert(/contactPoint/.test(html), "Organization lacks contactPoint");
  assert(/PostalAddress|addressCountry/.test(html), "Organization lacks address");
  return `${len} chars`;
});

// 2. Agent-friendly 404: real 404 + recovery pointers.
await check("2 404 status + recovery body", async () => {
  const res = await fetch(`${BASE}/some-path-that-does-not-exist-zzz`);
  assert(res.status === 404, `status ${res.status}, expected 404`);
  const body = await res.text();
  assert(/llms\.txt/.test(body), "no llms.txt pointer");
  assert(/sitemap\.xml/.test(body), "no sitemap pointer");
  return "404 with pointers";
});

// 3a. Markdown negotiation: Accept: text/markdown -> text/markdown + Vary: Accept.
await check("3a markdown variant + Vary", async () => {
  const res = await fetch(`${BASE}/`, { headers: { Accept: "text/markdown" } });
  const ct = res.headers.get("content-type") || "";
  assert(res.status === 200, `status ${res.status}`);
  assert(ct.includes("text/markdown"), `content-type is ${ct}`);
  const vary = res.headers.get("vary") || "";
  assert(/(^|,)\s*accept(\s|,|$)/i.test(vary), `Vary missing Accept (got "${vary}")`);
  const md = await res.text();
  assert(/^# /m.test(md), "body is not markdown");
  return `${ct}; vary=${vary}`;
});

// 3b. HTML homepage must also carry Vary: Accept (edge-enforced via
// vercel.json in production; Next.js normalizes Vary on documents in local
// dev/prod, so this passes on the deployed site, not on localhost).
await check("3b HTML homepage Vary includes Accept", async () => {
  const htmlRes = await fetch(`${BASE}/`);
  const htmlVary = htmlRes.headers.get("vary") || "";
  assert(/(^|,)\s*accept(\s|,|$)/i.test(htmlVary) || htmlVary.includes("*"), `Vary missing Accept (got "${htmlVary}")`);
  return `vary=${htmlVary}`;
});

// 4. Developer resources discoverable.
await check("4 openapi.json + docs.html", async () => {
  const spec = await fetch(`${BASE}/openapi.json`);
  assert(spec.status === 200, `openapi status ${spec.status}`);
  const json = await spec.json();
  assert(String(json.openapi || "").startsWith("3."), "not OpenAPI 3.x");
  assert(/Hi Temp Mail/.test(json.info?.title || ""), "product name missing from spec title");
  assert(json.paths && json.paths["/domains"], "no /domains path");
  const docs = await fetch(`${BASE}/docs.html`);
  assert(docs.status === 200, `docs status ${docs.status}`);
  const html = await docs.text();
  assert(/Hi Temp Mail/.test(html), "product name missing from docs");
  assert(stripTags(html).length >= 500, "docs too thin");
  return `${Object.keys(json.paths).length} paths`;
});

// 5/6. llms.txt: when-to-use + dev links.
await check("5 llms.txt when-to-use + resources", async () => {
  const res = await fetch(`${BASE}/llms.txt`);
  assert(res.status === 200, `status ${res.status}`);
  const txt = await res.text();
  assert(/when to use/i.test(txt), "no when-to-use section");
  assert(/openapi\.json/.test(txt), "no openapi link");
  assert(/\.well-known\/mcp/.test(txt), "no MCP link");
  assert(/contact\.html/.test(txt), "no contact link");
  return `${txt.length} chars`;
});

// 8. Trust pages with 500+ chars each, extensionless + .html.
await check("6 trust pages /about /contact /privacy", async () => {
  for (const p of ["/about", "/contact", "/privacy", "/about.html", "/contact.html", "/privacy.html"]) {
    const res = await fetch(`${BASE}${p}`);
    assert(res.status === 200, `${p} status ${res.status}`);
    const len = stripTags(await res.text()).length;
    assert(len >= 500, `${p} only ${len} chars`);
  }
  return "6/6 ok";
});

// 9. MCP: manifest + initialize + tools/list + tools/call.
await check("7 MCP handshake + tools", async () => {
  const base = `${BASE}/.well-known/mcp`;
  const manifest = await fetch(base);
  assert(manifest.status === 200, `manifest status ${manifest.status}`);
  const init = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "0" } } }),
  });
  assert(init.status === 200, `initialize status ${init.status}`);
  const initJson = await init.json();
  assert(initJson.result?.serverInfo?.name === "hi-temp-mail-mcp", "bad serverInfo");
  const list = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  });
  const listJson = await list.json();
  const names = (listJson.result?.tools || []).map((t) => t.name);
  assert(names.includes("get_domains"), `tools missing get_domains (${names})`);
  const call = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_domains" } }),
  });
  const callJson = await call.json();
  const text = callJson.result?.content?.[0]?.text || "";
  assert(/domain/i.test(text), "get_domains returned no domains");
  return `tools: ${names.join(",")}`;
});

console.log(failures === 0 ? "\nAll agentic checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
