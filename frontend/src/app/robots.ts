import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/", "/rss.xml"],
      },
      {
        userAgent: "*",
        disallow: "/api/",
      },
    ],
    sitemap: "https://dotadata.org/sitemap.xml",
  };
}

