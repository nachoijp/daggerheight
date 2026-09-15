import { defineConfig } from "vite";
import { resolve } from "path";

const root = import.meta.dirname;

export default defineConfig({
  server: {
    cors: true,
  },
  preview: {
    cors: true,
  },
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        background: resolve(root, "background.html"),
        settings: resolve(root, "settings.html"),
        levels: resolve(root, "levels.html"),
      },
    },
  },
});
