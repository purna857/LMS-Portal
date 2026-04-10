import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import type { AdminAssignmentTrackerItem, AdminDashboardStats } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForSubmissionStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Platform Reports"
        description="Track platform health, teaching capacity, assessment coverage, and operational throughput from one reporting view.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-content class="snapshot-toolbar">
          <div>
            <p class="snapshot-toolbar__eyebrow">Analytics Window</p>
            <h2>Executive Snapshot</h2>
            <span>Current metrics are generated from the existing admin analytics feed.</span>
          </div>

          <mat-chip-set>
            <mat-chip highlighted>Current view</mat-chip>
            <mat-chip data-tone="info">Backend-safe</mat-chip>
          </mat-chip-set>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content class="reports-filter-bar">
          <mat-form-field appearance="outline">
            <mat-label>Search assignment activity</mat-label>
            <input
              matInput
              [value]="searchQuery()"
              (input)="setSearchQuery($any($event.target).value ?? '')"
              placeholder="Assignment, course, learner, status, or file" />
          </mat-form-field>

          <div class="reports-filter-bar__actions">
            <button mat-stroked-button type="button" [class.is-active]="timeWindow() === '7d'" (click)="setTimeWindow('7d')">Last 7 days</button>
            <button mat-stroked-button type="button" [class.is-active]="timeWindow() === '30d'" (click)="setTimeWindow('30d')">Last 30 days</button>
            <button mat-flat-button color="primary" type="button" [disabled]="timeWindow() === 'all'" (click)="setTimeWindow('all')">All activity</button>
          </div>
        </mat-card-content>
      </mat-card>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="page-grid">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="stat-card skeleton skeleton--card"></div>
          }
        </div>
      }

      <div class="page-grid">
        @for (card of reportCards(); track card.label) {
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

      <div class="page-grid">
        <mat-card class="visual-card">
          <mat-card-header>
            <mat-card-title>Enrollment Utilization</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="progress-copy">
              <strong>{{ activeEnrollmentRate() }}%</strong>
              <span>of all enrollments are active or completed.</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="activeEnrollmentRate()"></mat-progress-bar>
          </mat-card-content>
        </mat-card>

        <mat-card class="visual-card">
          <mat-card-header>
            <mat-card-title>Publishing Coverage</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="progress-copy">
              <strong>{{ publishedCourseRate() }}%</strong>
              <span>of courses are currently published to learners.</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="publishedCourseRate()"></mat-progress-bar>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="surface-card">
        <mat-card-header>
          <mat-card-title>Core Platform Totals</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="page-grid">
            <div class="report-cell">
              <strong>{{ stats()?.total_students ?? 0 }}</strong>
              <span>Total users currently enrolled as students</span>
            </div>
            <div class="report-cell">
              <strong>{{ stats()?.total_courses ?? 0 }}</strong>
              <span>Courses currently tracked in the catalog</span>
            </div>
            <div class="report-cell">
              <strong>{{ stats()?.total_instructors ?? 0 }}</strong>
              <span>Active instructors available to teach</span>
            </div>
            <div class="report-cell">
              <strong>{{ stats()?.total_enrollments ?? 0 }}</strong>
              <span>Total enrollments represented in the existing analytics feed</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-header>
          <mat-card-title>Assessment Inventory</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="page-grid">
            <div class="report-cell">
              <strong>{{ stats()?.total_assignments ?? 0 }}</strong>
              <span>Assignments published across the platform</span>
            </div>
            <div class="report-cell">
              <strong>{{ stats()?.total_quizzes ?? 0 }}</strong>
              <span>Quizzes active across learning programs</span>
            </div>
            <div class="report-cell">
              <strong>{{ averageAssessmentsPerCourse() }}</strong>
              <span>Average assessments per course</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-header>
          <mat-card-title>Assignment Tracking</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (filteredAssignmentTracker().length) {
            <div class="stack-list">
              @for (item of filteredAssignmentTracker(); track item.submission_id) {
                <div class="stack-list__item">
                  <div>
                    <strong>{{ item.assignment_title }}</strong>
                    <p>{{ item.course_title }} · {{ item.student_name }} · {{ item.student_email }}</p>
                    <mat-chip-set>
                      <mat-chip [attr.data-tone]="chipToneForSubmissionStatus(item.status)">{{ item.status }}</mat-chip>
                      @if (item.score !== null && item.score !== undefined) {
                        <mat-chip data-tone="info">{{ item.score }}/{{ item.max_score }} pts</mat-chip>
                      }
                      @if (item.is_late) {
                        <mat-chip data-tone="danger">Late</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                  <div class="tracker-meta">
                    <span>{{ item.submitted_at | date:'mediumDate' }}</span>
                    @if (item.submission_file_name && item.submission_file_url) {
                      <a [href]="item.submission_file_url" target="_blank" rel="noreferrer">{{ item.submission_file_name }}</a>
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (assignmentTracker().length) {
            <app-empty-state
              icon="search_off"
              [title]="normalizedSearchQuery() ? 'No matching assignments' : 'Assignment activity will appear here'"
              [description]="normalizedSearchQuery() ? 'Try a different assignment title, course, student, or status.' : 'Assignment submissions will appear here once students start turning in work.'">
            </app-empty-state>
          } @else {
            <app-empty-state
              icon="assignment"
              title="Assignment activity will appear here"
              description="Assignment submissions will appear here once students start turning in work.">
            </app-empty-state>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .snapshot-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .snapshot-toolbar__eyebrow {
      margin: 0 0 0.4rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .snapshot-toolbar h2 {
      margin: 0;
      font-size: 1.35rem;
      letter-spacing: -0.04em;
    }

    .snapshot-toolbar span,
    .progress-copy span,
    .report-cell span {
      color: var(--muted);
    }

    .reports-filter-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .reports-filter-bar > .mat-mdc-form-field {
      flex: 1 1 320px;
      min-width: 0;
    }

    .reports-filter-bar__actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .reports-filter-bar__actions .is-active {
      border-color: rgba(37, 99, 235, 0.44);
      color: var(--primary);
      background: rgba(219, 234, 254, 0.55);
    }

    .progress-copy {
      display: grid;
      gap: 0.25rem;
      margin-bottom: 1rem;
    }

    .progress-copy strong {
      font-size: 2rem;
    }

    .report-cell {
      display: grid;
      gap: 0.5rem;
      padding: 1rem 1.15rem;
      border-radius: 22px;
      background: rgba(248, 250, 255, 0.88);
      border: 1px solid var(--border);
    }

    .report-cell strong {
      font-size: 1.8rem;
      letter-spacing: -0.04em;
    }

    .stack-list {
      display: grid;
      gap: 0.9rem;
    }

    .stack-list__item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: start;
      padding: 1rem 1.05rem;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(248, 251, 255, 0.92), #ffffff 72%);
    }

    .stack-list__item p {
      margin: 0.35rem 0 0.75rem;
      color: var(--muted);
      line-height: 1.5;
    }

    .stack-list__item .mat-mdc-chip-set {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .tracker-meta {
      display: grid;
      justify-items: end;
      gap: 0.45rem;
      color: var(--muted);
      font-size: 0.86rem;
    }

    .tracker-meta a {
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
    }

    @media (max-width: 720px) {
      .reports-filter-bar__actions {
        width: 100%;
      }

      .reports-filter-bar__actions > .mat-mdc-button-base {
        flex: 1 1 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent {
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly stats = signal<AdminDashboardStats | null>(null);
  readonly assignmentTracker = signal<AdminAssignmentTrackerItem[]>([]);
  readonly searchQuery = signal('');
  readonly timeWindow = signal<'7d' | '30d' | 'all'>('30d');
  readonly normalizedSearchQuery = computed(() => this.searchQuery().trim().toLowerCase());
  readonly filteredAssignmentTracker = computed(() => {
    const query = this.normalizedSearchQuery();
    const minimumDate = this.minimumVisibleDate();

    return this.assignmentTracker().filter((item) => {
      const matchesDate = !minimumDate || new Date(item.submitted_at).getTime() >= minimumDate;
      const matchesQuery = !query || this.matchesSearch(
        query,
        item.assignment_title,
        item.course_title,
        item.student_name,
        item.student_email,
        item.status,
        item.feedback,
        item.submission_file_name
      );
      return matchesDate && matchesQuery;
    });
  });

  readonly activeEnrollmentRate = computed(() => {
    const stats = this.stats();
    if (!stats?.total_enrollments) {
      return 0;
    }
    return Math.round((stats.active_enrollments / stats.total_enrollments) * 100);
  });

  readonly publishedCourseRate = computed(() => {
    const stats = this.stats();
    if (!stats?.total_courses) {
      return 0;
    }
    return Math.round((stats.published_courses / stats.total_courses) * 100);
  });

  readonly averageAssessmentsPerCourse = computed(() => {
    const stats = this.stats();
    if (!stats?.total_courses) {
      return '0.0';
    }
    return ((stats.total_assignments + stats.total_quizzes) / stats.total_courses).toFixed(1);
  });

  readonly reportCards = computed(() => {
    const stats = this.stats();
    if (!stats) {
      return [];
    }

    return [
      { label: 'Total Users', value: String(stats.total_students + stats.total_instructors), hint: 'Current students and instructors in the platform', icon: 'groups' },
      { label: 'Total Courses', value: String(stats.total_courses), hint: `${stats.published_courses} currently published`, icon: 'library_books' },
      { label: 'Active Instructors', value: String(stats.total_instructors), hint: 'Teaching capacity available right now', icon: 'school' },
      { label: 'Enrollments', value: String(stats.total_enrollments), hint: `${stats.active_enrollments} active or completed`, icon: 'trending_up' }
    ];
  });

  readonly chipToneForSubmissionStatus = chipToneForSubmissionStatus;

  constructor() {
    forkJoin({
      stats: this.adminPortalService.getAdminDashboardStats(),
      tracker: this.adminPortalService.listAssignmentTracker().pipe(
        catchError(() => of({ items: [], total: 0 }))
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, tracker }) => {
          this.stats.set(stats);
          this.assignmentTracker.set(tracker.items.slice(0, 8));
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load analytics.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(String(value).trimStart());
  }

  setTimeWindow(window: '7d' | '30d' | 'all'): void {
    this.timeWindow.set(window);
  }

  private minimumVisibleDate(): number | null {
    const window = this.timeWindow();
    const now = Date.now();
    if (window === '7d') {
      return now - (7 * 24 * 60 * 60 * 1000);
    }
    if (window === '30d') {
      return now - (30 * 24 * 60 * 60 * 1000);
    }
    return null;
  }

  private matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
    return values
      .filter((value): value is string => !!value)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
