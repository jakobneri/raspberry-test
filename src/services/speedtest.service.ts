import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface SpeedTestResult {
  success: boolean;
  ping: number | null;
  download: number | null;
  upload: number | null;
  unit: string;
  message?: string;
  timestamp: string;
}

export const runSpeedTest = async (): Promise<SpeedTestResult> => {
  try {
    // Check if speedtest-cli is available
    try {
      await execAsync("which speedtest-cli");
    } catch {
      // speedtest-cli not found, try ping only
      try {
        const { stdout } = await execAsync("ping -c 4 8.8.8.8");
        const match = stdout.match(/avg = ([\d.]+)/);
        const avgPing = match ? parseFloat(match[1]) : null;

        if (avgPing === null) {
          throw new Error("Could not parse ping result");
        }

        return {
          success: true,
          ping: Math.round(avgPing * 100) / 100,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Install speedtest-cli for full speed test. Only ping available.",
          timestamp: new Date().toISOString(),
        };
      } catch (pingError) {
        return {
          success: false,
          ping: null,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Speedtest not available. Install speedtest-cli: pip install speedtest-cli",
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Run full speedtest
    const { stdout } = await execAsync("speedtest-cli --simple");
    const lines = stdout.split("\n");

    let ping = null;
    let download = null;
    let upload = null;

    for (const line of lines) {
      if (line.startsWith("Ping:")) {
        ping = parseFloat(line.split(":")[1].trim().split(" ")[0]);
      } else if (line.startsWith("Download:")) {
        download = parseFloat(line.split(":")[1].trim().split(" ")[0]);
      } else if (line.startsWith("Upload:")) {
        upload = parseFloat(line.split(":")[1].trim().split(" ")[0]);
      }
    }

    return {
      success: true,
      ping,
      download,
      upload,
      unit: "ms / Mbit/s",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Speedtest Error]", error);
    throw error;
  }
};
