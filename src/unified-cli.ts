import readline from "node:readline";
import { randomBytes } from "node:crypto";
import { exec, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { db, run, get, all, hashPassword } from "./services/db.service.js";
import { getMetrics } from "./services/metrics.service.js";
import { getSessions, revokeAllSessions } from "./services/auth.service.js";
import {
  runSpeedTest,
  getSchedulerConfig,
  updateSchedulerConfig,
} from "./services/speedtest.service.js";
import { getSettings, setAutoUpdate } from "./services/settings.service.js";

// ========== COLORS ==========

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// ========== MENU SYSTEM ==========

type MenuAction = () => Promise<void> | void;

interface MenuItem {
  label: string;
  action?: MenuAction;
  submenu?: MenuItem[];
  skipKeyPress?: boolean;
}

class InteractiveMenu {
  private items: MenuItem[];
  private selectedIndex: number = 0;
  private title: string;
  private parent?: InteractiveMenu;

  constructor(title: string, items: MenuItem[], parent?: InteractiveMenu) {
    this.title = title;
    this.items = items;
    this.parent = parent;
  }

  public async show() {
    this.selectedIndex = 0;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    readline.emitKeypressEvents(process.stdin);

    this.render();

    return new Promise<void>((resolve) => {
      const keyHandler = async (str: string, key: readline.Key) => {
        if (key.ctrl && key.name === "c") {
          process.exit(0);
        }

        if (str && /^[1-9]$/.test(str)) {
          const index = parseInt(str, 10) - 1;
          if (index >= 0 && index < this.items.length) {
            this.selectedIndex = index;
            const item = this.items[this.selectedIndex];
            process.stdin.removeListener("keypress", keyHandler);
            process.stdin.setRawMode(false);
            await this.handleSelection(item, resolve);
            return;
          }
        }

        if (key.name === "up") {
          this.selectedIndex =
            (this.selectedIndex - 1 + this.items.length) % this.items.length;
          this.render();
        } else if (key.name === "down") {
          this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
          this.render();
        } else if (key.name === "return") {
          const item = this.items[this.selectedIndex];
          process.stdin.removeListener("keypress", keyHandler);
          process.stdin.setRawMode(false);
          await this.handleSelection(item, resolve);
        }
      };

      process.stdin.on("keypress", keyHandler);
    });
  }

  private async handleSelection(item: MenuItem, resolve: () => void) {
    if (item.submenu) {
      const subMenu = new InteractiveMenu(
        item.label,
        [
          ...item.submenu,
          {
            label: "← Back",
            skipKeyPress: true,
          },
        ],
        this
      );
      await subMenu.show();
      this.show();
      resolve();
    } else if (item.action) {
      console.clear();
      await item.action();
      if (!item.skipKeyPress) {
        console.log(
          `\n${colors.gray}Press any key to continue...${colors.reset}`
        );
        process.stdin.setRawMode(true);
        process.stdin.resume();
        await new Promise<void>((res) =>
          process.stdin.once("data", () => res())
        );
        process.stdin.setRawMode(false);
      }
      this.show();
      resolve();
    } else {
      resolve();
    }
  }

  private render() {
    console.clear();
    console.log(`\n╔═══════════════════════════════════════════╗`);
    console.log(`║  ${this.title.padEnd(39)}  ║`);
    console.log(`╚═══════════════════════════════════════════╝\n`);
    this.items.forEach((item, index) => {
      const num = index < 9 ? `${index + 1}. ` : "   ";
      const cursor = index === this.selectedIndex ? "▶ " : "  ";
      const color = index === this.selectedIndex ? colors.cyan : colors.reset;
      console.log(`${color}${cursor}${num}${item.label}${colors.reset}`);
    });
    const maxNum = Math.min(this.items.length, 9);
    console.log(
      `\n${colors.gray}(Use ↑↓ arrows or numbers 1-${maxNum}, Enter to select)${colors.reset}`
    );
  }
}

// ========== INPUT HELPERS ==========

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// ========== SHELL EXECUTION HELPERS ==========

const execCommand = (
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error ? error.code || 1 : 0,
      });
    });
  });
};

const spawnCommand = (command: string, args: string[]): Promise<number> => {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code || 0));
  });
};

// ========== GIT & BUILD FUNCTIONS ==========

const checkForUpdates = async (): Promise<boolean> => {
  console.log(`${colors.yellow}📥 Checking for updates...${colors.reset}`);

  await execCommand("git fetch origin main");
  const { stdout } = await execCommand(
    "git rev-list HEAD...origin/main --count"
  );
  const behindCount = parseInt(stdout.trim());

  if (behindCount > 0) {
    console.log(
      `${colors.yellow}⚠️  ${behindCount} commit(s) available from remote${colors.reset}`
    );
    return true;
  }

  console.log(`${colors.green}✓ Already up to date${colors.reset}`);
  return false;
};

const pullUpdates = async (): Promise<boolean> => {
  console.log(
    `${colors.yellow}📥 Pulling latest changes from repository...${colors.reset}`
  );

  // Check for local changes
  const { code: diffCode } = await execCommand(
    "git diff-index --quiet HEAD --"
  );
  const hasChanges = diffCode !== 0;

  if (hasChanges) {
    console.log(`${colors.yellow}⚠️  Local changes detected!${colors.reset}`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const branchName = `local-changes-${timestamp}`;

    console.log(
      `${colors.yellow}📦 Creating branch: ${branchName}${colors.reset}`
    );
    await execCommand(`git checkout -b ${branchName}`);
    await execCommand("git add -A");
    await execCommand(
      `git commit -m "Local changes before pull at ${timestamp}"`
    );
    console.log(
      `${colors.green}✓ Local changes saved to branch ${branchName}${colors.reset}`
    );

    await execCommand("git checkout main");
  }

  // Store old commit for comparison
  const { stdout: oldCommit } = await execCommand("git rev-parse HEAD");
  const oldCommitHash = oldCommit.trim();

  // Pull changes
  const { code: pullCode, stdout: pullOutput } = await execCommand(
    "git pull origin main"
  );

  if (pullCode !== 0) {
    console.log(`${colors.red}✗ Failed to pull changes${colors.reset}`);
    return false;
  }

  // Get new commit
  const { stdout: newCommit } = await execCommand("git rev-parse HEAD");
  const newCommitHash = newCommit.trim();

  if (oldCommitHash === newCommitHash) {
    console.log(`${colors.green}✓ Already up to date${colors.reset}`);
    return true;
  }

  console.log(
    `${colors.green}✓ Successfully pulled latest changes!${colors.reset}\n`
  );

  // Show changes
  const { stdout: diffStats } = await execCommand(
    `git diff --numstat ${oldCommitHash} ${newCommitHash}`
  );
  const lines = diffStats
    .trim()
    .split("\n")
    .filter((l) => l);

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length === 3) {
      const [insertions, deletions, filename] = parts;
      if (insertions === "-") {
        console.log(`${filename.padEnd(50)}   (binary)`);
      } else {
        console.log(
          `${filename.padEnd(50)}   ${colors.green}+ ${insertions.padStart(3)}${
            colors.reset
          }   ${colors.red}- ${deletions.padStart(3)}${colors.reset}`
        );
      }
    }
  }
  console.log();

  // Check if package.json changed
  const { stdout: packageChanged } = await execCommand(
    `git diff --name-only ${oldCommitHash} ${newCommitHash} | grep "package.json" || true`
  );

  if (packageChanged.trim()) {
    console.log(
      `${colors.yellow}📦 package.json changed, installing dependencies...${colors.reset}`
    );
    const npmCode = await spawnCommand("npm", ["install"]);
    if (npmCode !== 0) {
      console.log(
        `${colors.red}✗ Failed to install dependencies${colors.reset}`
      );
      return false;
    }
    console.log(`${colors.green}✓ Dependencies installed${colors.reset}\n`);
  }

  return true;
};

const buildBackend = async (): Promise<boolean> => {
  console.log(
    `${colors.yellow}🔨 Building TypeScript backend...${colors.reset}`
  );
  const code = await spawnCommand("npm", ["run", "build"]);
  if (code !== 0) {
    console.log(`${colors.red}✗ Backend build failed${colors.reset}`);
    return false;
  }
  console.log(`${colors.green}✓ Backend build successful!${colors.reset}\n`);
  return true;
};

const buildFrontend = async (): Promise<boolean> => {
  console.log(`${colors.yellow}🎨 Building Angular frontend...${colors.reset}`);

  const originalDir = process.cwd();

  try {
    if (!existsSync("frontend/node_modules")) {
      console.log(
        `${colors.yellow}📦 Installing frontend dependencies...${colors.reset}`
      );
      process.chdir("frontend");
      const installCode = await spawnCommand("npm", ["install"]);
      process.chdir(originalDir);
      if (installCode !== 0) {
        console.log(
          `${colors.red}✗ Failed to install frontend dependencies${colors.reset}`
        );
        return false;
      }
    }

    process.chdir("frontend");
    const code = await spawnCommand("npm", ["run", "build"]);
    process.chdir(originalDir);

    if (code !== 0) {
      console.log(`${colors.red}✗ Frontend build failed${colors.reset}`);
      return false;
    }
    console.log(`${colors.green}✓ Frontend build successful!${colors.reset}\n`);
    return true;
  } catch (error) {
    process.chdir(originalDir);
    console.log(`${colors.red}✗ Frontend build error: ${error}${colors.reset}`);
    return false;
  }
};

const checkSpeedtestCli = async (): Promise<void> => {
  const { code } = await execCommand("command -v speedtest-cli");
  if (code !== 0) {
    console.log(
      `${colors.yellow}📡 speedtest-cli not found, installing...${colors.reset}`
    );

    // Try pip3 first
    const { code: pip3Code } = await execCommand("pip3 install speedtest-cli");
    if (pip3Code === 0) {
      console.log(`${colors.green}✓ speedtest-cli installed!${colors.reset}`);
      return;
    }

    // Fallback to pip
    const { code: pipCode } = await execCommand("pip install speedtest-cli");
    if (pipCode === 0) {
      console.log(`${colors.green}✓ speedtest-cli installed!${colors.reset}`);
    } else {
      console.log(
        `${colors.red}✗ Failed to install speedtest-cli${colors.reset}`
      );
    }
  }
};

// ========== SERVER FUNCTIONS ==========

const startServer = async (skipUpdate: boolean = false) => {
  console.clear();
  console.log(
    `${colors.blue}╔════════════════════════════════════════${colors.reset}`
  );
  console.log(
    `${colors.blue}║  🥧 Raspberry Pi Server Manager 🥧   ║${colors.reset}`
  );
  console.log(
    `${colors.blue}╚════════════════════════════════════════${colors.reset}\n`
  );

  if (!skipUpdate) {
    // Check if auto-update is enabled
    const settings = await getSettings();
    if (settings.autoUpdate) {
      const hasUpdates = await checkForUpdates();
      if (hasUpdates) {
        const success = await pullUpdates();
        if (!success) {
          console.log(
            `${colors.red}✗ Update failed, aborting...${colors.reset}`
          );
          process.exit(1);
        }
      }
    } else {
      console.log(
        `${colors.gray}Auto-update disabled, skipping update check${colors.reset}\n`
      );
    }
  }

  // Ensure builds exist
  if (!existsSync("dist")) {
    if (!(await buildBackend())) {
      process.exit(1);
    }
  }

  if (!existsSync("frontend/dist")) {
    if (!(await buildFrontend())) {
      process.exit(1);
    }
  }

  // Check speedtest-cli
  await checkSpeedtestCli();

  // Get local IP
  const { stdout: ipOutput } = await execCommand("hostname -I 2>/dev/null");
  let localIp = ipOutput.trim().split(" ")[0];

  if (!localIp) {
    // Fallback for macOS
    const { stdout: macIp } = await execCommand(
      "ipconfig getifaddr en0 2>/dev/null"
    );
    localIp = macIp.trim() || "localhost";
  }

  console.log(
    `${colors.green}═══════════════════════════════════════${colors.reset}`
  );
  console.log(`${colors.green}   Server starting on:${colors.reset}\n`);
  console.log(
    `   ${colors.blue}➜${colors.reset}  Local:   ${colors.green}http://localhost:3000${colors.reset}`
  );
  if (localIp !== "localhost") {
    console.log(
      `   ${colors.blue}➜${colors.reset}  Network: ${colors.green}http://${localIp}:3000${colors.reset}`
    );
  }
  console.log(
    `\n${colors.green}═══════════════════════════════════════${colors.reset}\n`
  );

  // Start server with auto-restart on exit code 42
  while (true) {
    const code = await spawnCommand("npm", ["start"]);
    if (code === 42) {
      console.log(`\n${colors.yellow}🔄 Server restarting...${colors.reset}\n`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      console.log(
        `\n${colors.green}Server stopped (exit code: ${code})${colors.reset}`
      );
      break;
    }
  }
};

// ========== USER MANAGEMENT ACTIONS ==========

const createUser = async () => {
  console.log("\n--- Create New User ---");
  const email = await question("Email: ");
  const password = await question("Password: ");

  if (!email || !password) {
    console.log("Error: Email and password are required.");
    return;
  }

  try {
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      console.log("Error: User with this email already exists.");
      return;
    }

    const salt = randomBytes(16).toString("hex");
    const hashedPassword = hashPassword(password, salt);
    const id = `user_${Date.now()}`;

    await run(
      "INSERT INTO users (id, email, password, salt) VALUES (?, ?, ?, ?)",
      [id, email, hashedPassword, salt]
    );

    console.log(`Success: User '${email}' created.`);
  } catch (error) {
    console.error("Error creating user:", error);
  }
};

const listUsers = async () => {
  console.log("\n--- Registered Users ---");
  try {
    const users = await all<{ id: string; email: string }>(
      "SELECT id, email FROM users"
    );

    if (users.length === 0) {
      console.log("No users found.");
      return;
    }

    console.table(users);
  } catch (error) {
    console.error("Error listing users:", error);
  }
};

const deleteUser = async () => {
  await listUsers();
  const email = await question(
    "\nEnter Email of user to delete (or press Enter to cancel): "
  );

  if (!email) return;

  try {
    const user = await get<{ id: string }>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      console.log("Error: User not found.");
      return;
    }

    const confirm = await question(
      `Are you sure you want to delete user '${email}'? (yes/no): `
    );
    if (confirm.toLowerCase() !== "yes") {
      console.log("Deletion cancelled.");
      return;
    }

    await run("DELETE FROM users WHERE email = ?", [email]);
    console.log(`Success: User '${email}' deleted.`);
  } catch (error) {
    console.error("Error deleting user:", error);
  }
};

const resetPassword = async () => {
  await listUsers();
  const email = await question(
    "\nEnter Email of user to reset password (or press Enter to cancel): "
  );

  if (!email) return;

  try {
    const user = await get<{ id: string }>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      console.log("Error: User not found.");
      return;
    }

    const newPassword = await question("Enter new password: ");
    if (!newPassword) {
      console.log("Error: Password cannot be empty.");
      return;
    }

    const salt = randomBytes(16).toString("hex");
    const hashedPassword = hashPassword(newPassword, salt);

    await run("UPDATE users SET password = ?, salt = ? WHERE email = ?", [
      hashedPassword,
      salt,
      email,
    ]);

    console.log(`Success: Password for '${email}' updated.`);
  } catch (error) {
    console.error("Error resetting password:", error);
  }
};

const listRequests = async () => {
  console.log("\n--- Pending User Requests ---");
  try {
    const requests = await all<{
      id: string;
      email: string;
      name: string;
      requested_at: string;
    }>("SELECT * FROM user_requests WHERE status = 'pending'");

    if (requests.length === 0) {
      console.log("No pending requests.");
      return;
    }

    console.table(
      requests.map((r) => ({
        ID: r.id,
        Email: r.email,
        Name: r.name,
        Date: r.requested_at,
      }))
    );
  } catch (error) {
    console.error("Error listing requests:", error);
  }
};

const approveRequest = async () => {
  await listRequests();
  const requestId = await question(
    "\nEnter Request ID to approve (or press Enter to cancel): "
  );

  if (!requestId) return;

  try {
    const request = await get<{
      id: string;
      email: string;
      password: string;
      salt: string;
    }>("SELECT * FROM user_requests WHERE id = ? AND status = 'pending'", [
      requestId,
    ]);

    if (!request) {
      console.log("Error: Request not found or not pending.");
      return;
    }

    const userId = `user_${Date.now()}`;
    await run(
      "INSERT INTO users (id, email, password, salt) VALUES (?, ?, ?, ?)",
      [userId, request.email, request.password, request.salt]
    );

    await run("UPDATE user_requests SET status = 'approved' WHERE id = ?", [
      requestId,
    ]);

    console.log(`Success: Request for '${request.email}' approved.`);
  } catch (error) {
    console.error("Error approving request:", error);
  }
};

// ========== SYSTEM ACTIONS ==========

const showSystemStatus = async () => {
  console.log("\n--- System Status ---");
  try {
    const metrics = await getMetrics();
    const { cpu, memory, disk, os, system } = metrics.current;

    console.log(`Hostname: ${os.hostname}`);
    console.log(`OS: ${os.distro} ${os.release} (${os.platform})`);
    console.log(
      `Uptime: ${Math.floor(system.uptime / 3600)}h ${Math.floor(
        (system.uptime % 3600) / 60
      )}m`
    );
    console.log(`CPU Temp: ${cpu.temp}°C`);
    console.log(`CPU Load: ${cpu.usage}%`);
    console.log(
      `Memory: ${memory.used}GB / ${memory.total}GB (${memory.usagePercent}%)`
    );
    console.log(
      `Disk: ${disk.used}GB / ${disk.totalSize}GB (${disk.usagePercent}%)`
    );
  } catch (error) {
    console.error("Error fetching system metrics:", error);
  }
};

const listSessions = () => {
  console.log("\n--- Active Sessions ---");
  const sessions = getSessions();
  if (sessions.length === 0) {
    console.log("No active sessions.");
    return;
  }
  console.table(
    sessions.map((s) => ({
      User: s.userId,
      Created: s.createdAt,
      LastActive: s.lastActivity,
    }))
  );
};

const revokeSessions = async () => {
  const confirm = await question(
    "Are you sure you want to revoke ALL active sessions? Users will be logged out. (yes/no): "
  );
  if (confirm.toLowerCase() === "yes") {
    revokeAllSessions();
    console.log("All sessions revoked.");
  } else {
    console.log("Cancelled.");
  }
};

// ========== SPEEDTEST ACTIONS ==========

const configureSpeedtest = async () => {
  const config = getSchedulerConfig();
  console.log("\n--- Speedtest Configuration ---");
  console.log(`Current Status: ${config.enabled ? "Enabled" : "Disabled"}`);
  console.log(`Current Interval: ${config.interval} seconds`);

  const enableInput = await question("\nEnable Scheduler? (y/n/keep): ");

  let enabled = config.enabled;
  if (enableInput.toLowerCase() === "y") enabled = true;
  if (enableInput.toLowerCase() === "n") enabled = false;

  const intervalInput = await question(
    "Enter Interval in seconds (e.g. 3600) or press Enter to keep: "
  );

  let interval = config.interval;
  if (intervalInput) {
    const parsed = parseInt(intervalInput);
    if (!isNaN(parsed) && parsed > 0) {
      interval = parsed;
    } else {
      console.log("Invalid interval, keeping current.");
    }
  }

  updateSchedulerConfig(enabled, interval);
  console.log("Configuration updated.");
};

const runManualSpeedtest = async () => {
  console.log("\nRunning speedtest... (this may take a minute)");
  const result = await runSpeedTest();
  if (result.success) {
    console.log("\n--- Result ---");
    console.log(`Ping: ${result.ping} ms`);
    console.log(`Download: ${result.download} Mbit/s`);
    console.log(`Upload: ${result.upload} Mbit/s`);
  } else {
    console.log("Speedtest failed.");
  }
};

// ========== AUTO-UPDATE ACTIONS ==========

const toggleAutoUpdate = async () => {
  const settings = await getSettings();
  console.log(`\n--- Auto-Update Configuration ---`);
  console.log(
    `Current Status: ${
      settings.autoUpdate
        ? `${colors.green}Enabled${colors.reset}`
        : `${colors.red}Disabled${colors.reset}`
    }`
  );

  const input = await question("\nEnable Auto-Update? (y/n): ");

  if (input.toLowerCase() === "y") {
    await setAutoUpdate(true);
    console.log(`${colors.green}✓ Auto-update enabled${colors.reset}`);
    console.log(
      `\nThe server will automatically check for updates from the main branch on startup.`
    );
  } else if (input.toLowerCase() === "n") {
    await setAutoUpdate(false);
    console.log(`${colors.yellow}Auto-update disabled${colors.reset}`);
  } else {
    console.log("Cancelled.");
  }
};

// ========== BUILD ACTIONS ==========

const rebuildAll = async () => {
  console.log(`${colors.yellow}🔄 Rebuilding everything...${colors.reset}\n`);

  await execCommand("rm -rf dist frontend/dist");

  if (!(await buildBackend())) {
    return;
  }

  if (!(await buildFrontend())) {
    return;
  }

  console.log(`${colors.green}✓ All builds completed!${colors.reset}`);
};

const pullOnly = async () => {
  const success = await pullUpdates();
  if (success) {
    console.log(`${colors.green}Done!${colors.reset}`);
  }
};

// ========== MAIN MENU ==========

const mainMenu: MenuItem[] = [
  {
    label: "🚀 Start Server (with auto-update check)",
    skipKeyPress: true,
    action: async () => {
      await startServer(false);
      process.exit(0);
    },
  },
  {
    label: "▶️  Start Server (skip update check)",
    skipKeyPress: true,
    action: async () => {
      await startServer(true);
      process.exit(0);
    },
  },
  {
    label: "👤 User Management",
    submenu: [
      { label: "➕ Create New User", action: createUser },
      { label: "📋 View All Users", action: listUsers },
      { label: "🗑️  Delete User", action: deleteUser },
      { label: "🔑 Reset User Password", action: resetPassword },
      { label: "📥 View Pending Access Requests", action: listRequests },
      { label: "✅ Approve Access Request", action: approveRequest },
    ],
  },
  {
    label: "⚙️  System & Sessions",
    submenu: [
      { label: "📊 View System Status", action: showSystemStatus },
      { label: "👥 View Active Sessions", action: listSessions },
      { label: "🚫 Revoke All Sessions", action: revokeSessions },
    ],
  },
  {
    label: "🌐 Network Speedtest",
    submenu: [
      { label: "▶️  Run Speedtest Now", action: runManualSpeedtest },
      { label: "⏰ Configure Auto-Scheduler", action: configureSpeedtest },
    ],
  },
  {
    label: "🔧 Build & Update",
    submenu: [
      { label: "🔨 Rebuild Everything", action: rebuildAll },
      { label: "📥 Pull Updates Only", action: pullOnly },
      { label: "🔄 Toggle Auto-Update", action: toggleAutoUpdate },
    ],
  },
  {
    label: "🚪 Exit",
    skipKeyPress: true,
    action: () => {
      console.log("Goodbye!");
      process.exit(0);
    },
  },
];

const main = async () => {
  // Wait for DB init
  await new Promise((resolve) => setTimeout(resolve, 100));

  const menu = new InteractiveMenu("🥧 Raspberry Pi Server Manager", mainMenu);
  await menu.show();
};

main();
