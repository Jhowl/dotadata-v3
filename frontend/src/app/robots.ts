import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/blog", "/blog/", "/rss.xml"],
      disallow: ["/api/", "/auth/"],
    },
    sitemap: "https://dotadata.org/sitemap.xml",
  };
}
