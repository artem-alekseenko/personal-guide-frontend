import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
// Client render functions support both renderToString and the isolated UI renderer.
const vuePlugin = vue();
const transformVue = vuePlugin.transform;
const transformHandler =
  typeof transformVue === "function" ? transformVue : transformVue?.handler;
if (transformHandler) {
  vuePlugin.transform = {
    ...(typeof transformVue === "object" ? transformVue : {}),
    handler(code, id, options) {
      return transformHandler.call(this, code, id, { ...options, ssr: false });
    },
  };
}
export default defineConfig({
  plugins: [vuePlugin],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      "@": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  define: {
    "import.meta.client": "true",
    "import.meta.server": "false",
    "import.meta.dev": "false",
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
