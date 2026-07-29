import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

process.env.NODE_ENV = "test";
process.env.AUTH_MODE = "local";
process.env.SAMSARIX_DATA_FILE = path.join(
  os.tmpdir(),
  `samsarix-story-studio-test-${process.pid}-${randomUUID()}.json`
);

for (const key of [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
  "GEMINI_API_KEY",
  "SONAR_API_KEY",
  "DATABASE_URL",
]) {
  delete process.env[key];
}

afterAll(async () => {
  const dataPath = process.env.SAMSARIX_DATA_FILE;
  if (dataPath) await rm(dataPath, { force: true });
});
