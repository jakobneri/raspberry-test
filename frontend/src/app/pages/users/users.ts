import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ApiService, User } from '../../services/api';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-users',
  standalone: true,
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

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.fetchUsers();
    this.fetchUserRequests();
  }

  fetchUsers(): void {
    this.api.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching users:', err);
        this.toast.error('Failed to load users');
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  fetchUserRequests(): void {
    this.api.getUserRequests().subscribe({
      next: (requests) => (this.userRequests = requests),
      error: (err) => {
        console.error('Error fetching requests:', err);
        this.toast.error('Failed to load user requests');
      },
    });
  }

  createUser(): void {
    if (!this.newUser.email || !this.newUser.password || !this.newUser.name) {
      this.toast.warning('Please fill all fields');
      return;
    }

    this.api.createUser(this.newUser).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.toast.success(`User "${this.newUser.email}" created successfully`);
        this.newUser = { email: '', name: '', password: '' };
        this.fetchUsers();
      },
      error: (err) => {
        console.error('Error creating user:', err);
        const errorMsg = err.error?.error || 'Error creating user';
        this.toast.error(errorMsg);
      },
    });
  }

  deleteUser(userId: string): void {
    const user = this.users.find((u) => u.id === userId);
    const userName = user?.email || 'this user';
    
    if (confirm(`Are you sure you want to delete ${userName}?`)) {
      this.api.deleteUser(userId).subscribe({
        next: () => {
          this.toast.success(`User deleted successfully`);
          this.fetchUsers();
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          this.toast.error('Error deleting user');
        },
      });
    }
  }

  approveRequest(requestId: string): void {
    this.api.approveUserRequest(requestId).subscribe({
      next: () => {
        this.toast.success('User request approved');
        this.fetchUserRequests();
        this.fetchUsers();
      },
      error: (err) => {
        console.error('Error approving request:', err);
        this.toast.error('Error approving request');
      },
    });
  }

  rejectRequest(requestId: string): void {
    this.api.rejectUserRequest(requestId).subscribe({
      next: () => {
        this.toast.info('User request rejected');
        this.fetchUserRequests();
      },
      error: (err) => {
        console.error('Error rejecting request:', err);
        this.toast.error('Error rejecting request');
      },
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('de-DE');
  }
}
