import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type { MessageResponse } from '@app/core/models/auth.model';
import type {
  ChangePasswordPayload,
  CurrentProfileResponse,
  UserProfileUpdatePayload
} from '@app/core/models/profile.model';
import { SessionService } from '@app/core/services/session.service';


@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiClientService);
  private readonly sessionService = inject(SessionService);

  getCurrentProfile(): Observable<CurrentProfileResponse> {
    return this.api.get<CurrentProfileResponse>('/profile/me');
  }

  updateCurrentProfile(payload: UserProfileUpdatePayload): Observable<CurrentProfileResponse> {
    return this.api
      .patch<CurrentProfileResponse>('/profile/me', payload)
      .pipe(tap((profile) => this.sessionService.patchUser({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        status: profile.status,
        avatar_url: profile.profile?.avatar_url ?? null
      })));
  }

  changePassword(payload: ChangePasswordPayload): Observable<MessageResponse> {
    return this.api.post<MessageResponse>('/profile/change-password', payload);
  }
}
