import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { LogEntry } from './api';

@Injectable({
  providedIn: 'root',
})
export class WebsocketService implements OnDestroy {
  private logSubject = new Subject<LogEntry>();
  private eventSource?: EventSource;
  private reconnectTimeout?: any;

  logs$ = this.logSubject.asObservable();

  connectToLogs(): void {
    this.disconnectLogs();

    this.eventSource = new EventSource('/api/logs/stream');

    this.eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data) as LogEntry;
        this.logSubject.next(log);
      } catch (e) {
        console.error('Error parsing log:', e);
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      this.eventSource?.close();
      // Reconnect after 5 seconds
      this.reconnectTimeout = setTimeout(() => this.connectToLogs(), 5000);
    };
  }

  disconnectLogs(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  ngOnDestroy(): void {
    this.disconnectLogs();
  }
}
