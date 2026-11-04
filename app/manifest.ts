import type { MetadataRoute } from "next";

// Installierbare Web-App; die Icons erzeugen app/icon.tsx und app/maskable-icon/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "System One Playground",
    short_name: "System One",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d10",
    theme_color: "#0c0d10",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/maskable-icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/maskable-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
