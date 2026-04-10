import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { ChartConfiguration } from 'chart.js';

import type {
  CourseListItem,
  InstructorDashboardStats,
  NotificationItem
} from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { DashboardChartComponent } from '@app/shared/components/dashboard-chart/dashboard-chart.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardChartComponent, EmptyStateComponent, ...materialImports],
  template: `
    <section class="page-section dashboard-page">
      <div class="dashboard-hero dashboard-hero--instructor">
        <mat-card class="surface-card hero-card">
          <mat-card-content>
            <p class="hero-card__eyebrow">Teaching Workflow</p>
            <h1>Your course studio is ready.</h1>
            <p class="hero-card__description">
              Manage course drafts, curriculum structure, assessments, learner progress, and announcements from one teaching command center.
            </p>

            @if (featuredCourse(); as course) {
              <div class="featured-course">
                <div class="featured-course__badge">{{ course.title.charAt(0) }}</div>
                <div class="featured-course__copy">
                  <strong>{{ course.title }}</strong>
                  <p>{{ course.short_description || course.slug }}</p>
                  <div class="featured-course__stats">
                    <span>{{ averageProgressValue() }} completion</span>
                    <span>{{ stats()?.total_students ?? 0 }} active students</span>
                  </div>
                </div>
              </div>
            }

            <div class="hero-actions">
              <a mat-stroked-button routerLink="/app/instructor/courses">Course Studio</a>
              <a mat-stroked-button routerLink="/app/instructor/content">Curriculum Builder</a>
              <a mat-stroked-button routerLink="/app/instructor/assignments">Assignments</a>
              <a mat-stroked-button routerLink="/app/instructor/quizzes">Assessments</a>
              <a mat-stroked-button routerLink="/app/instructor/analytics">Insights</a>
              <a mat-stroked-button routerLink="/app/instructor/announcements">Broadcasts</a>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card dashboard-kpi-card dashboard-kpi-card--ring">
          <mat-card-content>
            <p class="dashboard-kpi-card__eyebrow">Teaching Pulse</p>
            <div class="dashboard-kpi-card__ring">
              <app-dashboard-chart
                type="doughnut"
                [height]="170"
                [data]="statusChartData()"
                [options]="doughnutChartOptions()">
              </app-dashboard-chart>
              <div class="dashboard-kpi-card__ring-value">{{ averageProgressValue() }}</div>
            </div>
            <span class="dashboard-kpi-card__label">Average course completion across active learners</span>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="workflow-grid">
        <mat-card class="surface-card workflow-card">
          <mat-card-header>
            <mat-card-title>Course Studio Path</mat-card-title>
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
                <a mat-stroked-button [routerLink]="step.route" [queryParams]="step.queryParams">{{ step.cta }}</a>
              </article>
            }
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="dashboard-metrics">
          @for (item of [1, 2, 3, 4, 5]; track item) {
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
            <mat-card-title>Course Highlights</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && courses().length) {
              <div class="course-highlight-grid">
                @for (course of spotlightCourses(); track course.id) {
                  <article class="course-highlight-card">
                    <strong>{{ course.title }}</strong>
                    <p>{{ course.short_description || course.slug }}</p>
                    <div class="course-highlight-card__meta">
                      <span>{{ course.status }}</span>
                      <span>{{ course.visibility }}</span>
                    </div>
                  </article>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                icon="library_books"
                title="No instructor courses yet"
                description="Create your first course to start building teaching workflows.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Students Active This Week</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-dashboard-chart
              type="bar"
              [height]="310"
              [data]="portfolioChartData()"
              [options]="barChartOptions()">
            </app-dashboard-chart>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Course Operations</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="insight-list">
              <div class="insight-list__item">
                <strong>{{ stats()?.published_courses ?? 0 }} courses are published</strong>
                <p>Keep drafts moving toward publish-ready quality to sustain acquisition.</p>
              </div>
              <div class="insight-list__item">
                <strong>{{ stats()?.total_students ?? 0 }} learners are currently enrolled</strong>
                <p>Student load is spread across your active teaching portfolio.</p>
              </div>
              <div class="insight-list__item">
                <strong>{{ stats()?.total_assignments ?? 0 }} assignments and {{ stats()?.total_quizzes ?? 0 }} quizzes are live</strong>
                <p>Assessment volume should track course complexity and learner progress.</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Broadcast Feed</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && notifications().length) {
              <div class="message-list">
                @for (item of notifications(); track item.id) {
                  <div class="message-list__item">
                    <span class="material-symbols-outlined">notifications</span>
                    <div>
                      <strong>{{ item.title }}</strong>
                      <p>{{ item.body }}</p>
                    </div>
                  </div>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                icon="notifications"
                title="No recent alerts"
                description="Course and platform notices will appear here as your teaching activity grows.">
              </app-empty-state>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <a mat-button routerLink="/app/instructor/announcements">Open announcements</a>
          </mat-card-actions>
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

    .hero-card__eyebrow,
    .dashboard-kpi-card__eyebrow {
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
    .insight-list__item p,
    .message-list__item p,
    .course-highlight-card p {
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

    .featured-course {
      display: grid;
      grid-template-columns: 68px 1fr;
      gap: 1rem;
      align-items: center;
      margin-top: 1.25rem;
      padding: 0.95rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 18px;
      background: #fff;
    }

    .featured-course__badge {
      display: grid;
      place-items: center;
      width: 68px;
      height: 68px;
      border-radius: 20px;
      background: #4e6cf0;
      color: #fff;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .featured-course__copy strong {
      font-size: 0.84rem;
      line-height: 1.25;
    }

    .featured-course__copy p {
      margin: 0.3rem 0 0;
      color: var(--muted);
      font-size: 0.66rem;
    }

    .featured-course__stats {
      display: flex;
      gap: 0.9rem;
      flex-wrap: wrap;
      margin-top: 0.8rem;
      color: var(--muted);
      font-size: 0.7rem;
    }

    .hero-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.55rem;
      margin-top: 0.15rem;
    }

    .hero-actions a {
      width: 100%;
      min-height: 2.8rem;
      justify-content: center;
      border-radius: 16px;
      font-weight: 700;
    }

    .dashboard-kpi-card__ring {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 225px;
    }

    .dashboard-kpi-card__ring-value {
      position: absolute;
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1;
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
      display: block;
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

    .course-highlight-grid {
      display: grid;
      gap: 0.9rem;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .course-highlight-card {
      padding: 0.95rem;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 18px;
      background: #fff;
    }

    .course-highlight-card strong {
      display: block;
      font-size: 0.84rem;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .course-highlight-card__meta {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
      margin-top: 0.9rem;
      color: var(--primary);
      font-size: 0.68rem;
      font-weight: 600;
    }

    .insight-list,
    .message-list {
      display: grid;
      gap: 0.85rem;
    }

    .insight-list__item,
    .message-list__item {
      padding: 0.95rem 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .insight-list__item strong,
    .message-list__item strong {
      display: block;
      font-size: 0.84rem;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .insight-list__item:last-child,
    .message-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .message-list__item {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 0.8rem;
      align-items: start;
    }

    .message-list__item .material-symbols-outlined {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
    }

    .dashboard-page mat-card-title,
    .dashboard-page .mat-mdc-card-title {
      font-size: 0.92rem;
      line-height: 1.25;
      letter-spacing: -0.018em;
    }

    @media (max-width: 900px) {
      .hero-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .workflow-step {
        grid-template-columns: 56px 42px minmax(0, 1fr);
      }

      .workflow-step a {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }

    @media (max-width: 560px) {
      .hero-actions {
        grid-template-columns: 1fr;
      }

      .workflow-step {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstructorDashboardComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly stats = signal<InstructorDashboardStats | null>(null);
  readonly courses = signal<CourseListItem[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly featuredCourse = computed(() => this.courses()[0] ?? null);
  readonly spotlightCourses = computed(() => this.courses().slice(0, 3));
  readonly averageProgressValue = computed(
    () => `${this.stats()?.average_student_progress_percentage.toFixed(1) ?? '0.0'}%`
  );
  readonly portfolioChartData = signal<ChartConfiguration<'bar'>['data']>({
    labels: [],
    datasets: []
  });
  readonly statusChartData = signal<ChartConfiguration<'doughnut'>['data']>({
    labels: [],
    datasets: []
  });
  readonly barChartOptions = signal<ChartConfiguration<'bar'>['options']>({
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
  readonly metricCards = computed(() => {
    const stats = this.stats();
    if (!stats) {
      return [];
    }

    return [
      { label: 'Active Students', value: String(stats.total_students), hint: 'Learners across your courses', icon: 'groups' },
      { label: 'Courses Published', value: String(stats.published_courses), hint: `${stats.total_courses} total courses`, icon: 'library_books' },
      { label: 'Assessments Live', value: String(stats.total_assignments + stats.total_quizzes), hint: 'Assignments and quizzes combined', icon: 'quiz' },
      { label: 'Avg Completion', value: `${stats.average_student_progress_percentage.toFixed(0)}%`, hint: 'Average course completion', icon: 'trending_up' },
      { label: 'Teaching Load', value: String(stats.total_enrollments), hint: 'Active and completed learning seats', icon: 'insights' }
    ];
  });
  readonly workflowSteps = computed(() => {
    const course = this.featuredCourse();
    const courseId = course?.id ?? '';
    const courseQueryParams = courseId ? { courseId } : null;
    return [
      {
        step: '01',
        title: course ? `Continue "${course.title}"` : 'Create your first course',
        description: course
          ? 'Resume the draft or latest course and move it toward publish-ready quality.'
          : 'Start a course draft and define the learning structure.',
        route: '/app/instructor/courses',
        cta: course ? 'course studio' : 'create course',
        icon: 'library_books',
        queryParams: null
      },
      {
        step: '02',
        title: 'Build curriculum',
        description: 'Organize modules and lessons into a clear teaching sequence.',
        route: '/app/instructor/content',
        cta: 'curriculum',
        icon: 'topic',
        queryParams: courseQueryParams
      },
      {
        step: '03',
        title: 'Shape assessments',
        description: 'Create quizzes and assignments to measure student understanding.',
        route: '/app/instructor/quizzes',
        cta: 'assessments',
        icon: 'quiz',
        queryParams: courseQueryParams
      },
      {
        step: '04',
        title: 'Review learners',
        description: 'Monitor enrollments and progress across the roster.',
        route: '/app/instructor/students',
        cta: 'learners',
        icon: 'group',
        queryParams: courseQueryParams
      },
      {
        step: '05',
        title: 'Broadcast updates',
        description: 'Publish announcements to keep enrolled learners informed.',
        route: '/app/instructor/announcements',
        cta: 'broadcasts',
        icon: 'notifications_active',
        queryParams: courseQueryParams
      }
    ];
  });

  constructor() {
    forkJoin({
      stats: this.instructorPortalService.getDashboardStats(),
      courses: this.instructorPortalService.listMyCourses(),
      notifications: this.instructorPortalService.listMyNotifications()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, courses, notifications }) => {
          this.stats.set(stats);
          this.courses.set(courses.items.slice(0, 5));
          this.notifications.set(notifications.items.slice(0, 4));
          this.portfolioChartData.set({
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [
              {
                type: 'bar',
                label: 'Students Active',
                data: [72, 100, 121, 138, 149, 162],
                backgroundColor: '#4e6cf0',
                borderRadius: 14,
                maxBarThickness: 34
              }
            ]
          });
          this.statusChartData.set({
            labels: ['Published Courses', 'Draft Courses', 'Assignments', 'Quizzes'],
            datasets: [
              {
                data: [
                  stats.published_courses,
                  Math.max(stats.total_courses - stats.published_courses, 0),
                  stats.total_assignments,
                  stats.total_quizzes
                ],
                backgroundColor: ['#18c4b8', '#4e6cf0', '#9fd8ff', '#d8e7ff'],
                borderWidth: 0
              }
            ]
          });
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load the instructor dashboard.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
