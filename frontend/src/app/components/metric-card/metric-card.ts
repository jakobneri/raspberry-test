import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-metric-card',
  imports: [CommonModule],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
})
export class MetricCard {
  @Input() icon: string = '';
  @Input() title: string = '';
  @Input() value: string | number = '--';
  @Input() unit: string = '';
  @Input() details: { label: string; value: string | number }[] = [];
  @Input() clickable: boolean = false;
  @Input() progress?: number;
  @Input() progressWarning: boolean = false;

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    if (this.clickable) {
      this.cardClick.emit();
    }
  }
}
