import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const files = readdirSync(new URL(".", import.meta.url))
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => fileURLToPath(new URL(file, import.meta.url)));

if (!files.length) throw new Error("No test files found.");

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
