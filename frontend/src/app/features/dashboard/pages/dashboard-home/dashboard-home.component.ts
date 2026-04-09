import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionService } from '@app/core/services/session.service';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Workspace"
        title="Workspace Hub"
        description="Jump into the area that matches your role, current priorities, and daily LMS workflow.">
      </app-page-header>

      <div class="hub-hero">
        <mat-card class="visual-card">
          <mat-card-content>
            <p class="hub-hero__eyebrow">Portal Navigation</p>
            <h2>Everything important is organized by role and task.</h2>
            <p>Use the workspace cards below to enter the part of the LMS built for your responsibilities, whether you manage the platform, teach courses, or learn through them.</p>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="page-grid">
        @for (card of cards(); track card.route) {
          <mat-card class="stat-card hub-card">
            <mat-card-content>
              <p class="hub-card__eyebrow">{{ card.badge }}</p>
              <h3>{{ card.title }}</h3>
              <p>{{ card.description }}</p>
            </mat-card-content>
            <mat-card-actions align="end">
              <a mat-flat-button color="primary" [routerLink]="card.route">Open workspace</a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </section>
  `,
  styles: [`
    .hub-hero__eyebrow,
    .hub-card__eyebrow {
      margin: 0 0 0.85rem;
      color: var(--primary-strong);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.74rem;
      font-weight: 700;
    }
    .hub-hero h2,
    .hub-card h3 {
      margin: 0;
      letter-spacing: -0.04em;
    }
    .hub-hero h2 {
      font-size: clamp(1.5rem, 2vw, 2.2rem);
    }
    .hub-hero p:last-child,
    .hub-card p:last-child {
      color: var(--muted);
      line-height: 1.65;
    }
    .hub-card {
      min-height: 100%;
    }
    .hub-card h3 {
      font-size: 1.24rem;
      margin-bottom: 0.8rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {
  private readonly sessionService = inject(SessionService);

  readonly cards = computed(() => {
    const roles = this.sessionService.user()?.roles ?? [];
    return [
      roles.includes('admin')
        ? {
            title: 'Admin Workspace',
            description: 'Platform analytics, users, approvals, and system-wide controls.',
            route: '/app/dashboard/admin',
            badge: 'Operations'
          }
        : null,
      roles.includes('instructor')
        ? {
            title: 'Instructor Workspace',
            description: 'Course authoring, student oversight, and teaching tools.',
            route: '/app/dashboard/instructor',
            badge: 'Teaching'
          }
        : null,
      roles.includes('student')
        ? {
            title: 'Student Workspace',
            description: 'Learning, assignments, quizzes, progress, and notifications.',
            route: '/app/dashboard/student',
            badge: 'Learning'
          }
        : null
    ].filter(Boolean) as { title: string; description: string; route: string; badge: string }[];
  });
}
