import readline from "node:readline";
import { randomBytes } from "node:crypto";
import { db, run, get, all, hashPassword } from "./services/db.service.js";
import { getMetrics } from "./services/metrics.service.js";
import { getSessions, revokeAllSessions } from "./services/auth.service.js";
import {
  runSpeedTest,
  getSchedulerConfig,
  updateSchedulerConfig,
} from "./services/speedtest.service.js";

// ========== MENU SYSTEM ==========

type MenuAction = () => Promise<void> | void;

interface MenuItem {
  label: string;
  action?: MenuAction;
  submenu?: MenuItem[];
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

          if (item.submenu) {
            const subMenu = new InteractiveMenu(
              item.label,
              [
                ...item.submenu,
                {
                  label: "< Back",
                  action: async () => {
                    /* handled by loop */
                  },
                },
              ],
              this
            );
            await subMenu.show();
            // Return to this menu
            this.show();
            resolve(); // Resolve this promise instance, but we re-entered show()
          } else if (item.action) {
            console.clear();
            await item.action();
            if (item.label !== "Exit") {
              console.log("\nPress any key to continue...");
              process.stdin.setRawMode(true);
              process.stdin.resume();
              await new Promise<void>((res) =>
                process.stdin.once("data", () => res())
              );
              process.stdin.setRawMode(false);
              this.show();
              resolve();
            }
          } else {
            // Back button or empty
            resolve();
          }
        }
      };

      process.stdin.on("keypress", keyHandler);
    });
  }

  private render() {
    console.clear();
    console.log(`\n=== ${this.title} ===\n`);
    this.items.forEach((item, index) => {
      const cursor = index === this.selectedIndex ? "> " : "  ";
      const color = index === this.selectedIndex ? "\x1b[36m" : "\x1b[0m"; // Cyan for selected
      console.log(`${color}${cursor}${item.label}\x1b[0m`);
    });
    console.log("\n(Use arrow keys to navigate, Enter to select)");
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

// ========== ACTIONS ==========

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

// ========== MAIN ==========

const mainMenu: MenuItem[] = [
  {
    label: "User Management",
    submenu: [
      { label: "Create User", action: createUser },
      { label: "List Users", action: listUsers },
      { label: "Delete User", action: deleteUser },
      { label: "Reset Password", action: resetPassword },
      { label: "List Pending Requests", action: listRequests },
      { label: "Approve Request", action: approveRequest },
    ],
  },
  {
    label: "System & Sessions",
    submenu: [
      { label: "System Status", action: showSystemStatus },
      { label: "List Active Sessions", action: listSessions },
      { label: "Revoke All Sessions", action: revokeSessions },
    ],
  },
  {
    label: "Speedtest",
    submenu: [
      { label: "Run Speedtest Now", action: runManualSpeedtest },
      { label: "Configure Scheduler", action: configureSpeedtest },
    ],
  },
  {
    label: "Exit",
    action: () => {
      console.log("Goodbye!");
      process.exit(0);
    },
  },
];

const main = async () => {
  // Wait for DB init
  await new Promise((resolve) => setTimeout(resolve, 100));

  const menu = new InteractiveMenu(
    "Raspberry Pi Server Control Center",
    mainMenu
  );
  await menu.show();
};

main();
