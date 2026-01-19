import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let toast of toasts"
        class="toast toast-{{ toast.type }}"
      >
        <div class="toast-icon">
          <span *ngIf="toast.type === 'success'">✓</span>
          <span *ngIf="toast.type === 'error'">✕</span>
          <span *ngIf="toast.type === 'info'">ℹ</span>
          <span *ngIf="toast.type === 'warning'">⚠</span>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
        <button class="toast-close" (click)="close(toast.id)">×</button>
      </div>
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
      }

      .toast {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
        border-left: 4px solid;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .toast-success {
        border-color: #10b981;
        background: #f0fdf4;
      }

      .toast-error {
        border-color: #ef4444;
        background: #fef2f2;
      }

      .toast-info {
        border-color: #3b82f6;
        background: #eff6ff;
      }

      .toast-warning {
        border-color: #f59e0b;
        background: #fffbeb;
      }

      .toast-icon {
        font-size: 20px;
        margin-right: 12px;
        font-weight: bold;
      }

      .toast-success .toast-icon {
        color: #10b981;
      }

      .toast-error .toast-icon {
        color: #ef4444;
      }

      .toast-info .toast-icon {
        color: #3b82f6;
      }

      .toast-warning .toast-icon {
        color: #f59e0b;
      }

      .toast-message {
        flex: 1;
        color: #1f2937;
        font-size: 14px;
      }

      .toast-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        margin-left: 12px;
        line-height: 1;
      }

      .toast-close:hover {
        color: #1f2937;
      }

      @media (max-width: 640px) {
        .toast-container {
          left: 10px;
          right: 10px;
          max-width: none;
        }
      }
    `,
  ],
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subscription?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subscription = this.toastService.getToasts().subscribe((toasts) => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  close(id: number): void {
    this.toastService.remove(id);
  }
}
