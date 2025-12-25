import http from "node:http";
import { readFileSync, createWriteStream } from "node:fs";
import {
  createToken,
  verifyToken,
  propUserId,
} from "./services/jwt.service.js";
import { users } from "./services/user.service.js";
import { getAppToken } from "./services/sso.service.js";
import * as sessionService from "./services/session.service.js";
import * as scoreService from "./services/score.service.js";
import * as metricsService from "./services/metrics.service.js";
import * as filesService from "./services/files.service.js";
import * as adminService from "./services/admin.service.js";
import * as wifiService from "./services/wifi.service.js";
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
      (u) => u.email === email && u.password === password
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

  // Game page (public but track session if logged in)
  if (method === "GET" && url === "/game") {
    const cookieToken = sessionService.getCookieToken(req);
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, users);
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
    const cookieToken = sessionService.getCookieToken(req);
    let userId = "anonymous";

    if (cookieToken) {
      try {
        const payload = await verifyToken(cookieToken, users);
        sessionService.updateSessionActivity(cookieToken);
        userId = payload[propUserId];
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
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(scoreService.getTopScores(10)));
    return;
  }

  // Who am I (public)
  if (method === "GET" && url === "/api/whoami") {
    const cookieToken = sessionService.getCookieToken(req);
    if (cookieToken) {
      try {
        const payload = await verifyToken(cookieToken, users);
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
    const cookieToken = sessionService.getCookieToken(req);
    if (cookieToken) {
      try {
        await verifyToken(cookieToken, users);
        sessionService.updateSessionActivity(cookieToken);
      } catch {}
    }
    const body = readFileSync("public/files.html", "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }

  // ========== AUTHENTICATED ROUTES ==========

  const cookieToken = sessionService.getCookieToken(req);
  if (!cookieToken) {
    res.writeHead(401).end("Unauthorized");
    return;
  }

  try {
    const payload = await verifyToken(cookieToken, users);
    sessionService.updateSessionActivity(cookieToken, payload[propUserId]);

    // Cockpit page
    if (method === "GET" && url === "/cockpit") {
      const body = readFileSync("public/cockpit.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }

    // Get metrics
    if (method === "GET" && url === "/api/metrics") {
      const metrics = await metricsService.getMetrics();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics));
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

    // Speedtest
    if (method === "POST" && url === "/api/speedtest") {
      try {
        const result = await speedTestService.runSpeedTest();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        console.error("[Speedtest Error]", error);
        res.writeHead(500).end("Error running speedtest");
        return;
      }
    }

    // WiFi status
    if (method === "GET" && url === "/api/wifi/status") {
      try {
        const status = await wifiService.getWifiStatus();
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
        const networks = await wifiService.scanWifi();
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

        const result = await wifiService.connectWifi(ssid, password);
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

      adminService.updateAndRestart();
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

      adminService.restart();
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

      adminService.shutdown();
      return;
    }

    // Logout
    if (method === "POST" && url === "/api/logout") {
      console.log(`[AUTH] User logged out: ${payload[propUserId]}`);
      sessionService.removeSession(cookieToken);

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
