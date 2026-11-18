import type { MetadataRoute } from "next";
import { appPath } from "../lib/paths";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: appPath(),
    name: "Bolts",
    short_name: "Bolts",
    description: "Keep your ideas and build on them, one discovery at a time.",
    start_url: appPath(),
    scope: appPath(),
    display: "standalone",
    background_color: "#f5f5f3",
    theme_color: "#f5f5f3",
    icons: [{ src: appPath("/icon"), sizes: "512x512", type: "image/png" }],
  };
}
