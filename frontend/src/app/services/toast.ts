import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toasts$ = new BehaviorSubject<Toast[]>([]);
  private nextId = 1;

  getToasts(): Observable<Toast[]> {
    return this.toasts$.asObservable();
  }

  show(message: string, type: Toast['type'] = 'info', duration = 5000): void {
    const toast: Toast = {
      id: this.nextId++,
      message,
      type,
      duration,
    };

    const currentToasts = this.toasts$.value;
    this.toasts$.next([...currentToasts, toast]);

    if (duration > 0) {
      setTimeout(() => this.remove(toast.id), duration);
    }
  }

  success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  remove(id: number): void {
    const currentToasts = this.toasts$.value;
    this.toasts$.next(currentToasts.filter((t) => t.id !== id));
  }

  clear(): void {
    this.toasts$.next([]);
  }
}
