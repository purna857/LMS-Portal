import { computed, Injectable, signal } from '@angular/core';

import type { AuthenticatedUser, SessionState, TokenPair, UserRole } from '@app/core/models/auth.model';
import { StorageService } from '@app/core/services/storage.service';


@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly sessionSignal = signal<SessionState | null>(this.restoreSession());

  readonly session = computed(() => this.sessionSignal());
  readonly user = computed<AuthenticatedUser | null>(() => this.sessionSignal()?.user ?? null);
  readonly tokens = computed<TokenPair | null>(() => this.sessionSignal()?.tokens ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly primaryRole = computed<UserRole | null>(() => this.user()?.roles[0] ?? null);

  constructor(private readonly storageService: StorageService) {}

  setSession(session: SessionState): void {
    this.sessionSignal.set(session);
    this.storageService.setSession(session);
  }

  patchUser(userPatch: Partial<AuthenticatedUser>): void {
    const currentSession = this.sessionSignal();
    if (!currentSession) {
      return;
    }

    const nextSession: SessionState = {
      ...currentSession,
      user: {
        ...currentSession.user,
        ...userPatch
      }
    };
    this.sessionSignal.set(nextSession);
    this.storageService.setSession(nextSession);
  }

  clearSession(): void {
    this.sessionSignal.set(null);
    this.storageService.clearSession();
  }

  hasAnyRole(expectedRoles: UserRole[]): boolean {
    const currentRoles = this.user()?.roles ?? [];
    return expectedRoles.some((role) => currentRoles.includes(role));
  }

  getAccessToken(): string | null {
    return this.tokens()?.access_token ?? null;
  }

  getDefaultAuthenticatedRoute(): string {
    const role = this.primaryRole();
    if (role === 'admin') {
      return '/app/dashboard/admin';
    }
    if (role === 'instructor') {
      return '/app/dashboard/instructor';
    }
    if (role === 'student') {
      return '/app/dashboard/student';
    }
    return '/app/dashboard';
  }

  private restoreSession(): SessionState | null {
    const session = this.storageService.getSession();
    if (!session) {
      return null;
    }

    const accessTokenExpiry = Date.parse(session.tokens.access_token_expires_at);
    if (Number.isNaN(accessTokenExpiry) || accessTokenExpiry <= Date.now()) {
      this.storageService.clearSession();
      return null;
    }

    return session;
  }
}
