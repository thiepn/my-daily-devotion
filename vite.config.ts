import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 350,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules\/(?:react|react-dom|react-router|react-router-dom)\//,
            },
            {
              name: "dexie-vendor",
              test: /node_modules\/dexie\//,
            },
          ],
        },
      },
    },
  },
});
