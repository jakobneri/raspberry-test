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
  console.log("[Speedtest] Starting speed test...");

  // Try speedtest-cli with JSON output
  try {
    console.log("[Speedtest] Running speedtest with JSON output...");
    const { stdout } = await execAsync("speedtest --json", {
      timeout: 90000,
    });
    const data = JSON.parse(stdout);

    const ping = data.ping || null;
    const download = data.download
      ? Math.round((data.download / 1000000) * 100) / 100
      : null; // Convert bytes/s to Mbit/s
    const upload = data.upload
      ? Math.round((data.upload / 1000000) * 100) / 100
      : null;

    console.log(
      `[Speedtest] Test complete - Ping: ${ping}ms, Download: ${download} Mbit/s, Upload: ${upload} Mbit/s`
    );
    return {
      success: true,
      ping,
      download,
      upload,
      unit: "ms / Mbit/s",
      timestamp: new Date().toISOString(),
    };
  } catch (jsonError) {
    console.log("[Speedtest] JSON mode failed, trying simple mode...");

    // Fallback to simple output
    try {
      const { stdout } = await execAsync("speedtest --simple", {
        timeout: 90000,
      });
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

      console.log(
        `[Speedtest] Test complete - Ping: ${ping}ms, Download: ${download} Mbit/s, Upload: ${upload} Mbit/s`
      );
      return {
        success: true,
        ping,
        download,
        upload,
        unit: "ms / Mbit/s",
        timestamp: new Date().toISOString(),
      };
    } catch (simpleError) {
      console.log(
        "[Speedtest] Simple mode failed, falling back to ping only..."
      );

      // Final fallback: ping only
      try {
        const { stdout } = await execAsync("ping -c 4 8.8.8.8");
        const match = stdout.match(/avg = ([\d.]+)/);
        const avgPing = match ? parseFloat(match[1]) : null;

        if (avgPing === null) {
          throw new Error("Could not parse ping result");
        }

        console.log(`[Speedtest] Ping test complete - ${avgPing}ms`);
        return {
          success: true,
          ping: Math.round(avgPing * 100) / 100,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Full speedtest not available. Only ping test completed. Install: sudo apt-get install speedtest-cli",
          timestamp: new Date().toISOString(),
        };
      } catch (pingError) {
        console.error("[Speedtest] All methods failed");
        return {
          success: false,
          ping: null,
          download: null,
          upload: null,
          unit: "ms / Mbit/s",
          message:
            "Speed test failed. Install speedtest-cli: sudo apt-get install speedtest-cli",
          timestamp: new Date().toISOString(),
        };
      }
    }
  }
};
