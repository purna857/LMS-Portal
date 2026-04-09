import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

import type {
  CourseListItem,
  EnrollmentStats,
  StudentCourseProgress,
  StudentEnrollment
} from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-instructor-students',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Students & Enrollments"
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
        <mat-card class="stat-card">
          <strong>Total Enrollments</strong>
          <p>{{ stats()?.total_enrollments ?? 0 }}</p>
        </mat-card>
        <mat-card class="stat-card">
          <strong>Active</strong>
          <p>{{ stats()?.active_enrollments ?? 0 }}</p>
        </mat-card>
        <mat-card class="stat-card">
          <strong>Completed</strong>
          <p>{{ stats()?.completed_enrollments ?? 0 }}</p>
        </mat-card>
        <mat-card class="stat-card">
          <strong>Dropped / Suspended</strong>
          <p>{{ (stats()?.dropped_enrollments ?? 0) + (stats()?.suspended_enrollments ?? 0) }}</p>
        </mat-card>
      </div>

      <div class="student-layout">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Roster</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (students().length) {
              <div class="table-wrap">
                <table mat-table [dataSource]="students()" class="data-table">
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
                        <mat-chip>{{ student.status }}</mat-chip>
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
            @if (progress().length) {
              <div class="stack-list">
                @for (item of progress(); track item.enrollment_id) {
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
      gap: 0.85rem;
    }

    .stack-list__item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--border);
    }

    .stack-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .stack-list__item p {
      margin: 0.35rem 0 0;
      color: var(--muted);
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

  readonly courses = signal<CourseListItem[]>([]);
  readonly students = signal<StudentEnrollment[]>([]);
  readonly progress = signal<StudentCourseProgress[]>([]);
  readonly stats = signal<EnrollmentStats | null>(null);
  readonly loading = signal(false);
  readonly studentColumns = ['student', 'status', 'dates'];
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
          const first = response.items[0]?.id ?? '';
          this.courseForm.patchValue({ course_id: first });
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
