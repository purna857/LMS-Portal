import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { AssignmentDialogComponent } from '@app/features/instructor/components/assignment-dialog/assignment-dialog.component';
import { AssignmentReviewDialogComponent } from '@app/features/instructor/components/assignment-review-dialog/assignment-review-dialog.component';
import type { Assignment, AssignmentSubmission, CourseListItem, CourseModule, Lesson } from '@app/features/instructor/models/instructor.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForCourseStatus, chipToneForSubmissionStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-instructor-assignments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Assignment Review"
        description="Create assessments, tune due dates, and review learner submissions with grading feedback.">
      </app-page-header>

      <div class="page-grid">
        @for (card of summaryCards(); track card.label) {
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

            @if (filteredAssignments().length) {
              <div class="table-wrap">
                <table mat-table [dataSource]="filteredAssignments()" class="data-table">
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
                        <mat-chip [attr.data-tone]="chipToneForCourseStatus(assignment.status)">{{ assignment.status }}</mat-chip>
                        <mat-chip data-tone="info">{{ assignment.max_score }} pts</mat-chip>
                        @if (submissionCountMap()[assignment.id]) {
                          <mat-chip data-tone="success">
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
            } @else if (assignments().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching assignments' : 'No assignments yet'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different assignment title, status, course, or score keyword.' : 'Create an assignment for the selected course to start collecting work.'">
              </app-empty-state>
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

            @if (filteredSubmissions().length) {
              <div class="stack-list">
                @for (submission of filteredSubmissions(); track submission.submission_id) {
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
                        <mat-chip [attr.data-tone]="chipToneForSubmissionStatus(submission.status)">{{ submission.status }}</mat-chip>
                        @if (submission.score !== null && submission.score !== undefined) {
                          <mat-chip data-tone="info">{{ submission.score }} pts</mat-chip>
                        }
                        @if (submission.is_late) {
                          <mat-chip data-tone="danger">Late</mat-chip>
                        }
                      </mat-chip-set>
                    </div>
                    <button mat-stroked-button type="button" (click)="reviewSubmission(submission)">Grade</button>
                  </div>
                }
              </div>
            } @else if (submissions().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching submissions' : 'No submissions to review'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different student name, email, status, or score keyword.' : 'Student submissions for the selected course will appear here automatically.'">
              </app-empty-state>
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

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
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

    .stack-list__item .mat-mdc-chip-set {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
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
  readonly workspaceSearch = inject(WorkspaceSearchService);
  private readonly route = inject(ActivatedRoute);

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
  readonly chipToneForCourseStatus = chipToneForCourseStatus;
  readonly chipToneForSubmissionStatus = chipToneForSubmissionStatus;
  readonly summaryCards = computed(() => {
    const assignments = this.assignments();
    const submissions = this.submissions();
    const totalSubmissions = Object.values(this.submissionCountMap()).reduce((total, count) => total + count, 0);

    return [
      {
        label: 'Assignments',
        value: String(assignments.length),
        hint: 'Assessment items in the selected course',
        icon: 'assignment'
      },
      {
        label: 'Published',
        value: String(assignments.filter((assignment) => assignment.status === 'published').length),
        hint: 'Assignments visible to learners',
        icon: 'rocket_launch'
      },
      {
        label: 'Submissions',
        value: String(totalSubmissions),
        hint: 'Total submissions collected across the course',
        icon: 'upload_file'
      },
      {
        label: 'In Review',
        value: String(submissions.length),
        hint: 'Selected assignment submissions ready for grading',
        icon: 'grading'
      }
    ];
  });
  readonly filteredAssignments = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.assignments();
    }

    return this.assignments().filter((assignment) =>
      this.workspaceSearch.matches(
        assignment.title,
        assignment.description,
        assignment.instructions,
        assignment.status,
        String(assignment.max_score),
        assignment.due_at,
        assignment.allow_late_submission ? 'allow late submission' : null
      )
    );
  });
  readonly filteredSubmissions = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.submissions();
    }

    return this.submissions().filter((submission) =>
      this.workspaceSearch.matches(
        submission.student_name,
        submission.student_email,
        submission.status,
        submission.submission_text,
        submission.submission_link,
        submission.feedback,
        submission.submission_file_name,
        submission.score !== null && submission.score !== undefined ? String(submission.score) : null
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
          const preferredCourseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';
          const selectedCourseId = response.items.find((course) => course.id === preferredCourseId)?.id ?? response.items[0]?.id ?? '';
          this.courseForm.patchValue({ course_id: selectedCourseId });
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
      ...portalDialogConfig('xl')
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
      ...portalDialogConfig('sm')
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
      ...portalDialogConfig('lg')
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
