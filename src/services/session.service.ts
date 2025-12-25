import http from "node:http";

/**
 * Session storage
 */
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
  console.log(`[SESSION] New session created for user: ${userId}`);

  // Clean old sessions (older than 15 minutes)
  cleanOldSessions();

  return session;
};

export const updateSessionActivity = (token: string, userId?: string): void => {
  const session = activeSessions.find((s) => s.token === token);
  if (session) {
    session.lastActivity = new Date().toISOString();
  } else if (userId) {
    // Session doesn't exist, create a new one
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
    console.log(`[SESSION] Cleaned ${cleanedCount} expired session(s)`);
  }
};

export const getCookieToken = (
  req: http.IncomingMessage
): string | undefined => {
  return (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
};
