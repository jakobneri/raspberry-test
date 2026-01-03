# Raspberry Pi Server Manager

A TypeScript-based server manager for Raspberry Pi with monitoring, file sharing, and administration features.

## 📋 System Requirements

### Speedtest Functionality

For network speed testing, you need to install the official Ookla Speedtest CLI:

**On Raspberry Pi / Debian / Ubuntu:**
```bash
# Install dependencies
sudo apt-get install curl

# Download and install official Ookla Speedtest CLI
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | sudo bash
sudo apt-get install speedtest
```

**Alternative: Legacy speedtest-cli (not recommended due to HTTP 403 errors):**
```bash
sudo apt-get install speedtest-cli
```

For more information, visit: https://www.speedtest.net/apps/cli

## 🚀 Quick Start

### Development (Windows)

```powershell
npm install
npm run build
npm start
```

### Production (Raspberry Pi)

```bash
./start.sh
```

The unified CLI provides an interactive menu with the following options:

- **🚀 Start Server (with auto-update check)** - Checks for updates if enabled, then starts the server
- **▶️ Start Server (skip update check)** - Starts the server immediately
- **👤 User Management** - Create, list, delete users, and manage access requests
- **⚙️ System & Sessions** - View system status and manage active sessions
- **🌐 Network Speedtest** - Run speed tests and configure auto-scheduler
- **🔧 Build & Update** - Rebuild projects, pull updates, toggle auto-update
- **🚪 Exit** - Close the CLI

### CLI Management

To access the management CLI:

```bash
npm run manage
```

Or directly via start.sh menu option.

## ⚙️ Auto-Update

The server supports automatic updates from the main git branch. When enabled:

- Automatically checks for updates on server startup
- Pulls latest changes from repository
- Automatically installs new dependencies (when package.json changes)
- Rebuilds backend and frontend as needed
- Aborts startup if any build fails

**Enable auto-update:**

1. Via CLI: Select **Build & Update** → **Toggle Auto-Update**
2. Via Dashboard: Toggle the **🔄 Auto-Update** switch in the System Info card

## 🚀 Deployment on Raspberry Pi

```
raspberry-test/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── cli.ts                # Legacy CLI (deprecated)
│   ├── unified-cli.ts        # Unified CLI with server management
│   └── services/
│       ├── auth.service.ts       # Authentication & sessions
│       ├── db.service.ts         # Database wrapper
│       ├── files.service.ts      # File upload/download
│       ├── metrics.service.ts    # System metrics (CPU, RAM, etc)
│       ├── network.service.ts    # WiFi & network operations
│       ├── score.service.ts      # Game scoreboard
│       ├── settings.service.ts   # System settings (auto-update, etc)
│       ├── speedtest.service.ts  # Network speed testing
│       └── system.service.ts     # Admin operations (restart, shutdown)
├── frontend/                 # Angular application
├── dist/                     # Compiled JavaScript (generated)
├── shared-files/             # User uploaded files
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── start.sh                  # Production start script
```

## 🛠️ Development

### Build TypeScript

```bash
npm run build
```

### Start Development Server

```bash
npm run dev
```

### Management CLI

Access the unified CLI for user management, system monitoring, and configuration:

```bash
npm run manage
```

### Clean Build

```bash
npm run clean
npm run build
```

## 🔧 TypeScript Configuration

The project uses modern TypeScript with:

- **Target:** ES2022
- **Module:** ESNext
- **Strict mode** enabled
- **Source maps** for debugging
- **Declaration files** generated

## 📦 Dependencies

### Production

- `@azure/msal-node` - Azure SSO authentication
- `jose` - JWT token handling
- `systeminformation` - System metrics

### Development

- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions

## 🔐 Features

### Authentication

- Email/password login
- JWT token-based sessions
- Session tracking and cleanup

### System Monitoring

- CPU usage and temperature
- Memory usage
- Disk I/O and usage
- Network statistics
- Real-time metrics history

### File Management

- Upload/download files
- List shared files
- Delete files

### WiFi Management

- Scan available networks
- Connect to WiFi
- View connection status

### Network Speed Testing

- Run manual speed tests
- Automatic scheduled speed tests
- Speed test history tracking
- Download/upload speed measurement
- Ping latency measurement
- Supports official Ookla Speedtest CLI

### Administration

- Server restart
- Server shutdown
- Update and restart (git pull + restart)
- **Auto-update toggle** - Enable/disable automatic updates on startup
- Build failure handling - Server won't start if builds fail
- Automatic dependency installation - Detects package.json changes and runs npm install

### Game Integration

- Score tracking
- Leaderboard (top 10)
- Anonymous and authenticated play

## 🚀 Deployment on Raspberry Pi

1. Clone the repository:

```bash
git clone https://github.com/jakobneri/raspberry-test.git
cd raspberry-test
```

2. Run the start script:

```bash
./start.sh
```

3. The unified CLI will launch with an interactive menu. Navigate using:
   - Arrow keys (↑↓) to move selection
   - Number keys (1-9) for quick selection
   - Enter to confirm selection

4. For first-time setup, select **🚀 Start Server (with auto-update check)**

The server will be available at `http://pi.local:3000`

## 🔄 Auto-restart on Crash

The start script automatically restarts the server if it crashes (exit code 42).

## 📝 Environment Configuration

**Required:** Create `config/env.json` file before starting the server.

### Quick Setup

Copy the example configuration:
```bash
cp config/env.example.json config/env.json
```

### Configuration File

Edit `config/env.json` with the following structure:

```json
{
  "JWT_SECRET": "your-secret-key-change-this-in-production",
  "CLIENT_ID": "",
  "TENANT_ID": "",
  "CLIENT_SECRET": "",
  "CLOUD_INSTANCE": "https://login.microsoftonline.com/"
}
```

### Configuration Fields

- **JWT_SECRET** (Required): A secret key for signing JWT tokens. Use a strong random string (min 32 characters recommended).
  - Generate a secure secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **CLIENT_ID** (Optional): Azure AD Application (client) ID - only required for Azure SSO
- **TENANT_ID** (Optional): Azure AD Directory (tenant) ID - only required for Azure SSO
- **CLIENT_SECRET** (Optional): Azure AD Client secret - only required for Azure SSO
- **CLOUD_INSTANCE** (Optional): Azure cloud instance URL - defaults to public cloud

⚠️ **Important:** The server will not start without a valid `config/env.json` file with JWT_SECRET set.

## 🎮 Default Users

Check `users.json` for default credentials (development only).

## 🔒 Security Notes

- Change default passwords in production
- Keep `env.json` private (in .gitignore)
- Use HTTPS in production
- Rotate JWT secrets regularly

## 📊 Monitoring

Access the cockpit at `/cockpit` to view:

- Real-time system metrics
- Active sessions
- System information
- Network statistics
- WiFi status

## 🎯 API Endpoints

### Public Routes

- `GET /` - Login page
- `POST /` - Login
- `GET /game` - Game page
- `GET /files` - File manager
- `GET /api/scores` - Get leaderboard
- `POST /api/scores` - Submit score
- `GET /api/whoami` - Check auth status

### Authenticated Routes

- `GET /cockpit` - Dashboard
- `GET /api/metrics` - System metrics
- `GET /api/system-info` - System information
- `GET /api/sessions` - Active sessions
- `POST /api/speedtest` - Run speed test
- `GET /api/speedtest/history` - Get speed test history
- `POST /api/speedtest/history/clear` - Clear speed test history
- `GET /api/speedtest/interval` - Get scheduler configuration
- `POST /api/speedtest/interval` - Update scheduler configuration
- `GET /api/wifi/status` - WiFi status
- `GET /api/wifi/scan` - Scan networks
- `POST /api/wifi/connect` - Connect to WiFi
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `GET /api/files/download/:filename` - Download file
- `DELETE /api/files/:filename` - Delete file
- `POST /api/admin/restart` - Restart server
- `POST /api/admin/shutdown` - Shutdown server
- `POST /api/admin/update` - Update and restart
- `GET /api/settings` - Get system settings (auto-update status)
- `POST /api/settings/auto-update` - Toggle auto-update (params: enabled=true/false)
- `POST /api/logout` - Logout

## 🎄 Merry Christmas!

Built on December 25, 2025
