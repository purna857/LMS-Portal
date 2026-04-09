import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, ...materialImports],
  template: `
    <section class="forbidden-page">
      <app-empty-state
        icon="lock"
        title="You do not have access to this area"
        description="Your account is signed in, but the current role does not match the route permissions.">
      </app-empty-state>
      <a mat-flat-button color="primary" routerLink="/app/dashboard">Back to dashboard</a>
    </section>
  `,
  styles: [`
    .forbidden-page {
      min-height: 100vh;
      display: grid;
      place-content: center;
      gap: 1rem;
      justify-items: start;
      padding: 1.5rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForbiddenComponent {}
