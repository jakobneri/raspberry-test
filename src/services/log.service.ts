export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];

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

export const addLog = (
  level: "info" | "warn" | "error",
  message: string
): void => {
  logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });

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
