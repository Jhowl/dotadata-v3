import { ImageResponse } from "next/og";

import { routing } from "@/i18n/routing";

export const runtime = "edge";
export const alt = "DotaData — Competitive Dota 2 statistics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateImageMetadata() {
  return routing.locales.map((locale) => ({ id: locale }));
}

export default async function OpenGraphImage({ params }: { params: { locale: string } }) {
  const isRu = params.locale === "ru";
  const headline = isRu ? "Каждая серия. Каждый патч." : "Every series. Every patch.";
  const subline = isRu ? "Статистика профессиональной Dota 2" : "Competitive Dota 2 statistics";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(circle at 20% 0%, rgba(24,185,157,0.35), transparent 55%), radial-gradient(circle at 100% 100%, rgba(235,189,80,0.30), transparent 50%), #0b0f10",
          color: "#f7f7f5",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#18b99d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 28,
              color: "#0b0f10",
            }}
          >
            D
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>
            DotaData
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 980,
            }}
          >
            {headline}
          </div>
          <div style={{ fontSize: 32, color: "rgba(247,247,245,0.72)" }}>
            {subline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(247,247,245,0.6)",
          }}
        >
          <div>dotadata.org</div>
          <div>{isRu ? "Лиги · Команды · Патчи" : "Leagues · Teams · Patches"}</div>
        </div>
      </div>
    ),
    size,
  );
}
