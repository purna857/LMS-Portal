import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type {
  AuthResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  InstructorSignupRequest,
  LoginRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SignupResponse,
  StudentSignupRequest
} from '@app/core/models/auth.model';


@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiClientService);

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', payload);
  }

  signupStudent(payload: StudentSignupRequest): Observable<SignupResponse> {
    return this.api.post<SignupResponse>('/auth/signup/student', payload);
  }

  signupInstructor(payload: InstructorSignupRequest): Observable<SignupResponse> {
    return this.api.post<SignupResponse>('/auth/signup/instructor', payload);
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.api.post<ForgotPasswordResponse>('/auth/forgot-password', payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    return this.api.post<ResetPasswordResponse>('/auth/reset-password', payload);
  }

  logout(refreshToken: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/logout', { refresh_token: refreshToken });
  }

  getCurrentUser(): Observable<AuthResponse['user']> {
    return this.api.get<AuthResponse['user']>('/auth/me');
  }
}
