import assert from "node:assert/strict";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { after, afterEach, before, mock, test } from "node:test";
import { gzipSync } from "node:zlib";
import { assertPublicAddress, fetchRecipePage, publicLookup, validateRecipeUrl } from "../src/lib/recipe-fetch";

test("accepts public HTTP(S) addresses and strips fragments", () => {
  assert.equal(validateRecipeUrl("https://example.com/recipe#ingredients").href, "https://example.com/recipe");
  assert.equal(validateRecipeUrl("http://8.8.8.8/").hostname, "8.8.8.8");
  assertPublicAddress("2606:4700:4700::1111");
});

test("rejects unsupported schemes, credentials, ports and oversized input", () => {
  for (const url of ["file:///etc/passwd", "ftp://example.com", "bad url", "https://user:pass@example.com", "https://example.com:8080", `https://example.com/${"x".repeat(500)}`]) {
    assert.throws(() => validateRecipeUrl(url));
  }
});

test("blocks non-public IPv4, IPv6 and alternate IP representations", () => {
  for (const address of [
    "127.0.0.1", "0.0.0.0", "10.0.0.1", "172.16.0.1", "192.168.0.1",
    "169.254.169.254", "100.64.0.1", "192.0.2.1", "198.18.0.1", "224.0.0.1",
    "::", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1", "ff02::1",
  ]) {
    assert.throws(() => assertPublicAddress(address), /public internet address/, address);
  }
  for (const url of ["http://2130706433", "http://0x7f000001", "http://127.1", "http://[::ffff:127.0.0.1]"]) {
    assert.throws(() => validateRecipeUrl(url), /public internet address/);
  }
});

afterEach(() => mock.restoreAll());

function fakeDns(addresses: dns.LookupAddress[]) {
  mock.method(dns, "lookup", (_hostname: string, options: dns.LookupOptions, callback: (error: Error | null, addresses: dns.LookupAddress[]) => void) => {
    assert.equal(options.all, true);
    callback(null, addresses);
  });
}

function resolvePublic(all = false) {
  return new Promise<string | dns.LookupAddress[]>((resolve, reject) => {
    publicLookup("example.com", { all }, (error, address) => error ? reject(error) : resolve(address));
  });
}

test("validates actual DNS lookup and returns only the already-validated addresses", async () => {
  const addresses = [{ address: "8.8.8.8", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }];
  fakeDns(addresses);
  assert.equal(await resolvePublic(), "8.8.8.8");
  assert.deepEqual(await resolvePublic(true), addresses);
});

test("rejects DNS results containing any non-public address and empty DNS results", async () => {
  fakeDns([{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]);
  await assert.rejects(resolvePublic(), /public internet address/);
  mock.restoreAll();
  fakeDns([]);
  await assert.rejects(resolvePublic(), /no IP addresses/);
});

const limit = 2 * 1024 * 1024;
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  switch (req.url) {
    case "/redirect":
      res.writeHead(302, { Location: "/ok" });
      res.end();
      break;
    case "/private":
      res.writeHead(302, { Location: "http://127.0.0.1/private" });
      res.end();
      break;
    case "/loop":
      res.writeHead(302, { Location: "/loop" });
      res.end();
      break;
    case "/json":
      res.setHeader("Content-Type", "application/json");
      res.end("{}");
      break;
    case "/error":
      res.writeHead(403);
      res.end();
      break;
    case "/large":
      res.end("x".repeat(limit + 1));
      break;
    case "/limit":
      res.end("x".repeat(limit));
      break;
    case "/gzip":
    case "/bomb":
      res.setHeader("Content-Encoding", "gzip");
      res.end(gzipSync(req.url === "/bomb" ? "x".repeat(limit + 1) : "<html>recipe</html>"));
      break;
    default:
      res.end("<html>recipe</html>");
  }
});
let port: number;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  port = address.port;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function routeToFixture() {
  const originalRequest = http.request;
  const urls: URL[] = [];
  const intercepted = (url: URL, options: https.RequestOptions, callback: (response: http.IncomingMessage) => void) => {
    urls.push(url);
    assert.equal(options.lookup, publicLookup);
    assert.equal(options.agent, false);
    if (url.protocol === "https:") assert.equal(options.rejectUnauthorized, true);
    return originalRequest(new URL(`http://127.0.0.1:${port}${url.pathname}`), options, callback);
  };
  mock.method(http, "request", intercepted);
  mock.method(https, "request", intercepted);
  return urls;
}

test("downloads HTML, decodes compression and follows relative redirects safely", async () => {
  const urls = routeToFixture();
  assert.deepEqual(await fetchRecipePage("https://example.com/redirect"), { html: "<html>recipe</html>", url: "https://example.com/ok" });
  assert.deepEqual(urls.map((url) => url.pathname), ["/redirect", "/ok"]);
  assert.equal((await fetchRecipePage("http://example.com/gzip")).html, "<html>recipe</html>");
});

test("blocks private redirects before another connection is made", async () => {
  const urls = routeToFixture();
  await assert.rejects(fetchRecipePage("https://example.com/private"), /public internet address/);
  assert.equal(urls.length, 1);
});

test("limits redirects to five", async () => {
  const urls = routeToFixture();
  await assert.rejects(fetchRecipePage("https://example.com/loop"), /too many redirects/);
  assert.equal(urls.length, 6);
});

test("rejects HTTP errors and non-HTML responses", async () => {
  routeToFixture();
  await assert.rejects(fetchRecipePage("https://example.com/error"), /HTTP 403/);
  await assert.rejects(fetchRecipePage("https://example.com/json"), /HTML page/);
});

test("enforces both downloaded and decompressed size limits", async () => {
  routeToFixture();
  assert.equal((await fetchRecipePage("https://example.com/limit")).html.length, limit);
  await assert.rejects(fetchRecipePage("https://example.com/large"), /too large/);
  await assert.rejects(fetchRecipePage("https://example.com/bomb"), /too large/);
});

test("applies one ten-second deadline to the import and reports timeouts", async () => {
  routeToFixture();
  mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, 10_000);
    return AbortSignal.abort();
  });
  await assert.rejects(fetchRecipePage("https://example.com/ok"), /too long/);
});
