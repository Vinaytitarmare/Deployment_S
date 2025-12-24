import express, { Application, Request, Response } from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env at project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export function createServer(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Basic health endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, message: process.env.PING_MESSAGE ?? "pong" });
  });

  // Example demo route (kept minimal)
  app.get("/api/demo", (_req: Request, res: Response) => {
    res.json({ message: "demo ok" });
  });

  return app;
}