import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#05080d",
        }}
      >
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: 999,
            border: "6px solid rgba(242,245,244,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 60,
              background: "#ffc300",
              borderRadius: "50% 50% 50% 50% / 65% 65% 35% 35%",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
