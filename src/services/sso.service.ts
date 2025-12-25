import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface EnvConfig {
  CLIENT_ID: string;
  TENANT_ID: string;
  CLIENT_SECRET: string;
  CLOUD_INSTANCE: string;
}

const envPath = resolve("./env.json");
const envConfig: EnvConfig = JSON.parse(readFileSync(envPath, "utf-8"));

const msalConfig: Configuration = {
  auth: {
    clientId: envConfig.CLIENT_ID,
    authority: `${envConfig.CLOUD_INSTANCE}${envConfig.TENANT_ID}`,
    clientSecret: envConfig.CLIENT_SECRET,
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

let appToken = "";

// Initialize app token
const initializeAppToken = async (): Promise<void> => {
  try {
    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    if (result) {
      console.log("[SSO] App Token Acquired");
      appToken = result.accessToken || "";
    } else {
      console.log("[SSO] Failed to acquire app token");
    }
  } catch (error) {
    console.error("[SSO] Error acquiring app token:", error);
  }
};

// Initialize on module load
initializeAppToken();

export const getAppToken = (): string => appToken;

export { appToken };
