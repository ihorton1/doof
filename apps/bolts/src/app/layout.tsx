import type { Metadata, Viewport } from "next";
import React, { type ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolts",
  description: "Keep your ideas and build on them, one discovery at a time.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bolts",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
