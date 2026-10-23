import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/recipes/import/route";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../src/lib/auth";

test("rejects unauthenticated requests before processing the URL", async () => {
  const response = await POST(new NextRequest("http://localhost/api/recipes/import", {
    method: "POST",
    body: JSON.stringify({ url: "http://127.0.0.1" }),
  }));
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Sign in/);
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
