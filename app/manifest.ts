import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "footfall",
    short_name: "footfall",
    theme_color: "#faf9f7",
    background_color: "#faf9f7",
    display: "standalone",
    start_url: "/app",
    icons: [
      {
        src: "/brand/logo-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/logo-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/logo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
