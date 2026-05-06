import { notFound } from "next/navigation";
import Script from "next/script";
import { Fragment } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ShareButton } from "@/components/share-button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import {
  getBlogPostBySlug,
  getBlogPosts,
  parseInlines,
  type BlogInline,
} from "@/lib/blog-posts";

const isInternalHref = (href: string) => href.startsWith("/") || href.startsWith("#");

const renderInlines = (
  inlines: BlogInline[] | undefined,
  fallbackText: string,
  keyPrefix: string,
) => {
  const segments = inlines && inlines.length ? inlines : parseInlines(fallbackText);
  return segments.map((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    if (segment.type === "text") {
      return <Fragment key={key}>{segment.value}</Fragment>;
    }
    if (isInternalHref(segment.href)) {
      return (
        <Link
          key={key}
          href={segment.href}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {segment.text}
        </Link>
      );
    }
    return (
      <a
        key={key}
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {segment.text}
      </a>
    );
  });
};

const estimateReadingMinutes = (text: string) => {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .length;

  return Math.max(1, Math.round(words / 170));
};

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return routing.locales.flatMap((locale) =>
    posts.map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getBlogPostBySlug(slug);
  const t = await getTranslations({ locale, namespace: "blogPost" });
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`;

  if (!post) {
    return {
      title: t("notFound"),
      description: t("notFoundDescription"),
      alternates: { canonical: `${localePath}/blog` },
    };
  }

  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.summary;

  return {
    title,
    description,
    alternates: {
      canonical: `${localePath}/blog/${post.slug}`,
      languages: { en: `/blog/${post.slug}`, ru: `/ru/blog/${post.slug}` },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${localePath}/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
  };
}

export const revalidate = 86400;

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blogPost");
  const tNav = await getTranslations("nav");
  const tBlog = await getTranslations("blog");
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const readingMinutes = estimateReadingMinutes(
    post.blocks
      .map((block) => {
        if (block.type === "paragraph") {
          return block.text;
        }

        if (block.type === "heading") {
          return block.text;
        }

        return block.items.join(" ");
      })
      .join(" ")
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author,
    },
    mainEntityOfPage: `https://dotadata.org/blog/${post.slug}`,
    url: `https://dotadata.org/blog/${post.slug}`,
    keywords: post.tags.join(", "),
    publisher: {
      "@type": "Organization",
      name: "DotaData",
      url: "https://dotadata.org",
    },
  };

  return (
    <article className="space-y-10">
      <Breadcrumbs items={[{ url: "/blog", title: tNav("blog") }, { title: post.title }]} />
      <Script id={`blog-${post.slug}-ld-json`} type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge className="w-fit bg-primary/10 text-primary">{t("headerBadge")}</Badge>
          <ShareButton
            title={post.title}
            text={t("shareText", { title: post.title, summary: post.summary })}
            url={`/blog/${post.slug}`}
          />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{post.title}</h1>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{formatDate(post.publishedAt)}</span>
          <span>•</span>
          <span>{post.author}</span>
          <span>•</span>
          <span>{tBlog("minRead", { minutes: readingMinutes })}</span>
          {post.updatedAt ? <span>• {tBlog("updated", { date: formatDate(post.updatedAt) })}</span> : null}
        </div>
        <p className="max-w-3xl text-muted-foreground">{post.summary}</p>
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </section>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-5 p-6">
          {post.blocks.map((block, index) => {
            const blockKey = `${post.slug}-block-${index}`;

            if (block.type === "paragraph") {
              return (
                <p key={blockKey} className="leading-relaxed text-muted-foreground">
                  {renderInlines(block.inlines, block.text, blockKey)}
                </p>
              );
            }

            if (block.type === "heading") {
              return block.level === 3 ? (
                <h3 key={blockKey} className="text-xl font-semibold">
                  {block.text}
                </h3>
              ) : (
                <h2 key={blockKey} className="text-2xl font-semibold">
                  {block.text}
                </h2>
              );
            }

            return (
              <ul key={blockKey} className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {block.items.map((item, itemIndex) => (
                  <li key={`${blockKey}-item-${itemIndex}`}>
                    {renderInlines(
                      block.itemInlines?.[itemIndex],
                      item,
                      `${blockKey}-item-${itemIndex}`,
                    )}
                  </li>
                ))}
              </ul>
            );
          })}
        </CardContent>
      </Card>
    </article>
  );
}
