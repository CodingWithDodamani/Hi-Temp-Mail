/* ---------------------------------------------------------------------------
 * Hi Temp Mail — agent-friendly 404.
 * Next.js serves this with a real HTTP 404 status. Besides the human-readable
 * message it carries a short markdown recovery block (in <pre>) pointing
 * crawlers and AI agents at the sitemap, llms.txt, docs index and OpenAPI
 * spec, so a dead end never looks like a valid app route.
 * ------------------------------------------------------------------------- */

const RECOVERY_MD = `# 404 — page not found (Hi Temp Mail)

This path does not exist. Where to look next:

- Home / open the app: https://hitempmail.app/
- About: https://hitempmail.app/about.html
- Contact: https://hitempmail.app/contact.html
- FAQ: https://hitempmail.app/faq.html
- Privacy Policy: https://hitempmail.app/privacy.html
- Disclaimer: https://hitempmail.app/disclaimer.html
- Developer docs: https://hitempmail.app/docs.html
- Machine index (llms.txt): https://hitempmail.app/llms.txt
- Full docs (llms-full.txt): https://hitempmail.app/llms-full.txt
- API spec (OpenAPI): https://hitempmail.app/openapi.json
- Sitemap: https://hitempmail.app/sitemap.xml
`;

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center bg-[#f5f3fb] p-8 dark:bg-[#0b0912]">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-pink-600 dark:text-pink-400">
        Hi Temp Mail
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        404 — this page doesn&apos;t exist
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        The address you followed isn&apos;t part of Hi Temp Mail — our app lives on a
        single page plus a handful of info pages. Pick a destination below instead
        of guessing URLs.
      </p>
      <ul className="mt-6 grid gap-2 text-sm font-semibold sm:grid-cols-2">
        <li><a className="text-pink-600 underline dark:text-pink-400" href="/">Home — open the app</a></li>
        <li><a className="text-pink-600 underline dark:text-pink-400" href="/about.html">About</a></li>
        <li><a className="text-pink-600 underline dark:text-pink-400" href="/contact.html">Contact</a></li>
        <li><a className="text-pink-600 underline dark:text-pink-400" href="/faq.html">FAQ</a></li>
        <li><a className="text-pink-600 underline dark:text-pink-400" href="/privacy.html">Privacy Policy</a></li>
        <li><a className="text-pink-600 underline dark:text-pink-400" href="/docs.html">Developer docs</a></li>
      </ul>
      {/* Machine-readable recovery block for crawlers & AI agents */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        For crawlers &amp; AI agents
      </h2>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {RECOVERY_MD}
      </pre>
    </main>
  );
}
