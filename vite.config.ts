import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/** Ship the standalone build under the name the brief asked for. */
function renameOutput(to: string): Plugin {
  return {
    name: "rename-html-output",
    enforce: "post",
    writeBundle(options) {
      const dir = options.dir ?? "dist";
      const from = path.join(dir, "index.html");
      if (existsSync(from)) renameSync(from, path.join(dir, to));
    },
  };
}

// The brief asked for react + vite *and* for something that runs standalone with
// no server. Both: `npm run dev` is ordinary Vite, and `npm run build` inlines
// every asset — including the simulation worker — into one self-contained HTML
// file that opens straight from disk.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile(), renameOutput("kelly_simulator.html")],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
