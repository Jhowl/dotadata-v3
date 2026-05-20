"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type MobileNavItem = { href: string; label: string };

interface MobileNavProps {
  items: readonly MobileNavItem[];
  /** Translated label for the toggle button — keeps accessibility text localized. */
  toggleLabelOpen: string;
  toggleLabelClose: string;
}

/**
 * Mobile-only hamburger nav. The desktop nav in `site-header` is hidden below
 * `lg`, so without this component there's no way to navigate the site on a
 * phone. Implemented in vanilla React (no Radix Dialog dep) — it's a small
 * disclosure with: ESC + backdrop close, body scroll lock while open, focus
 * trapped lightly via "focus first link on open / return to toggle on close".
 */
export function MobileNav({ items, toggleLabelOpen, toggleLabelClose }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    // Capture the toggle button at effect time. By cleanup time the ref could
    // have changed (rerender, unmount) — React's exhaustive-deps lint enforces
    // this; using the captured node makes cleanup deterministic.
    const toggleButton = buttonRef.current;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Lock body scroll so iOS doesn't scroll the page behind the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Defer focus to next frame so the link is mounted before we grab focus.
    const focusTimer = window.setTimeout(() => firstLinkRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      // Return focus to the toggle so keyboard users land where they started.
      toggleButton?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? toggleLabelClose : toggleLabelOpen}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 top-16 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={toggleLabelOpen}
            className="fixed inset-x-0 top-16 z-40 mx-3 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-3 shadow-2xl backdrop-blur"
          >
            <ul className="flex flex-col gap-0.5">
              {items.map((item, index) => (
                <li key={item.href}>
                  <Link
                    ref={index === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:bg-muted focus-visible:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
