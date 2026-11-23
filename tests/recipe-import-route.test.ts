import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/recipes/import/route";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../src/lib/auth";
import http from "node:http";
import https from "node:https";
import { publicLookup } from "../src/lib/recipe-fetch";

test("rejects unauthenticated requests before processing the URL", async () => {
  const response = await POST(new NextRequest("http://localhost/api/recipes/import", {
    method: "POST",
    body: JSON.stringify({ url: "http://127.0.0.1" }),
  }));
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Sign in/);
});

test("peek mode returns method and final source URL without weakening regular ingredient imports", async (t) => {
  const previous = process.env.COOKIE_SECRET;
  process.env.COOKIE_SECRET = "test-only-peek-route-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.COOKIE_SECRET;
    else process.env.COOKIE_SECRET = previous;
  });
  const recipe = { "@type": "Recipe", name: "Fixture soup", recipeInstructions: [
    { "@type": "HowToStep", text: "Stir the soup." },
  ] };
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/soup" }).end();
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(`<script type="application/ld+json">${JSON.stringify(recipe)}</script>`);
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const request = http.request;
  t.mock.method(https, "request", (url: URL, options: https.RequestOptions, callback: (response: http.IncomingMessage) => void) => {
    assert.equal(options.lookup, publicLookup);
    assert.equal(options.rejectUnauthorized, true);
    return request(new URL(`http://127.0.0.1:${address.port}${url.pathname}`), options, callback);
  });
  const cookie = `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}`;
  const peek = await POST(new NextRequest("http://localhost/api/recipes/import", {
    method: "POST", headers: { cookie },
    body: JSON.stringify({ url: "https://example.com/redirect", mode: "peek" }),
  }));
  assert.equal(peek.status, 200);
  assert.equal(peek.headers.get("Cache-Control"), "no-store");
  const body = await peek.json();
  assert.equal(body.sourceUrl, "https://example.com/soup");
  assert.deepEqual(body.recipes[0].instructions, [{ text: "Stir the soup." }]);
  assert.deepEqual(body.recipes[0].ingredients, []);
  const regular = await POST(new NextRequest("http://localhost/api/recipes/import", {
    method: "POST", headers: { cookie },
    body: JSON.stringify({ url: "https://example.com/soup" }),
  }));
  assert.equal(regular.status, 422);
  assert.match((await regular.json()).error, /No usable recipe ingredients/);
  const privateUrl = await POST(new NextRequest("http://localhost/api/recipes/import", {
    method: "POST", headers: { cookie },
    body: JSON.stringify({ url: "http://127.0.0.1", mode: "peek" }),
  }));
  assert.equal(privateUrl.status, 422);
});

test("validates signed-in requests and returns explicit URL safety errors", async () => {
  const previous = process.env.COOKIE_SECRET;
  process.env.COOKIE_SECRET = "test-only-recipe-import-secret";
  try {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}`;
    for (const [body, status] of [
      ["{bad", 400],
      [JSON.stringify({}), 400],
      [JSON.stringify({ url: 123 }), 400],
      [JSON.stringify({ url: "http://127.0.0.1" }), 422],
    ] as const) {
      const response = await POST(new NextRequest("http://localhost/api/recipes/import", {
        method: "POST", body, headers: { cookie },
      }));
      assert.equal(response.status, status);
      assert.equal(typeof (await response.json()).error, "string");
    }
  } finally {
    if (previous === undefined) delete process.env.COOKIE_SECRET;
    else process.env.COOKIE_SECRET = previous;
  }
});
