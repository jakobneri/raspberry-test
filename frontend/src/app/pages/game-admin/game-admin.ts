import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../components/sidebar/sidebar';
import { TerminalCard } from '../../components/terminal-card/terminal-card';
import { ApiService } from '../../services/api';

interface Score {
  name: string;
  score: number;
  difficulty: string;
  date: string;
}

interface DifficultySettings {
  speed: number;
  gridSize: number;
  growthRate: number;
}

@Component({
  selector: 'app-game-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, TerminalCard],
  templateUrl: './game-admin.html',
  styleUrl: './game-admin.scss',
})
export class GameAdmin implements OnInit {
  private api = inject(ApiService);

  scores: Score[] = [];
  difficulties: Record<string, DifficultySettings> = {
    easy: { speed: 200, gridSize: 15, growthRate: 1 },
    medium: { speed: 150, gridSize: 20, growthRate: 2 },
    hard: { speed: 100, gridSize: 25, growthRate: 3 },
  };

  selectedDifficulty = 'medium';
  editingSettings = false;
  tempSettings: DifficultySettings = { speed: 150, gridSize: 20, growthRate: 2 };

  showDeleteModal = false;
  scoreToDelete: Score | null = null;

  ngOnInit() {
    this.loadScores();
  }

  loadScores() {
    this.api.getScores().subscribe({
      next: (data: any) => {
        this.scores = data.scores || data || [];
      },
      error: (err) => console.error('Failed to load scores:', err),
    });
  }

  selectDifficulty(difficulty: string) {
    this.selectedDifficulty = difficulty;
    this.tempSettings = { ...this.difficulties[difficulty] };
  }

  startEditSettings() {
    this.editingSettings = true;
    this.tempSettings = { ...this.difficulties[this.selectedDifficulty] };
  }

  saveSettings() {
    this.difficulties[this.selectedDifficulty] = { ...this.tempSettings };
    this.editingSettings = false;
  }

  cancelEditSettings() {
    this.editingSettings = false;
  }

  confirmDeleteScore(score: Score) {
    this.scoreToDelete = score;
    this.showDeleteModal = true;
  }

  deleteScore() {
    if (this.scoreToDelete) {
      this.scores = this.scores.filter((s) => s !== this.scoreToDelete);
      this.closeDeleteModal();
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.scoreToDelete = null;
  }

  clearAllScores() {
    if (confirm('Are you sure you want to clear all scores?')) {
      this.scores = [];
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'easy':
        return 'easy';
      case 'medium':
        return 'medium';
      case 'hard':
        return 'hard';
      default:
        return '';
    }
  }
}
