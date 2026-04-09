import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionService } from '@app/core/services/session.service';


export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionService = inject(SessionService);
  const accessToken = sessionService.getAccessToken();

  if (!accessToken) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    })
  );
};
