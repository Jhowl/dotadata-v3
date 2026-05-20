"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const COMMENT_BODY_MAX = 2000;
// Backend mounts everything under /api/v1; relative "/api/..." fetches hit
// Caddy which forwards to api:4000 but doesn't rewrite the path, so we need
// the full prefix here. Matches what NEXT_PUBLIC_API_BASE_URL points at.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

type Comment = {
  id: string;
  steamid64: string;
  personaName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  body: string;
  createdAt: string;
};

type Props = {
  entityType: "league" | "team";
  entityId: string;
};

const formatRelative = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

export function CommentsSection({ entityType, entityId }: Props) {
  const t = useTranslations("comments");
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentSteamid, setCurrentSteamid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [commentsRes, meRes] = await Promise.all([
          fetch(
            `${API_BASE}/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
            { cache: "no-store", credentials: "include" },
          ),
          fetch(`${API_BASE}/auth/me`, { cache: "no-store", credentials: "include" }),
        ]);
        if (!commentsRes.ok) throw new Error(String(commentsRes.status));
        // Backend returns the list as a bare Comment[] (controllers/comments.controller.ts).
        const data = (await commentsRes.json()) as Comment[];
        // /auth/me returns the AppUser shape ({ steamid64, ... }) or null
        // when the session is missing/invalid — not { steamid }.
        const me = meRes.ok
          ? ((await meRes.json()) as { steamid64: string } | null)
          : null;
        if (!cancelled) {
          setComments(Array.isArray(data) ? data : []);
          setCurrentSteamid(me?.steamid64 ?? null);
        }
      } catch {
        if (!cancelled) setLoadError(t("loadError"));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, t]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > COMMENT_BODY_MAX) {
      setSubmitError(t("tooLong", { max: COMMENT_BODY_MAX }));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entityType, entityId, body: trimmed }),
      });
      // Success: the created Comment as the bare body. Failure: the central
      // error handler shape `{ error: { code, message } }`.
      const payload = (await res.json().catch(() => null)) as
        | Comment
        | { error?: { code?: string; message?: string } }
        | null;
      if (!res.ok || !payload || !("id" in payload)) {
        const message =
          payload && "error" in payload ? payload.error?.message : undefined;
        setSubmitError(message ?? t("submitError"));
        return;
      }
      setComments((prev) => [payload, ...(prev ?? [])]);
      setBody("");
    } catch {
      setSubmitError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`${API_BASE}/comments/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
    } catch {
      // swallow
    }
  };

  return (
    <section
      aria-labelledby="comments-heading"
      className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-6"
    >
      <h2 id="comments-heading" className="font-display text-2xl font-semibold">
        {t("heading")}
      </h2>

      {currentSteamid ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("placeholder")}
            maxLength={COMMENT_BODY_MAX}
            rows={3}
            className="w-full resize-y rounded-md border border-border/60 bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {body.length}/{COMMENT_BODY_MAX}
            </span>
            <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </div>
          {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-background/50 p-4">
          <p className="text-sm text-muted-foreground">{t("signInPrompt")}</p>
          <Button asChild variant="outline" size="sm">
            <a href={`${API_BASE}/auth/steam/login`}>{t("signInCta")}</a>
          </Button>
        </div>
      )}

      {loadError ? (
        <p className="text-sm text-red-400">{loadError}</p>
      ) : comments === null ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const displayName =
              comment.personaName?.trim() || `Steam ${comment.steamid64.slice(-4)}`;
            return (
              <li
                key={comment.id}
                className="flex gap-3 rounded-md border border-border/40 bg-background/40 p-3"
              >
                {comment.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comment.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full border border-border/60 object-cover"
                  />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-muted" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {comment.profileUrl ? (
                      <a
                        href={comment.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-foreground hover:underline"
                      >
                        {displayName}
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{displayName}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(comment.createdAt)}
                    </span>
                    {currentSteamid === comment.steamid64 ? (
                      <button
                        type="button"
                        onClick={() => onDelete(comment.id)}
                        className="ml-auto text-xs text-muted-foreground hover:text-red-400"
                      >
                        {t("delete")}
                      </button>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                    {comment.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
