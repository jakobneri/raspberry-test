import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService, MetricsData } from './api';

@Injectable({
  providedIn: 'root',
})
export class MetricsService implements OnDestroy {
  private metricsSubject = new BehaviorSubject<MetricsData | null>(null);
  private historySubject = new BehaviorSubject<MetricsData[]>([]);
  private pollingSubscription?: Subscription;

  metrics$ = this.metricsSubject.asObservable();
  history$ = this.historySubject.asObservable();

  constructor(private api: ApiService) {}

  startPolling(intervalMs: number = 1000): void {
    this.stopPolling();

    // Initial fetch
    this.fetchMetrics();

    this.pollingSubscription = interval(intervalMs)
      .pipe(
        switchMap(() =>
          this.api.getMetrics().pipe(
            catchError((err) => {
              console.error('Error fetching metrics:', err);
              return of(null);
            })
          )
        )
      )
      .subscribe((data) => {
        if (data) {
          this.metricsSubject.next(data);
          this.updateHistory(data);
        }
      });
  }

  stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
  }

  fetchMetrics(): void {
    this.api.getMetrics().subscribe({
      next: (data) => {
        this.metricsSubject.next(data);
        this.updateHistory(data);
      },
      error: (err) => console.error('Error fetching metrics:', err),
    });
  }

  fetchHistory(): void {
    this.api.getMetricsHistory().subscribe({
      next: (data) => this.historySubject.next(data.history || []),
      error: (err) => console.error('Error fetching history:', err),
    });
  }

  private updateHistory(data: MetricsData): void {
    const history = [...this.historySubject.value, data];
    // Keep last 60 data points (1 minute at 1s interval)
    if (history.length > 60) {
      history.shift();
    }
    this.historySubject.next(history);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
