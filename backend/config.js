import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

export function loadConfig(env = process.env) {
  loadDotEnv(env);
  return {
    port: Number(env.PORT || 4000),
    nodeEnv: env.NODE_ENV || "development",
    storageDriver: env.STORAGE_DRIVER || "memory",
    mongodbUri: env.MONGODB_URI || "",
    mongodbDb: env.MONGODB_DB || "kindreport_jaipur",
    corsOrigin: env.CORS_ORIGIN || "*",
    allowDbSeed: env.ALLOW_DB_SEED === "true",
    jwtSecret: env.JWT_SECRET || "change-this-local-development-secret",
    uploadDir: env.UPLOAD_DIR || "uploads",
    maxUploadBytes: Number(env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
    trustProxy: env.TRUST_PROXY === "true"
  };
}

function loadDotEnv(env) {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(projectRoot, ".env")
  ];
  const envPath = candidates.find((p) => existsSync(p));
  if (!envPath) return;

  const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (env[key] === undefined) env[key] = value;
  }
}

