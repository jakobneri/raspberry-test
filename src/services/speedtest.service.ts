import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

export const runSpeedTest = async (): Promise<SpeedTestResult> => {
  // console.log("[Speedtest] Starting speed test...");

  // Try speedtest-cli with JSON output
  try {
    // console.log("[Speedtest] Running speedtest with JSON output...");
    const { stdout } = await execAsync("speedtest --json", {
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

    // console.log(
    //   `[Speedtest] Test complete - Ping: ${ping}ms, Download: ${download} Mbit/s, Upload: ${upload} Mbit/s`
    // );
    return {
      success: true,
      ping,
      download,
      upload,
      unit: "ms / Mbit/s",
      timestamp: new Date().toISOString(),
    };
  } catch (jsonError) {
    console.log("[Speedtest] JSON mode failed, trying simple mode...");
    console.error("[Speedtest] JSON error:", jsonError);

    // Fallback to simple output
    try {
      const { stdout } = await execAsync("speedtest --simple", {
        timeout: 90000,
      });
      const lines = stdout.split("\n");

      let ping = null;
      let download = null;
      let upload = null;

      for (const line of lines) {
        if (line.startsWith("Ping:")) {
          ping = parseFloat(line.split(":")[1].trim().split(" ")[0]);
        } else if (line.startsWith("Download:")) {
          download = parseFloat(line.split(":")[1].trim().split(" ")[0]);
        } else if (line.startsWith("Upload:")) {
          upload = parseFloat(line.split(":")[1].trim().split(" ")[0]);
        }
      }

      console.log(
        `[Speedtest] Test complete - Ping: ${ping}ms, Download: ${download} Mbit/s, Upload: ${upload} Mbit/s`
      );
      return {
        success: true,
        ping,
        download,
        upload,
        unit: "ms / Mbit/s",
        timestamp: new Date().toISOString(),
      };
    } catch (simpleError) {
      console.log(
        "[Speedtest] Simple mode failed, falling back to ping only..."
      );
      console.error("[Speedtest] Simple error:", simpleError);

      // Final fallback: ping only
      try {
        const { stdout } = await execAsync("ping -c 4 8.8.8.8");
        const match = stdout.match(/avg = ([\d.]+)/);
        const avgPing = match ? parseFloat(match[1]) : null;

        if (avgPing === null) {
          throw new Error("Could not parse ping result");
        }

        console.log(`[Speedtest] Ping test complete - ${avgPing}ms`);
        return {
          success: true,
          ping: Math.round(avgPing * 100) / 100,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Full speedtest not available. Only ping test completed. Install: sudo apt-get install speedtest-cli",
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
            "Speed test failed. Install speedtest-cli: sudo apt-get install speedtest-cli",
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

export const addSpeedTestResult = (result: SpeedTestResult): void => {
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

    console.log(
      `[Speedtest] Added result to history. Total entries: ${history.length}`
    );
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

export type SpeedTestInterval = 10 | 30 | 60 | 300 | 600; // seconds

let currentInterval: SpeedTestInterval = 60; // 1 minute default
let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const runScheduledSpeedTest = async () => {
  if (isRunning) {
    console.log("[Speedtest] Test already running, skipping...");
    return;
  }

  isRunning = true;
  console.log("[Speedtest] Running scheduled speed test...");

  try {
    const result = await runSpeedTest();
    addSpeedTestResult(result);
  } catch (error) {
    console.error("[Speedtest] Error running test:", error);
  } finally {
    isRunning = false;
  }
};

export const startSpeedTestScheduler = (interval: SpeedTestInterval = 60) => {
  console.log(`[Speedtest] Starting scheduler with ${interval}s interval`);
  currentInterval = interval;

  // Stop existing interval if any
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  // Run immediately on start
  runScheduledSpeedTest();

  // Schedule recurring tests
  intervalHandle = setInterval(runScheduledSpeedTest, interval * 1000);
};

export const stopSpeedTestScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[Speedtest] Scheduler stopped");
  }
};

export const setSpeedTestInterval = (interval: SpeedTestInterval) => {
  if (interval !== currentInterval) {
    console.log(`[Speedtest] Changing interval to ${interval}s`);
    startSpeedTestScheduler(interval);
  }
};

export const getCurrentInterval = (): SpeedTestInterval => {
  return currentInterval;
};

export const isSpeedTestRunning = (): boolean => {
  return isRunning;
};
