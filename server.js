// src/index.ts
import http from "node:http";
import {
  readFileSync as readFileSync2,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, basename } from "node:path";
import si from "systeminformation";

// src/services/jwt.service.ts
import { SignJWT, jwtVerify } from "jose";

// env.json
var JWT_SECRET =
  "c7a8b2e1f0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3";

// src/services/jwt.service.ts
var propUserId = "urn:app:userid";
var secret = new TextEncoder().encode(JWT_SECRET);
var createToken = (userId) => {
  console.log(`[JWT] Token created for user: ${userId}`);
  return new SignJWT({ [propUserId]: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
};
// Token verification cache (token -> {payload, expiry})
var tokenCache = new Map();
var CACHE_TTL = 60000; // 60 seconds cache

var verifyToken = async (jwt, users) => {
  // Check cache first
  const cached = tokenCache.get(jwt);
  if (cached && cached.expiry > Date.now()) {
    return cached.payload;
  }

  const { payload } = await jwtVerify(jwt, secret);
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

  // Cache the verified token
  tokenCache.set(jwt, {
    payload,
    expiry: Date.now() + CACHE_TTL,
  });

  return payload;
};

// users.json
var users_default = {
  users: [
    {
      id: "user_001",
      email: "user1@example.com",
      password: "1",
    },
    {
      id: "user_002",
      email: "user2@example.com",
      password: "2",
    },
    {
      id: "user_003",
      email: "jn@arvadigitaldemo.onmicrosoft.com",
      password: "a",
    },
  ],
};

// src/services/user.service.ts
var userArray = [];
var data = users_default;
if (data?.users && Array.isArray(data.users)) {
  userArray.push(...data.users);
} else {
  console.error(
    "Fehler beim Laden von users.json: ung\xFCltige Struktur oder leer"
  );
}

// src/services/sso.service.ts
import { ConfidentialClientApplication } from "@azure/msal-node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
var envPath = resolve("./env.json");
var envConfig = JSON.parse(readFileSync(envPath, "utf-8"));
var msalConfig = {
  auth: {
    clientId: envConfig.CLIENT_ID,
    authority: `${envConfig.CLOUD_INSTANCE}${envConfig.TENANT_ID}`,
    clientSecret: envConfig.CLIENT_SECRET,
  },
};
var cca = new ConfidentialClientApplication(msalConfig);
var result = await cca.acquireTokenByClientCredential({
  scopes: ["https://graph.microsoft.com/.default"],
});
var appToken = "";
if (result) {
  console.log("App Token Acquired");
  appToken = result.accessToken || "";
} else {
  console.log("Failed to acquire app token");
}

// src/index.ts
var PORT = 3e3;

// Scoreboard storage - load from scores.json
var SCORES_FILE = "scores.json";
var scores = [];
try {
  const scoresData = JSON.parse(readFileSync2(SCORES_FILE, "utf8"));
  scores = scoresData.topScores || [];
} catch (err) {
  console.log("[Scores] No existing scores file, starting fresh");
  scores = [];
}

function saveScores() {
  writeFileSync(
    SCORES_FILE,
    JSON.stringify({ topScores: scores.slice(0, 10) }, null, 2)
  );
}

// File sharing directory
var SHARED_FILES_DIR = "shared-files";

// Active sessions storage
var activeSessions = [];

// Metrics history storage (keep last 60 data points)
var metricsHistory = [];

// Track session
function addSession(userId, token) {
  const session = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    token,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };
  activeSessions.push(session);
  // Clean old sessions (older than 15 minutes)
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  activeSessions = activeSessions.filter(
    (s) => new Date(s.lastActivity).getTime() > fifteenMinutesAgo
  );
  return session;
}

function updateSessionActivity(token) {
  const session = activeSessions.find((s) => s.token === token);
  if (session) {
    session.lastActivity = new Date().toISOString();
  } else {
    // Session doesn't exist (e.g., after server restart with existing JWT)
    // Extract userId from token and create a new session
    try {
      const decoded = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString()
      );
      if (decoded && decoded.userId) {
        addSession(decoded.userId, token);
      }
    } catch (err) {
      console.error(
        "[Session] Failed to create session from token:",
        err.message
      );
    }
  }
}

var parseBody = async (req) => {
  const body = await getReqBody(req);
  return new URLSearchParams(body || "");
};
var getReqBody = async (req) => {
  return await new Promise((resolve2) => {
    let body = void 0;
    req.on("data", (chunk) => {
      body = (body ?? "") + chunk;
    });
    req.on("end", () => {
      resolve2(body);
    });
  });
};
var server = http.createServer(async (req, res) => {
  const method = req.method || "";
  const url = req.url || "";
  if (method === "GET" && url === "/") {
    const body = readFileSync2("public/login.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }
  if (method === "POST" && url === "/") {
    const params = await parseBody(req);
    const email = params.get("email") || "";
    const password = params.get("password") || "";
    let user;
    for (const userItem of userArray) {
      if (userItem.email === email && userItem.password === password) {
        user = userItem;
        break;
      }
    }
    if (!user || !user.email) {
      const body = readFileSync2("public/login.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }
    const token = await createToken(user.id);
    addSession(user.id, token);
    res.setHeader("Set-Cookie", `jwt=${token}; HttpOnly; Path=/; Max-Age=900`);
    res.writeHead(302, { Location: "/cockpit" }).end();
    return;
  }
  if (method === "GET" && url === "/cockpit") {
    console.log(req.headers.cookie);
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(302, { Location: "/" }).end();
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      updateSessionActivity(cookieToken);
      const body = readFileSync2("public/cockpit.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    } catch {
      res.writeHead(302, { Location: "/" }).end();
      return;
    }
  }
  if (method === "GET" && url === "/api/metrics") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      updateSessionActivity(cookieToken);
      const [
        cpuData,
        memData,
        fsSize,
        currentLoad,
        networkStats,
        cpuTemp,
        diskIO,
      ] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.currentLoad(),
        si.networkStats(),
        si.cpuTemperature(),
        si.disksIO(),
      ]);

      const metrics = {
        cpu: {
          usage: Math.round(currentLoad.currentLoad * 10) / 10,
          cores: cpuData.cores,
          speed: cpuData.speed,
          temperature: cpuTemp.main || cpuTemp.max || 0,
        },
        memory: {
          total: Math.round((memData.total / 1024 / 1024 / 1024) * 100) / 100,
          used: Math.round((memData.used / 1024 / 1024 / 1024) * 100) / 100,
          free: Math.round((memData.free / 1024 / 1024 / 1024) * 100) / 100,
          usagePercent:
            Math.round((memData.used / memData.total) * 100 * 10) / 10,
        },
        disk: {
          totalSize:
            fsSize.length > 0
              ? Math.round((fsSize[0].size / 1024 / 1024 / 1024) * 100) / 100
              : 0,
          used:
            fsSize.length > 0
              ? Math.round((fsSize[0].used / 1024 / 1024 / 1024) * 100) / 100
              : 0,
          available:
            fsSize.length > 0
              ? Math.round(
                  ((fsSize[0].size - fsSize[0].used) / 1024 / 1024 / 1024) * 100
                ) / 100
              : 0,
          usagePercent:
            fsSize.length > 0 ? Math.round(fsSize[0].use * 10) / 10 : 0,
          rIO: diskIO.rIO || 0,
          wIO: diskIO.wIO || 0,
        },
        network: {
          rx:
            networkStats.length > 0
              ? Math.round((networkStats[0].rx_sec / 1024) * 100) / 100
              : 0,
          tx:
            networkStats.length > 0
              ? Math.round((networkStats[0].tx_sec / 1024) * 100) / 100
              : 0,
          interface: networkStats.length > 0 ? networkStats[0].iface : "N/A",
        },
        timestamp: new Date().toISOString(),
      };

      // Store in history (keep last 60 data points)
      metricsHistory.push(metrics);
      if (metricsHistory.length > 60) {
        metricsHistory.shift();
      }

      // Return current metrics with history
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ current: metrics, history: metricsHistory }));
      return;
    } catch (error) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
  }
  if (method === "GET" && url === "/game") {
    // Public route - no authentication required, but track session if logged in
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
      } catch {}
    }
    const body = readFileSync2("public/game.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }
  if (method === "POST" && url === "/api/scores") {
    // Public route - anyone can submit scores, use userId if logged in
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    let userId = "anonymous";

    if (cookieToken) {
      try {
        const payload = await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
        userId = payload[propUserId];
      } catch {}
    }

    try {
      const body = await getReqBody(req);
      const data = JSON.parse(body || "{}");

      scores.push({
        score: data.score || 0,
        userId: userId,
        timestamp: new Date().toISOString(),
      });

      // Keep only top 100 scores
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 100);

      // Save top 10 to file
      saveScores();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    } catch (error) {
      res.writeHead(500).end("Error saving score");
      return;
    }
  }
  if (method === "GET" && url === "/api/scores") {
    // Public route - anyone can view scores
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(scores.slice(0, 10)));
    return;
  }
  if (method === "GET" && url === "/api/whoami") {
    // Public endpoint to check if user is logged in
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (cookieToken) {
      try {
        const payload = await verifyToken(cookieToken, userArray);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ loggedIn: true, userId: payload[propUserId] })
        );
        return;
      } catch {}
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ loggedIn: false, userId: null }));
    return;
  }
  if (method === "GET" && url === "/api/sessions") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      updateSessionActivity(cookieToken);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ sessions: activeSessions, appToken: appToken || null })
      );
      return;
    } catch (error) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
  }
  if (method === "POST" && url === "/api/admin/restart") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      updateSessionActivity(cookieToken);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: true, message: "Server restarting..." })
      );

      setTimeout(() => {
        process.exit(42);
      }, 500);
      return;
    } catch (error) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
  }
  if (method === "POST" && url === "/api/admin/shutdown") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      updateSessionActivity(cookieToken);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: true, message: "Server shutting down..." })
      );

      setTimeout(() => {
        process.exit(0);
      }, 500);
      return;
    } catch (error) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
  }
  if (method === "GET" && url === "/api/system-info") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      updateSessionActivity(cookieToken);
      const [osInfo, systemInfo, timeInfo, processInfo] = await Promise.all([
        si.osInfo(),
        si.system(),
        si.time(),
        si.processes(),
      ]);

      const info = {
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          hostname: osInfo.hostname,
          uptime: Math.floor(timeInfo.uptime / 60),
        },
        system: {
          manufacturer: systemInfo.manufacturer,
          model: systemInfo.model,
          version: systemInfo.version,
        },
        process: {
          running: processInfo.running,
          sleeping: processInfo.sleeping,
          blocked: processInfo.blocked,
        },
        server: {
          nodeVersion: process.version,
          pid: process.pid,
          uptime: Math.floor(process.uptime() / 60),
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(info));
      return;
    } catch (error) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
  }
  if (method === "GET" && url === "/files") {
    // Public route - no authentication required
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
      } catch {}
    }
    const body = readFileSync2("public/files.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }
  if (method === "GET" && url === "/api/files/list") {
    // Public route - anyone can view files
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
      } catch {}
    }

    const files = readdirSync(SHARED_FILES_DIR)
      .map((filename) => {
        const filePath = join(SHARED_FILES_DIR, filename);
        const stats = statSync(filePath);
        const metaPath = join(SHARED_FILES_DIR, `.${filename}.meta`);
        let uploadedBy = "anonymous";
        let uploadedAt = stats.mtime.toISOString();

        try {
          const meta = JSON.parse(readFileSync2(metaPath, "utf8"));
          uploadedBy = meta.uploadedBy || "anonymous";
          uploadedAt = meta.uploadedAt || uploadedAt;
        } catch {}

        return {
          name: filename,
          size: stats.size,
          uploadedBy,
          uploadedAt,
        };
      })
      .filter((f) => !f.name.startsWith("."));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(files));
    return;
  }
  if (method === "POST" && url === "/api/files/upload") {
    // Public route - anyone can upload
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    let userId = "anonymous";

    if (cookieToken) {
      try {
        const payload = await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
        userId = payload[propUserId];
      } catch {}
    }

    try {
      const boundary = req.headers["content-type"]?.split("boundary=")[1];
      if (!boundary) {
        res.writeHead(400).end("No boundary");
        return;
      }

      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const parts = buffer.toString("binary").split(`--${boundary}`);

      for (const part of parts) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          const filename = filenameMatch[1];
          const dataStart = part.indexOf("\r\n\r\n") + 4;
          const dataEnd = part.lastIndexOf("\r\n");
          const fileData = Buffer.from(
            part.substring(dataStart, dataEnd),
            "binary"
          );

          const filePath = join(SHARED_FILES_DIR, filename);
          writeFileSync(filePath, fileData);

          const metaPath = join(SHARED_FILES_DIR, `.${filename}.meta`);
          writeFileSync(
            metaPath,
            JSON.stringify({
              uploadedBy: userId,
              uploadedAt: new Date().toISOString(),
            })
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, filename }));
          return;
        }
      }

      res.writeHead(400).end("No file found");
      return;
    } catch (error) {
      console.error("[Upload Error]", error);
      res.writeHead(500).end("Upload failed");
      return;
    }
  }
  if (method === "GET" && url.startsWith("/api/files/download/")) {
    // Public route - anyone can download
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
      } catch {}
    }
    try {
      const filename = decodeURIComponent(url.split("/api/files/download/")[1]);
      const filePath = join(SHARED_FILES_DIR, basename(filename));
      const fileData = readFileSync2(filePath);

      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
      res.end(fileData);
      return;
    } catch (error) {
      res.writeHead(404).end("File not found");
      return;
    }
  }
  if (method === "DELETE" && url.startsWith("/api/files/delete/")) {
    // Public route - anyone can delete (consider restricting this in production)
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, userArray);
        updateSessionActivity(cookieToken);
      } catch {}
    }
    try {
      const filename = decodeURIComponent(url.split("/api/files/delete/")[1]);
      const filePath = join(SHARED_FILES_DIR, basename(filename));
      const metaPath = join(SHARED_FILES_DIR, `.${basename(filename)}.meta`);

      unlinkSync(filePath);
      try {
        unlinkSync(metaPath);
      } catch {}

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    } catch (error) {
      res.writeHead(404).end("File not found");
      return;
    }
  }
  res.writeHead(404).end("Not found");
});
server.listen(PORT);
console.log(`Server: http://pi.local:${PORT}`);
