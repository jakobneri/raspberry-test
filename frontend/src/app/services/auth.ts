import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.checkAuthStatus();
  }

  checkAuthStatus(): void {
    this.http
      .get<{ loggedIn: boolean }>('/api/whoami')
      .pipe(
        tap((response) => this.isAuthenticatedSubject.next(response.loggedIn)),
        catchError(() => {
          this.isAuthenticatedSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  login(email: string, password: string): Observable<{ success: boolean; error?: string }> {
    const body = new HttpParams().set('email', email).set('password', password);

    return this.http
      .post<{ success: boolean; error?: string }>('/api/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((response) => {
          if (response.success) {
            this.isAuthenticatedSubject.next(true);
          }
        }),
        catchError((err) => {
          return of({ success: false, error: err?.error?.error || 'Login failed' });
        })
      );
  }

  logout(): void {
    this.http.post('/api/logout', {}).subscribe({
      next: () => {
        this.isAuthenticatedSubject.next(false);
        this.router.navigate(['/login']);
      },
      error: () => {
        this.isAuthenticatedSubject.next(false);
        this.router.navigate(['/login']);
      },
    });
  }

  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value;
  }
}
