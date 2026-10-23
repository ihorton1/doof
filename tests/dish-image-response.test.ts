import assert from "node:assert/strict";
import { test } from "node:test";
import { dishImageResponse } from "../src/lib/dish-image-response";

test("saved remote images redirect the browser without a referrer or a server-side fetch", (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Remote dish images must not be fetched by the server.");
  });
  for (const url of [
    "https://static01.nyt.com/images/recipe.jpg",
    "https://images.example.com/photo?width=800&format=webp",
    "http://images.example.com/recipe.jpg",
  ]) {
    const response = dishImageResponse(url);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("Location"), url);
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
    assert.equal(response.headers.get("Cache-Control"), "private, no-cache");
  }
});

test("uploaded data URL images still return their original bytes and cache headers", async () => {
  const bytes = Buffer.from("test image bytes");
  const response = dishImageResponse(`data:image/webp;base64,${bytes.toString("base64")}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.equal(response.headers.get("Content-Length"), String(bytes.byteLength));
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=31536000, immutable");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test("missing dishes and empty images return 404", () => {
  for (const imageUrl of [undefined, null, ""]) {
    assert.equal(dishImageResponse(imageUrl).status, 404);
  }
});

test("unsupported or unsafe saved image URLs never become redirects", () => {
  for (const value of [
    "invalid", "/relative.jpg", "//images.example.com/photo.jpg",
    "javascript:alert(1)", "file:///image.jpg", "data:text/html;base64,dGVzdA==",
    "https://user@example.com/photo.jpg", "https://images.example.com:8443/photo.jpg",
    "http://localhost/photo.jpg", "http://sub.localhost/photo.jpg", "http://photo.local/photo.jpg",
    "http://127.0.0.1/photo.jpg", "http://192.168.1.1/photo.jpg", "http://[::1]/photo.jpg",
    `https://images.example.com/${"x".repeat(4000)}`,
  ]) {
    const response = dishImageResponse(value);
    assert.equal(response.status, 415, value);
    assert.equal(response.headers.get("Location"), null);
  }
});
