import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { z } from "zod";
import { get, run, all } from "./db.service.js";

// ========== USER MANAGEMENT ==========

export type User = {
  id: string;
  email: string;
  password: string;
  salt: string;
};

export const hashPassword = (password: string, salt: string): string => {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
};

export const validateUser = async (
  email: string,
  password: string
): Promise<User | null> => {
  const user = await get<User>("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) {
    console.log(`[Auth] Login failed: User '${email}' not found.`);
    return null;
  }

  const hashed = hashPassword(password, user.salt);
  if (hashed === user.password) {
    return user;
  }

  console.log(`[Auth] Login failed: Invalid password for user '${email}'.`);
  return null;
};

// ========== JWT MANAGEMENT ==========

export const propUserId = "urn:app:userid";

export interface EnvConfig {
  JWT_SECRET: string;
  CLIENT_ID?: string;
  TENANT_ID?: string;
  CLIENT_SECRET?: string;
  CLOUD_INSTANCE?: string;
  ENABLE_SPEEDTEST?: boolean;
}

// Helper to ensure directory exists and write config file safely
const ensureConfigDirAndWrite = (filePath: string, content: string): void => {
  const configDir = dirname(filePath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(filePath, content);
};

// Load environment configuration with fallback to defaults
const loadEnvConfig = (): EnvConfig => {
  const envPath = resolve("./config/env.json");
  try {
    const config = JSON.parse(readFileSync(envPath, "utf-8"));
    return {
      JWT_SECRET: config.JWT_SECRET ?? generateAndSaveSecret(envPath, config),
      CLIENT_ID: config.CLIENT_ID,
      TENANT_ID: config.TENANT_ID,
      CLIENT_SECRET: config.CLIENT_SECRET,
      CLOUD_INSTANCE: config.CLOUD_INSTANCE || "https://login.microsoftonline.com/",
      ENABLE_SPEEDTEST: config.ENABLE_SPEEDTEST,
    };
  } catch (error) {
    console.log("[Auth] config/env.json not found, creating with default configuration");
    // Generate and save a persistent JWT secret
    const secret = randomBytes(32).toString("hex");
    const newConfig: EnvConfig = {
      JWT_SECRET: secret,
      CLOUD_INSTANCE: "https://login.microsoftonline.com/",
    };
    try {
      ensureConfigDirAndWrite(envPath, JSON.stringify(newConfig, null, 2));
      console.log("[Auth] Created config/env.json with generated JWT_SECRET");
    } catch (writeError) {
      console.error("[Auth] Failed to create config/env.json, using in-memory secret");
    }
    return newConfig;
  }
};

// Helper to generate and save a JWT secret if missing
const generateAndSaveSecret = (envPath: string, config: Partial<EnvConfig>): string => {
  const secret = randomBytes(32).toString("hex");
  config.JWT_SECRET = secret;
  try {
    ensureConfigDirAndWrite(envPath, JSON.stringify(config, null, 2));
    console.log("[Auth] Generated and saved JWT_SECRET to config/env.json");
  } catch (error) {
    console.error("[Auth] Failed to save JWT_SECRET to config/env.json");
  }
  return secret;
};

const envConfig = loadEnvConfig();
const jwtSecret = new TextEncoder().encode(envConfig.JWT_SECRET);

// Token verification cache
interface CachedToken {
  payload: JWTPayload;
  expiry: number;
}

const tokenCache = new Map<string, CachedToken>();
const CACHE_TTL = 60000; // 60 seconds

export const createToken = (userId: string) => {
  console.log(`[Auth] Token created: ${userId}`);
  return new SignJWT({ [propUserId]: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(jwtSecret);
};

export const verifyToken = async (jwt: string): Promise<JWTPayload> => {
  // Check cache first
  const cached = tokenCache.get(jwt);
  if (cached && cached.expiry > Date.now()) {
    return cached.payload;
  }

  const { payload } = await jwtVerify<JWTPayload>(jwt, jwtSecret);

  const userId = payload[propUserId];
  if (!userId || typeof userId !== "string") {
    throw new Error("[Auth] Invalid token: missing or invalid userid");
  }

  const user = await get<User>("SELECT id FROM users WHERE id = ?", [userId]);
  if (!user) {
    console.log(`[Auth] Token verification failed: user '${userId}' not found`);
    throw new Error(`[Auth] Invalid token: user '${userId}' not found`);
  }

  // Cache the verified token
  tokenCache.set(jwt, {
    payload,
    expiry: Date.now() + CACHE_TTL,
  });

  console.log(`[Auth] '${userId}' verified`);
  return payload;
};

export const clearTokenCache = (jwt: string): void => {
  tokenCache.delete(jwt);
};

export const getCookieToken = (req: IncomingMessage): string | undefined => {
  return (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
};

// ========== SSO MANAGEMENT ==========

// Azure SSO is optional - only initialized if credentials are provided
let cca: ConfidentialClientApplication | null = null;
let appToken = "";

const initializeSSO = async (): Promise<void> => {
  // Skip SSO initialization if credentials are not configured
  if (
    !envConfig.CLIENT_ID ||
    !envConfig.CLIENT_SECRET ||
    !envConfig.TENANT_ID
  ) {
    console.log(
      "[Auth] SSO not configured - skipping Azure SSO initialization"
    );
    return;
  }

  try {
    const msalConfig: Configuration = {
      auth: {
        clientId: envConfig.CLIENT_ID,
        authority: `${envConfig.CLOUD_INSTANCE}${envConfig.TENANT_ID}`,
        clientSecret: envConfig.CLIENT_SECRET,
      },
    };

    cca = new ConfidentialClientApplication(msalConfig);

    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    if (result) {
      console.log("[Auth] SSO App Token Acquired");
      appToken = result.accessToken || "";
    } else {
      console.log("[Auth] Failed to acquire SSO app token");
    }
  } catch (error) {
    console.error("[Auth] Error initializing SSO:", error);
    cca = null;
  }
};

// Initialize on module load
initializeSSO();

export const getAppToken = (): string => appToken;

// ========== SESSION MANAGEMENT ==========

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  lastActivity: string;
}

let activeSessions: Session[] = [];

export const addSession = (userId: string, token: string): Session => {
  const session: Session = {
    id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    userId,
    token,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };
  activeSessions.push(session);
  console.log(`[Auth] New session created for user: ${userId}`);

  // Clean old sessions
  cleanOldSessions();

  return session;
};

export const updateSessionActivity = (token: string, userId?: string): void => {
  const session = activeSessions.find((s) => s.token === token);
  if (session) {
    session.lastActivity = new Date().toISOString();
  } else if (userId) {
    addSession(userId, token);
  }
};

export const removeSession = (token: string): void => {
  activeSessions = activeSessions.filter((s) => s.token !== token);
};

export const getSessions = (): Session[] => {
  return activeSessions;
};

export const revokeAllSessions = (): void => {
  const count = activeSessions.length;
  activeSessions = [];
  console.log(`[Auth] Revoked all ${count} active sessions.`);
};

export const cleanOldSessions = (): void => {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const beforeCount = activeSessions.length;
  activeSessions = activeSessions.filter(
    (s) => new Date(s.lastActivity).getTime() > fifteenMinutesAgo
  );
  const cleanedCount = beforeCount - activeSessions.length;
  if (cleanedCount > 0) {
    console.log(`[Auth] Cleaned ${cleanedCount} expired session(s)`);
  }
};

// ========== USER REQUEST MANAGEMENT ==========

const emailSchema = z.string().email();

export interface UserRequest {
  id: string;
  email: string;
  password: string;
  salt: string;
  name: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

export const createUserRequest = async (
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Validate email with Zod
    emailSchema.parse(email);

    // Check if email already exists in users
    const existingUser = await get("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existingUser) {
      return { success: false, message: "Email already registered" };
    }

    // Check if there's already a pending request for this email
    const existingRequest = await get(
      "SELECT id FROM user_requests WHERE email = ? AND status = 'pending'",
      [email]
    );
    if (existingRequest) {
      return {
        success: false,
        message: "Request already pending for this email",
      };
    }

    const salt = randomBytes(16).toString("hex");
    const hashedPassword = hashPassword(password, salt);
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const requestedAt = new Date().toISOString();

    await run(
      `INSERT INTO user_requests (id, email, password, salt, name, requested_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, email, hashedPassword, salt, name, requestedAt, "pending"]
    );

    console.log(`[Auth] New user request created: ${email}`);
    return { success: true, message: "Access request submitted successfully" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Invalid email format" };
    }
    console.error(error);
    return { success: false, message: "Failed to create request" };
  }
};

export const getPendingUserRequests = async (): Promise<UserRequest[]> => {
  return await all<UserRequest>(
    "SELECT * FROM user_requests WHERE status = 'pending'"
  );
};

export const getAllUserRequests = async (): Promise<UserRequest[]> => {
  return await all<UserRequest>("SELECT * FROM user_requests");
};

export const approveUserRequest = async (
  requestId: string
): Promise<{ success: boolean; message: string }> => {
  const request = await get<UserRequest>(
    "SELECT * FROM user_requests WHERE id = ?",
    [requestId]
  );
  if (!request) {
    return { success: false, message: "Request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, message: "Request already processed" };
  }

  const userId = `user_${Date.now()}`;

  // Add user to users table
  await run(
    "INSERT INTO users (id, email, password, salt) VALUES (?, ?, ?, ?)",
    [userId, request.email, request.password, request.salt]
  );

  // Update request status
  await run("UPDATE user_requests SET status = 'approved' WHERE id = ?", [
    requestId,
  ]);

  console.log(`[Auth] User request approved: ${request.email}`);
  return { success: true, message: "User approved successfully" };
};

export const rejectUserRequest = async (
  requestId: string
): Promise<{ success: boolean; message: string }> => {
  const request = await get<UserRequest>(
    "SELECT * FROM user_requests WHERE id = ?",
    [requestId]
  );
  if (!request) {
    return { success: false, message: "Request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, message: "Request already processed" };
  }

  await run("UPDATE user_requests SET status = 'rejected' WHERE id = ?", [
    requestId,
  ]);

  console.log(`[Auth] User request rejected: ${request.email}`);
  return { success: true, message: "User request rejected" };
};

export const createUser = async (
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; message: string; userId?: string }> => {
  try {
    // Validate email with Zod
    emailSchema.parse(email);

    // Check if email already exists
    const existingUser = await get("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existingUser) {
      return { success: false, message: "Email already registered" };
    }

    const salt = randomBytes(16).toString("hex");
    const hashedPassword = hashPassword(password, salt);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    await run(
      "INSERT INTO users (id, email, password, salt) VALUES (?, ?, ?, ?)",
      [userId, email, hashedPassword, salt]
    );

    console.log(`[Auth] User created: ${email}`);
    return { success: true, message: "User created successfully", userId };
  } catch (error) {
    console.error("[Auth] Error creating user:", error);
    return { success: false, message: "Failed to create user" };
  }
};

export const deleteUser = async (
  userId: string
): Promise<{ success: boolean; message: string }> => {
  const user = await get<User>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) {
    return { success: false, message: "User not found" };
  }

  await run("DELETE FROM users WHERE id = ?", [userId]);

  console.log(`[Auth] User deleted: ${user.email}`);
  return { success: true, message: "User deleted successfully" };
};
