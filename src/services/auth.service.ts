import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage } from "node:http";
import usersJson from "../../config/users.json" with { type: "json" };

// ========== USER MANAGEMENT ==========

export type User = {
  id: string;
  email: string;
  password: string;
};

const userArray: User[] = [];
const data = usersJson as unknown as { users?: User[] } | undefined;

if (data?.users && Array.isArray(data.users)) {
  userArray.push(...data.users);
} else {
  console.error("[Auth] Error loading users.json: invalid structure or empty");
}

export const users = userArray;

// ========== JWT MANAGEMENT ==========

export const propUserId = "urn:app:userid";

interface EnvConfig {
  JWT_SECRET: string;
  CLIENT_ID: string;
  TENANT_ID: string;
  CLIENT_SECRET: string;
  CLOUD_INSTANCE: string;
}

const envPath = resolve("./config/env.json");
const envConfig: EnvConfig = JSON.parse(readFileSync(envPath, "utf-8"));
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

  const userExists = users.some((user) => user.id === userId);
  if (!userExists) {
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

const msalConfig: Configuration = {
  auth: {
    clientId: envConfig.CLIENT_ID,
    authority: `${envConfig.CLOUD_INSTANCE}${envConfig.TENANT_ID}`,
    clientSecret: envConfig.CLIENT_SECRET,
  },
};

const cca = new ConfidentialClientApplication(msalConfig);
let appToken = "";

const initializeAppToken = async (): Promise<void> => {
  try {
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
    console.error("[Auth] Error acquiring SSO app token:", error);
  }
};

// Initialize on module load
initializeAppToken();

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
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
