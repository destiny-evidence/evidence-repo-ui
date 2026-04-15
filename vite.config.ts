import { defineConfig, loadEnv } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [preact()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        react: "preact/compat",
        "react-dom": "preact/compat",
      },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://localhost:8080",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/vocab-proxy": {
          target: "https://vocab-reader.staging.evidence-repository.org",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vocab-proxy/, ""),
          followRedirects: true,
        },
      },
    },
  };
});
