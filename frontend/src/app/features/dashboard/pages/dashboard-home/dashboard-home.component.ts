import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionService } from '@app/core/services/session.service';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


type HubAction = {
  step: string;
  badge: string;
  title: string;
  description: string;
  route: string;
  cta: string;
  icon: string;
};


@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section dashboard-home">
      <app-page-header
        eyebrow="Workspace"
        title="Workspace Hub"
        description="Jump into the role-specific portal path that matches the work you need to do right now."
        [focusLabel]="hubFocusLabel()"
        [focusCopy]="hubFocusCopy()"
        [focusIcon]="hubFocusIcon()">
      </app-page-header>

      <div class="hub-hero-grid">
        <mat-card class="surface-card hub-hero-card">
          <mat-card-content>
            <p class="hub-hero-card__eyebrow">{{ roleTag() }}</p>
            <h2>{{ displayName() }}, {{ heroTitle() }}</h2>
            <p class="hub-hero-card__description">{{ heroDescription() }}</p>

            <div class="hub-hero-card__chips">
              @for (tag of heroTags(); track tag) {
                <span>{{ tag }}</span>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card hub-next-card">
          <mat-card-header>
            <mat-card-title>Recommended next step</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (workflowCards()[0]; as firstAction) {
              <div class="hub-next-card__lead">
                <span class="material-symbols-outlined">{{ firstAction.icon }}</span>
                <div>
                  <strong>{{ firstAction.title }}</strong>
                  <p>{{ firstAction.description }}</p>
                </div>
              </div>
              <a mat-flat-button color="primary" [routerLink]="firstAction.route">Open {{ firstAction.cta }}</a>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <div class="page-grid hub-workflow-grid">
        @for (card of workflowCards(); track card.route) {
          <mat-card class="stat-card hub-workflow-card">
            <mat-card-content>
              <div class="hub-workflow-card__top">
                <span class="hub-workflow-card__step">{{ card.step }}</span>
                <span class="hub-workflow-card__badge">{{ card.badge }}</span>
              </div>

              <span class="hub-workflow-card__icon material-symbols-outlined">{{ card.icon }}</span>
              <h3>{{ card.title }}</h3>
              <p>{{ card.description }}</p>
            </mat-card-content>
            <mat-card-actions align="end">
              <a mat-stroked-button [routerLink]="card.route">Open {{ card.cta }}</a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </section>
  `,
  styles: [`
    .dashboard-home {
      display: grid;
      gap: 1rem;
      font-family: 'IBM Plex Sans', sans-serif;
      color: var(--text-primary);
    }

    .dashboard-home :where(h1, h2, h3, h4, h5, h6, p, span, strong, a, button, label, input, textarea, small, mat-card-title, mat-card-subtitle) {
      font-family: inherit;
    }

    .dashboard-home .material-symbols-outlined,
    .dashboard-home .mat-icon {
      font-family: 'Material Symbols Outlined' !important;
    }

    .hub-hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
      gap: 1rem;
      align-items: stretch;
    }

    .hub-hero-card,
    .hub-next-card,
    .hub-workflow-card {
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(251, 253, 255, 0.99));
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.045);
      overflow: hidden;
    }

    .hub-hero-card mat-card-content {
      display: grid;
      gap: 0.8rem;
      padding: 1.25rem 1.25rem 1.2rem;
    }

    .hub-hero-card__eyebrow {
      display: inline-flex;
      width: fit-content;
      margin: 0;
      padding: 0.34rem 0.72rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.65rem;
      font-weight: 700;
    }

    .hub-hero-card h2 {
      margin: 0;
      font-size: clamp(1.45rem, 2vw, 2.1rem);
      letter-spacing: -0.04em;
      line-height: 1.08;
    }

    .hub-hero-card__description,
    .hub-next-card p,
    .hub-workflow-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.9rem;
    }

    .hub-hero-card__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-top: 0.1rem;
    }

    .hub-hero-card__chips span {
      display: inline-flex;
      align-items: center;
      min-height: 2.1rem;
      padding: 0 0.9rem;
      border-radius: 999px;
      background: #f7fbff;
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: #42526b;
      font-size: 0.72rem;
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
    }

    .hub-next-card mat-card-content {
      display: grid;
      gap: 1rem;
      padding-top: 0.2rem;
    }

    .hub-next-card__lead {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 0.85rem;
      align-items: start;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 18px;
      background: #fff;
    }

    .hub-next-card__lead .material-symbols-outlined {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1.25rem;
    }

    .hub-next-card__lead strong {
      display: block;
      font-size: 0.95rem;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .hub-next-card__lead p {
      margin-top: 0.35rem;
      font-size: 0.82rem;
      line-height: 1.45;
    }

    .hub-workflow-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .hub-workflow-card mat-card-content {
      display: grid;
      gap: 0.7rem;
      padding-bottom: 0.8rem;
    }

    .hub-workflow-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .hub-workflow-card__step,
    .hub-workflow-card__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 1.8rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .hub-workflow-card__step {
      background: #0f172a;
      color: #fff;
    }

    .hub-workflow-card__badge {
      background: #edf4ff;
      color: var(--primary);
    }

    .hub-workflow-card__icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1.1rem;
    }

    .hub-workflow-card h3 {
      margin: 0;
      font-size: 1rem;
      letter-spacing: -0.03em;
      line-height: 1.22;
    }

    .hub-workflow-card p {
      font-size: 0.82rem;
    }

    @media (max-width: 980px) {
      .hub-hero-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {
  private readonly sessionService = inject(SessionService);

  readonly displayName = computed(() => {
    const user = this.sessionService.user();
    return user ? `${user.first_name} ${user.last_name}`.trim() : 'there';
  });

  readonly roleTag = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return 'Platform Control';
    }
    if (role === 'instructor') {
      return 'Teaching Workflow';
    }
    if (role === 'student') {
      return 'Learning Path';
    }
    return 'Workspace';
  });

  readonly heroTitle = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return 'your platform control room is ready.';
    }
    if (role === 'instructor') {
      return 'your teaching studio is ready.';
    }
    if (role === 'student') {
      return 'your learning path is ready.';
    }
    return 'your portal workspace is ready.';
  });

  readonly heroDescription = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return 'Jump straight into approvals, catalog governance, user control, broadcasts, and reporting from one command surface.';
    }
    if (role === 'instructor') {
      return 'Move from course creation to curriculum building, assessments, learner review, and announcements without leaving the portal.';
    }
    if (role === 'student') {
      return 'Resume enrolled courses, keep progress visible, and switch to assignments, quizzes, and notifications in one place.';
    }
    return 'The portal keeps role-specific work organized so you can get to the right page with fewer clicks.';
  });

  readonly heroTags = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return ['Approvals', 'Catalog', 'Users', 'Momentum'];
    }
    if (role === 'instructor') {
      return ['Courses', 'Curriculum', 'Assessments', 'Progress'];
    }
    if (role === 'student') {
      return ['Learning', 'Progress', 'Streak', 'Certificates'];
    }
    return ['Portal', 'Workflow', 'Role-based'];
  });

  readonly hubFocusLabel = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return 'Control today';
    }
    if (role === 'instructor') {
      return 'Build the next lesson';
    }
    if (role === 'student') {
      return 'Finish your next win';
    }
    return 'Keep momentum';
  });

  readonly hubFocusCopy = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return 'Review approvals, catalog changes, and platform activity in one calm command view.';
    }
    if (role === 'instructor') {
      return 'Move from draft to publish with curriculum, assessments, and learner updates ready to go.';
    }
    if (role === 'student') {
      return 'Resume the course that keeps your streak moving and your goals visible.';
    }
    return 'The right portal path is already lined up for your next move.';
  });

  readonly hubFocusIcon = computed(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return 'space_dashboard';
    }
    if (role === 'instructor') {
      return 'auto_awesome';
    }
    if (role === 'student') {
      return 'local_fire_department';
    }
    return 'bolt';
  });

  readonly workflowCards = computed<HubAction[]>(() => {
    const role = this.sessionService.primaryRole();
    if (role === 'admin') {
      return [
        {
          step: '01',
          badge: 'Review',
          title: 'Instructor Reviews',
          description: 'Approve or reject teaching applications before they can publish content.',
          route: '/app/admin/approvals',
          cta: 'approval queue',
          icon: 'verified_user'
        },
        {
          step: '02',
          badge: 'Catalog',
          title: 'Catalog Control',
          description: 'Maintain course metadata, publishing state, and catalog visibility.',
          route: '/app/admin/courses',
          cta: 'catalog',
          icon: 'library_books'
        },
        {
          step: '03',
          badge: 'Govern',
          title: 'User Governance',
          description: 'Manage student and instructor accounts, roles, and access state.',
          route: '/app/admin/users',
          cta: 'users',
          icon: 'groups'
        },
        {
          step: '04',
          badge: 'Structure',
          title: 'Catalog Taxonomy',
          description: 'Keep departments, tags, and category structure tidy and searchable.',
          route: '/app/admin/categories',
          cta: 'taxonomy',
          icon: 'category'
        },
        {
          step: '05',
          badge: 'Report',
          title: 'Platform Reports',
          description: 'Inspect platform health, assessment inventory, and operational throughput.',
          route: '/app/admin/analytics',
          cta: 'reports',
          icon: 'monitoring'
        },
        {
          step: '06',
          badge: 'Broadcast',
          title: 'Platform Broadcasts',
          description: 'Send announcements and keep the portal communication flow consistent.',
          route: '/app/admin/announcements',
          cta: 'broadcasts',
          icon: 'campaign'
        }
      ];
    }

    if (role === 'instructor') {
      return [
        {
          step: '01',
          badge: 'Create',
          title: 'Course Studio',
          description: 'Start a draft, edit course metadata, and manage publishing state.',
          route: '/app/instructor/courses',
          cta: 'course studio',
          icon: 'library_books'
        },
        {
          step: '02',
          badge: 'Build',
          title: 'Curriculum Builder',
          description: 'Organize modules and lessons into a clear teaching sequence.',
          route: '/app/instructor/content',
          cta: 'curriculum',
          icon: 'topic'
        },
        {
          step: '03',
          badge: 'Assess',
          title: 'Assessments',
          description: 'Create quizzes and assignments to measure student understanding.',
          route: '/app/instructor/quizzes',
          cta: 'assessments',
          icon: 'quiz'
        },
        {
          step: '04',
          badge: 'Review',
          title: 'Learner Roster',
          description: 'Monitor enrollments, progress, and roster health in one view.',
          route: '/app/instructor/students',
          cta: 'learners',
          icon: 'group'
        },
        {
          step: '05',
          badge: 'Track',
          title: 'Teaching Insights',
          description: 'Measure course performance, completion, and learner momentum.',
          route: '/app/instructor/analytics',
          cta: 'insights',
          icon: 'insights'
        },
        {
          step: '06',
          badge: 'Broadcast',
          title: 'Course Broadcasts',
          description: 'Keep enrolled learners informed with announcements and updates.',
          route: '/app/instructor/announcements',
          cta: 'broadcasts',
          icon: 'notifications_active'
        }
      ];
    }

    return [
      {
        step: '01',
        badge: 'Learn',
        title: 'My Learning',
        description: 'Resume the courses you are enrolled in and continue your next lesson.',
        route: '/app/student/courses',
        cta: 'my learning',
        icon: 'cast_for_education'
      },
      {
        step: '02',
        badge: 'Explore',
        title: 'Browse Catalog',
        description: 'Search for new courses to add to your learning path.',
        route: '/app/student/browse',
        cta: 'catalog',
        icon: 'travel_explore'
      },
      {
        step: '03',
        badge: 'Due',
        title: 'Assignments',
        description: 'Open pending work, submissions, and instructor feedback.',
        route: '/app/student/assignments',
        cta: 'assignments',
        icon: 'task'
      },
      {
        step: '04',
        badge: 'Assess',
        title: 'Quizzes',
        description: 'Continue quiz attempts and review available results.',
        route: '/app/student/quizzes',
        cta: 'quizzes',
        icon: 'fact_check'
      },
      {
        step: '05',
        badge: 'Track',
        title: 'Progress',
        description: 'Check completion, momentum, and earned certificates.',
        route: '/app/student/progress',
        cta: 'progress',
        icon: 'timeline'
      },
      {
        step: '06',
        badge: 'Updates',
        title: 'Notifications',
        description: 'Review the latest course announcements and platform notices.',
        route: '/app/student/notifications',
        cta: 'notifications',
        icon: 'notifications'
      }
    ];
  });
}
