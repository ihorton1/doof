import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import manifest from "../apps/bolts/src/app/manifest";

const css = readFileSync(new URL("../apps/bolts/src/app/globals.css", import.meta.url), "utf8");

function palette(selector: RegExp): Record<string, string> {
  const block = css.match(selector)?.[1];
  assert.ok(block, "The theme must define its color tokens");
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{3,8})\s*;/gi)]
    .map((match) => [match[1], match[2]]));
}

const light = palette(/:root\s*\{([^}]+)\}/);
const dark = { ...light, ...palette(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/) };

function luminance(hex: string) {
  const value = hex.slice(1);
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const [name, colors] of [["light", light], ["dark", dark]] as const) {
  test(`Bolts ${name} theme reserves yellow for accents and keeps neutral controls readable`, () => {
    assert.equal(colors.accent, "#facc15");
    assert.notEqual(colors.primary, colors.accent);
    const primaryChannels = [1, 3, 5].map((offset) => parseInt(colors.primary.slice(offset, offset + 2), 16));
    assert.ok(Math.max(...primaryChannels) - Math.min(...primaryChannels) <= 40, `${name}: neutral button background`);
    for (const background of ["primary", "primary-hover"]) {
      assert.ok(contrast(colors["primary-text"], colors[background]) >= 4.5, `${name}: button text on ${background}`);
    }
    for (const background of ["background", "surface", "subtle-surface", "hover"]) {
      assert.ok(contrast(colors.text, colors[background]) >= 4.5, `${name}: text on ${background}`);
      assert.ok(contrast(colors.focus, colors[background]) >= 3, `${name}: focus ring on ${background}`);
      assert.ok(contrast(colors.link, colors[background]) >= 4.5, `${name}: links on ${background}`);
    }
    for (const foreground of ["muted", "muted-strong", "secondary-text", "placeholder", "error"]) {
      for (const background of ["surface", "subtle-surface", "hover"]) {
        assert.ok(contrast(colors[foreground], colors[background]) >= 4.5, `${name}: ${foreground} text on ${background}`);
      }
    }
  });
}

test("Bolts install and launch backgrounds match the light theme", () => {
  const app = manifest();
  assert.equal(app.background_color, light.background);
  assert.equal(app.theme_color, light.background);
});
