# Raspberry Pi Server Manager

A TypeScript-based server manager for Raspberry Pi with system monitoring, file sharing, WiFi management, and admin features.

> **Note:** This is a vibecoding project — I'm iteratively building and experimenting with features to focus on the Raspberry Pi hardware aspects while testing GitHub Copilot agent sessions for development workflow.

## 🚀 Quick Start

**On Raspberry Pi:**

```bash
git clone https://github.com/jakobneri/raspberry-test.git
cd raspberry-test
./start.sh
```

Access the server at `http://pi.local:3000`

**For Development:**

```bash
npm install
npm run build
npm start
```

## ⚙️ Setup

1. **Install Speedtest CLI (optional):**
   ```bash
   curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | sudo bash
   sudo apt-get install speedtest
   ```

2. **Create config file:**
   ```bash
   cp config/env.example.json config/env.json
   ```
   
   Edit `config/env.json` and set at minimum:
   ```json
   {
     "JWT_SECRET": "your-secret-key-here"
   }
   ```

## ✨ Key Features

- **System Monitoring** - CPU, RAM, disk, network metrics with real-time history
- **File Sharing** - Upload/download files via web interface
- **WiFi Management** - Scan and connect to networks
- **Speed Testing** - Manual & scheduled network speed tests
- **Power LED Control** - Configure Pi LED modes (activity, heartbeat, etc.)
- **Game Scoreboard** - Track high scores with leaderboard
- **Auto-Updates** - Pull latest changes and rebuild on startup
- **Admin Tools** - Restart, shutdown, update via web dashboard

## 🛠️ Management

Access the CLI for user management and system configuration:

```bash
npm run manage
# or via start.sh menu
```

## 📁 Project Structure

```
src/
├── index.ts              # Server entry point
├── services/             # Business logic
│   ├── auth.service.ts   # Authentication & JWT
│   ├── metrics.service.ts # System monitoring
│   ├── network.service.ts # WiFi operations
│   └── ...               # Other services
frontend/                 # Angular SPA
dist/                     # Compiled output
```

## 🔒 Security

- JWT token-based authentication
- Session tracking and cleanup
- Change default passwords in production
- Keep `config/env.json` private (gitignored)
