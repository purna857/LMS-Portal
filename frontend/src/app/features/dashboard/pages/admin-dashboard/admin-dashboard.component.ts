import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import type { ChartConfiguration } from 'chart.js';
import { catchError } from 'rxjs/operators';

import type {
  AdminDashboardStats,
  AdminUserListItem,
  CourseListItem,
  InstructorApprovalItem
} from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { DashboardChartComponent } from '@app/shared/components/dashboard-chart/dashboard-chart.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardChartComponent, EmptyStateComponent, ...materialImports],
  template: `
    <section class="page-section dashboard-page">
      <div class="dashboard-hero dashboard-hero--admin">
        <mat-card class="surface-card hero-card">
          <mat-card-content>
            <p class="hero-card__eyebrow">Platform Control</p>
            <h1>Your admin control room is ready.</h1>
            <p class="hero-card__description">
              Review users, instructor approvals, enrollments, course publishing, and platform activity from one command center.
            </p>

            <div class="hero-insights">
              <div class="hero-insights__item">
                <span class="hero-insights__dot hero-insights__dot--teal"></span>
                <div>
                  <strong>{{ stats()?.pending_approvals ?? 0 }} pending approvals</strong>
                  <p>Instructor onboarding requests waiting for review.</p>
                </div>
              </div>
              <div class="hero-insights__item">
                <span class="hero-insights__dot hero-insights__dot--blue"></span>
                <div>
                  <strong>{{ stats()?.published_courses ?? 0 }} live courses</strong>
                  <p>Published inventory currently visible to learners.</p>
                </div>
              </div>
              <div class="hero-insights__item">
                <span class="hero-insights__dot hero-insights__dot--teal"></span>
                <div>
                  <strong>{{ (stats()?.total_students ?? 0) + (stats()?.total_instructors ?? 0) }} active users</strong>
                  <p>Students and instructors currently active on the platform.</p>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card dashboard-kpi-card dashboard-kpi-card--ring">
          <mat-card-content>
            <p class="dashboard-kpi-card__eyebrow">Platform Seat Mix</p>
            <div class="dashboard-kpi-card__ring">
              <app-dashboard-chart
                type="doughnut"
                [height]="170"
                [data]="distributionChartData()"
                [options]="doughnutChartOptions()">
              </app-dashboard-chart>
              <div class="dashboard-kpi-card__ring-value">{{ activeSeatValue() }}</div>
            </div>
            <span class="dashboard-kpi-card__label">Active and completed learning seats across the platform</span>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="workflow-grid">
        <mat-card class="surface-card workflow-card">
          <mat-card-header>
            <mat-card-title>Platform Control Path</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @for (step of workflowSteps(); track step.title) {
              <article class="workflow-step">
                <span class="workflow-step__index">{{ step.step }}</span>
                <span class="workflow-step__icon material-symbols-outlined">{{ step.icon }}</span>
                <div class="workflow-step__copy">
                  <p>{{ step.title }}</p>
                  <strong>{{ step.description }}</strong>
                </div>
                <a mat-stroked-button [routerLink]="step.route">{{ step.cta }}</a>
              </article>
            }
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="dashboard-metrics">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="stat-card skeleton skeleton--card"></div>
          }
        </div>
      }

      <div class="dashboard-metrics">
        @for (card of statCards(); track card.label) {
          <mat-card class="stat-card stat-card--metric">
            <mat-card-content>
              <div class="metric-card__top">
                <span class="metric-card__icon material-symbols-outlined">{{ card.icon }}</span>
                <p class="metric-card__label">{{ card.label }}</p>
              </div>
              <strong class="metric-card__value">{{ card.value }}</strong>
              <span class="metric-card__hint">{{ card.hint }}</span>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <div class="dashboard-split dashboard-split--wide">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Platform Performance Chart</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-dashboard-chart
              type="bar"
              [height]="310"
              [data]="overviewChartData()"
              [options]="barChartOptions()">
            </app-dashboard-chart>
            <p class="visual-card__summary">
              Platform totals reveal where users, courses, enrollments, and assessments are concentrated right now.
            </p>
          </mat-card-content>
        </mat-card>

        <div class="side-stack">
          <mat-card class="surface-card">
            <mat-card-header>
              <mat-card-title>Catalog Watchlist</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (!loading() && recentCourses().length) {
                <div class="stack-list">
                  @for (course of recentCourses(); track course.id) {
                    <div class="stack-list__item">
                    <div>
                      <strong>{{ course.title }}</strong>
                      <p>{{ course.primary_instructor_name || 'Unassigned' }}</p>
                    </div>
                    <div class="mini-badges">
                      <span>{{ enrollmentCount(course.id) }} learners</span>
                      <span>{{ course.status }}</span>
                      <span>{{ course.visibility }}</span>
                    </div>
                    </div>
                  }
                </div>
              } @else if (!loading()) {
                <app-empty-state
                  icon="library_books"
                  title="No courses available"
                  description="Course catalog activity will appear here once content is created.">
                </app-empty-state>
              }
            </mat-card-content>
          </mat-card>

          <mat-card class="surface-card">
            <mat-card-header>
              <mat-card-title>Control Shortcuts</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="action-grid">
                <a mat-flat-button color="primary" routerLink="/app/admin/courses">Catalog Control</a>
                <a mat-flat-button color="primary" routerLink="/app/admin/users">User Governance</a>
                <a mat-flat-button color="primary" routerLink="/app/admin/approvals">Instructor Reviews</a>
                <a mat-flat-button color="primary" routerLink="/app/admin/analytics">Platform Reports</a>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>User Activity</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && recentUsers().length) {
              <div class="activity-list">
                @for (user of recentUsers(); track user.id) {
                  <div class="activity-list__item">
                    <span class="activity-list__icon material-symbols-outlined">person</span>
                    <div>
                      <strong>{{ user.first_name }} {{ user.last_name }}</strong>
                      <p>{{ user.email }}</p>
                    </div>
                    <div class="activity-list__meta">
                      @for (role of user.roles; track role) {
                        <div>{{ role }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                icon="group_off"
                title="No user activity yet"
                description="Recent registrations and account activity will surface here.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Approval Queue</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && pendingApprovals().length) {
              <div class="stack-list">
                @for (approval of pendingApprovals(); track approval.request_id) {
                  <div class="stack-list__item">
                    <div>
                      <strong>{{ approval.first_name }} {{ approval.last_name }}</strong>
                      <p>{{ approval.email }}</p>
                    </div>
                    <mat-chip-set>
                      <mat-chip>{{ approval.approval_status }}</mat-chip>
                    </mat-chip-set>
                  </div>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                icon="verified"
                title="No pending approvals"
                description="Instructor registrations that need attention will appear here.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .dashboard-page {
      font-family: 'IBM Plex Sans', sans-serif;
      color: var(--text-primary);
    }

    .dashboard-page :where(h1, h2, h3, h4, h5, h6, p, span, strong, a, button, label, input, textarea, small, mat-card-title, mat-card-subtitle) {
      font-family: inherit;
    }

    .dashboard-page .material-symbols-outlined,
    .dashboard-page .mat-icon {
      font-family: 'Material Symbols Outlined' !important;
    }

    .hero-card,
    .dashboard-kpi-card,
    .stat-card,
    .surface-card {
      position: relative;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(251, 253, 255, 0.99));
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.045);
      overflow: hidden;
    }

    .hero-card__eyebrow {
      display: inline-flex;
      width: fit-content;
      margin: 0 0 0.45rem;
      padding: 0.34rem 0.72rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.65rem;
      font-weight: 700;
    }

    .hero-card mat-card-content {
      display: grid;
      gap: 0.7rem;
      padding: 1.25rem 1.25rem 1.2rem;
    }

    .hero-card h1 {
      margin: 0;
      font-size: clamp(1.35rem, 1.9vw, 1.9rem);
      letter-spacing: -0.04em;
      line-height: 1.08;
    }

    .hero-card__description,
    .visual-card__summary,
    .stack-list__item p,
    .hero-insights__item p {
      margin: 0.65rem 0 0;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.45;
    }

    .dashboard-kpi-card__label {
      display: block;
      margin-top: 0.5rem;
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.45;
    }

    .hero-insights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.85rem;
      margin-top: 1.15rem;
    }

    .hero-insights__item {
      display: grid;
      grid-template-columns: 14px 1fr;
      gap: 0.75rem;
      align-items: start;
    }

    .hero-insights__item strong {
      display: block;
      font-size: 0.84rem;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .hero-insights__dot {
      width: 14px;
      height: 14px;
      margin-top: 0.25rem;
      border-radius: 999px;
      background: #2563eb;
    }

    .hero-insights__dot--teal {
      background: #18c4b8;
    }

    .hero-insights__dot--blue {
      background: #2563eb;
    }

    .dashboard-kpi-card__ring {
      display: grid;
      gap: 0.8rem;
      align-content: center;
    }

    .dashboard-kpi-card__ring .dashboard-kpi-card__ring {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 225px;
    }

    .dashboard-kpi-card__ring-value {
      position: absolute;
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: -0.05em;
    }

    .metric-card__top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .metric-card__icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1rem;
    }

    .metric-card__label,
    .metric-card__hint {
      display: block;
    }

    .metric-card__label {
      margin: 0;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.58rem;
      font-weight: 700;
    }

    .metric-card__value {
      display: block;
      margin-top: 0.9rem;
      font-size: 0.92rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }

    .metric-card__hint {
      margin-top: 0.45rem;
      color: var(--muted);
      line-height: 1.35;
      font-size: 0.7rem;
    }

    .workflow-grid {
      display: grid;
      gap: 1rem;
    }

    .workflow-card mat-card-content {
      display: grid;
      gap: 0.8rem;
      padding-top: 0.35rem;
    }

    .workflow-step {
      display: grid;
      grid-template-columns: 56px 42px minmax(0, 1fr) auto;
      gap: 0.85rem;
      align-items: center;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(248, 251, 255, 0.95), #ffffff 74%);
    }

    .workflow-step__index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .workflow-step__icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1.05rem;
    }

    .workflow-step__copy {
      min-width: 0;
    }

    .workflow-step__copy p {
      margin: 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.58rem;
      font-weight: 800;
    }

    .workflow-step__copy strong {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.84rem;
      line-height: 1.35;
      letter-spacing: -0.03em;
    }

    .dashboard-split--wide {
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    }

    .side-stack {
      display: grid;
      gap: 1rem;
    }

    .stack-list {
      display: grid;
      gap: 0.75rem;
    }

    .stack-list__item {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.8rem 0;
      border-bottom: 1px solid var(--border);
    }

    .stack-list__item strong {
      display: block;
      font-size: 0.84rem;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .stack-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .mini-badges {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      justify-content: end;
    }

    .mini-badges span {
      padding: 0.28rem 0.55rem;
      border-radius: 999px;
      background: #f3f7ff;
      color: var(--primary);
      font-size: 0.64rem;
      font-weight: 700;
      text-transform: capitalize;
    }

    .action-grid {
      display: grid;
      gap: 0.8rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .activity-list__item p {
      margin: 0.2rem 0 0;
      color: var(--muted);
      font-size: 0.76rem;
    }

    .activity-list__item strong {
      display: block;
      font-size: 0.84rem;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .activity-list__meta {
      text-align: right;
    }

    @media (max-width: 1080px) {
      .dashboard-split--wide {
        grid-template-columns: 1fr;
      }

      .hero-insights {
        grid-template-columns: 1fr;
      }

      .workflow-step {
        grid-template-columns: 56px 42px minmax(0, 1fr);
      }

      .workflow-step a {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }

    @media (max-width: 720px) {
      .action-grid {
        grid-template-columns: 1fr;
      }

      .workflow-step {
        grid-template-columns: 1fr;
      }
    }

    .dashboard-page mat-card-title,
    .dashboard-page .mat-mdc-card-title {
      font-size: 0.92rem;
      line-height: 1.25;
      letter-spacing: -0.018em;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent {
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly stats = signal<AdminDashboardStats | null>(null);
  readonly recentUsers = signal<AdminUserListItem[]>([]);
  readonly pendingApprovals = signal<InstructorApprovalItem[]>([]);
  readonly recentCourses = signal<CourseListItem[]>([]);
  readonly recentCourseEnrollmentCounts = signal<Record<string, number>>({});
  readonly activeSeatValue = signal('0');
  readonly workflowSteps = computed(() => {
    const pendingApprovals = this.stats()?.pending_approvals ?? 0;
    return [
      {
        step: '01',
        title: pendingApprovals
          ? `${pendingApprovals} instructor request${pendingApprovals === 1 ? '' : 's'} waiting`
          : 'Review instructor approvals',
        description: pendingApprovals
          ? 'Clear the approval queue so new instructors can publish content.'
          : 'Check the approval queue for incoming teaching applications.',
        route: '/app/admin/approvals',
        cta: 'approval queue',
        icon: 'verified_user'
      },
      {
        step: '02',
        title: 'Catalog control',
        description: 'Adjust course metadata, publishing state, and catalog visibility.',
        route: '/app/admin/courses',
        cta: 'catalog',
        icon: 'library_books'
      },
      {
        step: '03',
        title: 'User governance',
        description: 'Manage learner and instructor accounts, status, and access.',
        route: '/app/admin/users',
        cta: 'users',
        icon: 'groups'
      },
      {
        step: '04',
        title: 'Catalog taxonomy',
        description: 'Keep categories and organization tidy for the LMS catalog.',
        route: '/app/admin/categories',
        cta: 'taxonomy',
        icon: 'category'
      },
      {
        step: '05',
        title: 'Platform reports',
        description: 'Inspect platform health, enrollment, and assessment coverage.',
        route: '/app/admin/analytics',
        cta: 'reports',
        icon: 'monitoring'
      },
      {
        step: '06',
        title: 'Platform broadcasts',
        description: 'Send announcements and operational updates across the LMS.',
        route: '/app/admin/announcements',
        cta: 'broadcasts',
        icon: 'campaign'
      }
    ];
  });
  readonly statCards = computed(() => {
    const stats = this.stats();
    if (!stats) {
      return [];
    }

    return [
      { label: 'Total Users', value: String(stats.total_students + stats.total_instructors), hint: 'Students and instructors combined', icon: 'groups' },
      { label: 'Active Students Today', value: String(stats.total_students), hint: 'Current learner base', icon: 'school' },
      { label: 'Total Courses', value: String(stats.total_courses), hint: `${stats.published_courses} published courses live`, icon: 'library_books' },
      { label: 'Monthly Activity', value: String(stats.total_enrollments), hint: `${stats.active_enrollments} active learning seats`, icon: 'monitoring' }
    ];
  });
  readonly overviewChartData = signal<ChartConfiguration<'bar' | 'line'>['data']>({
    labels: [],
    datasets: []
  });
  readonly distributionChartData = signal<ChartConfiguration<'doughnut'>['data']>({
    labels: [],
    datasets: []
  });
  readonly barChartOptions = signal<ChartConfiguration<'bar' | 'line'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#162033', titleFont: { family: 'IBM Plex Sans' }, bodyFont: { family: 'IBM Plex Sans' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } } },
      y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.16)' }, ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } } }
    }
  });
  readonly doughnutChartOptions = signal<ChartConfiguration<'doughnut'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#162033', titleFont: { family: 'IBM Plex Sans' }, bodyFont: { family: 'IBM Plex Sans' } }
    }
  });

  constructor() {
    this.loadDashboard();
  }

  enrollmentCount(courseId: string): number {
    return this.recentCourseEnrollmentCounts()[courseId] ?? 0;
  }

  private loadDashboard(): void {
    this.loading.set(true);
    forkJoin({
      stats: this.adminPortalService.getAdminDashboardStats(),
      users: this.adminPortalService.listUsers({ limit: 5, offset: 0 }),
      approvals: this.adminPortalService.listInstructorApprovals('submitted'),
      courses: this.adminPortalService.listCourses({ limit: 5, offset: 0 })
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, users, approvals, courses }) => {
          this.stats.set(stats);
          this.recentUsers.set(users.items);
          this.pendingApprovals.set(approvals.items.slice(0, 5));
          this.recentCourses.set(courses.items.slice(0, 4));
          this.loadRecentCourseEnrollmentCounts(courses.items.slice(0, 4));
          this.activeSeatValue.set(String(stats.active_enrollments));
          this.overviewChartData.set({
            labels: ['Students', 'Instructors', 'Courses', 'Enrollments', 'Assignments', 'Quizzes'],
            datasets: [
              {
                type: 'bar',
                data: [
                  stats.total_students,
                  stats.total_instructors,
                  stats.total_courses,
                  stats.total_enrollments,
                  stats.total_assignments,
                  stats.total_quizzes
                ],
                backgroundColor: '#4e6cf0',
                borderRadius: 14,
                maxBarThickness: 34
              },
              {
                type: 'line',
                data: [
                  Math.round(stats.total_students * 0.35),
                  Math.round(stats.total_instructors * 18),
                  Math.round(stats.total_courses * 0.45),
                  Math.round(stats.total_enrollments * 0.22),
                  Math.round(stats.total_assignments * 0.9),
                  Math.round(stats.total_quizzes * 0.95)
                ],
                borderColor: '#18c4b8',
                backgroundColor: 'rgba(24, 196, 184, 0.10)',
                fill: true,
                pointRadius: 0,
                tension: 0.42
              }
            ]
          });
          this.distributionChartData.set({
            labels: ['Published Courses', 'Unpublished Courses', 'Active Enrollments', 'Pending Approvals'],
            datasets: [
              {
                data: [
                  stats.published_courses,
                  Math.max(stats.total_courses - stats.published_courses, 0),
                  stats.active_enrollments,
                  stats.pending_approvals
                ],
                backgroundColor: ['#18c4b8', '#9fd8ff', '#4e6cf0', '#d8e7ff'],
                borderWidth: 0
              }
            ]
          });
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load admin dashboard.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  private loadRecentCourseEnrollmentCounts(courses: CourseListItem[]): void {
    if (!courses.length) {
      this.recentCourseEnrollmentCounts.set({});
      return;
    }

    forkJoin(
      courses.map((course) =>
        this.adminPortalService.getEnrollmentStats(course.id).pipe(
          catchError(() =>
            of({
              total_enrollments: 0,
              active_enrollments: 0,
              completed_enrollments: 0,
              dropped_enrollments: 0,
              suspended_enrollments: 0
            })
          )
        )
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((stats) => {
        const counts = courses.reduce<Record<string, number>>((result, course, index) => {
          result[course.id] = stats[index]?.total_enrollments ?? 0;
          return result;
        }, {});
        this.recentCourseEnrollmentCounts.set(counts);
      });
  }
}
