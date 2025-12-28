import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { HttpClient, HttpParams } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  email = '';
  password = '';
  error = '';
  loading = false;
  showRequestForm = false;

  // Request access form
  requestEmail = '';
  requestPassword = '';
  requestName = '';
  requestSuccess = '';
  requestError = '';

  constructor(private authService: AuthService, private http: HttpClient, private router: Router) {}

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.router.navigate(['/cockpit']);
        } else {
          this.error = response.error || 'Login failed. Please check your credentials.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Login failed. Please check your credentials.';
      },
    });
  }

  requestAccess(): void {
    if (!this.requestEmail || !this.requestPassword || !this.requestName) {
      this.requestError = 'Please fill all fields';
      return;
    }

    const body = new HttpParams()
      .set('email', this.requestEmail)
      .set('password', this.requestPassword)
      .set('name', this.requestName);

    this.http
      .post('/api/request-access', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
        next: () => {
          this.requestSuccess = 'Request submitted successfully!';
          this.requestError = '';
          this.requestEmail = '';
          this.requestPassword = '';
          this.requestName = '';
        },
        error: () => {
          this.requestError = 'Failed to submit request';
          this.requestSuccess = '';
        },
      });
  }

  toggleRequestForm(): void {
    this.showRequestForm = !this.showRequestForm;
    this.requestError = '';
    this.requestSuccess = '';
  }
}
