import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Score } from '../../services/api';

interface SnakeSegment {
  x: number;
  y: number;
}

@Component({
  selector: 'app-game',
  imports: [CommonModule],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class Game implements OnInit, OnDestroy {
  // Game state
  gridSize = 20;
  cellSize = 20;
  snake: SnakeSegment[] = [];
  food: SnakeSegment = { x: 0, y: 0 };
  direction = 'right';
  nextDirection = 'right';
  score = 0;
  highScore = 0;
  gameRunning = false;
  gameOver = false;

  // Scoreboard
  topScores: Score[] = [];

  private gameInterval?: any;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadHighScore();
    this.loadScoreboard();
    this.initGame();
  }

  ngOnDestroy(): void {
    this.stopGame();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (['arrowup', 'w'].includes(key) && this.direction !== 'down') {
      this.nextDirection = 'up';
    } else if (['arrowdown', 's'].includes(key) && this.direction !== 'up') {
      this.nextDirection = 'down';
    } else if (['arrowleft', 'a'].includes(key) && this.direction !== 'right') {
      this.nextDirection = 'left';
    } else if (['arrowright', 'd'].includes(key) && this.direction !== 'left') {
      this.nextDirection = 'right';
    } else if (key === ' ' && !this.gameRunning) {
      this.startGame();
    }
  }

  initGame(): void {
    this.snake = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    this.direction = 'right';
    this.nextDirection = 'right';
    this.score = 0;
    this.gameOver = false;
    this.spawnFood();
  }

  startGame(): void {
    if (this.gameOver) {
      this.initGame();
    }
    this.gameRunning = true;
    this.gameInterval = setInterval(() => this.gameLoop(), 100);
  }

  stopGame(): void {
    this.gameRunning = false;
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
  }

  gameLoop(): void {
    this.direction = this.nextDirection;
    const head = { ...this.snake[0] };

    switch (this.direction) {
      case 'up':
        head.y--;
        break;
      case 'down':
        head.y++;
        break;
      case 'left':
        head.x--;
        break;
      case 'right':
        head.x++;
        break;
    }

    // Check collision with walls
    if (head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize) {
      this.endGame();
      return;
    }

    // Check collision with self
    if (this.snake.some((segment) => segment.x === head.x && segment.y === head.y)) {
      this.endGame();
      return;
    }

    this.snake.unshift(head);

    // Check food collision
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.spawnFood();
    } else {
      this.snake.pop();
    }
  }

  spawnFood(): void {
    do {
      this.food = {
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize),
      };
    } while (this.snake.some((segment) => segment.x === this.food.x && segment.y === this.food.y));
  }

  endGame(): void {
    this.stopGame();
    this.gameOver = true;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('snakeHighScore', this.score.toString());
    }

    // Submit score
    if (this.score > 0) {
      this.api.addScore(this.score).subscribe({
        next: () => this.loadScoreboard(),
        error: (err) => console.error('Error submitting score:', err),
      });
    }
  }

  loadHighScore(): void {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) {
      this.highScore = parseInt(saved, 10);
    }
  }

  loadScoreboard(): void {
    this.api.getScores().subscribe({
      next: (scores) => (this.topScores = scores.slice(0, 10)),
      error: (err) => console.error('Error loading scores:', err),
    });
  }

  getSegmentStyle(segment: SnakeSegment): any {
    return {
      left: segment.x * this.cellSize + 'px',
      top: segment.y * this.cellSize + 'px',
      width: this.cellSize - 2 + 'px',
      height: this.cellSize - 2 + 'px',
    };
  }

  getFoodStyle(): any {
    return {
      left: this.food.x * this.cellSize + 'px',
      top: this.food.y * this.cellSize + 'px',
      width: this.cellSize - 2 + 'px',
      height: this.cellSize - 2 + 'px',
    };
  }
}
