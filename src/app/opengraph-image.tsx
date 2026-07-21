import { ImageResponse } from "next/og";
import { SITE } from "@/content/site";

export const alt = `${SITE.name} — ${SITE.tagline}, ${SITE.location}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(1000px 500px at 30% -10%, #124c5a55, transparent), linear-gradient(160deg, #0a1119, #05080d)",
          color: "#f2f5f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "#ffc300",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#c9bfa8",
            }}
          >
            {`${SITE.tagline} · ${SITE.location}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, color: "#aeb8bd", marginBottom: 8 }}>{SITE.name}</div>
          <div
            style={{
              fontSize: 92,
              lineHeight: 1,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: -2,
            }}
          >
            You drop it.
          </div>
          <div
            style={{
              fontSize: 92,
              lineHeight: 1,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: -2,
              color: "#ffc300",
            }}
          >
            We dive for it.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#8f8974", letterSpacing: 2 }}>
          {`Underwater recovery · Diving · WhatsApp ${SITE.phoneInternationalDisplay}`}
        </div>
      </div>
    ),
    { ...size },
  );
}
