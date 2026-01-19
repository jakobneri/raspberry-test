import type { IncomingMessage, ServerResponse } from "node:http";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RouteHandler {
  (
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ): void | Promise<void>;
}

interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  regex: RegExp;
  paramNames: string[];
}

export class Router {
  private routes: Route[] = [];

  add(method: HttpMethod, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const regexPath = path.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

    this.routes.push({
      method,
      path,
      handler,
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
    });
  }

  get(path: string, handler: RouteHandler) {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.add("POST", path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.add("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    this.add("DELETE", path, handler);
  }

  async handle(req: IncomingMessage, res: ServerResponse) {
    const { method, url } = req;
    if (!url || !method) return;

    // Add CORS headers for API routes
    if (url.startsWith("/api/")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "86400");
      
      // Handle preflight OPTIONS requests
      if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return true;
      }
    }

    // Parse URL to ignore query strings for matching
    const [path] = url.split("?");

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = path.match(route.regex);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        try {
          await route.handler(req, res, params);
        } catch (error) {
          console.error(`[Router] Error handling ${method} ${path}:`, error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
        return;
      }
    }

    // 404 Not Found
    // If no route matches, we can let the caller handle it or send 404 here.
    // For this implementation, we'll return false to indicate no match,
    // allowing static file serving fallback in the main loop.
    return false;
  }
}
