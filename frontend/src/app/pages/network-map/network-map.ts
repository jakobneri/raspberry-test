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
    this.loadDevices();
  }

  loadDevices() {
    this.loading = true;
    this.api.getNetworkDevices().subscribe({
      next: (data) => {
        this.devices = data.devices || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load devices:', err);
        this.loading = false;
      },
    });
  }

  scanNetwork() {
    this.scanning = true;
    this.api.scanNetwork().subscribe({
      next: (data) => {
        this.devices = data.devices || [];
        this.lastScan = new Date();
        this.scanning = false;
      },
      error: (err) => {
        console.error('Network scan failed:', err);
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
