import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { SessionService } from '@app/core/services/session.service';


export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  return sessionService.isAuthenticated()
    ? true
    : router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
};
