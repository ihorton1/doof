import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { get } from "node:http";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const image = "doof-bolts:runtime-test";
const root = path.resolve(import.meta.dirname, "..");

function docker(...args: string[]) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 60_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`.trim();
}

function start(migrationStatus = "0", boltsMigrationStatus = "0", cookieSecret = "container-test-bolts-cookie-secret") {
  const name = `doof-bolts-test-${crypto.randomUUID()}`;
  docker(
    "run", "--detach", "--name", name,
    "--publish", "127.0.0.1::3000",
    "--mount", `type=bind,source=${root},target=/workspace,readonly`,
    "--env", "DATABASE_URL=test-only",
    "--env", "BOLTS_DATABASE_URL=bolts-test-only",
    "--env", "BOLTS_APP_PASSWORD=container-test-password",
    "--env", `BOLTS_COOKIE_SECRET=${cookieSecret}`,
    "--env", `MIGRATION_STATUS=${migrationStatus}`,
    "--env", `BOLTS_MIGRATION_STATUS=${boltsMigrationStatus}`,
    "--entrypoint", "/usr/bin/tini", image,
    "--", "bash", "-c",
    [
      "mkdir -p /app/infra /opt/bolts/apps/bolts /opt/prisma/node_modules/.bin",
      "cp /workspace/infra/nginx.conf.template /app/infra/",
      "cp /workspace/tests/fixtures/shared-container/server.cjs /app/server.js",
      "cp /app/server.js /opt/bolts/apps/bolts/server.js",
      `printf '#!/bin/sh\\nif [ "$3" = "--schema" ]; then\\nexit "\${BOLTS_MIGRATION_STATUS:-0}"\\nfi\\nexit "\${MIGRATION_STATUS:-0}"\\n' > /opt/prisma/node_modules/.bin/prisma`,
      "chmod +x /opt/prisma/node_modules/.bin/prisma",
      "cd /app",
      "exec bash /workspace/entrypoint.sh",
    ].join(" && "),
  );
  return name;
}

test("shared ingress routes apps independently and stops if either server fails", async () => {
  const name = start();
  try {
    const port = docker("port", name, "3000/tcp").split(":").at(-1);
    const url = `http://127.0.0.1:${port}`;
    // Wait inside the container so a closed host port cannot obscure startup errors.
    docker("exec", name, "node", "-e", `
      (async () => {
        for (let i = 0; i < 100; i++) {
          try {
            const r = await fetch("http://127.0.0.1:3000", {headers: {host: "bolts.localhost"}});
            if (r.ok) return;
          } catch (e) {
            if (e.cause?.code !== "ECONNREFUSED") throw e;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error("Shared ingress did not become ready");
      })().catch(e => { console.error(e); process.exit(1); });
    `);

    for (const [pathname, app, hasDatabase] of [
      ["/_next/example.js?v=1", "doof", true],
      ["/bolts/_next/example.js?v=1", "bolts", false],
      ["/bolts", "bolts", false],
      ["/boltsish", "doof", true],
    ] as const) {
      const host = "existing-doof.azurecontainerapps.io";
      const response = await new Promise<{ statusCode?: number; body: string }>((resolve, reject) => {
        get(`${url}${pathname}`, {
          headers: { host, "x-forwarded-proto": "https" },
        }, (result) => {
          let body = "";
          result.setEncoding("utf8");
          result.on("data", (chunk: string) => { body += chunk; });
          result.on("end", () => resolve({ statusCode: result.statusCode, body }));
          result.on("error", reject);
        }).on("error", reject);
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        app, hasDatabase,
        hasBoltsDatabase: app === "bolts",
        url: pathname,
        host,
        protocol: "https",
      });
    }
    assert.match(docker("logs", name), /Running Bolts Prisma migrations/);

    // Make a supervised child fail without relying on process-name matching.
    docker("exec", name, "node", "-e", `
      require("node:http").get("http://127.0.0.1:3001/crash").on("error", () => {});
    `);
    assert.equal(docker("wait", name), "17");
    assert.match(docker("logs", name), /stopping all services/);
  } finally {
    docker("rm", "--force", name);
  }
});

test("a failed Bolts migration stops startup before either app serves traffic", () => {
  const name = start("0", "29");
  try {
    assert.equal(docker("wait", name), "29");
    const logs = docker("logs", name);
    assert.match(logs, /Running Bolts Prisma migrations/);
    assert.doesNotMatch(logs, /Starting Doof/);
  } finally {
    docker("rm", "--force", name);
  }
});

test("shared container forwards shutdown to its services", async () => {
  const name = start();
  try {
    for (let i = 0; i < 100; i++) {
      if (docker("logs", name).includes("Starting shared ingress")) break;
      assert.ok(i < 99, "Shared services did not start");
      await setTimeout(100);
    }
    docker("stop", "--time", "10", name);
    assert.equal(docker("inspect", "--format", "{{.State.ExitCode}}", name), "143");
  } finally {
    docker("rm", "--force", name);
  }
});

for (const [description, migrationStatus, cookieSecret, expectedStatus, error] of [
  ["missing Bolts configuration", "0", "", "1", /must be configured/],
  ["failed migration", "23", "container-test-bolts-cookie-secret", "23", /Running Prisma migrations/],
] as const) {
  test(`shared container rejects ${description} before serving traffic`, () => {
    const name = start(migrationStatus, "0", cookieSecret);
    try {
      assert.equal(docker("wait", name), expectedStatus);
      const logs = docker("logs", name);
      assert.match(logs, error);
      assert.doesNotMatch(logs, /Starting Doof/);
    } finally {
      docker("rm", "--force", name);
    }
  });
}
