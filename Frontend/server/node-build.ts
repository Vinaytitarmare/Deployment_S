import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "./index";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Create API app
  const api = createServer();

  // Create host app that serves SPA and mounts API
  const app = express();

  // Mount API under /api/*
  app.use("/api", api);

  // Serve the SPA from dist/spa
  const spaDir = path.resolve(__dirname, "../spa");
  app.use(express.static(spaDir));

  // Fallback to index.html for client-side routing
  app.get("*", (_req, res) => {
    res.sendFile(path.join(spaDir, "index.html"));
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});