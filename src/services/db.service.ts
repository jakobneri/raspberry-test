import sqlite3 from "sqlite3";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

const dbPath = resolve("./database.sqlite");
export const db = new sqlite3.Database(dbPath);

// Helper to run queries as promises
export const run = (sql: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const get = <T>(
  sql: string,
  params: any[] = []
): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const all = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const hashPassword = (password: string, salt: string): string => {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
};

const initDb = async () => {
  try {
    // Create Users Table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        salt TEXT
      )
    `);

    // Create User Requests Table
    await run(`
      CREATE TABLE IF NOT EXISTS user_requests (
        id TEXT PRIMARY KEY,
        email TEXT,
        password TEXT,
        salt TEXT,
        name TEXT,
        requested_at TEXT,
        status TEXT
      )
    `);

    // Check if users table is empty
    const userCount = await get<{ count: number }>(
      "SELECT COUNT(*) as count FROM users"
    );

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
