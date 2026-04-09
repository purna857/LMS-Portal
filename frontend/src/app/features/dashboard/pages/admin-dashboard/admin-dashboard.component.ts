import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { ChartConfiguration } from 'chart.js';

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
            <p class="hero-card__eyebrow">Admin Control</p>
            <h1>Platform dashboard for growth, approvals, and course health.</h1>
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
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card dashboard-kpi-card dashboard-kpi-card--ring">
          <mat-card-content>
            <p class="dashboard-kpi-card__eyebrow">Platform Seat Mix</p>
            <div class="dashboard-kpi-card__ring">
              <app-dashboard-chart
                type="doughnut"
                [height]="250"
                [data]="distributionChartData()"
                [options]="doughnutChartOptions()">
              </app-dashboard-chart>
              <div class="dashboard-kpi-card__ring-value">{{ activeSeatValue() }}</div>
            </div>
            <span class="dashboard-kpi-card__label">Active and completed learning seats across the platform</span>
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
              [height]="320"
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
              <mat-card-title>Course Watchlist</mat-card-title>
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
              <mat-card-title>Quick Actions</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="action-grid">
                <a mat-flat-button color="primary" routerLink="/app/admin/courses">Manage Courses</a>
                <a mat-flat-button color="primary" routerLink="/app/admin/users">Manage Users</a>
                <a mat-flat-button color="primary" routerLink="/app/admin/approvals">Review Approvals</a>
                <a mat-flat-button color="primary" routerLink="/app/admin/analytics">Open Reports</a>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Recent Activity</mat-card-title>
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
            <mat-card-title>Pending Instructor Reviews</mat-card-title>
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
      font-size: 0.66rem;
      font-weight: 700;
    }

    .hero-card h1 {
      margin: 0;
      font-size: clamp(1.55rem, 2.2vw, 2.2rem);
      letter-spacing: -0.04em;
      line-height: 1.06;
    }

    .hero-card__description,
    .visual-card__summary,
    .stack-list__item p,
    .hero-insights__item p {
      margin: 0.65rem 0 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .hero-insights {
      display: grid;
      gap: 0.85rem;
      margin-top: 1.25rem;
    }

    .hero-insights__item {
      display: grid;
      grid-template-columns: 14px 1fr;
      gap: 0.75rem;
      align-items: start;
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
      min-height: 220px;
    }

    .dashboard-kpi-card__ring-value {
      position: absolute;
      font-size: 1.95rem;
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
      font-size: 1.05rem;
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
      font-size: 0.6rem;
      font-weight: 700;
    }

    .metric-card__value {
      display: block;
      margin-top: 0.9rem;
      font-size: clamp(1.3rem, 1.5vw, 1.7rem);
      letter-spacing: -0.03em;
      line-height: 1.05;
    }

    .metric-card__hint {
      margin-top: 0.45rem;
      color: var(--muted);
      line-height: 1.35;
      font-size: 0.72rem;
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
      font-size: 0.68rem;
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
      font-size: 0.82rem;
    }

    .activity-list__meta {
      text-align: right;
    }

    @media (max-width: 1080px) {
      .dashboard-split--wide {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .action-grid {
        grid-template-columns: 1fr;
      }
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
  readonly activeSeatValue = signal('0');
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
      tooltip: { backgroundColor: '#162033', titleFont: { family: 'IBM Plex Serif' }, bodyFont: { family: 'IBM Plex Serif' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#627187', font: { family: 'IBM Plex Serif' } } },
      y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.16)' }, ticks: { color: '#627187', font: { family: 'IBM Plex Serif' } } }
    }
  });
  readonly doughnutChartOptions = signal<ChartConfiguration<'doughnut'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#162033', titleFont: { family: 'IBM Plex Serif' }, bodyFont: { family: 'IBM Plex Serif' } }
    }
  });

  constructor() {
    this.loadDashboard();
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
}
