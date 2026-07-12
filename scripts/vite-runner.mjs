import path from "path";
import { fileURLToPath } from "url";

process.on("uncaughtException", (error) => {
  console.error("[vite-runner] uncaughtException");
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("[vite-runner] unhandledRejection");
  console.error(error);
  process.exit(1);
});

console.log("[vite-runner] boot");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const mode = process.argv[2] ?? "dev";
const buildMode = process.argv[3] ?? "production";

console.log("[vite-runner] importing vite");
const { build, createServer, preview } = await import("vite");

const config = {
  configFile: false,
  root: rootDir,
  cacheDir: path.resolve(rootDir, ".vite-cache"),
  build: {
    outDir: path.resolve(rootDir, ".vite-dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
          return;
        }
        warn(warning);
      },
    },
  },
  esbuild: {
    sourcemap: false,
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "lucide-react",
    ],
    esbuildOptions: {
      sourcemap: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
  },
};

if (mode === "build") {
  console.log(`[vite-runner] starting build in ${buildMode} mode`);
  await build({
    ...config,
    mode: buildMode,
  });
  console.log("[vite-runner] build complete");
} else if (mode === "preview") {
  console.log("[vite-runner] starting preview server");
  const server = await preview({
    ...config,
    preview: {
      host: "127.0.0.1",
      port: 4173,
    },
  });
  server.printUrls();
  await new Promise(() => {});
} else {
  console.log("[vite-runner] starting dev server");
  const server = await createServer(config);
  await server.listen();
  console.log("[vite-runner] dev server listening");
  server.printUrls();
  await new Promise(() => {});
}
