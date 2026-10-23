import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import { promisify } from "node:util";
import { brotliDecompress, gunzip, inflate } from "node:zlib";
import ipaddr from "ipaddr.js";
import { RecipeImportError } from "./recipe-import";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const decompressors = {
  gzip: promisify(gunzip),
  deflate: promisify(inflate),
  br: promisify(brotliDecompress),
};

export function assertPublicAddress(address: string): void {
  if (!ipaddr.isValid(address) || ipaddr.parse(address).range() !== "unicast") {
    throw new RecipeImportError("Recipe URLs must point to a public internet address.");
  }
}

export function validateRecipeUrl(input: string): URL {
  if (input.length > 500) {
    throw new RecipeImportError("The recipe URL must be 500 characters or fewer.");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new RecipeImportError("Enter a valid http:// or https:// recipe URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new RecipeImportError("Use an HTTP or HTTPS URL without credentials or a custom port.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) assertPublicAddress(hostname);
  url.hash = "";
  return url;
}

// Validate the actual connection lookup, not a separate DNS preflight that
// could be bypassed by DNS rebinding. Redirects use this same lookup.
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error, "", 4);
      return;
    }
    try {
      if (!addresses.length) throw new RecipeImportError("The recipe hostname has no IP addresses.");
      for (const { address } of addresses) assertPublicAddress(address);
    } catch (error) {
      callback(error instanceof Error ? error : new Error("Invalid recipe address"), "", 4);
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      const address = addresses[0];
      callback(null, address.address, address.family);
    }
  });
};

type PageResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function requestPage(url: URL, signal: AbortSignal): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const request = url.protocol === "https:" ? https.request : http.request;
    const req = request(url, {
      signal,
      lookup: publicLookup,
      agent: false,
      // Do not inherit any process-wide opt-out of TLS verification.
      ...(url.protocol === "https:" ? { rejectUnauthorized: true } : {}),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "Doof/0.1 (recipe ingredient importer)",
      },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        res.destroy();
        return;
      }
      const type = res.headers["content-type"]?.split(";")[0].trim().toLowerCase();
      if (type !== "text/html" && type !== "application/xhtml+xml") {
        reject(new RecipeImportError("The URL did not return an HTML page."));
        res.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          reject(new RecipeImportError("The recipe page is too large (maximum 2 MB)."));
          res.destroy();
        } else {
          chunks.push(chunk);
        }
      });
      res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
      res.on("aborted", () => reject(new RecipeImportError("The recipe website closed the connection before the page finished loading.")));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function fetchRecipePage(input: string): Promise<{ html: string; url: string }> {
  let url = validateRecipeUrl(input.trim());
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await requestPage(url, signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.headers.location || redirects === MAX_REDIRECTS) {
          throw new RecipeImportError("The recipe page has a missing redirect target or too many redirects.");
        }
        url = validateRecipeUrl(new URL(response.headers.location, url).href);
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new RecipeImportError(`The recipe website returned HTTP ${response.status}. It may block automated imports.`);
      }
      let body = response.body;
      const encoding = response.headers["content-encoding"]?.trim().toLowerCase();
      if (encoding && encoding !== "identity") {
        if (encoding !== "gzip" && encoding !== "deflate" && encoding !== "br") {
          throw new RecipeImportError("The recipe page uses an unsupported content encoding.");
        }
        body = await decompressors[encoding](body, { maxOutputLength: MAX_BYTES });
      }
      signal.throwIfAborted();
      const charset = response.headers["content-type"]?.match(/charset=["']?([^;"'\s]+)/i)?.[1] ?? "utf-8";
      return { html: new TextDecoder(charset).decode(body), url: url.href };
    }
    throw new RecipeImportError("The recipe page has too many redirects.");
  } catch (error) {
    if (error instanceof RecipeImportError) throw error;
    if (signal.aborted) {
      throw new RecipeImportError("The recipe website took too long to respond. Try again later.");
    }
    // Do not log the URL, which may contain private query parameters.
    console.error("Recipe page download failed:", error instanceof Error ? error.name : "Unknown error");
    throw new RecipeImportError("Could not download the recipe page. It may be unavailable, too large, or block automated imports.");
  }
}
