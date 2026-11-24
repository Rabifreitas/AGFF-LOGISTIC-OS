import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MOBI LOG OS",
    short_name: "MOBI LOG",
    description: "Mobility & Logistics Operating System",
    start_url: "/app/driver",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1D3A",
    theme_color: "#0B1D3A",
    lang: "pt-PT",
    icons: [
      { src: "/brand/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
