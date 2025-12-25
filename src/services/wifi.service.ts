import si from "systeminformation";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: boolean;
  connected: boolean;
}

export interface WifiStatus {
  connected: boolean;
  ssid: string | null;
  signal: number | null;
}

export const getWifiStatus = async (): Promise<WifiStatus> => {
  const [wifiInfo] = await si.wifiNetworks();
  return {
    connected: wifiInfo ? true : false,
    ssid: wifiInfo?.ssid || null,
    signal: wifiInfo?.signalLevel || null,
  };
};

export const scanWifi = async (): Promise<WifiNetwork[]> => {
  try {
    // Try nmcli (NetworkManager - common on Raspberry Pi OS)
    const { stdout } = await execAsync(
      "nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list"
    );
    const networks = stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [ssid, signal, security, active] = line.split(":");
        return {
          ssid: ssid || "Hidden Network",
          signal: parseInt(signal) || 0,
          security: !!(security && security !== "--" && security !== ""),
          connected: active === "yes",
        };
      })
      .filter((n) => n.ssid && n.ssid !== "Hidden Network");

    // Remove duplicates and sort by signal strength
    const uniqueNetworks = Array.from(
      new Map(networks.map((n) => [n.ssid, n])).values()
    ).sort((a, b) => b.signal - a.signal);

    return uniqueNetworks;
  } catch (nmcliError) {
    // Fallback to systeminformation
    const networks = await si.wifiNetworks();
    return networks.map((n: any) => ({
      ssid: n.ssid,
      signal: n.signalLevel || 0,
      security: n.security && n.security.length > 0,
      connected: false,
    }));
  }
};

export const connectWifi = async (
  ssid: string,
  password?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const connectCmd = password
      ? `nmcli device wifi connect "${ssid}" password "${password}"`
      : `nmcli device wifi connect "${ssid}"`;

    await execAsync(connectCmd);

    return { success: true, message: "Connected successfully" };
  } catch (error: any) {
    console.error("[WiFi Connect Error]", error);
    return {
      success: false,
      message: error.message || "Connection failed",
    };
  }
};
