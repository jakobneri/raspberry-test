import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getSettings } from "./settings.service.js";
import { updateAndRestart } from "./system.service.js";

const execAsync = promisify(exec);

// Update check interval in milliseconds (default: 30 minutes)
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

let updateCheckInterval: NodeJS.Timeout | null = null;

const checkForUpdates = async (): Promise<boolean> => {
  try {
    console.log("[Auto-Update] Checking for updates...");

    await execAsync("git fetch origin main");
    const { stdout } = await execAsync(
      "git rev-list HEAD...origin/main --count"
    );
    const behindCount = parseInt(stdout.trim());

    if (behindCount > 0) {
      console.log(
        `[Auto-Update] ${behindCount} commit(s) available from remote`
      );
      return true;
    }

    console.log("[Auto-Update] Already up to date");
    return false;
  } catch (error) {
    console.error("[Auto-Update] Error checking for updates:", error);
    return false;
  }
};

const performPeriodicCheck = async () => {
  try {
    const settings = await getSettings();

    if (!settings.autoUpdate) {
      console.log("[Auto-Update] Auto-update disabled, skipping check");
      return;
    }

    const hasUpdates = await checkForUpdates();

    if (hasUpdates) {
      console.log(
        "[Auto-Update] Updates available! Initiating update and restart..."
      );
      // Trigger update and restart
      updateAndRestart();
    }
  } catch (error) {
    console.error("[Auto-Update] Error during periodic check:", error);
  }
};

export const startAutoUpdateScheduler = (intervalMinutes?: number) => {
  if (updateCheckInterval) {
    console.log("[Auto-Update] Scheduler already running");
    return;
  }

  const interval = intervalMinutes
    ? intervalMinutes * 60 * 1000
    : UPDATE_CHECK_INTERVAL;

  console.log(
    `[Auto-Update] Starting scheduler with ${interval / 60000} minute interval`
  );

  // Perform initial check after 1 minute
  setTimeout(performPeriodicCheck, 60 * 1000);

  // Set up periodic checks
  updateCheckInterval = setInterval(performPeriodicCheck, interval);
};

export const stopAutoUpdateScheduler = () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
    console.log("[Auto-Update] Scheduler stopped");
  }
};

export const getAutoUpdateInterval = (): number => {
  return UPDATE_CHECK_INTERVAL / 60000; // Return in minutes
};
