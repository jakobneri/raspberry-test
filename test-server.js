// Keep-alive test script
import http from "http";
const PORT = 3000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.url === "/test") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});

// Keep alive
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Server still running...`);
}, 10000);
