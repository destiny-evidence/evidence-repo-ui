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
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", ".claude"],
  },
});
