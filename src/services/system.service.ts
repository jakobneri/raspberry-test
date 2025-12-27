import { exec } from "node:child_process";
import { EventEmitter } from "node:events";

// ========== LOG MANAGEMENT ==========

export const logEvents = new EventEmitter();

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];
let currentLogLevel: "info" | "warn" | "error" = "info";

const LOG_LEVELS = {
  info: 0,
  warn: 1,
  error: 2,
};

export const setLogLevel = (level: "info" | "warn" | "error") => {
  currentLogLevel = level;
  console.log(`[System] Log level set to ${level}`);
};

export const getLogLevel = () => currentLogLevel;

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Override console methods to capture logs
console.log = (...args: any[]) => {
  const message = args.map((arg) => String(arg)).join(" ");
  addLog("info", message);
  originalConsole.log(...args);
};

console.warn = (...args: any[]) => {
  const message = args.map((arg) => String(arg)).join(" ");
  addLog("warn", message);
  originalConsole.warn(...args);
};

console.error = (...args: any[]) => {
  const message = args.map((arg) => String(arg)).join(" ");
  addLog("error", message);
  originalConsole.error(...args);
};

const addLog = (level: "info" | "warn" | "error", message: string): void => {
  // Filter based on current log level
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  logs.push(entry);
  logEvents.emit("log", entry);

  // Keep only the last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
};

export const getLogs = (limit?: number): LogEntry[] => {
  if (limit) {
    return logs.slice(-limit);
  }
  return [...logs];
};

export const clearLogs = (): void => {
  logs.length = 0;
};

// ========== ADMIN MANAGEMENT ==========

export const restart = (): void => {
  console.log("[System] Server restart requested");
  setTimeout(() => {
    console.log("[System] Server restarting now...");
    process.exit(42);
  }, 500);
};

export const shutdown = (): void => {
  console.log("[System] Server shutdown requested");
  setTimeout(() => {
    console.log("[System] Server shutting down now...");
    process.exit(0);
  }, 500);
};

export const updateAndRestart = (): void => {
  console.log("[System] Server update & restart requested");
  setTimeout(() => {
    console.log("[System] Executing start.sh with option 0...");
    exec("bash start.sh 0", (error) => {
      if (error) {
        console.error(`[System] start.sh execution error: ${error.message}`);
      }
    });
    process.exit(42);
  }, 500);
};
