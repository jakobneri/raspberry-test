import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap, catchError, map, first } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Tracks when the initial auth check has completed
  private authCheckComplete$ = new ReplaySubject<boolean>(1);

  constructor(private http: HttpClient, private router: Router) {
    this.checkAuthStatus();
  }

  checkAuthStatus(): void {
    this.http
      .get<{ loggedIn: boolean }>('/api/whoami')
      .pipe(
        tap((response) => {
          this.isAuthenticatedSubject.next(response.loggedIn);
          this.authCheckComplete$.next(true);
        }),
        catchError(() => {
          this.isAuthenticatedSubject.next(false);
          this.authCheckComplete$.next(true);
          return of(null);
        })
      )
      .subscribe();
  }

  // Wait for auth check to complete, then return auth status
  waitForAuthCheck(): Observable<boolean> {
    return this.authCheckComplete$.pipe(
      first(),
      map(() => this.isAuthenticatedSubject.value)
    );
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
