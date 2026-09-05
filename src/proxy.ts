import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ---------------------------------------------------------------------------
 * Hi Temp Mail — acceptmarkdown.com style content negotiation for the homepage.
 *
 * - If the request's Accept header includes `text/markdown`, respond with a
 *   markdown rendering of the homepage (Content-Type: text/markdown).
 * - All markdown responses carry `Vary: Accept`. The HTML homepage response
 *   gets `Vary: Accept` appended here as well, plus an edge-level `Vary:
 *   Accept` from vercel.json — belt and suspenders, because the App Router
 *   framework normalizes `Vary` on document responses downstream of this
 *   function and of next.config headers(). Without it, a CDN could serve a
 *   cached HTML variant to an agent asking for markdown (or vice versa).
 *
 * Implemented as Next.js 16 `proxy` (the successor of `middleware`).
 * ------------------------------------------------------------------------- */

const HOME_MARKDOWN = `# Hi Temp Mail — Free Temporary Email, Instant OTPs

> Free disposable email with instant temporary addresses, OTP auto-detection and saved mailboxes you can restore days later. No login, no signup, just privacy.

## Open the app

https://hitempmail.app/ — a working disposable mailbox is generated instantly in your browser. No account needed.

## How it works

1. Open the app — a secure mailbox is generated instantly.
2. Copy the address and paste it into any signup or verification form.
3. Watch the inbox — OTP/verification codes are detected automatically and offered as a one-tap copy chip.

## Key facts

- Cost: free, no account, no ads, no analytics, no tracking.
- Mailbox lifetime: 10 minutes by default, extendable; saved mailboxes restore days later.
- OTP detection: 4–8 digit codes with optional auto-copy.
- Privacy: remote images blocked, email HTML sanitized, credentials stay in browser localStorage.

## When to use Hi Temp Mail

- Receiving OTP/verification codes while testing signups or onboarding flows.
- Throwaway addresses for free trials, downloads, forums, Wi-Fi portals.
- Automated QA that needs a real inbox without managing email infrastructure.

Do NOT use it for banking, government, healthcare, work, or any account whose loss would harm you. It is receive-only (sending is not supported).

## Machine resources

- Short agent index: https://hitempmail.app/llms.txt
- Full documentation: https://hitempmail.app/llms-full.txt
- Developer docs: https://hitempmail.app/docs.html
- API spec (OpenAPI 3.1): https://hitempmail.app/openapi.json
- MCP endpoint (Streamable HTTP): https://hitempmail.app/.well-known/mcp
- Sitemap: https://hitempmail.app/sitemap.xml
- Contact: https://hitempmail.app/contact.html
`;

function acceptsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  return accept.split(",").some((part) => {
    const type = part.split(";")[0].trim().toLowerCase();
    return type === "text/markdown" || type === "text/x-markdown";
  });
}

export default function proxy(req: NextRequest) {
  if (acceptsMarkdown(req.headers.get("accept"))) {
    return new NextResponse(HOME_MARKDOWN, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        // Critical: without Vary: Accept a CDN could cache one variant and
        // serve it to clients asking for the other.
        Vary: "Accept",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  }

  const res = NextResponse.next();
  const vary = res.headers.get("vary");
  if (!vary) {
    res.headers.set("Vary", "Accept");
  } else if (!/(^|,)\s*accept(\s|,|$)/i.test(vary) && !/\*/.test(vary)) {
    res.headers.set("Vary", `${vary}, Accept`);
  }
  return res;
}

export const config = {
  matcher: ["/"],
};
