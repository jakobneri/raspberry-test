import si from "systeminformation";

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    speed: number;
    temperature: number;
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
  timestamp: string;
}

export interface MetricsHistory {
  current: SystemMetrics;
  history: SystemMetrics[];
}

let metricsHistory: SystemMetrics[] = [];

export const getMetrics = async (): Promise<MetricsHistory> => {
  const [
    cpuData,
    memData,
    fsSize,
    currentLoad,
    networkStats,
    cpuTemp,
    diskIO,
  ] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.currentLoad(),
    si.networkStats(),
    si.cpuTemperature(),
    si.disksIO(),
  ]);

  const metrics: SystemMetrics = {
    cpu: {
      usage: Math.round(currentLoad.currentLoad * 10) / 10,
      cores: cpuData.cores,
      speed: cpuData.speed,
      temperature: cpuTemp.main || cpuTemp.max || 0,
    },
    memory: {
      total: Math.round((memData.total / 1024 / 1024 / 1024) * 100) / 100,
      used: Math.round((memData.used / 1024 / 1024 / 1024) * 100) / 100,
      free: Math.round((memData.free / 1024 / 1024 / 1024) * 100) / 100,
      usagePercent:
        Math.round((memData.used / memData.total) * 100 * 10) / 10,
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
      usagePercent:
        fsSize.length > 0 ? Math.round(fsSize[0].use * 10) / 10 : 0,
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
    timestamp: new Date().toISOString(),
  };

  // Store in history (keep last 60 data points)
  metricsHistory.push(metrics);
  if (metricsHistory.length > 60) {
    metricsHistory.shift();
  }

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
