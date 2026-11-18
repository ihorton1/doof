import { z } from "zod";

export const THEME_COOKIE_NAME = "bolts_theme";
export const themeSchema = z.enum(["light", "dark"], { error: "Choose Light or Dark." });
export type Theme = z.infer<typeof themeSchema>;
export type ThemeState = { theme: Theme; saved?: boolean; error?: string };

export function getTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
