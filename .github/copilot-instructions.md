# Copilot Instructions for Raspberry Pi Server Manager

## Project Overview

This is a TypeScript-based server manager for Raspberry Pi that provides system monitoring, file sharing, WiFi management, and administration features. The application consists of a Node.js backend and an Angular frontend.

## Technology Stack

### Backend
- **Runtime**: Node.js with ES modules (`"type": "module"` in package.json)
- **Language**: TypeScript 5.7+ (strict mode enabled)
- **Target**: ES2022
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT tokens with jose library
- **System Info**: systeminformation library
- **Azure SSO**: @azure/msal-node
- **Validation**: Zod

### Frontend
- **Framework**: Angular
- **Build Output**: `frontend/dist/frontend/browser`
- **Served by**: Backend server as SPA

## Build and Development Commands

### Backend
```bash
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled server
npm run dev        # Build and run
npm run clean      # Remove dist directory
```

### Production (Raspberry Pi)
```bash
./start.sh         # Interactive start script with git pull option
```

## Project Structure

```
raspberry-test/
├── src/                    # Backend TypeScript source
│   ├── index.ts            # Main server entry point
│   ├── router.ts           # Route handler
│   ├── cli.ts              # CLI management tool
│   └── services/           # Business logic modules
│       ├── auth.service.ts     # JWT & session management
│       ├── db.service.ts       # SQLite database wrapper
│       ├── files.service.ts    # File upload/download
│       ├── metrics.service.ts  # System metrics (CPU, RAM, etc)
│       ├── network.service.ts  # WiFi & network operations
│       ├── score.service.ts    # Game scoreboard
│       ├── speedtest.service.ts # Network speed testing
│       └── system.service.ts   # Admin operations (restart, shutdown)
├── frontend/               # Angular application
│   └── src/
├── public/                 # Legacy static files
├── dist/                   # Compiled JavaScript (generated, gitignored)
├── shared-files/           # User uploaded files (gitignored)
├── config/                 # Configuration files (gitignored)
│   └── env.json            # Azure SSO credentials
├── database.sqlite         # SQLite database (gitignored)
└── tsconfig.json           # TypeScript configuration
```

## Coding Conventions

### TypeScript Style
- **Strict mode**: Always enabled, follow all strict type checking
- **Import style**: Use ES module imports (`import X from "Y"`)
- **File extensions**: Always use `.js` extension in imports (e.g., `from "./router.js"`)
- **Module resolution**: Node-style resolution
- **Async/await**: Prefer async/await over promises
- **Error handling**: Use try-catch blocks for error-prone operations

### Code Organization
- **Services**: Business logic in `src/services/` files
- **Exports**: Use named exports for functions and interfaces
- **Interfaces**: Define TypeScript interfaces for data structures
- **Comments**: Use section headers with `==========` for organization (e.g., `// ========== API ROUTES ==========`)

### Naming Conventions
- **Variables/Functions**: camelCase (e.g., `getUserId`, `createToken`)
- **Interfaces/Types**: PascalCase (e.g., `SystemMetrics`, `LogEntry`)
- **Constants**: UPPER_SNAKE_CASE for config (e.g., `PORT`, `ANGULAR_DIST`)
- **Files**: kebab-case with `.service.ts` suffix for services (e.g., `auth.service.ts`)

### Authentication & Security
- **JWT Tokens**: Use jose library for token operations
- **Session Management**: Track active sessions in auth.service.ts
- **Cookie Security**: Set HttpOnly cookies with appropriate Max-Age
- **Input Validation**: Use Zod for request validation where applicable
- **Path Traversal**: Always check for `..` in file paths
- **SQL Injection**: Use parameterized queries with db.service.ts

## API Design Patterns

### Route Handler Pattern
```typescript
router.get("/api/endpoint", authHandler(async (req, res, userId) => {
  // Handler with automatic auth check
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ data }));
}));
```

### Authentication Middleware
- Use `authHandler()` wrapper for protected routes
- Automatically provides `userId` parameter
- Returns 401 for unauthorized requests

### Response Format
- Always set appropriate Content-Type headers
- Use JSON for API responses
- Include error messages in JSON format

## Database

### Schema
- **Database**: SQLite with better-sqlite3
- **Access**: Use db.service.ts wrapper functions: `get()`, `all()`, `run()`
- **Queries**: Always use parameterized queries: `SELECT * FROM users WHERE id = ?`
- **Tables**: 
  - `users` - User accounts
  - `user_requests` - Pending access requests
  - `scores` - Game scoreboard (managed by score.service.ts)

## Testing

- Currently no test infrastructure in place
- Manual testing required for changes
- Test on actual Raspberry Pi hardware when possible

## Deployment

### Target Environment
- **OS**: Raspberry Pi OS (Linux)
- **Server**: Runs on port 3000
- **Hostname**: Typically accessible at `pi.local:3000`
- **Auto-restart**: start.sh includes crash recovery (exit code 42)

### Configuration Files
- `config/env.json`: Azure SSO credentials (required for SSO login)
- `database.sqlite`: User database (auto-created)
- All config files are gitignored for security

## Important Notes

### Module System
- This project uses ES modules, NOT CommonJS
- All imports must use `.js` extensions even for TypeScript files
- Use `import` and `export`, never `require()` or `module.exports`

### File Imports
When importing from services, always use the `.js` extension:
```typescript
// Correct
import { validateUser } from "./services/auth.service.js";

// Incorrect
import { validateUser } from "./services/auth.service";
```

### Node.js Built-ins
Use `node:` prefix for Node.js built-in modules:
```typescript
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
```

### Angular Integration
- Frontend is served as SPA from backend
- All routes fall through to index.html for Angular routing
- API routes take priority over static file serving
- Static files served from `frontend/dist/frontend/browser`

### System Operations
- System metrics collected via systeminformation library
- WiFi operations use system commands (Linux-specific)
- Admin operations (restart/shutdown) exit process with specific codes

## Common Patterns

### Reading Request Body
```typescript
const getReqBody = async (req: http.IncomingMessage): Promise<string> => {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
};
```

### Parsing Form Data
```typescript
const parseBody = async (req: http.IncomingMessage) => {
  const body = await getReqBody(req);
  return new URLSearchParams(body);
};
```

### JSON Responses
```typescript
res.writeHead(200, { "Content-Type": "application/json" });
res.end(JSON.stringify({ success: true, data }));
```

## Dependencies

### Adding New Dependencies
- Use npm for package management
- Update both package.json and package-lock.json
- Prefer well-maintained packages with TypeScript support
- Add type definitions (@types/*) for packages without built-in types

### Key Dependencies
- `@azure/msal-node`: Azure authentication
- `jose`: JWT token operations
- `systeminformation`: System metrics
- `better-sqlite3`: SQLite database
- `zod`: Runtime validation

## Performance Considerations

- Metrics collected at regular intervals (not per-request)
- Session cleanup runs periodically
- File operations use streaming where possible
- Database queries should be efficient (indexed where needed)

## Error Handling

- Log errors to console with context (e.g., `[AUTH]`, `[Files]`)
- Return appropriate HTTP status codes
- Include error messages in JSON responses
- Catch and handle uncaught exceptions/rejections

## Logging Format
```typescript
console.log(`[SERVICE] Action: details`);
console.error(`[SERVICE] Error:`, error);
```

Service prefixes: `[AUTH]`, `[Files]`, `[ADMIN]`, `[Server]`, `[Speedtest]`
