import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { get, run } from "./db.service.js";

const execAsync = promisify(exec);

// ========== LED CONFIGURATION ==========

// Raspberry Pi LED paths
const PWR_LED_TRIGGER = "/sys/class/leds/PWR/trigger";
const ACT_LED_TRIGGER = "/sys/class/leds/ACT/trigger";

// Available trigger modes
export type LedTriggerMode = "none" | "mmc0" | "actpwr" | "heartbeat" | "default";

export interface LedConfig {
  enabled: boolean;
  mode: LedTriggerMode;
  ledType: "PWR" | "ACT";
}

// Default configuration
let currentConfig: LedConfig = {
  enabled: false,
  mode: "default",
  ledType: "PWR",
};

// ========== LED AVAILABILITY CHECK ==========

/**
 * Check if LED control is available on this system
 */
export const isLedAvailable = (ledType: "PWR" | "ACT" = "PWR"): boolean => {
  const ledPath = ledType === "PWR" ? PWR_LED_TRIGGER : ACT_LED_TRIGGER;
  return existsSync(ledPath);
};

/**
 * Get available LED trigger modes for a specific LED
 */
export const getAvailableTriggers = async (
  ledType: "PWR" | "ACT" = "PWR"
): Promise<string[]> => {
  const ledPath = ledType === "PWR" ? PWR_LED_TRIGGER : ACT_LED_TRIGGER;

  if (!existsSync(ledPath)) {
    return [];
  }

  try {
    const content = readFileSync(ledPath, "utf8");
    // Extract triggers from format like: "none mmc0 timer [heartbeat]"
    // Currently active trigger is in brackets
    const triggers = content
      .replace(/\[|\]/g, "")
      .trim()
      .split(/\s+/);
    return triggers;
  } catch (error) {
    console.error(`[LED] Error reading available triggers:`, error);
    return [];
  }
};

/**
 * Get current LED trigger mode
 */
export const getCurrentTrigger = async (
  ledType: "PWR" | "ACT" = "PWR"
): Promise<string | null> => {
  const ledPath = ledType === "PWR" ? PWR_LED_TRIGGER : ACT_LED_TRIGGER;

  if (!existsSync(ledPath)) {
    return null;
  }

  try {
    const content = readFileSync(ledPath, "utf8");
    // Extract current trigger (the one in brackets)
    const match = content.match(/\[([^\]]+)\]/);
    return match ? match[1] : null;
  } catch (error) {
    console.error(`[LED] Error reading current trigger:`, error);
    return null;
  }
};

// ========== LED CONTROL ==========

/**
 * Set LED trigger mode
 */
export const setLedTrigger = async (
  mode: LedTriggerMode,
  ledType: "PWR" | "ACT" = "PWR"
): Promise<{ success: boolean; error?: string }> => {
  const ledPath = ledType === "PWR" ? PWR_LED_TRIGGER : ACT_LED_TRIGGER;

  if (!existsSync(ledPath)) {
    return {
      success: false,
      error: "LED control not available on this system",
    };
  }

  // Validate mode against allowed values to prevent command injection
  const allowedModes = ["none", "mmc0", "actpwr", "heartbeat", "default"];
  if (!allowedModes.includes(mode)) {
    return {
      success: false,
      error: `Invalid LED mode: ${mode}. Allowed modes: ${allowedModes.join(", ")}`,
    };
  }

  try {
    // Use echo with sudo to write to the LED trigger file
    // This requires the user running the server to have sudo access without password
    // for the specific command, or the server to run as root
    // Mode is validated above to prevent command injection
    const command = `echo "${mode}" | sudo tee ${ledPath} > /dev/null`;
    await execAsync(command);

    console.log(`[LED] Set ${ledType} LED trigger to: ${mode}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[LED] Error setting LED trigger:`, error);
    return {
      success: false,
      error: error.message || "Failed to set LED trigger",
    };
  }
};

/**
 * Apply the LED configuration
 */
export const applyLedConfig = async (
  config: LedConfig
): Promise<{ success: boolean; error?: string }> => {
  if (!config.enabled) {
    // Restore default LED behavior
    console.log("[LED] Restoring default LED behavior");
    return await setLedTrigger("default", config.ledType);
  }

  // Apply the configured mode
  return await setLedTrigger(config.mode, config.ledType);
};

// ========== CONFIGURATION MANAGEMENT ==========

/**
 * Load LED configuration from database
 */
const loadLedConfigFromDb = async (): Promise<LedConfig> => {
  try {
    const row = await get<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'led_config'"
    );
    if (row && row.value) {
      return JSON.parse(row.value);
    }
  } catch (error) {
    console.error("[LED] Error loading config from database:", error);
  }

  // Return default config
  return {
    enabled: false,
    mode: "default",
    ledType: "PWR",
  };
};

/**
 * Save LED configuration to database
 */
const saveLedConfigToDb = async (config: LedConfig): Promise<void> => {
  try {
    await run(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) 
       VALUES ('led_config', ?, datetime('now'))`,
      [JSON.stringify(config)]
    );
  } catch (error) {
    console.error("[LED] Error saving config to database:", error);
  }
};

/**
 * Get current LED configuration
 */
export const getLedConfig = (): LedConfig => {
  return { ...currentConfig };
};

/**
 * Update LED configuration and apply it
 */
export const updateLedConfig = async (
  config: Partial<LedConfig>
): Promise<{ success: boolean; error?: string; config: LedConfig }> => {
  // Merge with current config
  currentConfig = {
    ...currentConfig,
    ...config,
  };

  // Save to database
  await saveLedConfigToDb(currentConfig);

  // Apply the configuration
  const result = await applyLedConfig(currentConfig);

  if (result.success) {
    console.log("[LED] Configuration updated:", currentConfig);
  }

  return {
    ...result,
    config: currentConfig,
  };
};

/**
 * Get LED status including availability and current state
 */
export const getLedStatus = async (): Promise<{
  available: boolean;
  config: LedConfig;
  currentTrigger: string | null;
  availableTriggers: string[];
}> => {
  const available = isLedAvailable(currentConfig.ledType);
  const currentTrigger = available
    ? await getCurrentTrigger(currentConfig.ledType)
    : null;
  const availableTriggers = available
    ? await getAvailableTriggers(currentConfig.ledType)
    : [];

  return {
    available,
    config: currentConfig,
    currentTrigger,
    availableTriggers,
  };
};

// ========== INITIALIZATION ==========

/**
 * Initialize LED service
 */
export const initLedService = async (): Promise<void> => {
  console.log("[LED] Initializing LED service...");

  // Load configuration from database
  currentConfig = await loadLedConfigFromDb();
  console.log("[LED] Loaded configuration:", currentConfig);

  const available = isLedAvailable(currentConfig.ledType);
  if (available) {
    console.log("[LED] LED control available");
    const triggers = await getAvailableTriggers(currentConfig.ledType);
    console.log(`[LED] Available triggers: ${triggers.join(", ")}`);

    // Apply saved configuration on startup
    if (currentConfig.enabled) {
      const result = await applyLedConfig(currentConfig);
      if (result.success) {
        console.log(
          `[LED] Applied saved configuration: ${currentConfig.mode} mode`
        );
      } else {
        console.error(`[LED] Failed to apply saved configuration:`, result.error);
      }
    }
  } else {
    console.log(
      "[LED] LED control not available (this is normal on non-Raspberry Pi systems)"
    );
  }
};
