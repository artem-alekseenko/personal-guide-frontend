import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Optional server-only credentials. Browser auth uses Firebase client configuration.
export default defineNitroPlugin((nitro) => {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return;
  JSON.parse(json);
  const directory = mkdtempSync(join(tmpdir(), "personal-guide-credentials-"));
  const file = join(directory, "service-account.json");
  writeFileSync(file, json, { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
  nitro.hooks.hook("close", () => {
    rmSync(directory, { recursive: true, force: true });
  });
});
