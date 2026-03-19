import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  optimizeDeps: {
    exclude: ["@tailwindcss/vite"],
  },
  build: {
    // Increase chunk size warning limit to 1000kb
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
            },
            {
              name: "ui",
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            },
            {
              name: "query",
              test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/,
            },
            {
              name: "motion",
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            },
            {
              name: "map",
              test: /[\\/]node_modules[\\/](maplibre-gl|supercluster)[\\/]/,
            },
            {
              name: "lightgallery",
              test: /[\\/]node_modules[\\/]lightgallery[\\/]/,
            },
            {
              name: "editor",
              test: /[\\/]node_modules[\\/](@uiw[\\/]react-md-editor|react-markdown|rehype-highlight|remark-gfm)[\\/]/,
            },
            {
              name: "utils",
              test: /[\\/]node_modules[\\/](lodash|axios|clsx|tailwind-merge)[\\/]/,
            },
            {
              name: "icons",
              test: /[\\/]node_modules[\\/](@heroicons[\\/]react|lucide-react)[\\/]/,
            },
            {
              name: "forms",
              test: /[\\/]node_modules[\\/](react-hook-form|react-dropzone|react-image-crop)[\\/]/,
            },
          ],
        },
      },
    },
    // Enable modern JavaScript features for smaller bundles
    target: "esnext",
    // Enable minification (use default minifier)
    minify: true,
  },
});
