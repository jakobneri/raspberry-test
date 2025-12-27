import readline from "node:readline";
import { randomBytes } from "node:crypto";
import { db, run, get, all, hashPassword } from "./services/db.service.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const printMenu = () => {
  console.log("\n=== Raspberry Pi Server Manager CLI ===");
  console.log("1. Create User");
  console.log("2. List Pending Requests");
  console.log("3. Approve Request");
  console.log("4. Exit");
  console.log("=======================================");
};

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

const listRequests = async () => {
  console.log("\n--- Pending User Requests ---");
  try {
    const requests = await all<{ id: string; email: string; name: string; requested_at: string }>(
      "SELECT * FROM user_requests WHERE status = 'pending'"
    );

    if (requests.length === 0) {
      console.log("No pending requests.");
      return;
    }

    console.table(requests.map(r => ({
      ID: r.id,
      Email: r.email,
      Name: r.name,
      Date: r.requested_at
    })));
  } catch (error) {
    console.error("Error listing requests:", error);
  }
};

const approveRequest = async () => {
  await listRequests();
  const requestId = await question("\nEnter Request ID to approve (or press Enter to cancel): ");
  
  if (!requestId) return;

  try {
    const request = await get<{ id: string; email: string; password: string; salt: string }>(
      "SELECT * FROM user_requests WHERE id = ? AND status = 'pending'",
      [requestId]
    );

    if (!request) {
      console.log("Error: Request not found or not pending.");
      return;
    }

    const userId = `user_${Date.now()}`;
    await run(
      "INSERT INTO users (id, email, password, salt) VALUES (?, ?, ?, ?)",
      [userId, request.email, request.password, request.salt]
    );

    await run("UPDATE user_requests SET status = 'approved' WHERE id = ?", [requestId]);

    console.log(`Success: Request for '${request.email}' approved.`);
  } catch (error) {
    console.error("Error approving request:", error);
  }
};

const main = async () => {
  // Wait for DB init (it happens on import, but let's give it a tick)
  await new Promise(resolve => setTimeout(resolve, 100));

  while (true) {
    printMenu();
    const choice = await question("Select an option: ");

    switch (choice) {
      case "1":
        await createUser();
        break;
      case "2":
        await listRequests();
        break;
      case "3":
        await approveRequest();
        break;
      case "4":
        console.log("Goodbye!");
        rl.close();
        process.exit(0);
      default:
        console.log("Invalid option.");
    }
  }
};

main();
