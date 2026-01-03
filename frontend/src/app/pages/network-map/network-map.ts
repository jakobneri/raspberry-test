import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ApiService } from '../../services/api';
import type { DataSet } from 'vis-network';
import type { Edge, Node, Network, Options } from 'vis-network';

interface NetworkDevice {
  ip: string;
  mac: string;
  hostname?: string;
  vendor?: string;
  status: 'online' | 'offline';
  lastSeen: string;
  connection?: 'wired' | 'wireless' | 'unknown';
}

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './network-map.html',
  styleUrl: './network-map.scss',
})
export class NetworkMap implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private storageKey = 'networkMapState';
  private visImports?: Promise<typeof import('vis-network')>;
  private nodes?: DataSet<Node>;
  private edges?: DataSet<Edge>;
  private network?: Network;

  @ViewChild('topologyGraph') topologyGraph?: ElementRef<HTMLDivElement>;

  devices: NetworkDevice[] = [];
  loading = false;
  scanning = false;
  lastScan: Date | null = null;

  ngOnInit() {
    console.log('[NetworkMap] Component initialized, loading devices...');
    this.loadSavedState();
    this.loadDevices();
  }

  ngAfterViewInit(): void {
    // In case saved state arrived before view init
    this.renderNetwork();
  }

  ngOnDestroy(): void {
    this.network?.destroy();
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
        connection: device.connection || 'unknown',
      };
      return normalized;
    });
  }

  private saveState(devices: NetworkDevice[], lastScan: Date | null) {
    try {
      const payload = {
        devices,
        lastScan: lastScan ? lastScan.toISOString() : null,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
      console.log('[NetworkMap] State saved to localStorage');
    } catch (err) {
      console.warn('[NetworkMap] Failed to save state:', err);
    }
  }

  private loadSavedState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { devices?: any[]; lastScan?: string | null };
      if (parsed.devices?.length) {
        this.devices = this.normalizeDevices(parsed.devices);
        this.lastScan = parsed.lastScan ? new Date(parsed.lastScan) : null;
        console.log(`[NetworkMap] Loaded ${this.devices.length} devices from saved state`);
        this.renderNetwork();
      }
    } catch (err) {
      console.warn('[NetworkMap] Failed to load saved state:', err);
    }
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
        this.renderNetwork();
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
        this.saveState(this.devices, this.lastScan);
        this.scanning = false;
        this.loading = false;
        this.cdr.detectChanges();
        this.renderNetwork();
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

  get topologyNodes() {
    return this.devices;
  }

  private connectionColors(connection?: string) {
    switch (connection) {
      case 'wired':
        return { background: '#0d1f3a', border: '#4ea3ff' };
      case 'wireless':
        return { background: '#0f2a1d', border: '#4caf50' };
      default:
        return { background: '#1b1d25', border: '#6c6f7f' };
    }
  }

  private async ensureNetwork(): Promise<void> {
    if (!this.topologyGraph) return;
    if (!this.visImports) {
      this.visImports = import('vis-network');
    }
    const vis = await this.visImports;

    if (!this.nodes) {
      this.nodes = new vis.DataSet<Node>();
    }
    if (!this.edges) {
      this.edges = new vis.DataSet<Edge>();
    }

    if (!this.network) {
      const options: Options = {
        autoResize: true,
        physics: {
          stabilization: true,
          barnesHut: { gravitationalConstant: -9000, springLength: 140, springConstant: 0.02 },
        },
        nodes: {
          shape: 'box',
          font: { color: '#e9ecf5', size: 13 },
          borderWidth: 1,
        },
        edges: {
          color: { color: '#6c6f7f', inherit: false },
          smooth: { enabled: true, type: 'dynamic' },
          width: 1.5,
        },
        interaction: { hover: true },
      };

      this.network = new vis.Network(
        this.topologyGraph.nativeElement,
        { nodes: this.nodes, edges: this.edges },
        options
      );
    }
  }

  private async renderNetwork() {
    if (!this.topologyGraph) return;
    await this.ensureNetwork();
    if (!this.nodes || !this.edges) return;

    this.nodes.clear();
    this.edges.clear();

    // Gateway node
    this.nodes.add({
      id: 'gateway',
      label: 'Gateway',
      shape: 'hexagon',
      color: { background: '#252838', border: '#a7a9b7' },
      font: { color: '#fff', size: 14 },
      mass: 3,
    });

    for (const device of this.devices) {
      const colors = this.connectionColors(device.connection);
      this.nodes.add({
        id: device.ip,
        label: device.hostname || device.ip,
        title: `${device.ip}\n${device.mac}`,
        color: { background: colors.background, border: colors.border },
        font: { color: '#e9ecf5', size: 12 },
      });
      this.edges.add({
        from: 'gateway',
        to: device.ip,
        color: { color: colors.border },
      });
    }

    if (this.network) {
      this.network.setData({ nodes: this.nodes, edges: this.edges });
      this.network.fit({ animation: true });
    }
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
