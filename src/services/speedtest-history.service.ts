import type { SpeedTestResult } from "./speedtest.service.js";

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
      `[Speedtest History] Added result. Total entries: ${history.length}`
    );
  }
};

export const getSpeedTestHistory = (): SpeedTestHistoryEntry[] => {
  return [...history];
};

export const clearSpeedTestHistory = (): void => {
  history.length = 0;
  console.log("[Speedtest History] Cleared all entries");
};
