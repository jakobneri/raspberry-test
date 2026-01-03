import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const dbPath = resolve("./database.sqlite");
export const db: DatabaseType = new Database(dbPath);

// Helper to run queries as promises (keeping async signature for compatibility)
export const run = async (sql: string, params: any[] = []): Promise<void> => {
  db.prepare(sql).run(...params);
};

export const get = async <T>(
  sql: string,
  params: any[] = []
): Promise<T | undefined> => {
  return db.prepare(sql).get(...params) as T | undefined;
};

export const all = async <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return db.prepare(sql).all(...params) as T[];
};

export const hashPassword = (password: string, salt: string): string => {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
};

const initDb = () => {
  try {
    // Create Tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        salt TEXT
      );
      CREATE TABLE IF NOT EXISTS user_requests (
        id TEXT PRIMARY KEY,
        email TEXT,
        password TEXT,
        salt TEXT,
        name TEXT,
        requested_at TEXT,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );
    `);

    // Check if users table is empty
    const userCount = db
      .prepare("SELECT COUNT(*) as count FROM users")
      .get() as {
      count: number;
    };

    if (userCount && userCount.count === 0) {
      console.log("[DB] Database initialized (empty).");
    } else {
      console.log("[DB] Database initialized.");
    }
  } catch (error) {
    console.error("[DB] Initialization error:", error);
  }
};

initDb();
