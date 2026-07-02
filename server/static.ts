import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  // Try __dirname/public first (local), then process.cwd()/dist/public (Render)
  let distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(process.cwd(), "dist", "public");
  }
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
