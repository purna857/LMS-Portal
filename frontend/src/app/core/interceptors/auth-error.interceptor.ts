import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { SessionService } from '@app/core/services/session.service';


const AUTH_WHITELIST = [
  '/auth/login',
  '/auth/signup/student',
  '/auth/signup/instructor',
  '/auth/forgot-password',
  '/auth/reset-password'
];

export const authErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const sessionService = inject(SessionService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !AUTH_WHITELIST.some((path) => request.url.includes(path))
      ) {
        sessionService.clearSession();
        void router.navigate(['/auth/login'], {
          queryParams: { returnUrl: router.url }
        });
      }

      return throwError(() => error);
    })
  );
};
