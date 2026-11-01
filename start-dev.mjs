import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = dirname(fileURLToPath(import.meta.url));
const backendPath = join(rootPath, "backend");
const frontendPath = join(rootPath, "frontend");
const pythonPath = process.platform === "win32"
  ? join(backendPath, ".venv", "Scripts", "python.exe")
  : join(backendPath, ".venv", "bin", "python");
const typescriptPath = join(frontendPath, "node_modules", "typescript", "bin", "tsc");
const vitePath = join(frontendPath, "node_modules", "vite", "bin", "vite.js");
const indexPath = join(frontendPath, "dist", "index.html");
const port = 8000;

for (const requiredPath of [
  join(backendPath, "app", "main.py"),
  join(frontendPath, "package.json"),
  typescriptPath,
  vitePath,
]) {
  if (!existsSync(requiredPath)) {
    console.error(`Required project file not found: ${requiredPath}`);
    console.error("Install backend and frontend dependencies as described in README.md.");
    process.exit(1);
  }
}

function runCommand(label, command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", (error) => reject(new Error(`${label} could not start: ${error.message}`)));
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.`));
      }
    });
  });
}

function ensurePortAvailable(checkPort) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      reject(new Error(`Port ${checkPort} is unavailable. Stop the process using it and try again.`));
    });
    server.listen(checkPort, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

function waitForServer(server) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.kill("SIGINT");
      reject(new Error("FastAPI did not become ready within 60 seconds."));
    }, 60_000);
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`FastAPI could not start: ${error.message}`));
    });

    const check = async () => {
      if (server.exitCode !== null || server.signalCode !== null) {
        clearTimeout(timeout);
        reject(new Error(`FastAPI exited with code ${server.exitCode ?? server.signalCode}.`));
        return;
      }

      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) {
          const health = await response.json();
          if (health.service === "ai-agriculture-api") {
            clearTimeout(timeout);
            resolve();
            return;
          }
        }
      } catch {
        // The server is still starting.
      }

      setTimeout(check, 500);
    };

    check();
  });
}

async function main() {
  console.log("Building frontend...");
  await runCommand("TypeScript check", process.execPath, [typescriptPath], frontendPath);
  await runCommand("Vite production build", process.execPath, [vitePath, "build"], frontendPath);

  if (!existsSync(indexPath)) {
    throw new Error(`Frontend build did not create ${indexPath}`);
  }

  await ensurePortAvailable(port);

  const command = existsSync(pythonPath) ? pythonPath : "python";
  const server = spawn(
    command,
    ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", String(port)],
    { cwd: backendPath, stdio: "inherit" },
  );

  server.once("exit", (code) => {
    if (!isStopping) {
      process.exitCode = code ?? 1;
    }
  });

  process.once("SIGINT", () => stopServer(server));
  process.once("SIGTERM", () => stopServer(server));

  await waitForServer(server);
  console.log(`Application running at http://localhost:${port}`);
}

let isStopping = false;
function stopServer(server) {
  if (!isStopping) {
    isStopping = true;
    server.kill("SIGINT");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
