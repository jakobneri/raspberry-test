import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService, Session, SessionsResponse } from '../../services/api';

@Component({
  selector: 'app-sessions-card',
  imports: [CommonModule],
  templateUrl: './sessions-card.html',
  styleUrl: './sessions-card.scss',
})
export class SessionsCard implements OnInit, OnDestroy {
  sessionCount = 0;
  activeUsers = 0;
  showModal = false;
  sessions: Session[] = [];
  appToken?: string;
  expandedTokens: Set<string> = new Set();

  private subscription?: Subscription;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.fetchSessions();
    this.subscription = interval(5000)
      .pipe(switchMap(() => this.api.getSessions()))
      .subscribe((data) => {
        this.updateSessionData(data);
        this.cdr.detectChanges(); // Explicitly trigger change detection
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  fetchSessions(): void {
    this.api.getSessions().subscribe((data) => {
      this.updateSessionData(data);
      this.cdr.detectChanges(); // Explicitly trigger change detection
    });
  }

  private updateSessionData(data: SessionsResponse): void {
    this.sessions = data.sessions;
    this.appToken = data.appToken;
    this.sessionCount = data.sessions.length;
    this.activeUsers = new Set(data.sessions.map((s) => s.userId)).size;
  }

  openModal(): void {
    this.fetchSessions();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  toggleToken(id: string): void {
    if (this.expandedTokens.has(id)) {
      this.expandedTokens.delete(id);
    } else {
      this.expandedTokens.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedTokens.has(id);
  }

  getShortToken(token: string): string {
    return token.substring(0, 20) + '...' + token.substring(token.length - 10);
  }

  copyToken(token: string): void {
    navigator.clipboard.writeText(token).then(() => {
      alert('Token copied!');
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('de-DE');
  }
}
