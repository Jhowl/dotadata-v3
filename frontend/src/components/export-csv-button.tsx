"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ExportCsvButtonProps = {
  href: string;
  label?: string;
};

export function ExportCsvButton({ href, label = "Export CSV" }: ExportCsvButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const handleClick = useCallback(async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Export failed.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] ?? "export.csv";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsLoading(false);
    }
  }, [href, isLoading]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={isLoading}>
        {isLoading ? "Exporting..." : label}
      </Button>
      {error ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border/60 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg">
          {error}
        </div>
      ) : null}
    </>
  );
}
