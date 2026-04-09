import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import type { UserRole } from '@app/core/models/auth.model';
import { SessionService } from '@app/core/services/session.service';


export const roleGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] as UserRole[] | undefined) ?? [];

  if (!sessionService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (roles.length === 0 || sessionService.hasAnyRole(roles)) {
    return true;
  }

  return router.createUrlTree(['/auth/forbidden']);
};
