import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const restart = (): void => {
  console.log("[ADMIN] Server restart requested");
  setTimeout(() => {
    console.log("[ADMIN] Server restarting now...");
    process.exit(42);
  }, 500);
};

export const shutdown = (): void => {
  console.log("[ADMIN] Server shutdown requested");
  setTimeout(() => {
    console.log("[ADMIN] Server shutting down now...");
    process.exit(0);
  }, 500);
};

export const updateAndRestart = (): void => {
  console.log("[ADMIN] Server update & restart requested");
  setTimeout(() => {
    console.log("[ADMIN] Executing start.sh with option 0...");
    exec("bash start.sh 0", (error) => {
      if (error) {
        console.error(`[ADMIN] start.sh execution error: ${error.message}`);
      }
    });
    process.exit(42);
  }, 500);
};
