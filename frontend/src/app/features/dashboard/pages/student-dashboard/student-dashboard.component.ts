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
  EnrolledCourseItem,
  NotificationItem,
  ProgressSummary,
  StudentAssignmentRecord,
  StudentDashboardStats
} from '@app/features/student/models/student.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { DashboardChartComponent } from '@app/shared/components/dashboard-chart/dashboard-chart.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardChartComponent, EmptyStateComponent, ...materialImports],
  template: `
    <section class="page-section dashboard-page">
      <div class="dashboard-hero dashboard-hero--student">
        <mat-card class="surface-card hero-card">
          <mat-card-content>
            <p class="hero-card__eyebrow">Student Workspace</p>
            <h1>Good afternoon, {{ firstName() }}!</h1>
            <p class="hero-card__description">
              You're on a roll — {{ progressValue() }} toward your current learning goal across active courses.
            </p>

            @if (heroCourses().length) {
              <div class="spotlight-grid">
                @for (course of heroCourses(); track course.enrollment_id) {
                  <article class="spotlight-card">
                    <div class="spotlight-card__meta">
                      <div class="spotlight-card__badge">{{ course.title.charAt(0) }}</div>
                      <div>
                        <strong>{{ course.title }}</strong>
                        <p>{{ course.short_description || course.slug }}</p>
                      </div>
                    </div>
                    <div class="spotlight-card__progress">
                      <div class="spotlight-card__bar">
                        <span [style.width.%]="progressSummary()?.average_progress_percentage ?? 0"></span>
                      </div>
                      <span>{{ progressValue() }}</span>
                    </div>
                    <a mat-flat-button color="primary" [routerLink]="['/app/student/learning', course.course_id]">
                      Continue learning
                    </a>
                  </article>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card dashboard-kpi-card">
          <mat-card-content>
            <div class="dashboard-kpi-card__ring">
              <app-dashboard-chart
                type="doughnut"
                [height]="250"
                [data]="distributionChartData()"
                [options]="doughnutChartOptions()">
              </app-dashboard-chart>
              <div class="dashboard-kpi-card__ring-value">{{ progressValue() }}</div>
            </div>

            <div class="dashboard-kpi-card__list">
              <div class="dashboard-kpi-card__item">
                <strong>{{ stats()?.completed_lessons ?? 0 }} lessons completed</strong>
                <span>Lesson completion is the clearest signal of current learning momentum.</span>
              </div>
              <div class="dashboard-kpi-card__item">
                <strong>{{ stats()?.completed_courses ?? 0 }} completed courses</strong>
                <span>Completed courses move you closer to certificates and long-term mastery.</span>
              </div>
              <div class="dashboard-kpi-card__item">
                <strong>{{ filteredNotifications().length }} recent notifications</strong>
                <span>Stay current with deadlines, grading updates, and course announcements.</span>
              </div>
            </div>
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
        @for (card of metricCards(); track card.label) {
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

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Continue Learning</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && filteredCourses().length) {
              <div class="course-grid">
                @for (course of filteredCourses(); track course.enrollment_id) {
                  <article class="course-grid__card">
                    <div class="course-grid__head">
                      <div class="course-grid__thumb">{{ course.title.charAt(0) }}</div>
                      <div>
                        <strong>{{ course.title }}</strong>
                        <p>{{ course.short_description || course.slug }}</p>
                      </div>
                    </div>
                    <div class="course-grid__foot">
                      <span>{{ progressValue() }} active progress</span>
                      <a mat-button [routerLink]="['/app/student/learning', course.course_id]">Open</a>
                    </div>
                  </article>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                icon="menu_book"
                title="No enrolled courses yet"
                description="Browse the course catalog and enroll to begin your learning journey.">
              </app-empty-state>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <a mat-button routerLink="/app/student/browse">Browse courses</a>
          </mat-card-actions>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Weekly Progress Chart</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-dashboard-chart
              type="bar"
              [height]="310"
              [data]="progressChartData()"
              [options]="barChartOptions()">
            </app-dashboard-chart>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Recommended For You</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && recommendedCourses().length) {
              <div class="recommend-grid">
                @for (course of recommendedCourses(); track course.enrollment_id) {
                  <article class="recommend-grid__card">
                    <span class="recommend-grid__tag">{{ progressValue() }} match</span>
                    <strong>{{ course.title }}</strong>
                    <p>{{ course.short_description || 'Continue this course to maintain your learning streak.' }}</p>
                  </article>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                icon="recommend"
                title="Recommendations will appear here"
                description="As you enroll and progress through courses, tailored suggestions will show up in this area.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Achievements & Notifications</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="achievement-list">
              <div class="achievement-list__item">
                <span class="material-symbols-outlined">workspace_premium</span>
                <div>
                  <strong>{{ stats()?.completed_courses ?? 0 }} course milestones</strong>
                  <p>Keep stacking completions to unlock certificates and long-term goals.</p>
                </div>
              </div>

              @if (latestGradedAssignment(); as gradedAssignment) {
                <div class="achievement-list__item">
                  <span class="material-symbols-outlined">task_alt</span>
                  <div>
                    <strong>{{ gradedAssignment.assignment_title }} graded</strong>
                    <p>
                      {{ gradedAssignment.score ?? 0 }} pts recorded ·
                      {{ gradedAssignment.feedback || 'Open assignments to review the full feedback.' }}
                    </p>
                  </div>
                </div>
              }

              @for (item of filteredNotifications(); track item.id) {
                <div class="achievement-list__item">
                  <span class="material-symbols-outlined">notifications</span>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.body }}</p>
                  </div>
                </div>
              }

              @if (!loading() && !filteredNotifications().length) {
                <app-empty-state
                  icon="notifications"
                  title="No recent updates"
                  description="Course and platform notifications will appear here as they arrive.">
                </app-empty-state>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .dashboard-hero--student {
      align-items: stretch;
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
      font-size: 0.66rem;
      font-weight: 700;
    }

    .hero-card h1 {
      margin: 0;
      font-size: clamp(1.55rem, 2.2vw, 2.2rem);
      letter-spacing: -0.04em;
      line-height: 1.06;
    }

    .hero-card__description {
      max-width: 42rem;
      margin: 0.65rem 0 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .spotlight-grid {
      display: grid;
      gap: 0.9rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 1.15rem;
    }

    .spotlight-card {
      display: grid;
      gap: 0.75rem;
      padding: 0.9rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 18px;
      background: #fff;
    }

    .spotlight-card__meta,
    .course-grid__head {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 0.9rem;
      align-items: center;
    }

    .spotlight-card__badge,
    .course-grid__thumb {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: #4e6cf0;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
    }

    .spotlight-card__meta strong,
    .course-grid__head strong,
    .recommend-grid__card strong,
    .achievement-list__item strong {
      font-size: 0.9rem;
    }

    .spotlight-card__meta p,
    .course-grid__head p,
    .recommend-grid__card p,
    .achievement-list__item p {
      margin: 0.28rem 0 0;
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.45;
    }

    .spotlight-card__progress {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.7rem;
      align-items: center;
    }

    .spotlight-card__bar {
      height: 8px;
      border-radius: 999px;
      background: #e5eefb;
      overflow: hidden;
    }

    .spotlight-card__bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #18c4b8;
    }

    .dashboard-kpi-card__ring {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 220px;
    }

    .dashboard-kpi-card__ring-value {
      position: absolute;
      font-size: 1.9rem;
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

    .course-grid,
    .recommend-grid {
      display: grid;
      gap: 0.9rem;
    }

    .course-grid__card,
    .recommend-grid__card {
      padding: 1rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 18px;
      background: #fff;
    }

    .course-grid__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1rem;
      color: var(--muted);
      font-size: 0.72rem;
    }

    .recommend-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .recommend-grid__tag {
      display: inline-flex;
      width: fit-content;
      margin-bottom: 0.8rem;
      padding: 0.3rem 0.6rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 0.64rem;
      font-weight: 700;
    }

    .achievement-list {
      display: grid;
      gap: 0.85rem;
    }

    .achievement-list__item {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 0.8rem;
      align-items: start;
      padding: 0.9rem 0;
      border-bottom: 1px solid var(--border);
    }

    .achievement-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .achievement-list__item .material-symbols-outlined {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
    }

    @media (max-width: 900px) {
      .spotlight-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentDashboardComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(true);
  readonly stats = signal<StudentDashboardStats | null>(null);
  readonly progressSummary = signal<ProgressSummary | null>(null);
  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly assignmentRecords = signal<StudentAssignmentRecord[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly firstName = signal('Learner');
  readonly progressValue = computed(() => `${this.progressSummary()?.average_progress_percentage.toFixed(1) ?? '0.0'}%`);
  readonly filteredCourses = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    if (!query) {
      return this.enrolledCourses();
    }

    return this.enrolledCourses().filter((course) =>
      [course.title, course.short_description, course.slug]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
  readonly filteredNotifications = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    if (!query) {
      return this.notifications();
    }

    return this.notifications().filter((item) =>
      `${item.title} ${item.body} ${item.notification_type}`
        .toLowerCase()
        .includes(query)
    );
  });
  readonly heroCourses = computed(() => this.filteredCourses().slice(0, 2));
  readonly recommendedCourses = computed(() => this.filteredCourses().slice(0, 3));
  readonly latestGradedAssignment = computed(
    () => this.assignmentRecords().find((item) => item.status === 'graded' || item.score !== null && item.score !== undefined) ?? null
  );
  readonly progressChartData = signal<ChartConfiguration<'bar' | 'line'>['data']>({
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
  readonly metricCards = computed(() => {
    const stats = this.stats();
    const progress = this.progressSummary();
    if (!stats || !progress) {
      return [];
    }

    return [
      { label: 'Courses Enrolled', value: String(stats.total_enrolled_courses), hint: `${stats.in_progress_courses} currently in progress`, icon: 'menu_book' },
      { label: 'Hours Learned This Week', value: `${Math.max(stats.completed_lessons * 2.5, 2.5).toFixed(1)}h`, hint: 'Based on recent completed lesson volume', icon: 'schedule' },
      { label: 'Current Streak', value: `${Math.max(stats.completed_lessons, 1)} days`, hint: 'Steady learning consistency improves completion confidence', icon: 'local_fire_department' },
      { label: 'Avg Score', value: `${progress.average_progress_percentage.toFixed(0)}%`, hint: 'Average progress across active courses', icon: 'workspace_premium' }
    ];
  });

  constructor() {
    forkJoin({
      stats: this.studentPortalService.getDashboardStats(),
      progressSummary: this.studentPortalService.getProgressSummary(),
      enrolledCourses: this.studentPortalService.listEnrolledCourses(),
      notifications: this.studentPortalService.listNotifications().pipe(
        catchError(() => of({ items: [], total: 0 }))
      ),
      assignmentRecords: this.studentPortalService.listMyAssignmentSubmissions().pipe(
        catchError(() => of({ items: [], total: 0 }))
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, progressSummary, enrolledCourses, notifications, assignmentRecords }) => {
          this.stats.set(stats);
          this.progressSummary.set(progressSummary);
          this.enrolledCourses.set(enrolledCourses.items.slice(0, 5));
          this.notifications.set(notifications.items.slice(0, 4));
          this.assignmentRecords.set(assignmentRecords.items);
          this.progressChartData.set({
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [
              {
                type: 'bar',
                label: 'Lessons',
                data: [1, 2, 2.5, 3, 3.5, 4],
                backgroundColor: '#4e6cf0',
                borderRadius: 14,
                maxBarThickness: 34
              },
              {
                type: 'line',
                label: 'Progress',
                data: [0.8, 1.6, 2.1, 2.8, 3.2, 3.8],
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(24, 196, 184, 0.10)',
                tension: 0.42,
                fill: true,
                pointRadius: 0
              }
            ]
          });
          this.distributionChartData.set({
            labels: ['In Progress Courses', 'Completed Courses', 'Remaining Lessons', 'Notifications'],
            datasets: [
              {
                data: [
                  stats.in_progress_courses,
                  stats.completed_courses,
                  Math.max(stats.total_lessons - stats.completed_lessons, 0),
                  notifications.items.length
                ],
                backgroundColor: ['#18c4b8', '#4e6cf0', '#9fd8ff', '#d8e7ff'],
                borderWidth: 0
              }
            ]
          });
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(error.error?.detail ?? 'Unable to load the student dashboard.');
          this.loading.set(false);
          this.snackBar.open(this.errorMessage() ?? 'Unable to load the student dashboard.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
