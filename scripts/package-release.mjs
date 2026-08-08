import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8")
);
const runGit = (...args) => {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
};

const dirty = runGit("status", "--porcelain", "--untracked-files=no");
if (dirty && process.env.ALLOW_DIRTY_PACKAGE !== "1") {
  throw new Error(
    "Refusing to package a dirty tracked worktree. Commit the release candidate first."
  );
}

const commit = runGit("rev-parse", "HEAD");
const artifactDirectory = path.join(root, "artifacts");
const baseName = `${packageJson.name}-v${packageJson.version}-source`;
const archivePath = path.join(artifactDirectory, `${baseName}.zip`);
await mkdir(artifactDirectory, { recursive: true });

const archive = spawnSync(
  "git",
  [
    "archive",
    "--format=zip",
    `--prefix=${packageJson.name}-${packageJson.version}/`,
    `--output=${archivePath}`,
    "HEAD",
  ],
  { cwd: root, encoding: "utf8", windowsHide: true }
);
if (archive.status !== 0) {
  throw new Error(archive.stderr.trim() || "git archive failed");
}

const digest = createHash("sha256")
  .update(await readFile(archivePath))
  .digest("hex");
const checksumPath = `${archivePath}.sha256`;
await writeFile(checksumPath, `${digest}  ${path.basename(archivePath)}\n`);
await writeFile(
  path.join(artifactDirectory, `${baseName}.json`),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version: packageJson.version,
      commit,
      archive: path.basename(archivePath),
      sha256: digest,
    },
    null,
    2
  )}\n`
);

console.log(`Created ${path.relative(root, archivePath)}`);
console.log(`Commit ${commit}`);
console.log(`SHA-256 ${digest}`);
