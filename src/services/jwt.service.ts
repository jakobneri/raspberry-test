import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import envConfig from "../../config/env.json" with { type: "json" };
import type { User } from "./user.service.js";

// userid claim key
export const propUserId = "urn:app:userid";
const secret = new TextEncoder().encode(envConfig.JWT_SECRET);

// Token verification cache (token -> {payload, expiry})
interface CachedToken {
  payload: JWTPayload;
  expiry: number;
}

const tokenCache = new Map<string, CachedToken>();
const CACHE_TTL = 60000; // 60 seconds cache

export const createToken = (userId: string) => {
  console.log(`[JWT] Token Created: ${userId}`);
  return new SignJWT({ [propUserId]: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
};

export const verifyToken = async (
  jwt: string,
  users: User[]
): Promise<JWTPayload> => {
  // Check cache first
  const cached = tokenCache.get(jwt);
  if (cached && cached.expiry > Date.now()) {
    return cached.payload;
  }

  const { payload } = await jwtVerify<JWTPayload>(jwt, secret);

  const userId = payload[propUserId];
  if (!userId || typeof userId !== "string") {
    throw new Error("[JWT] Invalid token: missing or invalid userid.");
  }

  let userExists = false;
  for (const user of users) {
    if (user.id === userId) {
      userExists = true;
      break;
    }
  }
  if (!userExists) {
    console.log(`[AUTH] Token verification failed: user '${userId}' not found`);
    throw new Error(`[JWT] Invalid token: user '${userId}' not found.`);
  }

  // Cache the verified token
  tokenCache.set(jwt, {
    payload,
    expiry: Date.now() + CACHE_TTL,
  });

  console.log(`[JWT] '${userId}' verified.`);
  return payload;
};

export const clearTokenCache = (jwt: string): void => {
  tokenCache.delete(jwt);
};
