import type { Metadata, Viewport } from "next";
import React, { type ReactNode } from "react";
import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, getTheme } from "../lib/theme";
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

export async function generateViewport(): Promise<Viewport> {
  const theme = getTheme((await cookies()).get(THEME_COOKIE_NAME)?.value);
  return {
    themeColor: theme === "dark" ? "#141418" : "#f5f5f3",
    colorScheme: theme,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = getTheme((await cookies()).get(THEME_COOKIE_NAME)?.value);
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
