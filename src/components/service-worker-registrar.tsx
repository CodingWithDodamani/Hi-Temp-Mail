'use client';

/* ---------------------------------------------------------------------------
 * Hi Temp Mail — PWA service worker registration.
 *
 * Registered in production builds only: during development Turbopack serves
 * mutable chunk URLs, and a caching service worker would risk stale HMR
 * states. On the deployed site (Vercel) the SW enables offline access and
 * installability. Registration failures are swallowed by design — the app
 * must never surface a console error because of PWA plumbing.
 * ------------------------------------------------------------------------- */

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* best-effort only: PWA features degrade gracefully */
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
