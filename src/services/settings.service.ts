import { db, get, run } from "./db.service.js";

// ========== SETTINGS MANAGEMENT ==========

export interface SystemSettings {
  autoUpdate: boolean;
}

const initSettingsTable = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Initialize default auto-update setting if not exists
    const autoUpdateSetting = db
      .prepare("SELECT value FROM system_settings WHERE key = 'autoUpdate'")
      .get() as { value: string } | undefined;

    if (!autoUpdateSetting) {
      db.prepare(
        "INSERT INTO system_settings (key, value) VALUES ('autoUpdate', 'false')"
      ).run();
      console.log("[Settings] Initialized auto-update setting to false");
    }
  } catch (error) {
    console.error("[Settings] Initialization error:", error);
  }
};

export const getSettings = async (): Promise<SystemSettings> => {
  const autoUpdate = await get<{ value: string }>(
    "SELECT value FROM system_settings WHERE key = 'autoUpdate'"
  );

  return {
    autoUpdate: autoUpdate?.value === "true",
  };
};

export const setAutoUpdate = async (enabled: boolean): Promise<void> => {
  await run(
    "UPDATE system_settings SET value = ? WHERE key = 'autoUpdate'",
    [enabled ? "true" : "false"]
  );
  console.log(`[Settings] Auto-update set to ${enabled}`);
};

// Initialize table on module load
initSettingsTable();
