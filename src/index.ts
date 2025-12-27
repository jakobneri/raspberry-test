import http from "node:http";
import { readFileSync, createWriteStream, writeFileSync } from "node:fs";
import { Router } from "./router.js";
import {
  createToken,
  verifyToken,
  propUserId,
  clearTokenCache,
  getAppToken,
  getCookieToken,
  validateUser,
} from "./services/auth.service.js";
import * as sessionService from "./services/auth.service.js";
import * as scoreService from "./services/score.service.js";
import * as metricsService from "./services/metrics.service.js";
import * as filesService from "./services/files.service.js";
import * as systemService from "./services/system.service.js";
import * as networkService from "./services/network.service.js";
import * as speedTestService from "./services/speedtest.service.js";

const PORT = 3000;
const router = new Router();

// Helper: Parse Body
const getReqBody = async (req: http.IncomingMessage): Promise<string> => {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
};

const parseBody = async (req: http.IncomingMessage) => {
  const body = await getReqBody(req);
  return new URLSearchParams(body);
};

// Helper: Auth Middleware
const requireAuth = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<string> => {
  const cookieToken = getCookieToken(req);
  if (!cookieToken) {
    throw new Error("Unauthorized");
  }
  const payload = await verifyToken(cookieToken);
  const userId = payload[propUserId] as string;
  sessionService.updateSessionActivity(cookieToken, userId);
  return userId;
};

// ========== PUBLIC ROUTES ==========

router.get("/", (req, res) => {
  const body = readFileSync("public/login.html", "utf8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
});

router.post("/", async (req, res) => {
  const params = await parseBody(req);
  const email = params.get("email") || "";
  const password = params.get("password") || "";

  const user = await validateUser(email, password);

  if (!user) {
    console.log(`[AUTH] Failed login attempt for email: ${email}`);
    const body = readFileSync("public/login.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }

  console.log(`[AUTH] Successful login for user: ${user.id} (${email})`);
  const token = await createToken(user.id);
  sessionService.addSession(user.id, token);
  res.setHeader("Set-Cookie", `jwt=${token}; HttpOnly; Path=/; Max-Age=900`);
  res.writeHead(302, { Location: "/cockpit" }).end();
});

router.post("/api/request-access", async (req, res) => {
  try {
    const params = await parseBody(req);
    const email = params.get("email") || "";
    const password = params.get("password") || "";
    const name = params.get("name") || "";

    const { createUserRequest } = await import("./services/auth.service.js");
    const result = await createUserRequest(email, password, name);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500).end("Error creating request");
  }
});

router.get("/game", async (req, res) => {
  const cookieToken = getCookieToken(req);
  if (cookieToken) {
    try {
      await verifyToken(cookieToken);
      sessionService.updateSessionActivity(cookieToken);
    } catch {}
  }
  const body = readFileSync("public/game.html", "utf8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
});

router.post("/api/scores", async (req, res) => {
  const cookieToken = getCookieToken(req);
  let userId = "anonymous";
  if (cookieToken) {
    try {
      const payload = await verifyToken(cookieToken);
      sessionService.updateSessionActivity(cookieToken);
      userId = payload[propUserId] as string;
    } catch {}
  }

  try {
    const body = await getReqBody(req);
    const data = JSON.parse(body || "{}");
    scoreService.addScore(data.score || 0, userId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    res.writeHead(500).end("Error saving score");
  }
});

router.get("/api/scores", async (req, res) => {
  const scores = scoreService.getTopScores(10);
  // Note: This user lookup is now async in reality but scoreService is sync?
  // We need to fix scoreService or just fetch users here.
  // For now, assuming users array is still populated or we need to fetch.
  // Wait, I removed `users` array export from auth.service.ts?
  // No, I kept `users` export but it was `userArray`.
  // I should check auth.service.ts again. I removed `users` export in my thought process but did I in the file?
  // I replaced the file content. Let's check if `users` is still exported.
  // I replaced the `users` export with `validateUser`.
  // So `users` is NOT available. I need to fetch user details for scores.
  // This is a breaking change for `scoreService` or this route.
  // I will fix this route to fetch user emails from DB.

  const { get } = await import("./services/db.service.js");

  const enrichedScores = await Promise.all(
    scores.map(async (score) => {
      let email = "Anonymous";
      if (score.userId !== "anonymous") {
        const user = await get<{ email: string }>(
          "SELECT email FROM users WHERE id = ?",
          [score.userId]
        );
        if (user) email = user.email;
        else email = score.userId;
      }
      return { ...score, user: email };
    })
  );

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(enrichedScores));
});

router.get("/api/whoami", async (req, res) => {
  const cookieToken = getCookieToken(req);
  if (cookieToken) {
    try {
      const payload = await verifyToken(cookieToken);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ loggedIn: true, userId: payload[propUserId] }));
      return;
    } catch {}
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ loggedIn: false, userId: null }));
});

router.get("/files", async (req, res) => {
  const cookieToken = getCookieToken(req);
  if (cookieToken) {
    try {
      await verifyToken(cookieToken);
      sessionService.updateSessionActivity(cookieToken);
    } catch {}
  }
  const body = readFileSync("public/files.html", "utf8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
});

// ========== AUTHENTICATED ROUTES ==========

const authHandler = (
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    userId: string,
    params: any
  ) => Promise<void>
) => {
  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    params: any
  ) => {
    try {
      const userId = await requireAuth(req, res);
      await handler(req, res, userId, params);
    } catch (error) {
      res.writeHead(302, { Location: "/" }).end();
    }
  };
};

router.get(
  "/cockpit",
  authHandler(async (req, res) => {
    const body = readFileSync("public/cockpit.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  })
);

router.get(
  "/users",
  authHandler(async (req, res) => {
    const body = readFileSync("public/users.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  })
);

router.get(
  "/api/users",
  authHandler(async (req, res) => {
    const { all } = await import("./services/db.service.js");
    const users = await all("SELECT id, email FROM users");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(users));
  })
);

router.get(
  "/api/user-requests",
  authHandler(async (req, res) => {
    const { getPendingUserRequests } = await import(
      "./services/auth.service.js"
    );
    const requests = await getPendingUserRequests();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(requests));
  })
);

router.get(
  "/game-admin",
  authHandler(async (req, res) => {
    const body = readFileSync("public/game-admin.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  })
);

router.get(
  "/network-map",
  authHandler(async (req, res) => {
    const body = readFileSync("public/network-map.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  })
);

router.get(
  "/api/network/scan",
  authHandler(async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const { scanNetwork } = await import("./services/network.service.js");

    await scanNetwork((device) => {
      res.write(`data: ${JSON.stringify(device)}\n\n`);
    });

    res.write("event: done\ndata: {}\n\n");
    res.end();
  })
);

router.delete(
  "/api/scores",
  authHandler(async (req, res) => {
    scoreService.resetScores();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  })
);

router.post(
  "/api/user-requests/approve",
  authHandler(async (req, res) => {
    const body = await getReqBody(req);
    const data = JSON.parse(body || "{}");
    const { approveUserRequest } = await import("./services/auth.service.js");
    const result = await approveUserRequest(data.requestId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  })
);

router.post(
  "/api/user-requests/reject",
  authHandler(async (req, res) => {
    const body = await getReqBody(req);
    const data = JSON.parse(body || "{}");
    const { rejectUserRequest } = await import("./services/auth.service.js");
    const result = await rejectUserRequest(data.requestId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  })
);

router.post(
  "/api/users/delete",
  authHandler(async (req, res) => {
    const body = await getReqBody(req);
    const data = JSON.parse(body || "{}");
    const { deleteUser } = await import("./services/auth.service.js");
    const result = await deleteUser(data.userId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  })
);

router.get(
  "/api/metrics",
  authHandler(async (req, res) => {
    const metrics = await metricsService.getMetrics();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(metrics));
  })
);

router.get(
  "/api/logs",
  authHandler(async (req, res) => {
    const logs = systemService.getLogs();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ logs }));
  })
);

router.post(
  "/api/logs/clear",
  authHandler(async (req, res) => {
    systemService.clearLogs();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  })
);

router.get(
  "/api/sessions",
  authHandler(async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        sessions: sessionService.getSessions(),
        appToken: getAppToken() || null,
      })
    );
  })
);

router.get(
  "/api/system-info",
  authHandler(async (req, res) => {
    const info = await metricsService.getSystemInfo();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(info));
  })
);

router.get(
  "/api/network/details",
  authHandler(async (req, res) => {
    const details = await networkService.getNetworkDetails();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(details));
  })
);

router.post(
  "/api/speedtest",
  authHandler(async (req, res) => {
    try {
      const result = await speedTestService.runSpeedTest();
      speedTestService.addSpeedTestResult(result);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500).end("Error running speedtest");
    }
  })
);

router.get(
  "/api/speedtest/history",
  authHandler(async (req, res) => {
    const history = speedTestService.getSpeedTestHistory();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ history }));
  })
);

router.post(
  "/api/speedtest/history/clear",
  authHandler(async (req, res) => {
    speedTestService.clearSpeedTestHistory();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  })
);

router.get(
  "/api/speedtest/interval",
  authHandler(async (req, res) => {
    const config = speedTestService.getSchedulerConfig();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ interval: config.interval, enabled: config.enabled })
    );
  })
);

router.post(
  "/api/speedtest/interval",
  authHandler(async (req, res) => {
    const body = await parseBody(req);
    const interval = parseInt(body.get("interval") || "3600");
    const enabled = body.get("enabled") === "true";

    if (interval > 0) {
      speedTestService.updateSchedulerConfig(enabled, interval);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, interval, enabled }));
    } else {
      res.writeHead(400).end("Invalid interval");
    }
  })
);

router.get(
  "/api/wifi/status",
  authHandler(async (req, res) => {
    const status = await networkService.getWifiStatus();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status));
  })
);

router.get(
  "/api/wifi/scan",
  authHandler(async (req, res) => {
    const networks = await networkService.scanWifi();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(networks));
  })
);

router.post(
  "/api/wifi/connect",
  authHandler(async (req, res) => {
    const body = await getReqBody(req);
    const { ssid, password } = JSON.parse(body || "{}");
    if (!ssid) {
      res.writeHead(400).end("SSID required");
      return;
    }
    const result = await networkService.connectWifi(ssid, password);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  })
);

router.get(
  "/api/files",
  authHandler(async (req, res) => {
    const files = filesService.listFiles();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(files));
  })
);

router.post(
  "/api/files/upload",
  authHandler(async (req, res) => {
    const contentType = req.headers["content-type"] || "";
    const boundary = contentType.split("boundary=")[1];
    if (!boundary) {
      res.writeHead(400).end("Invalid content type");
      return;
    }

    let body = await getReqBody(req);
    if (!body) {
      res.writeHead(400).end("No file data");
      return;
    }

    const parts = body.split(`--${boundary}`);
    for (const part of parts) {
      if (part.includes('name="file"')) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (!filenameMatch) continue;

        const filename = filenameMatch[1];
        const dataStart = part.indexOf("\r\n\r\n") + 4;
        const dataEnd = part.lastIndexOf("\r\n");
        const fileData = part.substring(dataStart, dataEnd);

        const filePath = filesService.getFilePath(filename);
        const stream = createWriteStream(filePath);
        stream.write(fileData);
        stream.end();

        console.log(`[Files] Uploaded file: ${filename}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, filename }));
        return;
      }
    }
    res.writeHead(400).end("No file found");
  })
);

router.get(
  "/api/files/download/:filename",
  authHandler(async (req, res, userId, params) => {
    try {
      const filename = decodeURIComponent(params.filename);
      const file = filesService.getFile(filename);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
      res.end(file);
    } catch (error) {
      res.writeHead(404).end("File not found");
    }
  })
);

router.delete(
  "/api/files/:filename",
  authHandler(async (req, res, userId, params) => {
    try {
      const filename = decodeURIComponent(params.filename);
      const success = filesService.deleteFile(filename);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success }));
    } catch (error) {
      res.writeHead(500).end("Error deleting file");
    }
  })
);

router.post(
  "/api/admin/update",
  authHandler(async (req, res, userId) => {
    console.log(`[ADMIN] Server update & restart requested by user: ${userId}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ success: true, message: "Server wird aktualisiert..." })
    );
    systemService.updateAndRestart();
  })
);

router.post(
  "/api/admin/restart",
  authHandler(async (req, res, userId) => {
    console.log(`[ADMIN] Server restart requested by user: ${userId}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Server restarting..." }));
    systemService.restart();
  })
);

router.post(
  "/api/admin/shutdown",
  authHandler(async (req, res, userId) => {
    console.log(`[ADMIN] Server shutdown requested by user: ${userId}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ success: true, message: "Server shutting down..." })
    );
    systemService.shutdown();
  })
);

// ========== LOGGING ROUTES ==========

router.get(
  "/api/logs/stream",
  authHandler(async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send existing logs
    const logs = systemService.getLogs();
    logs.forEach((log) => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    // Subscribe to new logs
    const onLog = (log: systemService.LogEntry) => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    };

    systemService.logEvents.on("log", onLog);

    // Cleanup on close
    req.on("close", () => {
      systemService.logEvents.off("log", onLog);
    });
  })
);

router.post(
  "/api/logs/clear",
  authHandler(async (req, res) => {
    systemService.clearLogs();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  })
);

router.post(
  "/api/logs/level",
  authHandler(async (req, res) => {
    const params = await parseBody(req);
    const level = params.get("level");
    if (level && ["info", "warn", "error"].includes(level)) {
      systemService.setLogLevel(level as "info" | "warn" | "error");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, level }));
    } else {
      res.writeHead(400).end("Invalid log level");
    }
  })
);

router.post(
  "/api/admin/speedtest/toggle",
  authHandler(async (req, res, userId) => {
    const params = await parseBody(req);
    const enabled = params.get("enabled") === "true";
    console.log(`[ADMIN] Speedtest toggle: ${enabled} by user: ${userId}`);

    try {
      const envConfig = JSON.parse(readFileSync("config/env.json", "utf8"));
      envConfig.ENABLE_SPEEDTEST = enabled;
      writeFileSync("config/env.json", JSON.stringify(envConfig, null, 2));

      if (enabled) speedTestService.startSpeedTestScheduler(60);
      else speedTestService.stopSpeedTestScheduler();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, enabled }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "Internal Error" }));
    }
  })
);

router.get(
  "/api/admin/speedtest/status",
  authHandler(async (req, res) => {
    try {
      const envConfig = JSON.parse(readFileSync("config/env.json", "utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ enabled: envConfig.ENABLE_SPEEDTEST === true }));
    } catch (error) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ enabled: false }));
    }
  })
);

router.post(
  "/api/logout",
  authHandler(async (req, res, userId) => {
    console.log(`[AUTH] User logged out: ${userId}`);
    const cookieToken = getCookieToken(req);
    if (cookieToken) {
      sessionService.removeSession(cookieToken);
      clearTokenCache(cookieToken);
    }
    res.setHeader("Set-Cookie", "jwt=; HttpOnly; Path=/; Max-Age=0");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  })
);

const server = http.createServer(async (req, res) => {
  const url = req.url || "";

  // Static CSS files
  if (req.method === "GET" && url.startsWith("/css/")) {
    try {
      if (url.includes("..")) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const body = readFileSync("public" + url, "utf8");
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end(body);
      return;
    } catch (error) {
      res.writeHead(404).end("Not found");
      return;
    }
  }

  const handled = await router.handle(req, res);
  if (handled === false) {
    res.writeHead(404).end("Not found");
  }
});

server.listen(PORT);
console.log(`Server: http://pi.local:${PORT}`);
console.log("");

// Start speedtest scheduler if enabled
try {
  const envConfig = JSON.parse(readFileSync("config/env.json", "utf8"));
  if (envConfig.ENABLE_SPEEDTEST === true) {
    speedTestService.startSpeedTestScheduler(60);
  } else {
    console.log("[Speedtest] Scheduler disabled in config");
  }
} catch (e) {
  console.log("[Speedtest] Scheduler disabled (default)");
}
