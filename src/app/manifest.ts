import type { MetadataRoute } from "next";
import { SITE } from "@/content/site";
import { BRAND } from "@/content/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description:
      "Underwater recovery and diving in Koh Samui, Thailand. You drop it. We dive for it.",
    start_url: "/",
    display: "standalone",
    background_color: BRAND.blueblack,
    theme_color: BRAND.blueblack,
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
