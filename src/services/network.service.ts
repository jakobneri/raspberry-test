import si from "systeminformation";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// ========== WIFI MANAGEMENT ==========

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
    // Validate SSID and password to prevent command injection
    // Allow alphanumeric, spaces, hyphens, underscores, and dots
    const validSsidPattern = /^[a-zA-Z0-9\s._-]{1,32}$/;
    const validPasswordPattern = /^[\x20-\x7E]{0,63}$/; // Printable ASCII chars, max 63 for WPA
    
    if (!ssid || !validSsidPattern.test(ssid)) {
      return { success: false, message: "Invalid SSID format (use alphanumeric, spaces, dots, hyphens, underscores only)" };
    }
    
    if (password && !validPasswordPattern.test(password)) {
      return { success: false, message: "Invalid password format" };
    }

    if (!password) {
      // Open network - use execFile with array arguments to prevent injection
      console.log(`[Network] Connecting to open network: ${ssid}`);
      await execFileAsync("sudo", ["nmcli", "device", "wifi", "connect", ssid]);
      console.log(`[Network] Successfully connected to: ${ssid}`);
      return { success: true, message: "Connected successfully" };
    }

    // For WPA networks, create a full connection profile
    const timestamp = Date.now();
    const connectionName = `${ssid}-${timestamp}`;

    console.log(`[Network] Creating WPA connection profile for: ${ssid}`);

    // Add connection with full WPA-PSK parameters using execFile to prevent injection
    await execFileAsync("sudo", [
      "nmcli",
      "connection",
      "add",
      "type",
      "wifi",
      "con-name",
      connectionName,
      "ifname",
      "wlan0",
      "ssid",
      ssid,
      "wifi-sec.key-mgmt",
      "wpa-psk",
      "wifi-sec.psk",
      password,
    ]);

    // Activate the connection
    console.log(`[Network] Activating connection: ${connectionName}`);
    await execFileAsync("sudo", ["nmcli", "connection", "up", connectionName]);

    console.log(`[Network] Successfully connected to: ${ssid}`);
    return { success: true, message: "Connected successfully" };
  } catch (error: any) {
    console.error("[Network] WiFi connect error:", error);

    // Extract meaningful error message
    const errorMsg = error.stderr || error.message || "Connection failed";

    return {
      success: false,
      message: errorMsg,
    };
  }
};

// ========== NETWORK DETAILS ==========

export const getNetworkDetails = async () => {
  const [networkInterfaces, networkStats, wifiInfo] = await Promise.all([
    si.networkInterfaces(),
    si.networkStats(),
    si.wifiNetworks(),
  ]);

  // Find eth0 and wlan0 interfaces
  const eth0 = networkInterfaces.find((iface) => iface.iface === "eth0");
  const wlan0 = networkInterfaces.find((iface) => iface.iface === "wlan0");

  // Find active stats for each
  const eth0Stats = networkStats.find((stat) => stat.iface === "eth0");
  const wlan0Stats = networkStats.find((stat) => stat.iface === "wlan0");

  return {
    ethernet: {
      connected: eth0 && eth0.ip4 ? true : false,
      interface: "eth0",
      ipAddress: eth0?.ip4 || "N/A",
      ipv6Address: eth0?.ip6 || "N/A",
      macAddress: eth0?.mac || "N/A",
      speed: eth0?.speed ? `${eth0.speed} Mbps` : "Unknown",
      rx: eth0Stats ? Math.round((eth0Stats.rx_sec / 1024) * 100) / 100 : 0,
      tx: eth0Stats ? Math.round((eth0Stats.tx_sec / 1024) * 100) / 100 : 0,
    },
    wifi: {
      connected: wlan0 && wlan0.ip4 ? true : false,
      interface: "wlan0",
      ipAddress: wlan0?.ip4 || "N/A",
      ipv6Address: wlan0?.ip6 || "N/A",
      macAddress: wlan0?.mac || "N/A",
      speed: wlan0?.speed ? `${wlan0.speed} Mbps` : "Unknown",
      ssid: wifiInfo.length > 0 ? wifiInfo[0].ssid : "N/A",
      signal: wifiInfo.length > 0 ? wifiInfo[0].signalLevel : null,
      rx: wlan0Stats ? Math.round((wlan0Stats.rx_sec / 1024) * 100) / 100 : 0,
      tx: wlan0Stats ? Math.round((wlan0Stats.tx_sec / 1024) * 100) / 100 : 0,
    },
  };
};
