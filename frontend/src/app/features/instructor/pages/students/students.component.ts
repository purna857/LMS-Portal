import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import type {
  CourseListItem,
  EnrollmentStats,
  StudentCourseProgress,
  StudentEnrollment
} from '@app/features/instructor/models/instructor.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForUserStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-instructor-students',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Learner Roster"
        description="Track roster health, enrollment distribution, and learning progress across your courses.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="courseForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Course</mat-label>
              <mat-select formControlName="course_id">
                @for (course of courses(); track course.id) {
                  <mat-option [value]="course.id">{{ course.title }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-flat-button color="primary" type="button" (click)="loadStudents()">Refresh</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="page-grid">
        <mat-card class="stat-card stat-card--metric">
          <mat-card-content>
            <p class="metric-card__label">Total Enrollments</p>
            <strong class="metric-card__value">{{ stats()?.total_enrollments ?? 0 }}</strong>
            <span class="metric-card__hint">Learners currently attached to the selected course</span>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card stat-card--metric">
          <mat-card-content>
            <p class="metric-card__label">Active</p>
            <strong class="metric-card__value">{{ stats()?.active_enrollments ?? 0 }}</strong>
            <span class="metric-card__hint">Students actively progressing through the course</span>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card stat-card--metric">
          <mat-card-content>
            <p class="metric-card__label">Completed</p>
            <strong class="metric-card__value">{{ stats()?.completed_enrollments ?? 0 }}</strong>
            <span class="metric-card__hint">Learners who have reached the completion milestone</span>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card stat-card--metric">
          <mat-card-content>
            <p class="metric-card__label">Dropped / Suspended</p>
            <strong class="metric-card__value">{{ (stats()?.dropped_enrollments ?? 0) + (stats()?.suspended_enrollments ?? 0) }}</strong>
            <span class="metric-card__hint">Enrolment records no longer in an active state</span>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="student-layout">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Roster</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (filteredStudents().length) {
              <div class="table-wrap">
                <table mat-table [dataSource]="filteredStudents()" class="data-table">
                  <ng-container matColumnDef="student">
                    <th mat-header-cell *matHeaderCellDef>Student</th>
                    <td mat-cell *matCellDef="let student">
                      <div class="cell-title">
                        <strong>{{ student.student_name }}</strong>
                        <span>{{ student.student_email }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let student">
                      <mat-chip-set>
                        <mat-chip [attr.data-tone]="chipToneForUserStatus(student.status)">{{ student.status }}</mat-chip>
                      </mat-chip-set>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="dates">
                    <th mat-header-cell *matHeaderCellDef>Timeline</th>
                    <td mat-cell *matCellDef="let student">
                      {{ student.enrolled_at ? (student.enrolled_at | date:'mediumDate') : 'N/A' }}
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="studentColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: studentColumns"></tr>
                </table>
              </div>
            } @else if (students().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching students' : 'No enrollments found'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different name, email, status, or progress keyword.' : 'Enrollments for the selected course will appear here.'">
              </app-empty-state>
            } @else {
              <app-empty-state
                icon="group"
                title="No enrollments found"
                description="Enrollments for the selected course will appear here.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Progress Snapshot</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (filteredProgress().length) {
              <div class="stack-list">
                @for (item of filteredProgress(); track item.enrollment_id) {
                  <div class="stack-list__item">
                    <div>
                      <strong>{{ item.student_name }}</strong>
                      <p>{{ item.completed_lessons }}/{{ item.total_lessons }} lessons completed</p>
                    </div>
                    <div class="progress-box">
                      <strong>{{ item.progress_percentage }}%</strong>
                      <span>{{ item.progress_status }}</span>
                    </div>
                  </div>
                }
              </div>
            } @else if (progress().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching progress entries' : 'No progress yet'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different student name or progress keyword.' : 'Student progress will appear here once lessons are completed.'">
              </app-empty-state>
            } @else {
              <app-empty-state
                icon="timeline"
                title="No progress yet"
                description="Student progress will appear here once lessons are completed.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .student-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
      gap: 1.25rem;
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
      margin: 0.35rem 0 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .progress-box {
      display: grid;
      justify-items: end;
      color: var(--muted);
    }

    .progress-box strong {
      color: var(--text);
      font-size: 1.2rem;
    }

    @media (max-width: 720px) {
      .stack-list__item {
        grid-template-columns: 1fr;
      }

      .stack-list__item > :last-child {
        justify-self: start;
      }
    }

    @media (max-width: 1100px) {
      .student-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentsComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspaceSearch = inject(WorkspaceSearchService);
  private readonly route = inject(ActivatedRoute);

  readonly courses = signal<CourseListItem[]>([]);
  readonly students = signal<StudentEnrollment[]>([]);
  readonly progress = signal<StudentCourseProgress[]>([]);
  readonly stats = signal<EnrollmentStats | null>(null);
  readonly loading = signal(false);
  readonly studentColumns = ['student', 'status', 'dates'];
  readonly chipToneForUserStatus = chipToneForUserStatus;
  readonly filteredStudents = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.students();
    }

    return this.students().filter((student) =>
      this.workspaceSearch.matches(
        student.student_name,
        student.student_email,
        student.status,
        student.enrolled_at,
        student.started_at,
        student.completed_at
      )
    );
  });
  readonly filteredProgress = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.progress();
    }

    return this.progress().filter((item) =>
      this.workspaceSearch.matches(
        item.student_name,
        item.student_email,
        item.progress_status,
        `${item.completed_lessons}/${item.total_lessons}`,
        `${item.progress_percentage}%`
      )
    );
  });
  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  constructor() {
    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        this.students.set([]);
        this.progress.set([]);
        this.stats.set(null);
        if (courseId) {
          this.loadStudents();
        }
      });

    this.instructorPortalService.listMyCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.items);
          const preferredCourseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';
          const selectedCourseId = response.items.find((course) => course.id === preferredCourseId)?.id ?? response.items[0]?.id ?? '';
          this.courseForm.patchValue({ course_id: selectedCourseId });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load instructor courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadStudents(): void {
    const courseId = this.courseForm.getRawValue().course_id;
    if (!courseId) {
      return;
    }
    this.loading.set(true);
    forkJoin({
      students: this.instructorPortalService.listEnrolledStudents(courseId),
      progress: this.instructorPortalService.listStudentProgress(courseId),
      stats: this.instructorPortalService.getEnrollmentStats(courseId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ students, progress, stats }) => {
          this.students.set(students.items);
          this.progress.set(progress.items);
          this.stats.set(stats);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load student data.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
