import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '@app/core/services/session.service';


@Component({
  selector: 'app-dashboard-redirect',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardRedirectComponent {
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);

  constructor() {
    effect(() => {
      const targetRoute = this.sessionService.getDefaultAuthenticatedRoute();
      if (this.router.url !== targetRoute) {
        void this.router.navigateByUrl(targetRoute, { replaceUrl: true });
      }
    });
  }
}
