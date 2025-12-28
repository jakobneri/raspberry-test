import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

interface NavLink {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  @Input() currentPage: string = '';

  adminLinks: NavLink[] = [
    { path: '/cockpit', icon: '📊', label: 'Dashboard' },
    { path: '/users', icon: '👥', label: 'User Management' },
    { path: '/files', icon: '📁', label: 'Files' },
    { path: '/network-map', icon: '🌐', label: 'Network Map' },
    { path: '/game-admin', icon: '⚙️', label: 'Game Admin' },
  ];

  publicLinks: NavLink[] = [{ path: '/game', icon: '🎮', label: 'Game' }];

  constructor(private authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}
