import type { Express, Request, Response } from "express";
import { isTerminalGenerationStatus } from "../shared/generationLifecycle";
import * as db from "./db";
import {
  getGenerationJob,
  subscribeToGeneration,
  type PublicGenerationJob,
} from "./generationCoordinator";

function sendGenerationEvent(res: Response, job: PublicGenerationJob) {
  res.write(`event: generation\ndata: ${JSON.stringify(job)}\n\n`);
}

export function registerGenerationEventRoutes(app: Express) {
  app.get(
    "/api/generation/:jobId/events",
    async (req: Request, res: Response) => {
      let closeStream: (() => void) | undefined;
      try {
        const jobId = req.params.jobId?.trim() ?? "";
        if (!jobId || jobId.length > 64) {
          res.status(400).json({ error: "Invalid generation id" });
          return;
        }
        const user = await db.getLocalUser();
        const initial = await getGenerationJob(jobId, user.id);
        if (!initial) {
          res.status(404).json({ error: "Generation not found" });
          return;
        }

        res.status(200);
        res.set({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();

        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          res.end();
        };
        const unsubscribe = subscribeToGeneration(jobId, job => {
          if (closed) return;
          sendGenerationEvent(res, job);
          if (isTerminalGenerationStatus(job.status)) close();
        });
        const heartbeat = setInterval(() => {
          if (!closed) res.write(": keep-alive\n\n");
        }, 15_000);
        heartbeat.unref();
        req.once("close", close);
        closeStream = close;

        const latest = (await getGenerationJob(jobId, user.id)) ?? initial;
        sendGenerationEvent(res, latest);
        if (isTerminalGenerationStatus(latest.status)) close();
      } catch (error) {
        closeStream?.();
        console.error("Generation event stream failed", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Generation status is unavailable" });
        } else {
          res.end();
        }
      }
    }
  );
}
