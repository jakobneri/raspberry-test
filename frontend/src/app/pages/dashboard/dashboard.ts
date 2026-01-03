import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Sidebar } from '../../components/sidebar/sidebar';
import { MetricCard } from '../../components/metric-card/metric-card';
import { TerminalCard } from '../../components/terminal-card/terminal-card';
import { SessionsCard } from '../../components/sessions-card/sessions-card';
import { MetricsService } from '../../services/metrics';
import { ApiService, MetricsData } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, Sidebar, MetricCard, TerminalCard, SessionsCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  metrics: MetricsData | null = null;
  systemInfo: any = null;
  lastUpdate: string = '--';
  loading = true;
  error: string | null = null;
  autoUpdateEnabled = false;

  private metricsSubscription?: Subscription;

  constructor(
    private metricsService: MetricsService,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Fetch initial data directly first
    this.api.getMetrics().subscribe({
      next: (data) => {
        this.metrics = data;
        this.lastUpdate = new Date().toLocaleString('de-DE');
        this.loading = false;
        this.cdr.detectChanges(); // Explicitly trigger change detection
      },
      error: (err) => {
        console.error('Error fetching metrics:', err);
        this.error = 'Failed to load metrics';
        this.loading = false;
        this.cdr.detectChanges(); // Explicitly trigger change detection
      },
    });

    // Then start polling (every 5 seconds for better performance)
    this.metricsService.startPolling(5000);
    this.metricsSubscription = this.metricsService.metrics$.subscribe((data) => {
      if (data) {
        this.metrics = data;
        this.lastUpdate = new Date().toLocaleString('de-DE');
        this.loading = false;
        this.error = null;
        this.cdr.detectChanges(); // Explicitly trigger change detection
      }
    });

    this.fetchSystemInfo();
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.metricsService.stopPolling();
    this.metricsSubscription?.unsubscribe();
  }

  fetchSystemInfo(): void {
    this.api.getSystemInfo().subscribe({
      next: (info) => {
        this.systemInfo = info;
        this.cdr.detectChanges(); // Explicitly trigger change detection
      },
      error: (err) => console.error('Error fetching system info:', err),
    });
  }

  get cpuDetails() {
    if (!this.metrics) return [];
    return [
      { label: 'Cores', value: this.metrics.cpu.cores },
      { label: 'Speed', value: `${this.metrics.cpu.speed} GHz` },
      { label: 'Temp', value: `${this.metrics.cpu.temp}°C` },
    ];
  }

  get memoryDetails() {
    if (!this.metrics) return [];
    return [
      { label: 'Used', value: `${this.metrics.memory.used.toFixed(1)} GB` },
      { label: 'Free', value: `${this.metrics.memory.free.toFixed(1)} GB` },
      { label: 'Total', value: `${this.metrics.memory.total.toFixed(1)} GB` },
    ];
  }

  get diskDetails() {
    if (!this.metrics) return [];
    return [
      { label: 'Used', value: `${this.metrics.disk.used.toFixed(1)} GB` },
      { label: 'Available', value: `${this.metrics.disk.available.toFixed(1)} GB` },
    ];
  }

  get networkDetails() {
    if (!this.metrics) return [];
    return [
      { label: 'Download', value: `${this.metrics.network.rx.toFixed(1)} KB/s` },
      { label: 'Upload', value: `${this.metrics.network.tx.toFixed(1)} KB/s` },
      { label: 'Interface', value: this.metrics.network.interface },
    ];
  }

  get systemLoadDetails() {
    if (!this.metrics?.system) return [];
    return [{ label: 'Load Avg', value: this.metrics.system.loadAvg[0]?.toFixed(2) || '--' }];
  }

  formatUptime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;

    if (days > 0) {
      return `${days}d ${hrs}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  }

  restartServer(): void {
    if (confirm('Are you sure you want to restart the server?')) {
      this.api.restartServer().subscribe({
        next: () => {
          alert('Server is restarting...');
          setTimeout(() => window.location.reload(), 3000);
        },
        error: () => alert('Error restarting server'),
      });
    }
  }

  shutdownServer(): void {
    if (confirm('Are you sure you want to shutdown the server?')) {
      this.api.shutdownServer().subscribe({
        next: () => alert('Server is shutting down...'),
        error: () => alert('Error shutting down server'),
      });
    }
  }

  navigateToNetworkMap(): void {
    this.router.navigate(['/network-map']);
  }

  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: (settings) => {
        this.autoUpdateEnabled = settings.autoUpdate;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading settings:', err),
    });
  }

  toggleAutoUpdate(event: Event): void {
    const target = event.target as HTMLInputElement;
    const enabled = target.checked;
    
    this.api.toggleAutoUpdate(enabled).subscribe({
      next: () => {
        this.autoUpdateEnabled = enabled;
        const message = enabled 
          ? 'Auto-update enabled. Server will check for updates on startup.' 
          : 'Auto-update disabled.';
        alert(message);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error toggling auto-update:', err);
        alert('Failed to update auto-update setting');
        // Revert checkbox
        target.checked = !enabled;
      },
    });
  }
}
