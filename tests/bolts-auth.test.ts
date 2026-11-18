import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { passwordSession } from "../packages/auth/session";
import { config, proxy } from "../apps/bolts/src/proxy";
import { actionRedirectUrl, appPath, safeNextPath } from "../apps/bolts/src/lib/paths";
import * as bolts from "../apps/bolts/src/lib/auth";
import * as doof from "../src/lib/auth";

test("Bolts proxy matches its normalized base-path root as well as private pages", () => {
  const nextConfig = { basePath: "/bolts", trailingSlash: true };
  for (const url of ["/bolts", "/bolts/", "/bolts/ideas/new", "/bolts/ideas/new/", "/bolts/settings/"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig, url }), true, url);
  }
  for (const url of ["/bolts/_next/static/app.js", "/bolts/_next/image", "/bolts/favicon.ico"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig, url }), false, url);
  }
});

test("password sessions preserve Doof cookie signatures and isolate Bolts", (context) => {
  const values = {
    APP_PASSWORD: "unit-test-password",
    COOKIE_SECRET: "unit-test-doof-cookie-secret",
    BOLTS_APP_PASSWORD: "unit-test-password",
    BOLTS_COOKIE_SECRET: "unit-test-bolts-cookie-secret",
  };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    context.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const expires = String(Date.now() + 60000);
  const oldCookie = `${expires}.${createHmac("sha256", values.COOKIE_SECRET).update(expires).digest("hex")}`;
  assert.equal(doof.isValidSessionCookie(oldCookie), true);
  assert.equal(bolts.isValidSessionCookie(oldCookie), false);
  const cookie = bolts.createSessionCookieValue();
  assert.equal(bolts.isValidSessionCookie(cookie), true);
  assert.equal(doof.isValidSessionCookie(cookie), false);
  assert.equal(bolts.SESSION_COOKIE_NAME, "bolts_session");
  assert.equal(bolts.checkPassword(values.BOLTS_APP_PASSWORD), true);
  assert.equal(bolts.checkPassword("incorrect-test-password"), false);
  assert.equal(bolts.isValidSessionCookie(`${cookie}.extra`), false);
  assert.equal(bolts.isValidSessionCookie("0.bad"), false);
  assert.equal(bolts.isValidSessionCookie(undefined), false);

  const unauthenticated = proxy(new NextRequest("https://example.com/bolts/ideas/new", {
    nextConfig: { basePath: "/bolts" },
  }));
  const destination = new URL(unauthenticated.headers.get("location")!);
  assert.equal(destination.pathname, "/bolts/login");
  assert.equal(destination.searchParams.get("next"), "/ideas/new");
  const settings = proxy(new NextRequest("https://example.com/bolts/settings/", {
    nextConfig: { basePath: "/bolts" },
    headers: { cookie: "bolts_theme=dark" },
  }));
  const settingsLogin = new URL(settings.headers.get("location")!);
  assert.equal(settingsLogin.pathname, "/bolts/login/");
  assert.equal(settingsLogin.searchParams.get("next"), "/settings");
  const authenticated = proxy(new NextRequest("https://example.com/bolts/", {
    nextConfig: { basePath: "/bolts" },
    headers: { cookie: `bolts_session=${cookie}` },
  }));
  assert.equal(authenticated.headers.get("x-middleware-next"), "1");
  for (const pathname of ["/login", "/manifest.webmanifest", "/apple-icon", "/icon", "/api/health"]) {
    assert.equal(proxy(new NextRequest(`https://example.com/bolts${pathname}`, {
      nextConfig: { basePath: "/bolts" },
    })).headers.get("x-middleware-next"), "1");
  }
});

test("Bolts return paths cannot escape the app or loop through login", () => {
  for (const value of [undefined, "//evil.example", "/\\evil.example", "/\t/evil.example", "https://evil.example", "/login", "/login?next=/", "/ideas/../login", "/ideas/%2e%2e/login/", "/x\nHeader: value"]) {
    assert.equal(safeNextPath(value), "/");
  }
  assert.equal(safeNextPath("/ideas/abc?view=full"), "/ideas/abc?view=full");
  assert.equal(safeNextPath("/../today"), "/today");
  assert.equal(appPath("/login"), "/bolts/login");
});

test("action redirects include the base path exactly once for native and hydrated forms", () => {
  assert.equal(actionRedirectUrl("/", "https://example.com"), "https://example.com/bolts/");
  assert.equal(actionRedirectUrl("/login/?error=1", "http://localhost:3003"), "http://localhost:3003/bolts/login/?error=1");
  assert.equal(actionRedirectUrl(safeNextPath("/ideas/../ideas/abc/"), "https://example.com"), "https://example.com/bolts/ideas/abc/");
  assert.throws(() => actionRedirectUrl("/", null), /Origin header/);
});

test("a missing password is reported as a configuration error", () => {
  const session = passwordSession({ cookieName: "test", passwordEnv: "BOLTS_MISSING_TEST_PASSWORD", secretEnv: "BOLTS_MISSING_TEST_SECRET" });
  assert.throws(() => session.checkPassword("test"), /must be set/);
  assert.throws(() => session.createSessionCookieValue(), /16\+ chars/);
});
