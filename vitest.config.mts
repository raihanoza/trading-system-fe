import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Tanpa @vitejs/plugin-react: versi terbarunya bentrok peer-dependency, dan
// esbuild bawaan Vite sudah cukup untuk JSX otomatis React 19.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": root } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // Tes integrasi menyalakan backend Python asli; beri waktu startup.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
