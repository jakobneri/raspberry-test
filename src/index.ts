import http from "node:http";
import { readFileSync, createWriteStream, writeFileSync } from "node:fs";
import {
  createToken,
  verifyToken,
  propUserId,
  clearTokenCache,
  users,
  getAppToken,
  getCookieToken,
  hashPassword,
} from "./services/auth.service.js";
import * as sessionService from "./services/auth.service.js";
import * as scoreService from "./services/score.service.js";
import * as metricsService from "./services/metrics.service.js";
import * as filesService from "./services/files.service.js";
import * as systemService from "./services/system.service.js";
import * as networkService from "./services/network.service.js";
import * as speedTestService from "./services/speedtest.service.js";

const PORT = 3000;

const parseBody = async (req: http.IncomingMessage) => {
  const body = await getReqBody(req);
  return new URLSearchParams(body || "");
};

const getReqBody = async (
  req: http.IncomingMessage
): Promise<string | undefined> => {
  return await new Promise((resolve) => {
    let body: string | undefined = undefined;
    req.on("data", (chunk) => {
      body = (body ?? "") + chunk;
    });
    req.on("end", () => {
      resolve(body);
    });
  });
};

const server = http.createServer(async (req, res) => {
  const method = req.method || "";
  const url = req.url || "";

  // ========== PUBLIC ROUTES ==========

  // Serve CSS files
  if (method === "GET" && url.startsWith("/css/")) {
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

  // Login page
  if (method === "GET" && url === "/") {
    const body = readFileSync("public/login.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }

  // Login POST
  if (method === "POST" && url === "/") {
    const params = await parseBody(req);
    const email = params.get("email") || "";
    const password = params.get("password") || "";

    const user = users.find(
      (u) => u.email === email && u.password === hashPassword(password)
    );

    if (!user || !user.email) {
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
    return;
  }

  // Request access POST
  if (method === "POST" && url === "/api/request-access") {
    try {
      const params = await parseBody(req);
      const email = params.get("email") || "";
      const password = params.get("password") || "";
      const name = params.get("name") || "";

      const result = (
        await import("./services/auth.service.js")
      ).createUserRequest(email, password, name);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    } catch (error) {
      res.writeHead(500).end("Error creating request");
      return;
    }
  }

  // Game page (public but track session if logged in)
  if (method === "GET" && url === "/game") {
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
    return;
  }

  // Submit score (public)
  if (method === "POST" && url === "/api/scores") {
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
      return;
    } catch (error) {
      res.writeHead(500).end("Error saving score");
      return;
    }
  }

  // Get scores (public)
  if (method === "GET" && url === "/api/scores") {
    const scores = scoreService.getTopScores(10);
    const enrichedScores = scores.map((score) => {
      const user = users.find((u) => u.id === score.userId);
      return {
        ...score,
        user: user
          ? user.email
          : score.userId === "anonymous"
          ? "Anonymous"
          : score.userId,
      };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(enrichedScores));
    return;
  }

  // Who am I (public)
  if (method === "GET" && url === "/api/whoami") {
    const cookieToken = getCookieToken(req);
    if (cookieToken) {
      try {
        const payload = await verifyToken(cookieToken);
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

  // Files page (public but track session if logged in)
  if (method === "GET" && url === "/files") {
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
    return;
  }

  // ========== AUTHENTICATED ROUTES ==========

  const cookieToken = getCookieToken(req);
  if (!cookieToken) {
    res.writeHead(401).end("Unauthorized");
    return;
  }

  try {
    const payload = await verifyToken(cookieToken);
    sessionService.updateSessionActivity(
      cookieToken,
      payload[propUserId] as string
    );

    // Cockpit page
    if (method === "GET" && url === "/cockpit") {
      const body = readFileSync("public/cockpit.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }

    // User management page
    if (method === "GET" && url === "/users") {
      const body = readFileSync("public/users.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }

    // Get all users
    if (method === "GET" && url === "/api/users") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(users));
      return;
    }

    // Get pending user requests
    if (method === "GET" && url === "/api/user-requests") {
      const { getPendingUserRequests } = await import(
        "./services/auth.service.js"
      );
      const requests = getPendingUserRequests();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(requests));
      return;
    }

    // Game Admin page
    if (method === "GET" && url === "/game-admin") {
      const body = readFileSync("public/game-admin.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }

    // Reset scores
    if (method === "DELETE" && url === "/api/scores") {
      scoreService.resetScores();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Approve user request
    if (method === "POST" && url === "/api/user-requests/approve") {
      try {
        const body = await getReqBody(req);
        const data = JSON.parse(body || "{}");
        const { approveUserRequest } = await import(
          "./services/auth.service.js"
        );
        const result = approveUserRequest(data.requestId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        res.writeHead(500).end("Error approving request");
        return;
      }
    }

    // Reject user request
    if (method === "POST" && url === "/api/user-requests/reject") {
      try {
        const body = await getReqBody(req);
        const data = JSON.parse(body || "{}");
        const { rejectUserRequest } = await import(
          "./services/auth.service.js"
        );
        const result = rejectUserRequest(data.requestId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        res.writeHead(500).end("Error rejecting request");
        return;
      }
    }

    // Delete user
    if (method === "POST" && url === "/api/users/delete") {
      try {
        const body = await getReqBody(req);
        const data = JSON.parse(body || "{}");
        const { deleteUser } = await import("./services/auth.service.js");
        const result = deleteUser(data.userId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        res.writeHead(500).end("Error deleting user");
        return;
      }
    }

    // Get metrics
    if (method === "GET" && url === "/api/metrics") {
      const metrics = await metricsService.getMetrics();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics));
      return;
    }

    // Get logs
    if (method === "GET" && url === "/api/logs") {
      const logs = systemService.getLogs();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ logs }));
      return;
    }

    // Clear logs
    if (method === "POST" && url === "/api/logs/clear") {
      systemService.clearLogs();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Get sessions
    if (method === "GET" && url === "/api/sessions") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          sessions: sessionService.getSessions(),
          appToken: getAppToken() || null,
        })
      );
      return;
    }

    // System info
    if (method === "GET" && url === "/api/system-info") {
      const info = await metricsService.getSystemInfo();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(info));
      return;
    }

    // Network details
    if (method === "GET" && url === "/api/network/details") {
      const details = await networkService.getNetworkDetails();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(details));
      return;
    }

    // Speedtest
    if (method === "POST" && url === "/api/speedtest") {
      try {
        const result = await speedTestService.runSpeedTest();
        speedTestService.addSpeedTestResult(result);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        console.error("[Speedtest Error]", error);
        res.writeHead(500).end("Error running speedtest");
        return;
      }
    }

    // Get speedtest history
    if (method === "GET" && url === "/api/speedtest/history") {
      const history = speedTestService.getSpeedTestHistory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ history }));
      return;
    }

    // Clear speedtest history
    if (method === "POST" && url === "/api/speedtest/history/clear") {
      speedTestService.clearSpeedTestHistory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Get speedtest interval
    if (method === "GET" && url === "/api/speedtest/interval") {
      const interval = speedTestService.getCurrentInterval();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ interval }));
      return;
    }

    // Set speedtest interval
    if (method === "POST" && url === "/api/speedtest/interval") {
      try {
        const body = await parseBody(req);
        const interval = parseInt(body.get("interval") || "60");
        if ([10, 30, 60, 300, 600].includes(interval)) {
          speedTestService.setSpeedTestInterval(interval as any);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, interval }));
        } else {
          res.writeHead(400).end("Invalid interval");
        }
        return;
      } catch (error) {
        console.error("[Speedtest Interval Error]", error);
        res.writeHead(500).end("Error setting interval");
        return;
      }
    }

    // WiFi status
    if (method === "GET" && url === "/api/wifi/status") {
      try {
        const status = await networkService.getWifiStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
        return;
      } catch (error) {
        res.writeHead(500).end("Error getting WiFi status");
        return;
      }
    }

    // WiFi scan
    if (method === "GET" && url === "/api/wifi/scan") {
      try {
        const networks = await networkService.scanWifi();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(networks));
        return;
      } catch (error) {
        console.error("[WiFi Scan Error]", error);
        res.writeHead(500).end("Error scanning WiFi networks");
        return;
      }
    }

    // WiFi connect
    if (method === "POST" && url === "/api/wifi/connect") {
      try {
        const body = await getReqBody(req);
        const { ssid, password } = JSON.parse(body || "{}");

        if (!ssid) {
          res.writeHead(400).end("SSID required");
          return;
        }

        const result = await networkService.connectWifi(ssid, password);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        console.error("[WiFi Connect Error]", error);
        res.writeHead(500).end("Error connecting to WiFi");
        return;
      }
    }

    // List files
    if (method === "GET" && url === "/api/files") {
      const files = filesService.listFiles();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(files));
      return;
    }

    // Upload file
    if (method === "POST" && url === "/api/files/upload") {
      try {
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

        // Simple multipart parser for file upload
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

        res.writeHead(400).end("No file found in request");
        return;
      } catch (error) {
        console.error("[Files] Upload error:", error);
        res.writeHead(500).end("Error uploading file");
        return;
      }
    }

    // Download file
    if (method === "GET" && url.startsWith("/api/files/download/")) {
      try {
        const filename = decodeURIComponent(
          url.split("/api/files/download/")[1]
        );
        const file = filesService.getFile(filename);

        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
        });
        res.end(file);
        return;
      } catch (error) {
        res.writeHead(404).end("File not found");
        return;
      }
    }

    // Delete file
    if (method === "DELETE" && url.startsWith("/api/files/")) {
      try {
        const filename = decodeURIComponent(url.split("/api/files/")[1]);
        const success = filesService.deleteFile(filename);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success }));
        return;
      } catch (error) {
        res.writeHead(500).end("Error deleting file");
        return;
      }
    }

    // Admin: Update and restart
    if (method === "POST" && url === "/api/admin/update") {
      console.log(
        `[ADMIN] Server update & restart requested by user: ${payload[propUserId]}`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          message: "Server wird aktualisiert und neu gestartet...",
        })
      );

      systemService.updateAndRestart();
      return;
    }

    // Admin: Restart
    if (method === "POST" && url === "/api/admin/restart") {
      console.log(
        `[ADMIN] Server restart requested by user: ${payload[propUserId]}`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: true, message: "Server restarting..." })
      );

      systemService.restart();
      return;
    }

    // Admin: Shutdown
    if (method === "POST" && url === "/api/admin/shutdown") {
      console.log(
        `[ADMIN] Server shutdown requested by user: ${payload[propUserId]}`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: true, message: "Server shutting down..." })
      );

      systemService.shutdown();
      return;
    }

    // Admin: Toggle Speedtest
    if (method === "POST" && url === "/api/admin/speedtest/toggle") {
      const params = await parseBody(req);
      const enabled = params.get("enabled") === "true";

      console.log(
        `[ADMIN] Speedtest toggle requested: ${enabled} by user: ${payload[propUserId]}`
      );

      try {
        const envConfig = JSON.parse(readFileSync("config/env.json", "utf8"));
        envConfig.ENABLE_SPEEDTEST = enabled;
        writeFileSync("config/env.json", JSON.stringify(envConfig, null, 2));

        if (enabled) {
          speedTestService.startSpeedTestScheduler(60);
        } else {
          speedTestService.stopSpeedTestScheduler();
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, enabled }));
      } catch (error) {
        console.error("Error toggling speedtest:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Internal Error" }));
      }
      return;
    }

    // Admin: Get Speedtest Status
    if (method === "GET" && url === "/api/admin/speedtest/status") {
      try {
        const envConfig = JSON.parse(readFileSync("config/env.json", "utf8"));
        const enabled = envConfig.ENABLE_SPEEDTEST === true;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ enabled }));
      } catch (error) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ enabled: false }));
      }
      return;
    }

    // Logout
    if (method === "POST" && url === "/api/logout") {
      console.log(`[AUTH] User logged out: ${payload[propUserId]}`);
      sessionService.removeSession(cookieToken);
      clearTokenCache(cookieToken);

      res.setHeader("Set-Cookie", "jwt=; HttpOnly; Path=/; Max-Age=0");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }
  } catch (error) {
    // Invalid token
    res.writeHead(302, { Location: "/" }).end();
    return;
  }

  // 404 for all other routes
  res.writeHead(404).end("Not found");
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
  // Default to disabled if config missing or error
  console.log("[Speedtest] Scheduler disabled (default)");
}
