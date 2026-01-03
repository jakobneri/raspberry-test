import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ApiService } from '../../services/api';

interface NetworkDevice {
  ip: string;
  mac: string;
  hostname?: string;
  vendor?: string;
  status: 'online' | 'offline';
  lastSeen: string;
}

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './network-map.html',
  styleUrl: './network-map.scss',
})
export class NetworkMap implements OnInit {
  private api = inject(ApiService);

  devices: NetworkDevice[] = [];
  loading = false;
  scanning = false;
  lastScan: Date | null = null;

  ngOnInit() {
    console.log('[NetworkMap] Component initialized, loading devices...');
    this.loadDevices();
  }

  loadDevices() {
    console.log('[NetworkMap] Loading cached network devices...');
    this.loading = true;
    this.api.getNetworkDevices().subscribe({
      next: (data) => {
        console.log('[NetworkMap] Devices loaded:', data);
        this.devices = data.devices || [];
        console.log(`[NetworkMap] Found ${this.devices.length} devices`);
        this.loading = false;
      },
      error: (err) => {
        console.error('[NetworkMap] Failed to load devices:', err);
        console.error('[NetworkMap] Error details:', JSON.stringify(err));
        this.loading = false;
      },
    });
  }

  scanNetwork() {
    console.log('[NetworkMap] Starting network scan...');
    this.scanning = true;
    this.api.scanNetwork().subscribe({
      next: (data) => {
        console.log('[NetworkMap] Network scan completed:', data);
        this.devices = data.devices || [];
        console.log(`[NetworkMap] Scan found ${this.devices.length} devices`);
        this.lastScan = new Date();
        this.scanning = false;
      },
      error: (err) => {
        console.error('[NetworkMap] Network scan failed:', err);
        console.error('[NetworkMap] Error details:', JSON.stringify(err));
        this.scanning = false;
      },
    });
  }

  getStatusColor(status: string): string {
    return status === 'online' ? 'online' : 'offline';
  }

  formatLastSeen(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  get onlineCount(): number {
    return this.devices.filter((d) => d.status === 'online').length;
  }

  get offlineCount(): number {
    return this.devices.filter((d) => d.status === 'offline').length;
  }
}
