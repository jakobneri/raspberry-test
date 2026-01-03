import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

  devices: NetworkDevice[] = [];
  loading = false;
  scanning = false;
  lastScan: Date | null = null;

  ngOnInit() {
    console.log('[NetworkMap] Component initialized, loading devices...');
    this.loadDevices();
  }

  private normalizeDevices(devices: any[] = []): NetworkDevice[] {
    return devices.map((device, idx) => {
      const normalized: NetworkDevice = {
        ip: device.ip || `unknown-${idx}`,
        mac: device.mac || 'Unknown',
        hostname: device.hostname || 'Unknown',
        vendor: device.vendor,
        status: device.status === 'offline' ? 'offline' : 'online',
        lastSeen: device.lastSeen || new Date().toISOString(),
      };
      return normalized;
    });
  }

  loadDevices() {
    console.log('[NetworkMap] Loading cached network devices...');
    this.loading = true;
    this.api.getNetworkDevices().subscribe({
      next: (data) => {
        console.log('[NetworkMap] Devices loaded:', data);
        this.devices = this.normalizeDevices(data.devices);
        console.log(`[NetworkMap] Found ${this.devices.length} devices`);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[NetworkMap] Failed to load devices:', err);
        console.error('[NetworkMap] Error details:', JSON.stringify(err));
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  scanNetwork() {
    console.log('[NetworkMap] Starting network scan...');
    this.scanning = true;
    this.api.scanNetwork().subscribe({
      next: (data) => {
        console.log('[NetworkMap] Network scan completed:', data);
        this.devices = this.normalizeDevices(data.devices);
        console.log(`[NetworkMap] Scan found ${this.devices.length} devices`);
        this.lastScan = new Date();
        this.scanning = false;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[NetworkMap] Network scan failed:', err);
        console.error('[NetworkMap] Error details:', JSON.stringify(err));
        this.scanning = false;
        this.loading = false;
        this.cdr.detectChanges();
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
