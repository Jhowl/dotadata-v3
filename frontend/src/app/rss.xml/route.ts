import { NextResponse } from "next/server";

import { getBlogPosts } from "@/lib/blog-posts";

const BASE_URL = "https://dotadata.org";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toRssDate = (value: string) => new Date(value).toUTCString();

export async function GET() {
  const posts = await getBlogPosts();

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>DotaData Blog</title>
    <description>DotaData analysis, patch summaries, and Dota 2 strategy writing.</description>
    <link>${BASE_URL}</link>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts
      .slice(0, 20)
      .map(
        (post) => `
      <item>
        <title>${escapeXml(post.title)}</title>
        <link>${BASE_URL}/blog/${post.slug}</link>
        <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
        <pubDate>${toRssDate(post.publishedAt)}</pubDate>
        <description>${escapeXml(post.summary)}</description>
      </item>`
      )
      .join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

