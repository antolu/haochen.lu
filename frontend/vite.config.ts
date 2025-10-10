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
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for large libraries
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-switch",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-slot",
          ],
          query: ["@tanstack/react-query"],
          motion: ["framer-motion"],
          map: ["maplibre-gl", "supercluster"],
          lightgallery: ["lightgallery"],
          editor: [
            "@uiw/react-md-editor",
            "react-markdown",
            "rehype-highlight",
            "remark-gfm",
          ],
          utils: ["lodash", "axios", "clsx", "tailwind-merge"],
          icons: ["@heroicons/react", "lucide-react"],
          forms: ["react-hook-form", "react-dropzone", "react-image-crop"],
        },
      },
    },
    // Enable modern JavaScript features for smaller bundles
    target: "esnext",
    // Enable minification (use default minifier)
    minify: true,
  },
});
