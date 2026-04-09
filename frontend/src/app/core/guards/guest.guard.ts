import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { SessionService } from '@app/core/services/session.service';


export const guestGuard: CanActivateFn = (): boolean | UrlTree => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  return sessionService.isAuthenticated()
    ? router.parseUrl(sessionService.getDefaultAuthenticatedRoute())
    : true;
};
