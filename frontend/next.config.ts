import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const ONE_YEAR = 60 * 60 * 24 * 365;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  images: {
    // Hero portraits and ability icons come from Steam's CDN. Allowing them
    // here lets next/image fetch + re-encode to WebP/AVIF and serve responsive
    // sizes via the /_next/image route. Team logos (team.logoUrl) come from
    // arbitrary org-controlled CDNs we don't enumerate — those keep using
    // `<Image unoptimized>` to bypass the optimizer.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/apps/dota2/images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/thumbnails/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR}, immutable`,
          },
        ],
      },
      {
        source: "/mascot/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR}, immutable`,
          },
        ],
      },
      {
        source: "/:path(favicon\\.ico|favicon-96x96\\.png|apple-touch-icon\\.png|web-app-manifest-192x192\\.png|web-app-manifest-512x512\\.png|site\\.webmanifest)",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR}, immutable`,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
