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

## 🧪 Development

### Code Quality Tools

```bash
# Linting
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues

# Formatting
npm run format        # Format all files
npm run format:check  # Check formatting

# Building
npm run build         # Compile TypeScript
npm run clean         # Remove dist/
```

### Frontend Development

```bash
cd frontend
npm install           # Install dependencies
npm run build         # Build production bundle
npm run start         # Dev server (if needed)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

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

### Security Features

- **JWT token-based authentication** with HttpOnly cookies
- **Rate limiting** on login endpoint (5 attempts per 15 minutes)
- **Session tracking and cleanup** with automatic expiration
- **File upload validation** with size limits (50MB max)
- **Path traversal protection** using `basename()` sanitization
- **Command injection prevention** using `execFile` with array arguments
- **CORS headers** for API routes
- **Request size limits** (100MB max)
- **Input validation** with JSON.parse error handling

### Security Best Practices

1. **Change the JWT Secret:**
   ```bash
   # Generate a strong secret (minimum 32 characters)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Add this to `config/env.json`:
   ```json
   {
     "JWT_SECRET": "your-generated-secret-here"
   }
   ```

2. **Keep config files private:**
   - Never commit `config/env.json` to version control
   - Use environment-specific configs for production

3. **Change default passwords:**
   - Use the management CLI to create strong user passwords
   - Avoid using easily guessable credentials

4. **Update regularly:**
   - Keep dependencies updated: `npm audit` and `npm update`
   - Monitor for security vulnerabilities

5. **Network security:**
   - Use HTTPS in production (configure reverse proxy)
   - Restrict access to admin endpoints
   - Use firewall rules to limit access

6. **File uploads:**
   - Files are limited to 50MB
   - Filenames are sanitized to prevent path traversal
   - Consider adding virus scanning for production use

### Known Limitations

- No HTTPS support built-in (use reverse proxy like nginx)
- No audit logging for admin actions
- Password hashing uses SHA-256 (consider bcrypt for production)

See [CONTRIBUTING.md](CONTRIBUTING.md) for security guidelines when contributing.
