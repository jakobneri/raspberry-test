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

The start script will automatically:

- Pull latest changes from git
- Install dependencies
- Build TypeScript code
- Start the server

## 📁 Project Structure

```
raspberry-test/
├── src/
│   ├── index.ts              # Main server entry point
│   └── services/
│       ├── admin.service.ts      # Server restart/shutdown
│       ├── files.service.ts      # File upload/download
│       ├── jwt.service.ts        # JWT token management
│       ├── metrics.service.ts    # System metrics (CPU, RAM, etc)
│       ├── score.service.ts      # Game scoreboard
│       ├── session.service.ts    # Session management
│       ├── sso.service.ts        # Azure SSO integration
│       ├── speedtest.service.ts  # Network speed testing
│       ├── user.service.ts       # User authentication
│       └── wifi.service.ts       # WiFi management
├── public/
│   ├── cockpit.html          # Main dashboard
│   ├── game.html             # Game page
│   ├── login.html            # Login page
│   └── files.html            # File manager
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

3. Select an option:
   - **Pull updates and start server** - Recommended for first run
   - **Just start server (no update)** - Quick restart
   - **Only pull updates (don't start)** - Update only
   - **Exit**

The server will be available at `http://pi.local:3000`

## 🔄 Auto-restart on Crash

The start script automatically restarts the server if it crashes (exit code 42).

## 📝 Environment Configuration

Create `env.json` with your Azure SSO credentials:

```json
{
  "CLIENT_ID": "your-client-id",
  "TENANT_ID": "your-tenant-id",
  "CLIENT_SECRET": "your-client-secret",
  "CLOUD_INSTANCE": "https://login.microsoftonline.com/"
}
```

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
- `POST /api/logout` - Logout

## 🎄 Merry Christmas!

Built on December 25, 2025
