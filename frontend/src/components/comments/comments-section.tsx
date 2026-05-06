"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const COMMENT_BODY_MAX = 2000;

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
            `/api/comments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
            { cache: "no-store" },
          ),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        if (!commentsRes.ok) throw new Error(String(commentsRes.status));
        const data = (await commentsRes.json()) as { comments: Comment[] };
        const me = meRes.ok ? ((await meRes.json()) as { steamid: string | null }) : { steamid: null };
        if (!cancelled) {
          setComments(data.comments ?? []);
          setCurrentSteamid(me.steamid);
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
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, body: trimmed }),
      });
      const data = (await res.json()) as { comment?: Comment; error?: string };
      if (!res.ok || !data.comment) {
        setSubmitError(data.error ?? t("submitError"));
        return;
      }
      setComments((prev) => [data.comment as Comment, ...(prev ?? [])]);
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
      const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
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
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/auth/steam/login">{t("signInCta")}</a>
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
