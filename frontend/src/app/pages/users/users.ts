import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ApiService, User } from '../../services/api';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  users: User[] = [];
  userRequests: any[] = [];
  showCreateModal = false;
  loading = true;

  // New user form
  newUser = {
    email: '',
    name: '',
    password: '',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.fetchUsers();
    this.fetchUserRequests();
  }

  fetchUsers(): void {
    this.api.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching users:', err);
        this.loading = false;
      },
    });
  }

  fetchUserRequests(): void {
    this.api.getUserRequests().subscribe({
      next: (requests) => (this.userRequests = requests),
      error: (err) => console.error('Error fetching requests:', err),
    });
  }

  createUser(): void {
    if (!this.newUser.email || !this.newUser.password || !this.newUser.name) {
      alert('Please fill all fields');
      return;
    }

    this.api.createUser(this.newUser).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.newUser = { email: '', name: '', password: '' };
        this.fetchUsers();
      },
      error: (err) => {
        console.error('Error creating user:', err);
        alert('Error creating user');
      },
    });
  }

  deleteUser(userId: string): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.api.deleteUser(userId).subscribe({
        next: () => this.fetchUsers(),
        error: (err) => {
          console.error('Error deleting user:', err);
          alert('Error deleting user');
        },
      });
    }
  }

  approveRequest(requestId: string): void {
    this.api.approveUserRequest(requestId).subscribe({
      next: () => {
        this.fetchUserRequests();
        this.fetchUsers();
      },
      error: (err) => {
        console.error('Error approving request:', err);
        alert('Error approving request');
      },
    });
  }

  rejectRequest(requestId: string): void {
    this.api.rejectUserRequest(requestId).subscribe({
      next: () => this.fetchUserRequests(),
      error: (err) => {
        console.error('Error rejecting request:', err);
        alert('Error rejecting request');
      },
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('de-DE');
  }
}
