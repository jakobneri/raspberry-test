import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const execAsync = promisify(exec);

// ========== CONFIGURATION ==========

const configPath = resolve("./config/speedtest.json");

export interface SpeedTestConfig {
  enabled: boolean;
  interval: number; // seconds
}

const loadConfig = (): SpeedTestConfig => {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, "utf-8"));
    }
  } catch (error) {
    console.error("[Speedtest] Error loading config:", error);
  }
  return { enabled: true, interval: 3600 };
};

const saveConfig = (config: SpeedTestConfig) => {
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("[Speedtest] Error saving config:", error);
  }
};

// ========== SPEEDTEST EXECUTION ==========

export interface SpeedTestResult {
  success: boolean;
  ping: number | null;
  download: number | null;
  upload: number | null;
  unit: string;
  message?: string;
  timestamp: string;
}

export const runSpeedTest = async (
  silent: boolean = false
): Promise<SpeedTestResult> => {
  if (!silent) console.log("[Speedtest] Starting speed test...");

  // Try official Ookla Speedtest CLI with JSON output
  try {
    if (!silent)
      console.log("[Speedtest] Running speedtest with JSON output...");
    const { stdout } = await execAsync("speedtest --format=json --accept-license --accept-gdpr", {
      timeout: 90000,
    });
    const data = JSON.parse(stdout);

    // Official Ookla Speedtest CLI JSON structure
    const ping = data.ping?.latency || null;
    const download = data.download?.bandwidth
      ? Math.round((data.download.bandwidth * 8 / 1000000) * 100) / 100
      : null; // Convert bytes/s to Mbit/s (multiply by 8 for bits)
    const upload = data.upload?.bandwidth
      ? Math.round((data.upload.bandwidth * 8 / 1000000) * 100) / 100
      : null;

    if (!silent) {
      console.log(
        `[Speedtest] Test complete - Ping: ${ping}ms, Download: ${download} Mbit/s, Upload: ${upload} Mbit/s`
      );
    }
    return {
      success: true,
      ping,
      download,
      upload,
      unit: "ms / Mbit/s",
      timestamp: new Date().toISOString(),
    };
  } catch (jsonError) {
    if (!silent)
      console.log("[Speedtest] Official Speedtest CLI failed, trying legacy speedtest-cli...");
    console.error("[Speedtest] JSON error:", jsonError);

    // Fallback to legacy speedtest-cli (Python version)
    try {
      const { stdout } = await execAsync("speedtest-cli --json", {
        timeout: 90000,
      });
      const data = JSON.parse(stdout);

      const ping = data.ping || null;
      const download = data.download
        ? Math.round((data.download / 1000000) * 100) / 100
        : null; // Convert bytes/s to Mbit/s
      const upload = data.upload
        ? Math.round((data.upload / 1000000) * 100) / 100
        : null;

      if (!silent) {
        console.log(
          `[Speedtest] Test complete - Ping: ${ping}ms, Download: ${download} Mbit/s, Upload: ${upload} Mbit/s`
        );
      }
      return {
        success: true,
        ping,
        download,
        upload,
        unit: "ms / Mbit/s",
        timestamp: new Date().toISOString(),
      };
    } catch (legacyError) {
      if (!silent)
        console.log(
          "[Speedtest] Legacy speedtest-cli failed, falling back to ping only..."
        );
      console.error("[Speedtest] Legacy error:", legacyError);

      // Final fallback: ping only
      try {
        const { stdout } = await execAsync("ping -c 4 8.8.8.8");
        const match = stdout.match(/avg = ([\d.]+)/);
        const avgPing = match ? parseFloat(match[1]) : null;

        if (avgPing === null) {
          throw new Error("Could not parse ping result");
        }

        if (!silent)
          console.log(`[Speedtest] Ping test complete - ${avgPing}ms`);
        return {
          success: true,
          ping: Math.round(avgPing * 100) / 100,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Full speedtest not available. Only ping test completed. Install official Ookla Speedtest CLI: https://www.speedtest.net/apps/cli",
          timestamp: new Date().toISOString(),
        };
      } catch (pingError) {
        console.error("[Speedtest] All methods failed");
        console.error("[Speedtest] Ping error:", pingError);
        return {
          success: false,
          ping: null,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Speed test failed. Install official Ookla Speedtest CLI: https://www.speedtest.net/apps/cli",
          timestamp: new Date().toISOString(),
        };
      }
    }
  }
};

// ========== SPEEDTEST HISTORY ==========

export interface SpeedTestHistoryEntry {
  timestamp: string;
  ping: number | null;
  download: number | null;
  upload: number | null;
}

const MAX_HISTORY = 1000;
const history: SpeedTestHistoryEntry[] = [];

export const addSpeedTestResult = (
  result: SpeedTestResult,
  silent: boolean = false
): void => {
  if (result.success) {
    history.push({
      timestamp: result.timestamp,
      ping: result.ping,
      download: result.download,
      upload: result.upload,
    });

    // Keep only the last MAX_HISTORY entries
    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    if (!silent) {
      console.log(
        `[Speedtest] Added result to history. Total entries: ${history.length}`
      );
    }
  }
};

export const getSpeedTestHistory = (): SpeedTestHistoryEntry[] => {
  return [...history];
};

export const clearSpeedTestHistory = (): void => {
  history.length = 0;
  console.log("[Speedtest] Cleared all history entries");
};

// ========== SPEEDTEST SCHEDULER ==========

export type SpeedTestInterval = 10 | 30 | 60 | 300 | 600 | 1800 | 3600; // seconds

let currentInterval: number = 3600;
let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const runScheduledSpeedTest = async () => {
  if (isRunning) return;

  // Reload config to check if still enabled (in case changed by CLI)
  const config = loadConfig();
  if (!config.enabled) {
    stopSpeedTestScheduler();
    return;
  }

  isRunning = true;
  try {
    const result = await runSpeedTest(true);
    addSpeedTestResult(result, true);
  } catch (error) {
    console.error("[Speedtest] Error running test:", error);
  } finally {
    isRunning = false;
  }
};

export const startSpeedTestScheduler = (interval?: number) => {
  const config = loadConfig();
  if (!config.enabled) {
    console.log("[Speedtest] Scheduler disabled in config");
    return;
  }

  const finalInterval = interval || config.interval;
  console.log(`[Speedtest] Starting scheduler with ${finalInterval}s interval`);
  currentInterval = finalInterval;

  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  // Run immediately on start
  runScheduledSpeedTest();

  intervalHandle = setInterval(runScheduledSpeedTest, finalInterval * 1000);
};

export const stopSpeedTestScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[Speedtest] Scheduler stopped");
  }
};

export const updateSchedulerConfig = (enabled: boolean, interval: number) => {
  const config = { enabled, interval };
  saveConfig(config);

  if (enabled) {
    startSpeedTestScheduler(interval);
  } else {
    stopSpeedTestScheduler();
  }
};

export const getSchedulerConfig = (): SpeedTestConfig => {
  return loadConfig();
};

// NOTE: Auto-initialization disabled - call startSpeedTestScheduler() explicitly from main module if needed
// startSpeedTestScheduler();
