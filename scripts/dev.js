import { spawn, exec } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const backendDir = resolve(rootDir, "backend");
const frontendDir = resolve(rootDir, "frontend");

const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

function log(prefix, color, message) {
  console.log(`${color}${bold}[${prefix}]${reset} ${message}`);
}

function pipeStream(stream, prefix, color) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    console.log(`${color}[${prefix}]${reset} ${line}`);
  });
}

console.log(`${bold}====================================================${reset}`);
console.log(`${green}${bold}  KindSaver Jaipur - Full-Stack Dev Server${reset}`);
console.log(`${bold}====================================================${reset}`);
log("kindsaver", cyan, "Starting backend (port 4000) & frontend (port 5173)...");

// Spawn backend
const backendProc = spawn(process.execPath, ["server.js"], {
  cwd: backendDir,
  stdio: ["inherit", "pipe", "pipe"]
});

pipeStream(backendProc.stdout, "backend", cyan);
pipeStream(backendProc.stderr, "backend:err", red);

// Spawn frontend (direct vite launcher or npm fallback)
const viteBin = resolve(frontendDir, "node_modules", "vite", "bin", "vite.js");
let frontendProc;

if (existsSync(viteBin)) {
  frontendProc = spawn(process.execPath, [viteBin, "--host", "127.0.0.1"], {
    cwd: frontendDir,
    stdio: ["inherit", "pipe", "pipe"]
  });
} else {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  frontendProc = spawn(npmCmd, ["run", "dev"], {
    cwd: frontendDir,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true
  });
}

pipeStream(frontendProc.stdout, "frontend", green);
pipeStream(frontendProc.stderr, "frontend:err", yellow);

let isShuttingDown = false;

function killProc(proc) {
  if (!proc || !proc.pid) return;
  if (process.platform === "win32") {
    try {
      exec(`taskkill /pid ${proc.pid} /T /F`, () => {});
    } catch {}
  } else {
    try {
      proc.kill("SIGTERM");
    } catch {}
  }
}

function shutdown(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log("kindsaver", yellow, "Shutting down servers...");
  killProc(backendProc);
  killProc(frontendProc);
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

backendProc.on("exit", (code) => {
  if (!isShuttingDown && code !== null && code !== 0) {
    log("backend", red, `Backend exited with code ${code}`);
    shutdown(code);
  }
});

frontendProc.on("exit", (code) => {
  if (!isShuttingDown && code !== null && code !== 0) {
    log("frontend", red, `Frontend exited with code ${code}`);
    shutdown(code);
  }
});
