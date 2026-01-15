import { existsSync, readFileSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { get, run } from "./db.service.js";

const execAsync = promisify(exec);

// ========== LED CONFIGURATION ==========

// Raspberry Pi LED paths
const PWR_LED_TRIGGER = "/sys/class/leds/PWR/trigger";
const ACT_LED_TRIGGER = "/sys/class/leds/ACT/trigger";

// Available trigger modes
// Use string type but validate against the device-reported trigger list to stay flexible
export type LedTriggerMode = string;

export interface LedConfig {
  enabled: boolean;
  mode: LedTriggerMode;
  ledType: "PWR" | "ACT";
}

// Default configuration
let currentConfig: LedConfig = {
  enabled: true,
  mode: "actpwr",
  ledType: "PWR",
};

// Remember the boot-time trigger so we can revert to it when disabling
const defaultTriggers: Record<"PWR" | "ACT", string | null> = {
  PWR: null,
  ACT: null,
};

// Simple mutex lock for config updates to prevent race conditions
// Note: This simple boolean flag works for most cases but is not perfectly thread-safe
// in high-concurrency scenarios. For production, consider using a proper semaphore/queue.
let updateInProgress = false;

const captureDefaultTrigger = async (ledType: "PWR" | "ACT") => {
  if (defaultTriggers[ledType] !== null) return;
  if (!isLedAvailable(ledType)) return;

  defaultTriggers[ledType] = await getCurrentTrigger(ledType);
};

const resolveFallbackTrigger = async (
  ledType: "PWR" | "ACT"
): Promise<LedTriggerMode | null> => {
  await captureDefaultTrigger(ledType);
  const available = await getAvailableTriggers(ledType);

  if (!available.length) return null;

  const recorded = defaultTriggers[ledType];
  if (recorded && available.includes(recorded)) return recorded;

  const preferredOrder = [
    "default-on",
    "mmc0",
    "actpwr",
    "heartbeat",
    "input",
    "none",
  ];

  const preferred = preferredOrder.find((mode) => available.includes(mode));
  return preferred ?? available[0] ?? null;
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
      .split(/\s+/)
      .filter((mode) => mode.length > 0);
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

  const availableTriggers = await getAvailableTriggers(ledType);
  if (!availableTriggers.length) {
    return {
      success: false,
      error: "No LED trigger modes available on this system",
    };
  }

  const sanitizedMode = mode.trim();

  // Validate mode against allowed values to prevent command injection
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(sanitizedMode)) {
    return {
      success: false,
      error: "Invalid LED mode characters",
    };
  }

  if (!availableTriggers.includes(sanitizedMode)) {
    return {
      success: false,
      error: `Invalid LED mode: ${sanitizedMode}. Available modes: ${availableTriggers.join(
        ", "
      )}`,
    };
  }

  // Validate ledPath matches expected constants to prevent command injection
  const validPaths = [PWR_LED_TRIGGER, ACT_LED_TRIGGER];
  if (!validPaths.includes(ledPath)) {
    return {
      success: false,
      error: "Invalid LED path",
    };
  }

  try {
    // Use echo with sudo to write to the LED trigger file
    // This requires the user running the server to have sudo access without password
    // for the specific command, or the server to run as root
    // Mode is validated above to prevent command injection
    const command = `echo "${sanitizedMode}" | sudo tee ${ledPath} > /dev/null`;
    await execAsync(command);

    console.log(`[LED] Set ${ledType} LED trigger to: ${sanitizedMode}`);
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
  if (!isLedAvailable(config.ledType)) {
    return {
      success: false,
      error: "LED control not available on this system",
    };
  }

  const availableTriggers = await getAvailableTriggers(config.ledType);
  if (!availableTriggers.length) {
    return {
      success: false,
      error: "No LED trigger modes reported by the system",
    };
  }

  if (!config.enabled) {
    // Restore default LED behavior
    console.log("[LED] Restoring default LED behavior");
    const fallback = await resolveFallbackTrigger(config.ledType);

    if (!fallback) {
      return {
        success: false,
        error: "No suitable default trigger found",
      };
    }

    return await setLedTrigger(fallback, config.ledType);
  }

  const requestedMode =
    config.mode === "default"
      ? await resolveFallbackTrigger(config.ledType)
      : config.mode;

  if (!requestedMode) {
    return {
      success: false,
      error: "Unable to resolve LED mode",
    };
  }

  if (!availableTriggers.includes(requestedMode)) {
    return {
      success: false,
      error: `Invalid LED mode: ${requestedMode}. Available modes: ${availableTriggers.join(
        ", "
      )}`,
    };
  }

  // Apply the configured mode
  return await setLedTrigger(requestedMode, config.ledType);
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
      const parsed = JSON.parse(row.value);

      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.enabled === "boolean" &&
        typeof parsed.mode === "string" &&
        typeof parsed.ledType === "string" &&
        (parsed.ledType === "PWR" || parsed.ledType === "ACT")
      ) {
        return parsed as LedConfig;
      }
      console.warn("[LED] Invalid config in database, using defaults");
    }
  } catch (error) {
    console.error("[LED] Error loading config from database:", error);
  }

  // Return default config
  return {
    enabled: true,
    mode: "actpwr",
    ledType: "PWR",
  };
};

/**
 * Save LED configuration to database
 */
const saveLedConfigToDb = async (config: LedConfig): Promise<void> => {
  await run(
    `INSERT OR REPLACE INTO settings (key, value, updated_at) 
     VALUES ('led_config', ?, datetime('now'))`,
    [JSON.stringify(config)]
  );
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
  // Simple lock to prevent race conditions
  if (updateInProgress) {
    return {
      success: false,
      error: "Update already in progress",
      config: currentConfig,
    };
  }

  updateInProgress = true;

  try {
    const targetLedType = config.ledType ?? currentConfig.ledType;
    const mergedMode = config.mode ?? currentConfig.mode;

    if (!isLedAvailable(targetLedType)) {
      return {
        success: false,
        error: "LED control not available on this system",
        config: currentConfig,
      };
    }

    // Normalize requested mode (e.g., legacy "default") before applying
    const normalizedMode =
      mergedMode === "default"
        ? await resolveFallbackTrigger(targetLedType)
        : mergedMode;

    if (!normalizedMode) {
      return {
        success: false,
        error: "Unable to resolve LED mode for this device",
        config: currentConfig,
      };
    }

    const nextConfig: LedConfig = {
      ...currentConfig,
      ...config,
      ledType: targetLedType,
      mode: normalizedMode,
    };

    // Apply the configuration first
    const result = await applyLedConfig(nextConfig);

    if (result.success) {
      currentConfig = nextConfig;

      // Persist only when application succeeds
      await saveLedConfigToDb(currentConfig);

      console.log("[LED] Configuration updated:", currentConfig);
    }

    return {
      ...result,
      config: currentConfig,
    };
  } catch (error: any) {
    console.error("[LED] Error updating LED config:", error);
    return {
      success: false,
      error: error.message || "Failed to update LED configuration",
      config: currentConfig,
    };
  } finally {
    updateInProgress = false;
  }
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

  // Capture boot-time triggers for both LEDs if present so we can restore them later
  await Promise.all([
    captureDefaultTrigger("PWR"),
    captureDefaultTrigger("ACT"),
  ]);

  const available = isLedAvailable(currentConfig.ledType);
  if (available) {
    console.log("[LED] LED control available");
    const triggers = await getAvailableTriggers(currentConfig.ledType);
    console.log(`[LED] Available triggers: ${triggers.join(", ")}`);

    if (!triggers.includes(currentConfig.mode)) {
      const fallback = await resolveFallbackTrigger(currentConfig.ledType);
      if (fallback) {
        console.warn(
          `[LED] Stored mode '${currentConfig.mode}' is not available. Falling back to '${fallback}'.`
        );
        currentConfig = {
          ...currentConfig,
          mode: fallback,
        };
        await saveLedConfigToDb(currentConfig);
      }
    }

    // Apply saved configuration on startup
    if (currentConfig.enabled) {
      const result = await applyLedConfig(currentConfig);
      if (result.success) {
        console.log(
          `[LED] Applied saved configuration: ${currentConfig.mode} mode`
        );
      } else {
        console.error(
          `[LED] Failed to apply saved configuration:`,
          result.error
        );
      }
    }
  } else {
    console.log(
      "[LED] LED control not available (this is normal on non-Raspberry Pi systems)"
    );
  }
};
