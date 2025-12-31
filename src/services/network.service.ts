import si from "systeminformation";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";

const execAsync = promisify(exec);

// ========== NETWORK SCANNING ==========

export interface NetworkDevice {
  ip: string;
  alive: boolean;
  hostname?: string;
  mac?: string;
}

const ping = async (ip: string): Promise<boolean> => {
  const cmd =
    platform() === "win32" ? `ping -n 1 -w 200 ${ip}` : `ping -c 1 -W 1 ${ip}`;

  try {
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
};

const getHostname = async (ip: string): Promise<string | undefined> => {
  try {
    const { stdout } = await execAsync(`host ${ip}`);
    const match = stdout.match(/pointer\s+(.+)\./);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
};

const getMacAddress = async (ip: string): Promise<string | undefined> => {
  try {
    // Use arp to get MAC address
    const { stdout } = await execAsync(`arp -n ${ip}`);
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(ip)) {
        // Extract MAC address from arp output
        const match = line.match(/([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})/);
        return match ? match[1] : undefined;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const scanNetwork = async (
  onDeviceFound: (device: NetworkDevice) => void
): Promise<void> => {
  const interfaces = await si.networkInterfaces();
  // Find default or first active non-internal interface
  const ifaceList = Array.isArray(interfaces) ? interfaces : [interfaces];
  const defaultIface =
    ifaceList.find((i) => !i.internal && i.ip4) || ifaceList[0];

  if (!defaultIface || !defaultIface.ip4) return;

  const subnet = defaultIface.ip4.substring(
    0,
    defaultIface.ip4.lastIndexOf(".")
  );
  const myIp = defaultIface.ip4;

  // Emit self immediately with MAC address
  onDeviceFound({ 
    ip: myIp, 
    alive: true, 
    hostname: "Raspberry Pi (Self)",
    mac: defaultIface.mac || "Unknown"
  });

  // Scan 1-254 in batches
  const batchSize = 20;
  const ips = [];
  for (let i = 1; i < 255; i++) {
    ips.push(`${subnet}.${i}`);
  }

  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (ip) => {
        if (ip === myIp) return;
        const alive = await ping(ip);
        if (alive) {
          // Try to get additional device info
          const [hostname, mac] = await Promise.all([
            getHostname(ip),
            getMacAddress(ip)
          ]);
          onDeviceFound({ ip, alive: true, hostname, mac });
        }
      })
    );
  }
};

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
    if (!password) {
      // Open network - simple connection
      console.log(`[Network] Connecting to open network: ${ssid}`);
      await execAsync(`sudo nmcli device wifi connect "${ssid}"`);
      console.log(`[Network] Successfully connected to: ${ssid}`);
      return { success: true, message: "Connected successfully" };
    }

    // For WPA networks, create a full connection profile
    const timestamp = Date.now();
    const connectionName = `${ssid}-${timestamp}`;

    console.log(`[Network] Creating WPA connection profile for: ${ssid}`);

    // Add connection with full WPA-PSK parameters
    await execAsync(
      `sudo nmcli connection add type wifi con-name "${connectionName}" ` +
        `ifname wlan0 ssid "${ssid}" ` +
        `wifi-sec.key-mgmt wpa-psk ` +
        `wifi-sec.psk "${password}"`
    );

    // Activate the connection
    console.log(`[Network] Activating connection: ${connectionName}`);
    await execAsync(`sudo nmcli connection up "${connectionName}"`);

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
