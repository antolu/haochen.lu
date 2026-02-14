import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    reporters: ["verbose"],
    outputFile: "./coverage/test-report.html",
    // Exclude node_modules tests and Playwright E2E tests from Vitest
    exclude: [...configDefaults.exclude, "node_modules/**", "src/test/e2e/**"],
    // Resource limits to prevent process spawning issues
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
        minForks: 1,
      },
    },
    // Timeout configurations
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    // Disable watch mode in CI-like runs
    watch: false,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/**/*.d.ts",
        "src/**/*.config.*",
        "src/main.tsx",
        "dist/",
        "coverage/",
        "*.config.*",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/components": resolve(__dirname, "./src/components"),
      "@/services": resolve(__dirname, "./src/services"),
      "@/utils": resolve(__dirname, "./src/utils"),
      "@/hooks": resolve(__dirname, "./src/hooks"),
      "@/types": resolve(__dirname, "./src/types"),
      "@/store": resolve(__dirname, "./src/store"),
      "@/test": resolve(__dirname, "./src/test"),
    },
  },
});
