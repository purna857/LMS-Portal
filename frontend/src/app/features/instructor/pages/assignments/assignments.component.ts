import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { AssignmentDialogComponent } from '@app/features/instructor/components/assignment-dialog/assignment-dialog.component';
import { AssignmentReviewDialogComponent } from '@app/features/instructor/components/assignment-review-dialog/assignment-review-dialog.component';
import type { Assignment, AssignmentSubmission, CourseListItem, CourseModule, Lesson } from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-instructor-assignments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Assignments"
        description="Create assessments, tune due dates, and review learner submissions with grading feedback.">
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
              <button mat-stroked-button type="button" (click)="loadAssignments()">Refresh</button>
              <button mat-flat-button color="primary" type="button" [disabled]="!selectedCourseId()" (click)="openAssignmentDialog()">Create Assignment</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <div class="assignment-layout">
        <mat-card class="surface-card">
          <mat-card-content>
            @if (loading()) {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }

            @if (assignments().length) {
              <div class="table-wrap">
                <table mat-table [dataSource]="assignments()" class="data-table">
                  <ng-container matColumnDef="title">
                    <th mat-header-cell *matHeaderCellDef>Assignment</th>
                    <td mat-cell *matCellDef="let assignment">
                      <div class="cell-title">
                        <strong>{{ assignment.title }}</strong>
                        <span>{{ assignment.due_at ? (assignment.due_at | date:'medium') : 'No due date' }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let assignment">
                      <mat-chip-set>
                        <mat-chip [highlighted]="assignment.status === 'published'">{{ assignment.status }}</mat-chip>
                        <mat-chip>{{ assignment.max_score }} pts</mat-chip>
                        @if (submissionCountMap()[assignment.id]) {
                          <mat-chip color="primary">
                            {{ submissionCountMap()[assignment.id] }} submission{{ submissionCountMap()[assignment.id] === 1 ? '' : 's' }}
                          </mat-chip>
                        }
                      </mat-chip-set>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let assignment">
                      <div class="action-row">
                        <button mat-button type="button" (click)="selectAssignment(assignment)">Submissions</button>
                        <button mat-button type="button" (click)="openAssignmentDialog(assignment)">Edit</button>
                        <button mat-button color="warn" type="button" (click)="deleteAssignment(assignment)">Delete</button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="assignmentColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: assignmentColumns"></tr>
                </table>
              </div>
            } @else {
              <app-empty-state
                icon="assignment"
                title="No assignments yet"
                description="Create an assignment for the selected course to start collecting work.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>{{ selectedAssignment()?.title || 'Submission Review' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (submissionsLoading()) {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }

            @if (submissions().length) {
              <div class="stack-list">
                @for (submission of submissions(); track submission.submission_id) {
                  <div class="stack-list__item">
                    <div>
                      <strong>{{ submission.student_name }}</strong>
                      <p>{{ submission.student_email }}</p>
                      @if (submission.submission_file_name && submission.submission_file_url) {
                        <a class="submission-asset" [href]="submission.submission_file_url" target="_blank" rel="noreferrer">
                          {{ submission.submission_file_name }}
                        </a>
                      }
                      <mat-chip-set>
                        <mat-chip>{{ submission.status }}</mat-chip>
                        @if (submission.score !== null && submission.score !== undefined) {
                          <mat-chip>{{ submission.score }} pts</mat-chip>
                        }
                        @if (submission.is_late) {
                          <mat-chip>Late</mat-chip>
                        }
                      </mat-chip-set>
                    </div>
                    <button mat-stroked-button type="button" (click)="reviewSubmission(submission)">Grade</button>
                  </div>
                }
              </div>
            } @else {
              <app-empty-state
                icon="grading"
                title="No submissions to review"
                description="Student submissions for the selected course will appear here automatically.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .assignment-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      gap: 1.25rem;
    }

    .action-row,
    .stack-list {
      display: grid;
      gap: 0.75rem;
    }

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
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
      margin: 0.35rem 0 0.75rem;
      color: var(--muted);
    }

    .submission-asset {
      display: inline-flex;
      margin: 0 0 0.75rem;
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
    }

    .action-row button:first-child {
      font-weight: 700;
    }

    @media (max-width: 1100px) {
      .assignment-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentsComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<CourseListItem[]>([]);
  readonly assignments = signal<Assignment[]>([]);
  readonly submissions = signal<AssignmentSubmission[]>([]);
  readonly submissionCountMap = signal<Record<string, number>>({});
  readonly modules = signal<CourseModule[]>([]);
  readonly lessons = signal<Lesson[]>([]);
  readonly loading = signal(false);
  readonly submissionsLoading = signal(false);
  readonly selectedAssignment = signal<Assignment | null>(null);
  readonly selectedCourseId = signal<string | null>(null);
  readonly assignmentColumns = ['title', 'status', 'actions'];

  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  constructor() {
    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        this.selectedCourseId.set(courseId || null);
        this.selectedAssignment.set(null);
        this.assignments.set([]);
        this.submissions.set([]);
        this.submissionCountMap.set({});
        this.modules.set([]);
        this.lessons.set([]);
        if (courseId) {
          this.loadAssignments();
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

  loadAssignments(): void {
    const courseId = this.courseForm.getRawValue().course_id || this.selectedCourseId();
    if (!courseId) {
      return;
    }
    this.selectedCourseId.set(courseId);
    this.selectedAssignment.set(null);
    this.submissions.set([]);
    this.submissionCountMap.set({});
    this.loading.set(true);
    forkJoin({
      assignments: this.instructorPortalService.listAssignments(courseId),
      modules: this.instructorPortalService.listModules(courseId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ assignments, modules }) => {
          this.assignments.set(assignments.items);
          this.modules.set(modules.items);
          this.loadSubmissionOverview(assignments.items);
          if (!modules.items.length) {
            this.lessons.set([]);
            this.loading.set(false);
            return;
          }
          forkJoin(modules.items.map((module) => this.instructorPortalService.listLessons(module.id)))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (lessonLists) => {
                this.lessons.set(lessonLists.flatMap((list) => list.items));
                this.loading.set(false);
              },
              error: () => {
                this.lessons.set([]);
                this.loading.set(false);
              }
            });
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.submissionCountMap.set({});
          this.snackBar.open(error.error?.detail ?? 'Unable to load assignments.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadSubmissionOverview(assignments: Assignment[]): void {
    if (!assignments.length) {
      this.submissionCountMap.set({});
      this.selectedAssignment.set(null);
      this.submissions.set([]);
      return;
    }

    forkJoin(
      assignments.map((assignment) =>
        this.instructorPortalService.listAssignmentSubmissions(assignment.id).pipe(
          catchError(() => of({ items: [], total: 0 }))
        )
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((responses) => {
        const counts = assignments.reduce<Record<string, number>>((acc, assignment, index) => {
          acc[assignment.id] = responses[index].total;
          return acc;
        }, {});
        this.submissionCountMap.set(counts);

        const preferredAssignment =
          assignments.find((assignment, index) => responses[index].total > 0) ??
          assignments[0] ??
          null;

        if (!preferredAssignment) {
          this.selectedAssignment.set(null);
          this.submissions.set([]);
          return;
        }

        this.selectedAssignment.set(preferredAssignment);
        const selectedIndex = assignments.findIndex((item) => item.id === preferredAssignment.id);
        this.submissions.set(responses[selectedIndex]?.items ?? []);
      });
  }

  openAssignmentDialog(assignment?: Assignment): void {
    const dialogRef = this.dialog.open(AssignmentDialogComponent, {
      data: {
        mode: assignment ? 'edit' : 'create',
        assignment,
        modules: this.modules(),
        lessons: this.lessons()
      },
      panelClass: ['lms-dialog-panel', 'lms-assignment-dialog'],
      width: '760px',
      maxWidth: '94vw',
      maxHeight: '88vh',
      autoFocus: false
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      const courseId = this.selectedCourseId();
      if (!payload || !courseId) {
        return;
      }
      const request$ = assignment
        ? this.instructorPortalService.updateAssignment(assignment.id, payload)
        : this.instructorPortalService.createAssignment(courseId, payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open(`Assignment ${assignment ? 'updated' : 'created'} successfully.`, 'Dismiss', { duration: 3200 });
          this.loadAssignments();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save assignment.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteAssignment(assignment: Assignment): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Assignment',
        message: `Delete "${assignment.title}"?`,
        confirmLabel: 'Delete Assignment',
        confirmColor: 'warn'
      },
      panelClass: ['lms-dialog-panel', 'lms-confirm-dialog'],
      width: '420px',
      maxWidth: '92vw',
      maxHeight: '80vh',
      autoFocus: false
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }
      this.instructorPortalService.deleteAssignment(assignment.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            if (this.selectedAssignment()?.id === assignment.id) {
              this.selectedAssignment.set(null);
              this.submissions.set([]);
            }
            this.loadAssignments();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete assignment.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }

  selectAssignment(assignment: Assignment): void {
    this.selectedAssignment.set(assignment);
    this.submissionsLoading.set(true);
    this.instructorPortalService.listAssignmentSubmissions(assignment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submissions.set(response.items);
          this.submissionsLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.submissionsLoading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load submissions.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  reviewSubmission(submission: AssignmentSubmission): void {
    const dialogRef = this.dialog.open(AssignmentReviewDialogComponent, {
      data: {
        submission,
        maxScore: this.selectedAssignment()?.max_score ?? 100
      },
      panelClass: ['lms-dialog-panel', 'lms-assignment-dialog'],
      width: '620px',
      maxWidth: '92vw',
      maxHeight: '88vh',
      autoFocus: false
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload) {
        return;
      }
      this.instructorPortalService.gradeAssignmentSubmission(submission.submission_id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open('Submission review saved.', 'Dismiss', { duration: 3200 });
            const current = this.selectedAssignment();
            if (current) {
              this.selectAssignment(current);
            }
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to grade submission.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }
}
