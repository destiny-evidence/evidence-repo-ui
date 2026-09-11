import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      react: resolve(__dirname, "node_modules/preact/compat"),
      "react-dom": resolve(__dirname, "node_modules/preact/compat"),
      "react/jsx-runtime": resolve(__dirname, "node_modules/preact/jsx-runtime"),
    },
    dedupe: ["preact"],
  },
  test: {
    environment: "jsdom",
    // Node 22+ ships its own Web Storage and from 25 enables it by default,
    // where its methodless `localStorage` shadows jsdom's. Turn it off.
    poolOptions: { forks: { execArgv: ["--no-experimental-webstorage"] } },
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", ".claude"],
  },
});
