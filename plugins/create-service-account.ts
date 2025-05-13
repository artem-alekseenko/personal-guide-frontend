import fs from "fs";
import path from "path";

export default defineNuxtPlugin(() => {
  if (import.meta.server) {
    const jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!jsonString) {
      console.warn(
        "[ServiceAccountPlugin] GOOGLE_SERVICE_ACCOUNT_JSON is not set",
      );
      return;
    }

    try {
      const tmpFilePath = path.join("/tmp", "service-account.json");
      fs.writeFileSync(tmpFilePath, jsonString, { encoding: "utf8" });

      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFilePath;

      console.info(
        "[ServiceAccountPlugin] Service account file created at:",
        tmpFilePath,
      );
    } catch (error) {
      console.error(
        "[ServiceAccountPlugin] Failed to create service account file:",
        error,
      );
    }
  }
});
