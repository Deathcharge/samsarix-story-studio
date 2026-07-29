import "dotenv/config";
import { createServer, type Server } from "node:http";
import net from "node:net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { enforceRequestBoundary } from "./requestSecurity";
import { serveStatic, setupVite } from "./vite";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(port, host, () => probe.close(() => resolve(true)));
    probe.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number, host: string) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port, host)) return port;
  }
  throw new Error(
    `No available port found from ${startPort} through ${startPort + 19}`
  );
}

function parsePort() {
  const value = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return value;
}

function assertSafeExposure() {
  const requestedAuthMode = process.env.AUTH_MODE?.trim().toLowerCase();
  if (requestedAuthMode && requestedAuthMode !== "local") {
    throw new Error(
      "Only AUTH_MODE=local is supported by this release. The historical OAuth adapter was removed from the runtime boundary."
    );
  }

  if (ENV.authMode === "local" && !LOOPBACK_HOSTS.has(ENV.host)) {
    throw new Error(
      "Samsarix Story Studio may only bind to localhost, 127.0.0.1, or ::1."
    );
  }
}

export async function startServer(): Promise<Server> {
  const isDevelopment =
    process.argv.includes("--dev") || process.env.NODE_ENV === "development";
  process.env.NODE_ENV = isDevelopment ? "development" : "production";
  assertSafeExposure();

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.use(enforceRequestBoundary);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, mode: ENV.authMode });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (isDevelopment) await setupVite(app, server);
  else serveStatic(app);

  const preferredPort = parsePort();
  const port = isDevelopment
    ? await findAvailablePort(preferredPort, ENV.host)
    : preferredPort;

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, ENV.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`Samsarix Story Studio running at http://${ENV.host}:${port}/`);
  console.log(`Authentication: ${ENV.authMode}`);
  return server;
}

async function closeServer(server: Server, signal: string) {
  console.log(`${signal} received; closing HTTP server`);
  const forceClose = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000);
  forceClose.unref();

  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
  clearTimeout(forceClose);
}

if (process.env.NODE_ENV !== "test") {
  startServer()
    .then(server => {
      let closing = false;
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
          if (closing) return;
          closing = true;
          closeServer(server, signal).catch(error => {
            console.error("Shutdown failed", error);
            process.exitCode = 1;
          });
        });
      }
    })
    .catch(error => {
      console.error("Server failed to start", error);
      process.exitCode = 1;
    });
}
