import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  lastActivity: string;
}

export interface SessionsResponse {
  sessions: Session[];
  appToken?: string;
}

export interface MetricsData {
  cpu: { usage: number; cores: number; speed: number; temp: number };
  memory: { usagePercent: number; used: number; free: number; total: number };
  disk: { usagePercent: number; used: number; available: number };
  network: { rx: number; tx: number; interface: string };
  system: { loadAvg: number[] };
}

export interface User {
  id: string;
  email: string;
}

export interface FileItem {
  name: string;
  size: number;
  modified: string;
  isDirectory: boolean;
}

export interface Score {
  score: number;
  user: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  // Auth
  login(email: string, password: string): Observable<any> {
    const params = new HttpParams().set('email', email).set('password', password);
    return this.http.post(`${this.baseUrl}/login`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/logout`, {});
  }

  checkAuth(): Observable<{ loggedIn: boolean; userId: string | null }> {
    return this.http.get<{ loggedIn: boolean; userId: string | null }>(`${this.baseUrl}/whoami`);
  }

  // Metrics
  getMetrics(): Observable<MetricsData> {
    return this.http.get<MetricsData>(`${this.baseUrl}/metrics`);
  }

  getMetricsHistory(): Observable<{ history: MetricsData[] }> {
    return this.http.get<{ history: MetricsData[] }>(`${this.baseUrl}/metrics/history`);
  }

  // Sessions
  getSessions(): Observable<SessionsResponse> {
    return this.http.get<SessionsResponse>(`${this.baseUrl}/sessions`);
  }

  // Logs
  getLogs(): Observable<{ logs: LogEntry[] }> {
    return this.http.get<{ logs: LogEntry[] }>(`${this.baseUrl}/logs`);
  }

  clearLogs(): Observable<any> {
    return this.http.post(`${this.baseUrl}/logs/clear`, {});
  }

  setLogLevel(level: string): Observable<any> {
    const params = new HttpParams().set('level', level);
    return this.http.post(`${this.baseUrl}/logs/level`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // Users
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`);
  }

  createUser(user: Partial<User> & { password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, user);
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${userId}`);
  }

  getUserRequests(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/user-requests`);
  }

  approveUserRequest(requestId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/user-requests/${requestId}/approve`, {});
  }

  rejectUserRequest(requestId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/user-requests/${requestId}`);
  }

  // Files
  getFiles(): Observable<FileItem[]> {
    return this.http.get<FileItem[]>(`${this.baseUrl}/files`);
  }

  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/files/upload`, formData);
  }

  deleteFile(filename: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/files/${encodeURIComponent(filename)}`);
  }

  downloadFile(filename: string): string {
    return `${this.baseUrl}/files/download/${encodeURIComponent(filename)}`;
  }

  // Scores
  getScores(): Observable<Score[]> {
    return this.http.get<Score[]>(`${this.baseUrl}/scores`);
  }

  addScore(score: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/scores`, { score });
  }

  deleteScores(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/scores`);
  }

  // System
  getSystemInfo(): Observable<any> {
    return this.http.get(`${this.baseUrl}/system-info`);
  }

  restartServer(): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/restart`, {});
  }

  shutdownServer(): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/shutdown`, {});
  }

  // Network
  getNetworkDetails(): Observable<any> {
    return this.http.get(`${this.baseUrl}/network/details`);
  }

  getNetworkDevices(): Observable<{ devices: any[] }> {
    return this.http.get<{ devices: any[] }>(`${this.baseUrl}/network/devices`);
  }

  scanNetwork(): Observable<{ devices: any[] }> {
    return this.http.post<{ devices: any[] }>(`${this.baseUrl}/network/scan`, {});
  }

  getWifiStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/wifi/status`);
  }

  scanWifi(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/wifi/scan`);
  }

  connectWifi(ssid: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/wifi/connect`, { ssid, password });
  }

  // Speedtest
  runSpeedtest(): Observable<any> {
    return this.http.post(`${this.baseUrl}/speedtest`, {});
  }

  getSpeedtestHistory(): Observable<{ history: any[] }> {
    return this.http.get<{ history: any[] }>(`${this.baseUrl}/speedtest/history`);
  }

  getSpeedtestStatus(): Observable<{ enabled: boolean }> {
    return this.http.get<{ enabled: boolean }>(`${this.baseUrl}/admin/speedtest/status`);
  }

  toggleAutoSpeedtest(enabled: boolean): Observable<any> {
    const params = new HttpParams().set('enabled', enabled.toString());
    return this.http.post(`${this.baseUrl}/admin/speedtest/toggle`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // LED
  getLedStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/led/status`);
  }

  updateLedConfig(config: {
    enabled?: boolean;
    mode?: string;
    ledType?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/led/config`, config);
  }
}
