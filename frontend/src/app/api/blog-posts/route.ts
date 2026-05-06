import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/client";

const ADMIN_TOKEN = process.env.BLOG_ADMIN_TOKEN;
const MAX_BODY_BYTES = 120_000;

const jsonResponse = (payload: Record<string, unknown>, status: number) =>
  NextResponse.json(payload, {
    status,
    headers: { "Content-Type": "application/json" },
  });

const normalizeSlug = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const candidate = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : "";
};

const normalizeText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normalizeDate = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  const asString = String(value);
  const parsed = Date.parse(asString);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const normalizeTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return jsonResponse({ error: "Database write client unavailable." }, 500);
  }

  if (!ADMIN_TOKEN) {
    return jsonResponse({ error: "Admin token not configured." }, 500);
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const providedToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : authorization;

  if (!providedToken || providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Payload too large." }, 413);
  }

  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return jsonResponse({ error: "Unsupported content type." }, 415);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ error: "Invalid payload." }, 400);
  }

  const slug = normalizeSlug(payload.slug);
  const title = normalizeText(payload.title);
  const summary = normalizeText(payload.summary);
  const content = normalizeText(payload.content);
  const author = normalizeText(payload.author) || "DotaData Editorial";
  const publishedAt = normalizeDate(payload.publishedAt ?? payload.published_at);
  const seoTitle = normalizeText(payload.seoTitle ?? payload.seo_title);
  const seoDescription = normalizeText(payload.seoDescription ?? payload.seo_description);
  const isPublished = typeof payload.isPublished === "boolean" ? payload.isPublished : true;
  const tags = normalizeTags(payload.tags);
  const updatedAt = normalizeDate(payload.updatedAt ?? payload.updated_at) ?? new Date().toISOString();

  if (!slug || !title || !summary || !content || !publishedAt) {
    return jsonResponse(
      { error: "Missing or invalid required fields: slug, title, summary, content, publishedAt." },
      400
    );
  }

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .upsert(
      {
        slug,
        title,
        summary,
        content_markdown: content,
        published_at: publishedAt,
        updated_at: updatedAt,
        author,
        tags: tags.length ? tags : ["DotaData"],
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        is_published: isPublished,
      },
      { onConflict: "slug", ignoreDuplicates: false }
    )
    .select("slug")
    .maybeSingle();

  if (error || !data?.slug) {
    return jsonResponse({ error: "Failed to save post." }, 500);
  }

  return jsonResponse(
    {
      ok: true,
      slug: data.slug,
    },
    200
  );
}

