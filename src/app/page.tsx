'use client';

/* ---------------------------------------------------------------------------
 * Hi Temp Mail — home route.
 * Flow: / renders the intro/landing experience first; every "Open app" action
 * on the landing page posts HI_TEMPMAIL_LAUNCH and this shell crossfades to
 * the app iframe. The app stays mounted afterwards (hidden, still polling) so
 * the generated mailbox survives a round-trip; the app's brand button posts
 * HI_TEMPMAIL_HOME to come back to the landing page.
 * JSON-LD + <noscript> content below remains crawlable by search engines and
 * AI/LLM agents, since iframe content is not indexed under this URL.
 * ------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

const SITE_NAME = "Hi Temp Mail";
const SITE_DESCRIPTION =
  "Free disposable email with instant temporary addresses, OTP auto-detection and saved mailboxes you can restore days later. No login, no signup, just privacy.";

const LAUNCH_MSG = "HI_TEMPMAIL_LAUNCH";
const HOME_MSG = "HI_TEMPMAIL_HOME";

const FAQ = [
  {
    q: "What is a temporary email address?",
    a: "A disposable email address is a real, working inbox used instead of your personal email for signups. It receives mail like a normal address but is not connected to your identity.",
  },
  {
    q: "How long does a mailbox last?",
    a: "10 minutes by default with one-tap extend. Saved mailboxes can be restored any time — the same day or days later — and keep receiving mail.",
  },
  {
    q: "Can I receive OTP and verification codes?",
    a: "Yes. 4-8 digit codes are auto-detected and shown as a copyable chip in the inbox and a large copy button in the message view, with an optional auto-copy setting.",
  },
  {
    q: "What does saving a mailbox do?",
    a: "It stores the mailbox address and password in your browser's local storage only — never on our servers — so you can reopen the exact mailbox later and continue receiving mail.",
  },
  {
    q: "Do you read or store my emails?",
    a: "No. The app runs entirely in your browser with no server database; messages are stored by the Mail.tm service. There are no analytics, ads or tracking.",
  },
  {
    q: "Is Hi Temp Mail free?",
    a: "Yes — every feature is free. No account, no subscription, no ads.",
  },
  {
    q: "Is it safe for banking or important accounts?",
    a: "No. Disposable addresses are for low-risk signups only — trials, downloads, forums. Never use one for accounts whose loss would harm you.",
  },
  {
    q: "How do I delete everything?",
    a: "Delete Mail removes the current mailbox from the provider, Clear all in Settings empties the saved vault, and clearing your browser's site data wipes every local trace. Nothing is stored anywhere else.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: "https://hitempmail.app/",
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: "https://hitempmail.app/",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript",
      description: SITE_DESCRIPTION,
      featureList: [
        "Instant temporary email addresses — no account needed",
        "OTP / verification code auto-detection with one-tap copy",
        "Saved Mailboxes vault with restore days later",
        "Attachment viewing and download",
        "Privacy blur and remote-image (tracking pixel) blocking",
        "Sanitized email HTML rendering",
        "Inbox search, pull-to-refresh, sound & vibration alerts",
        "Backup export / import",
        "Light and dark themes",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "HowTo",
      name: "How to get a temporary email address with Hi Temp Mail",
      totalTime: "PT1M",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Open the app",
          text: "Open Hi Temp Mail — a secure disposable mailbox is generated instantly, no signup required.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Copy the address",
          text: "Tap Copy and paste the temporary address into any signup or verification form.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Receive and copy your code",
          text: "Incoming OTP/verification codes are detected automatically and offered as a one-tap copy chip.",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

type View = "landing" | "app";

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [appMounted, setAppMounted] = useState(false);
  const [appRevealed, setAppRevealed] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === LAUNCH_MSG) {
        setAppMounted(true);
        setView("app");
      } else if (data.type === HOME_MSG) {
        setView("landing");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const appActive = view === "app";

  useEffect(() => {
    if (!appMounted) return;
    // one tick after the app iframe mounts, reveal it — so the very first
    // appearance fades in from opacity-0 instead of popping in
    const id = window.setTimeout(() => setAppRevealed(true), 80);
    return () => window.clearTimeout(id);
  }, [appMounted]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#f5f3fb] dark:bg-[#0b0912]">
      {/* Structured data for search engines & AI agents */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Crawlable content: iframe documents are not indexed under this URL */}
      <noscript>
        <div className="mx-auto max-w-2xl p-8">
          <h1 className="text-2xl font-bold">{SITE_NAME} — Free Temporary Email, Instant OTPs</h1>
          <p className="mt-3">{SITE_DESCRIPTION}</p>
          <h2 className="mt-6 text-lg font-bold">Features</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Instant temporary email addresses — ready in seconds, no account</li>
            <li>10-minute mailbox lifetime with one-tap Extend</li>
            <li>Saved Mailboxes — restore the same mailbox days later; OTPs keep arriving</li>
            <li>OTP/verification code auto-detection with one-tap copy</li>
            <li>Attachments: view and download</li>
            <li>Privacy blur and remote-image (tracking pixel) blocking</li>
            <li>Sanitized email HTML — scripts and trackers never run</li>
            <li>Light &amp; dark themes, pull-to-refresh, backup export/import</li>
          </ul>
          <h2 className="mt-6 text-lg font-bold">How it works</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm">
            <li>Open the app — a secure mailbox is generated instantly.</li>
            <li>Copy the address and paste it into any signup form.</li>
            <li>Watch the inbox — verification codes are detected and offered as a one-tap copy chip.</li>
          </ol>
          <h2 className="mt-6 text-lg font-bold">Frequently asked questions</h2>
          {FAQ.map((f) => (
            <div key={f.q} className="mt-3">
              <h3 className="text-sm font-bold">{f.q}</h3>
              <p className="text-sm">{f.a}</p>
            </div>
          ))}
          <p className="mt-6 text-sm">
            <a className="text-pink-600 underline" href="/about.html">About</a> ·{" "}
            <a className="text-pink-600 underline" href="/faq.html">FAQ</a> ·{" "}
            <a className="text-pink-600 underline" href="/privacy.html">Privacy Policy</a> ·{" "}
            <a className="text-pink-600 underline" href="/disclaimer.html">Disclaimer</a>
          </p>
        </div>
      </noscript>

      {/* Landing / intro — always mounted so scroll position and theme persist */}
      <iframe
        src="/landing.html"
        title="Hi Temp Mail — Intro & overview"
        aria-hidden={appActive}
        inert={appActive}
        className={`absolute inset-0 h-full w-full border-0 ${
          appActive ? "pointer-events-none" : ""
        }`}
      />

      {/* The app — mounted on first open, kept alive so the mailbox persists */}
      {appMounted && (
        <iframe
          src="/ar-tempmail.html"
          title="Hi Temp Mail — Free Temporary Email, Instant OTPs"
          aria-hidden={!appActive}
          inert={!appActive}
          allow="clipboard-write"
          className={`absolute inset-0 z-10 h-full w-full border-0 transition-opacity duration-700 ease-out ${
            appRevealed && appActive ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
      )}
    </main>
  );
}
