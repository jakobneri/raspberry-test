import { runSpeedTest } from "./speedtest.service.js";
import { addSpeedTestResult } from "./speedtest-history.service.js";

export type SpeedTestInterval = 10 | 30 | 60 | 300 | 600; // seconds

let currentInterval: SpeedTestInterval = 60; // 1 minute default
let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const runScheduledSpeedTest = async () => {
  if (isRunning) {
    console.log("[Speedtest Scheduler] Test already running, skipping...");
    return;
  }

  isRunning = true;
  console.log("[Speedtest Scheduler] Running scheduled speed test...");

  try {
    const result = await runSpeedTest();
    addSpeedTestResult(result);
  } catch (error) {
    console.error("[Speedtest Scheduler] Error running test:", error);
  } finally {
    isRunning = false;
  }
};

export const startSpeedTestScheduler = (interval: SpeedTestInterval = 60) => {
  console.log(`[Speedtest Scheduler] Starting with ${interval}s interval`);
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
    console.log("[Speedtest Scheduler] Stopped");
  }
};

export const setSpeedTestInterval = (interval: SpeedTestInterval) => {
  if (interval !== currentInterval) {
    console.log(`[Speedtest Scheduler] Changing interval to ${interval}s`);
    startSpeedTestScheduler(interval);
  }
};

export const getCurrentInterval = (): SpeedTestInterval => {
  return currentInterval;
};

export const isSpeedTestRunning = (): boolean => {
  return isRunning;
};
