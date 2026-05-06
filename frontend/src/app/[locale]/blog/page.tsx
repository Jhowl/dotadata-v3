import { setRequestLocale, getTranslations } from "next-intl/server";

import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { getBlogPosts } from "@/lib/blog-posts";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const path = locale === routing.defaultLocale ? "/blog" : `/${locale}/blog`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/blog", ru: "/ru/blog" } },
  };
}

export const revalidate = 86400;

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = await getBlogPosts();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge className="w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
          <ShareButton title={t("heroHeading")} text={t("shareText")} url="/blog" />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("heroLead")}</p>
      </section>

      <section className="space-y-4">
        {posts.length ? (
          posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="block" prefetch={false}>
              <Card className="border-border/60 bg-card/80 transition hover:border-primary/40">
                <CardContent className="space-y-3 p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(post.publishedAt)}</span>
                    <span className="text-muted-foreground/70">•</span>
                    <span>{post.author}</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">{post.title}</h2>
                  <p className="max-w-3xl text-sm text-muted-foreground">{post.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{t("noPosts")}</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
