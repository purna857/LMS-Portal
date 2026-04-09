import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-workspace-placeholder',
  standalone: true,
  imports: [EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        [eyebrow]="eyebrow()"
        [title]="title()"
        [description]="description()">
      </app-page-header>

      <div class="page-grid">
        <mat-card class="stat-card">
          <mat-card-title>Ready for feature wiring</mat-card-title>
          <mat-card-content>
            <p>This route is registered so the dashboard menu stays functional while the feature pages are being built.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-title>API integration target</mat-card-title>
          <mat-card-content>
            <p>Connect this page to the matching FastAPI module when the next frontend slice is implemented.</p>
          </mat-card-content>
        </mat-card>
      </div>

      <app-empty-state
        icon="deployed_code"
        title="Section scaffolded"
        description="Navigation, routing, and the dashboard shell are already prepared for this workspace.">
      </app-empty-state>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspacePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title = computed(() => this.route.snapshot.data['title'] as string ?? 'Workspace');
  readonly description = computed(
    () => this.route.snapshot.data['description'] as string ?? 'This LMS workspace section is ready for the next implementation step.'
  );
  readonly eyebrow = computed(() => this.route.snapshot.data['eyebrow'] as string ?? 'Workspace');
}
