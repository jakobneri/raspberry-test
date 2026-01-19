import si from "systeminformation";

// ========== SYSTEM METRICS ==========

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    speed: number;
    temp: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    totalSize: number;
    used: number;
    available: number;
    usagePercent: number;
    rIO: number;
    wIO: number;
  };
  network: {
    rx: number;
    tx: number;
    interface: string;
  };
  system: {
    uptime: number;
    loadAvg: number[];
    processCount: number;
    processRunning: number;
    processBlocked: number;
  };
  os: {
    platform: string;
    distro: string;
    release: string;
    hostname: string;
  };
  timestamp: string;
}

export interface MetricsHistory {
  current: SystemMetrics;
  history: SystemMetrics[];
}

let metricsHistory: SystemMetrics[] = [];
let cachedMetrics: SystemMetrics | null = null;
let lastFetch: number = 0;
const CACHE_DURATION_MS = 1000; // Cache for 1 second
const MAX_HISTORY_SIZE = 60; // Keep last 60 data points

export const getMetrics = async (): Promise<MetricsHistory> => {
  // Return cached metrics if they're fresh (less than CACHE_DURATION_MS old)
  const now = Date.now();
  if (cachedMetrics && now - lastFetch < CACHE_DURATION_MS) {
    return {
      current: cachedMetrics,
      history: metricsHistory,
    };
  }

  const [
    cpuData,
    memData,
    fsSize,
    currentLoad,
    networkStats,
    cpuTemp,
    diskIO,
    osInfo,
    time,
    processes,
  ] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.currentLoad(),
    si.networkStats(),
    si.cpuTemperature(),
    si.disksIO(),
    si.osInfo(),
    si.time(),
    si.processes(),
  ]);

  const metrics: SystemMetrics = {
    cpu: {
      usage: Math.round(currentLoad.currentLoad * 10) / 10,
      cores: cpuData.cores,
      speed: cpuData.speed,
      temp: cpuTemp.main || cpuTemp.max || 0,
    },
    memory: {
      total: Math.round((memData.total / 1024 / 1024 / 1024) * 100) / 100,
      used: Math.round((memData.used / 1024 / 1024 / 1024) * 100) / 100,
      free: Math.round((memData.free / 1024 / 1024 / 1024) * 100) / 100,
      usagePercent: Math.round((memData.used / memData.total) * 100 * 10) / 10,
    },
    disk: {
      totalSize:
        fsSize.length > 0
          ? Math.round((fsSize[0].size / 1024 / 1024 / 1024) * 100) / 100
          : 0,
      used:
        fsSize.length > 0
          ? Math.round((fsSize[0].used / 1024 / 1024 / 1024) * 100) / 100
          : 0,
      available:
        fsSize.length > 0
          ? Math.round(
              ((fsSize[0].size - fsSize[0].used) / 1024 / 1024 / 1024) * 100
            ) / 100
          : 0,
      usagePercent: fsSize.length > 0 ? Math.round(fsSize[0].use * 10) / 10 : 0,
      rIO: diskIO.rIO || 0,
      wIO: diskIO.wIO || 0,
    },
    network: {
      rx:
        networkStats.length > 0
          ? Math.round((networkStats[0].rx_sec / 1024) * 100) / 100
          : 0,
      tx:
        networkStats.length > 0
          ? Math.round((networkStats[0].tx_sec / 1024) * 100) / 100
          : 0,
      interface: networkStats.length > 0 ? networkStats[0].iface : "N/A",
    },
    system: {
      uptime: time.uptime,
      loadAvg: currentLoad.cpus.map((c) => c.load), // This is per cpu load, wait. currentLoad.avgLoad is what we want usually but on windows it might be different.
      // si.currentLoad() returns avgLoad which is system load avg.
      // Let's check types.
      processCount: processes.all,
      processRunning: processes.running,
      processBlocked: processes.blocked,
    },
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      hostname: osInfo.hostname,
    },
    timestamp: new Date().toISOString(),
  };

  // Fix loadAvg mapping
  // si.currentLoad() returns { avgLoad: number, currentLoad: number, ... }
  // But standard loadavg is usually an array [1m, 5m, 15m].
  // systeminformation 'currentLoad' doesn't return [1m, 5m, 15m] directly in all OSs.
  // 'si.loadavg()' is deprecated? No, 'si.currentLoad()' is preferred.
  // Actually 'si.currentLoad()' has 'avgLoad' property which is a number (current load).
  // To get [1, 5, 15], we might need 'os.loadavg()' from node, but systeminformation abstracts it.
  // Let's check 'si.fullLoad()' or just use 'currentLoad.avgLoad' as a single number for now,
  // OR use 'si.processes()' which might have it? No.
  // Let's just use currentLoad.currentLoad (already used in CPU) and maybe just show process info in the System card.
  // Wait, I can use 'os.loadavg()' from nodejs 'os' module if I want the array.
  // But let's stick to 'systeminformation'.
  // 'si.currentLoad()' returns 'avgLoad' (number).
  // Let's just use that.
  metrics.system.loadAvg = [currentLoad.avgLoad];

  // Store in history (keep last MAX_HISTORY_SIZE data points)
  metricsHistory.push(metrics);
  if (metricsHistory.length > MAX_HISTORY_SIZE) {
    metricsHistory.shift();
  }

  // Update cache
  cachedMetrics = metrics;
  lastFetch = now;

  return {
    current: metrics,
    history: metricsHistory,
  };
};

export const getSystemInfo = async () => {
  const [osInfo, systemInfo, timeInfo, processInfo] = await Promise.all([
    si.osInfo(),
    si.system(),
    si.time(),
    si.processes(),
  ]);

  return {
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      hostname: osInfo.hostname,
      uptime: Math.floor(timeInfo.uptime / 60),
    },
    system: {
      manufacturer: systemInfo.manufacturer,
      model: systemInfo.model,
      version: systemInfo.version,
    },
    process: {
      running: processInfo.running,
      sleeping: processInfo.sleeping,
      blocked: processInfo.blocked,
    },
    server: {
      nodeVersion: process.version,
      pid: process.pid,
      uptime: Math.floor(process.uptime() / 60),
    },
  };
};
