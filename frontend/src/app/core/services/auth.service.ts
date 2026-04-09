import { inject, Injectable } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';

import { AuthApiService } from '@app/core/api/services/auth-api.service';
import type {
  AuthResponse,
  ForgotPasswordResponse,
  ForgotPasswordRequest,
  InstructorSignupRequest,
  LoginRequest,
  ResetPasswordResponse,
  ResetPasswordRequest,
  SignupResponse,
  StudentSignupRequest
} from '@app/core/models/auth.model';
import { SessionService } from '@app/core/services/session.service';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly sessionService = inject(SessionService);

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.authApi
      .login(payload)
      .pipe(tap((response) => this.sessionService.setSession(response)));
  }

  signupStudent(payload: StudentSignupRequest): Observable<SignupResponse> {
    return this.authApi.signupStudent(payload);
  }

  signupInstructor(payload: InstructorSignupRequest): Observable<SignupResponse> {
    return this.authApi.signupInstructor(payload);
  }

  requestPasswordReset(payload: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.authApi.forgotPassword(payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    return this.authApi.resetPassword(payload);
  }

  getCurrentUser(): Observable<AuthResponse['user']> {
    return this.authApi.getCurrentUser();
  }

  logout(): Observable<void> {
    const refreshToken = this.sessionService.tokens()?.refresh_token;
    if (!refreshToken) {
      this.sessionService.clearSession();
      return of(void 0);
    }

    return this.authApi
      .logout(refreshToken)
      .pipe(
        map(() => void 0),
        catchError(() => of(void 0)),
        finalize(() => this.sessionService.clearSession())
      );
  }
}
