import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket';
import { ApiService, LogEntry } from '../../services/api';

@Component({
  selector: 'app-terminal-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './terminal-card.html',
  styleUrl: './terminal-card.scss',
})
export class TerminalCard implements OnInit, OnDestroy {
  @ViewChild('terminalOutput') terminalOutput!: ElementRef;

  logs: LogEntry[] = [];
  logLevel: string = 'info';
  private subscription?: Subscription;

  constructor(
    private websocket: WebsocketService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.websocket.connectToLogs();
    this.subscription = this.websocket.logs$.subscribe((log) => {
      this.logs.push(log);
      // Keep only last 500 logs
      if (this.logs.length > 500) {
        this.logs.shift();
      }
      this.scrollToBottom();
      this.cdr.detectChanges(); // Explicitly trigger change detection
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.websocket.disconnectLogs();
  }

  clearTerminal(): void {
    this.api.clearLogs().subscribe(() => {
      this.logs = [];
    });
  }

  setLogLevel(level: string): void {
    this.api.setLogLevel(level).subscribe();
  }

  getLogColor(level: string): string {
    switch (level) {
      case 'warn':
        return '#cca700';
      case 'error':
        return '#f14c4c';
      default:
        return '#d4d4d4';
    }
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.terminalOutput?.nativeElement) {
        const el = this.terminalOutput.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
