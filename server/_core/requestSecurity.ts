import type { NextFunction, Request, Response } from "express";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function normalizeHostname(hostname: string) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
}

export function isTrustedRequestMetadata(hostname: string, origin?: string) {
  const requestHostname = normalizeHostname(hostname);
  if (!LOOPBACK_HOSTS.has(requestHostname)) return false;
  if (!origin) return true;

  try {
    const originHostname = normalizeHostname(new URL(origin).hostname);
    return LOOPBACK_HOSTS.has(originHostname);
  } catch {
    return false;
  }
}

export function isBackupImportRequestPath(requestPath: string) {
  return requestPath.split(",").includes("/projects.importBackup");
}

export function enforceRequestBoundary(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const origin =
    typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  if (!isTrustedRequestMetadata(req.hostname, origin)) {
    res
      .status(403)
      .json({ error: "Request origin is outside the local studio boundary" });
    return;
  }
  next();
}
