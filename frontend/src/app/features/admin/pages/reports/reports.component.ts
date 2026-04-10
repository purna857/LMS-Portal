import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import type { AdminAssignmentTrackerItem, AdminDashboardStats } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
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
              <p class="metric-card__label">{{ card.label }}</p>
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
              [title]="workspaceSearch.normalizedQuery() ? 'No matching assignments' : 'Assignment activity will appear here'"
              [description]="workspaceSearch.normalizedQuery() ? 'Try a different assignment title, course, student, or status.' : 'Assignment submissions will appear here once students start turning in work.'">
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

      <mat-card class="visual-card">
        <mat-card-header>
          <mat-card-title>Executive Snapshot</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="mini-chart">
            @for (height of [40, 64, 58, 72, 84, 76]; track height) {
              <div class="mini-chart__bar" [style.height.%]="height"></div>
            }
          </div>
          <p class="visual-card__summary">Publishing coverage, active enrollment utilization, and assessment volume all indicate healthy platform momentum.</p>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .metric-card__label,
    .metric-card__hint {
      display: block;
    }

    .metric-card__label {
      margin-bottom: 0.65rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .metric-card__value {
      display: block;
      font-size: clamp(1.7rem, 2vw, 2.4rem);
      letter-spacing: -0.04em;
    }

    .metric-card__hint {
      margin-top: 0.55rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .progress-copy {
      display: grid;
      gap: 0.25rem;
      margin-bottom: 1rem;
    }

    .progress-copy strong {
      font-size: 2rem;
    }

    .progress-copy span,
    .report-cell span {
      color: var(--muted);
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

    .visual-card__summary {
      margin: 1rem 0 0;
      color: var(--muted);
      line-height: 1.6;
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
      .stack-list__item {
        grid-template-columns: 1fr;
      }

      .stack-list__item > :last-child {
        justify-self: start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent {
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(true);
  readonly stats = signal<AdminDashboardStats | null>(null);
  readonly assignmentTracker = signal<AdminAssignmentTrackerItem[]>([]);
  readonly filteredAssignmentTracker = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.assignmentTracker();
    }

    return this.assignmentTracker().filter((item) =>
      this.workspaceSearch.matches(
        item.assignment_title,
        item.course_title,
        item.student_name,
        item.student_email,
        item.status,
        item.feedback,
        item.submission_file_name
      )
    );
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
      { label: 'Total Students', value: String(stats.total_students), hint: 'Learners onboarded into the LMS' },
      { label: 'Total Instructors', value: String(stats.total_instructors), hint: 'Teaching capacity available' },
      { label: 'Pending Approvals', value: String(stats.pending_approvals), hint: 'Applications waiting on admin review' },
      { label: 'Published Courses', value: String(stats.published_courses), hint: `${stats.total_courses} courses exist in total` }
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
}
