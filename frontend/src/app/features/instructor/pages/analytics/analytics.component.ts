import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

import type { CourseListItem, EnrollmentStats, InstructorDashboardStats } from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-instructor-analytics',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Teaching Analytics"
        description="Understand course performance, student load, enrollment health, and assessment coverage across your teaching portfolio.">
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="page-grid">
        @for (card of portfolioCards(); track card.label) {
          <mat-card class="stat-card stat-card--metric">
            <mat-card-content>
              <p class="metric-card__label">{{ card.label }}</p>
              <strong class="metric-card__value">{{ card.value }}</strong>
              <span class="metric-card__hint">{{ card.hint }}</span>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="courseForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Course Drilldown</mat-label>
              <mat-select formControlName="course_id">
                @for (course of courses(); track course.id) {
                  <mat-option [value]="course.id">{{ course.title }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-flat-button color="primary" type="button" (click)="loadCourseStats()">Refresh Course Metrics</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <div class="page-grid">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Course Enrollment Snapshot</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-cluster">
              <div>
                <strong>{{ courseStats()?.total_enrollments ?? 0 }}</strong>
                <span>Total enrollments</span>
              </div>
              <div>
                <strong>{{ courseStats()?.active_enrollments ?? 0 }}</strong>
                <span>Active learners</span>
              </div>
              <div>
                <strong>{{ courseStats()?.completed_enrollments ?? 0 }}</strong>
                <span>Completed learners</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Retention Signals</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-cluster">
              <div>
                <strong>{{ courseStats()?.dropped_enrollments ?? 0 }}</strong>
                <span>Dropped</span>
              </div>
              <div>
                <strong>{{ courseStats()?.suspended_enrollments ?? 0 }}</strong>
                <span>Suspended</span>
              </div>
              <div>
                <strong>{{ completionRate() }}%</strong>
                <span>Completion rate</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
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
      font-size: clamp(1.8rem, 2vw, 2.4rem);
      letter-spacing: -0.04em;
    }

    .metric-card__hint {
      margin-top: 0.55rem;
      color: var(--muted);
    }

    .metric-cluster {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }

    .metric-cluster div {
      display: grid;
      gap: 0.35rem;
    }

    .metric-cluster strong {
      font-size: 1.8rem;
      letter-spacing: -0.04em;
    }

    .metric-cluster span {
      color: var(--muted);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly dashboardStats = signal<InstructorDashboardStats | null>(null);
  readonly courseStats = signal<EnrollmentStats | null>(null);
  readonly courses = signal<CourseListItem[]>([]);
  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  readonly completionRate = computed(() => {
    const stats = this.courseStats();
    if (!stats?.total_enrollments) {
      return 0;
    }
    return Math.round((stats.completed_enrollments / stats.total_enrollments) * 100);
  });

  readonly portfolioCards = computed(() => {
    const stats = this.dashboardStats();
    if (!stats) {
      return [];
    }
    return [
      { label: 'Courses', value: String(stats.total_courses), hint: `${stats.published_courses} currently published` },
      { label: 'Students', value: String(stats.total_students), hint: 'Unique learners reached' },
      { label: 'Assignments', value: String(stats.total_assignments), hint: 'Authoring workload in the portfolio' },
      { label: 'Quizzes', value: String(stats.total_quizzes), hint: 'Live assessment inventory' },
      { label: 'Avg Progress', value: `${stats.average_student_progress_percentage.toFixed(1)}%`, hint: 'Average progress across your learners' }
    ];
  });

  constructor() {
    forkJoin({
      stats: this.instructorPortalService.getDashboardStats(),
      courses: this.instructorPortalService.listMyCourses()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, courses }) => {
          this.dashboardStats.set(stats);
          this.courses.set(courses.items);
          const first = courses.items[0]?.id ?? '';
          this.courseForm.patchValue({ course_id: first });
          this.loading.set(false);
          if (first) {
            this.loadCourseStats();
          }
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load instructor analytics.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadCourseStats(): void {
    const courseId = this.courseForm.getRawValue().course_id;
    if (!courseId) {
      return;
    }
    this.instructorPortalService.getEnrollmentStats(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => this.courseStats.set(stats),
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load course analytics.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
