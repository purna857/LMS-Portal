import { Injectable } from '@angular/core';

import { appSettings } from '@app/core/config/app-settings';
import type { SessionState } from '@app/core/models/auth.model';


@Injectable({ providedIn: 'root' })
export class StorageService {
  getSession(): SessionState | null {
    const rawValue = localStorage.getItem(appSettings.storageKey);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as SessionState;
    } catch {
      localStorage.removeItem(appSettings.storageKey);
      return null;
    }
  }

  setSession(session: SessionState): void {
    localStorage.setItem(appSettings.storageKey, JSON.stringify(session));
  }

  clearSession(): void {
    localStorage.removeItem(appSettings.storageKey);
  }
}
