import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import envConfig from "../../config/env.json" assert { type: "json" };
import type { User } from "./user.service.js";

// userid claim key
export const propUserId = "urn:app:userid";
const secret = new TextEncoder().encode(envConfig.JWT_SECRET);

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
    throw new Error(`[JWT] Invalid token: user '${userId}' not found.`);
  }

  console.log(`[JWT] '${userId}' verified.`);
  return payload;
};
