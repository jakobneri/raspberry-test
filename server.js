// src/index.ts
import http from "node:http";
import { readFileSync as readFileSync2 } from "node:fs";
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
  console.log(`[JWT] Token Created: ${userId}`);
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
if (result) {
  console.log("App Token Acquired: ");
} else {
  console.log("Failed to acquire app token");
}

// src/index.ts
var PORT = 3e3;

// Scoreboard storage
var scores = [];

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

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics));
      return;
    } catch (error) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
  }
  if (method === "GET" && url === "/game") {
    // Public route - no authentication required
    const body = readFileSync2("public/game.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }
  if (method === "POST" && url === "/api/scores") {
    // Public route - anyone can submit scores
    try {
      const body = await getReqBody(req);
      const data = JSON.parse(body || "{}");

      scores.push({
        score: data.score || 0,
        userId: "anonymous",
        timestamp: new Date().toISOString(),
      });

      // Keep only top 100 scores
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 100);

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
  if (method === "POST" && url === "/api/admin/restart") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: true, message: "Server restarting..." })
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
  if (method === "POST" && url === "/api/admin/shutdown") {
    const cookieToken = (req.headers.cookie || "").match(/jwt=([^;]+)/)?.[1];
    if (!cookieToken) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    try {
      await verifyToken(cookieToken, userArray);
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
  res.writeHead(404).end("Not found");
});
server.listen(PORT);
console.log(`Server: http://pi.local:${PORT}`);
