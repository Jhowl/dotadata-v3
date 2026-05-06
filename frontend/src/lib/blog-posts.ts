import { apiFetch } from "@/lib/api/client";

export type BlogBlockType = "paragraph" | "heading" | "list";

export type BlogInline =
  | { type: "text"; value: string }
  | { type: "link"; text: string; href: string };

export type BlogPostBlock =
  | { type: "paragraph"; text: string; inlines: BlogInline[] }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; items: string[]; itemInlines: BlogInline[][] };

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt?: string | null;
  author: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  blocks: BlogPostBlock[];
};

export type BlogPostSummary = Omit<BlogPost, "blocks">;

const INLINE_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export const parseInlines = (raw: string): BlogInline[] => {
  const segments: BlogInline[] = [];
  let cursor = 0;
  INLINE_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_LINK_PATTERN.exec(raw)) !== null) {
    if (match.index > cursor) {
      const value = raw.slice(cursor, match.index);
      if (value) segments.push({ type: "text", value });
    }
    const text = match[1].trim();
    const href = match[2].trim();
    if (text && href) segments.push({ type: "link", text, href });
    cursor = match.index + match[0].length;
  }

  if (cursor < raw.length) {
    const tail = raw.slice(cursor);
    if (tail) segments.push({ type: "text", value: tail });
  }

  if (!segments.length) segments.push({ type: "text", value: raw });
  return segments;
};

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

export const getBlogPosts = (): Promise<BlogPostSummary[]> =>
  safe(() => apiFetch<BlogPostSummary[]>("/blog", { revalidate: 300 }), []);

export const getBlogPostBySlug = (slug: string): Promise<BlogPost | undefined> =>
  safe(
    async () =>
      (await apiFetch<BlogPost>(`/blog/${encodeURIComponent(slug)}`, {
        revalidate: 900,
      })) ?? undefined,
    undefined,
  );
