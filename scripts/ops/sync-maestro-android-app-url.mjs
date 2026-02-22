#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const workflowName = process.env.APK_WORKFLOW_NAME ?? "Build Android Staging APK";
const branch = process.env.APK_WORKFLOW_BRANCH ?? "main";
const secretName = process.env.MAESTRO_ANDROID_URL_SECRET ?? "MAESTRO_ANDROID_APP_URL";

function runGh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findLatestSuccessfulRunId() {
  const raw = runGh([
    "run",
    "list",
    "--workflow",
    workflowName,
    "--branch",
    branch,
    "--limit",
    "30",
    "--json",
    "databaseId,status,conclusion,createdAt",
  ]);

  const runs = JSON.parse(raw);
  const hit = runs.find(
    (run) => run?.status === "completed" && run?.conclusion === "success",
  );
  return hit?.databaseId ? String(hit.databaseId) : "";
}

function findApkUrl(logText) {
  const apkUrlPattern = /https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk/g;
  const hits = logText.match(apkUrlPattern) ?? [];
  return hits[0] ?? "";
}

function main() {
  runGh(["auth", "status"]);

  const runId = process.env.APK_WORKFLOW_RUN_ID?.trim() || findLatestSuccessfulRunId();
  assert(
    runId,
    `No successful '${workflowName}' run found on branch '${branch}'.`,
  );

  const logs = runGh(["run", "view", runId, "--log"]);
  const apkUrl = findApkUrl(logs);
  assert(
    apkUrl,
    `Could not find APK URL in logs for run ${runId}.`,
  );

  runGh(["secret", "set", secretName, "--body", apkUrl]);

  console.log(
    `[sync-maestro-android-app-url] Updated ${secretName} from run ${runId}: ${apkUrl}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sync-maestro-android-app-url] ${message}`);
  process.exit(1);
}
