import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ApiService } from '../../services/api';

interface NetworkDetails {
  ethernet: any;
  wifi: any;
}

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './network.html',
  styleUrl: './network.scss',
})
export class Network implements OnInit {
  private api = inject(ApiService);

  details: NetworkDetails | null = null;
  loadingDetails = false;
  runningSpeedtest = false;
  latestSpeedtest: any = null;
  speedtestHistory: any[] = [];
  error: string | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loadDetails();
    this.loadHistory();
  }

  loadDetails(): void {
    this.loadingDetails = true;
    this.error = null;
    this.api.getNetworkDetails().subscribe({
      next: (data) => {
        this.details = data as NetworkDetails;
        this.loadingDetails = false;
      },
      error: (err) => {
        this.error = 'Failed to load network details';
        this.loadingDetails = false;
        console.error(err);
      },
    });
  }

  loadHistory(): void {
    this.api.getSpeedtestHistory().subscribe({
      next: (res) => {
        const history = res?.history || [];
        this.speedtestHistory = history.slice().reverse();
        this.latestSpeedtest = this.speedtestHistory[0] || null;
      },
      error: (err) => console.error(err),
    });
  }

  runSpeedtest(): void {
    this.runningSpeedtest = true;
    this.error = null;
    this.api.runSpeedtest().subscribe({
      next: (result) => {
        this.runningSpeedtest = false;
        this.latestSpeedtest = result;
        this.loadHistory();
      },
      error: (err) => {
        this.runningSpeedtest = false;
        this.error = 'Speedtest failed';
        console.error(err);
      },
    });
  }

  formatMbps(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)} Mbit/s`;
  }

  formatPing(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value} ms`;
  }
}
