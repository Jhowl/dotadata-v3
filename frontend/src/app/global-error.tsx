"use client";

// Last-resort boundary. Fires only when the ROOT layout itself fails to
// render — which means next-intl, fonts, and global CSS may all be
// unavailable. Must render its own <html>/<body> (it replaces the root).
//
// Per Next docs this is rendered without app/layout.tsx, so we intentionally
// avoid the next-intl client provider, Tailwind utility classes, and the
// design tokens here. Inline styles only. English only.

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("global-error caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#0a0f17",
          color: "#e2e8f0",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", sans-serif',
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#18b99d",
              margin: 0,
            }}
          >
            Critical error
          </p>
          <h1
            style={{
              marginTop: "0.75rem",
              marginBottom: "1rem",
              fontSize: "2rem",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            DotaData isn&apos;t loading
          </h1>
          <p style={{ margin: "0 0 1.5rem", color: "#94a3b8", lineHeight: 1.6 }}>
            We hit a fatal error at the root of the app. This usually clears on a refresh —
            if it doesn&apos;t, try again in a few minutes.
          </p>
          {error.digest && (
            <p
              style={{
                marginBottom: "1.5rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                color: "#64748b",
              }}
            >
              Error reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #18b99d",
              background: "#18b99d",
              color: "#0a0f17",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
