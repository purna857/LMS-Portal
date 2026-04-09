import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AssignmentSubmitDialogComponent } from '@app/features/student/components/assignment-submit-dialog/assignment-submit-dialog.component';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import type {
  Assignment,
  AssignmentSubmissionResponse,
  EnrolledCourseItem,
  StudentAssignmentRecord
} from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-student-assignments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        title="Assignments"
        description="Track course assignments, monitor deadlines, and submit your work from one place.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="courseForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Course</mat-label>
              <mat-select formControlName="course_id">
                @for (course of enrolledCourses(); track course.course_id) {
                  <mat-option [value]="course.course_id">{{ course.title }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="loadAssignments()">Refresh</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      @if (filteredAssignments().length) {
        <div class="assignment-grid">
          @for (assignment of filteredAssignments(); track assignment.id) {
            <mat-card class="surface-card">
              <mat-card-content>
                <div class="assignment-head">
                  <div>
                    <h3>{{ assignment.title }}</h3>
                    <p>{{ assignment.description || assignment.instructions || 'No assignment description provided.' }}</p>
                  </div>
                  <mat-chip-set>
                    <mat-chip [highlighted]="assignment.status === 'published'">{{ assignment.status }}</mat-chip>
                    <mat-chip>{{ assignment.max_score }} pts</mat-chip>
                  </mat-chip-set>
                </div>
                <div class="assignment-meta">
                  <span>Due: {{ assignment.due_at ? (assignment.due_at | date:'medium') : 'No due date' }}</span>
                  @if (submissionMap()[assignment.id]; as submission) {
                    <span>Submitted: {{ submission.submitted_at | date:'mediumDate' }}</span>
                  }
                </div>

                @if (submissionMap()[assignment.id]; as submission) {
                  <div class="submission-panel">
                    <div class="submission-panel__top">
                      <mat-chip-set>
                        <mat-chip [highlighted]="submission.status === 'graded'">{{ submission.status }}</mat-chip>
                        @if (submission.score !== null && submission.score !== undefined) {
                          <mat-chip color="primary">{{ submission.score }}/{{ assignment.max_score }} pts</mat-chip>
                        }
                        @if (submission.is_late) {
                          <mat-chip color="warn">Late</mat-chip>
                        }
                      </mat-chip-set>
                    </div>

                    @if (submission.submission_file_url && submission.submission_file_name) {
                      <a class="submission-link" [href]="submission.submission_file_url" target="_blank" rel="noreferrer">
                        Open uploaded file: {{ submission.submission_file_name }}
                      </a>
                    }

                    @if (submission.feedback) {
                      <div class="feedback-panel">
                        <span class="feedback-panel__label">Instructor feedback</span>
                        <p>{{ submission.feedback }}</p>
                      </div>
                    }
                  </div>
                }
              </mat-card-content>
              <mat-card-actions align="end">
                @if (submissionMap()[assignment.id]) {
                  <button mat-stroked-button type="button" disabled>
                    {{ submissionMap()[assignment.id].status === 'graded' ? 'Reviewed' : 'Submitted' }}
                  </button>
                } @else {
                  <button mat-flat-button color="primary" type="button" (click)="submitAssignment(assignment)">Submit</button>
                }
              </mat-card-actions>
            </mat-card>
          }
        </div>
      } @else {
        <app-empty-state
          icon="assignment"
          title="No assignments available"
          description="Assignments for the selected course will appear here once they are published.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    .assignment-grid {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .assignment-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
    .assignment-head h3 {
      margin: 0;
      font-size: 1.1rem;
    }
    .assignment-head p,
    .assignment-meta {
      color: var(--muted);
    }
    .assignment-head p {
      margin: 0.4rem 0 0;
      line-height: 1.55;
    }
    .assignment-meta {
      display: grid;
      gap: 0.3rem;
      margin-top: 1rem;
      font-size: 0.92rem;
    }

    .submission-panel {
      display: grid;
      gap: 0.85rem;
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 20px;
      background: #f8fbff;
      border: 1px solid rgba(37, 99, 235, 0.1);
    }

    .submission-link {
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
    }

    .feedback-panel {
      padding: 0.85rem 0.95rem;
      border-radius: 16px;
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .feedback-panel__label {
      display: block;
      margin-bottom: 0.35rem;
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .feedback-panel p {
      margin: 0;
      line-height: 1.55;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentAssignmentsComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly assignments = signal<Assignment[]>([]);
  readonly submissionMap = signal<Record<string, StudentAssignmentRecord | AssignmentSubmissionResponse>>({});
  readonly filteredAssignments = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    const selectedCourseId = this.courseForm.getRawValue().course_id;
    const selectedCourseTitle = this.enrolledCourses().find((course) => course.course_id === selectedCourseId)?.title ?? '';

    if (!query) {
      return this.assignments();
    }

    return this.assignments().filter((assignment) =>
      [
        assignment.title,
        assignment.description,
        assignment.instructions,
        assignment.status,
        selectedCourseTitle
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  constructor() {
    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        this.assignments.set([]);
        if (courseId) {
          this.loadAssignments();
        }
      });

    this.studentPortalService.listEnrolledCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.enrolledCourses.set(response.items);
          this.courseForm.patchValue({ course_id: response.items[0]?.course_id ?? '' });
          this.loadSubmissionRecords();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load enrolled courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadSubmissionRecords(): void {
    this.studentPortalService.listMyAssignmentSubmissions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const selectedCourseId = this.courseForm.getRawValue().course_id;
          const filteredItems = selectedCourseId
            ? response.items.filter((item) => item.course_id === selectedCourseId)
            : response.items;
          this.submissionMap.set(
            filteredItems.reduce<Record<string, StudentAssignmentRecord>>((acc, item) => {
              acc[item.assignment_id] = item;
              return acc;
            }, {})
          );
        },
        error: () => {
          this.submissionMap.set({});
        }
      });
  }

  loadAssignments(): void {
    const courseId = this.courseForm.getRawValue().course_id;
    if (!courseId) {
      return;
    }
    this.loadSubmissionRecords();
    this.loading.set(true);
    this.studentPortalService.listAssignments(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assignments.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.assignments.set([]);
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load assignments.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  submitAssignment(assignment: Assignment): void {
    const dialogRef = this.dialog.open(AssignmentSubmitDialogComponent, {
      data: { assignment },
      panelClass: ['lms-dialog-panel', 'lms-assignment-dialog'],
      width: '720px',
      maxWidth: '92vw',
      maxHeight: '88vh',
      autoFocus: false
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        if (!payload) {
          return;
        }
        this.studentPortalService.submitAssignment(assignment.id, payload)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (submission) => {
              this.submissionMap.update((items) => ({ ...items, [assignment.id]: submission }));
              this.loadSubmissionRecords();
              this.snackBar.open('Assignment submitted successfully.', 'Dismiss', { duration: 3200 });
            },
            error: (error: HttpErrorResponse) => {
              if (error.status === 409) {
                this.submissionMap.update((items) => ({
                  ...items,
                  [assignment.id]: {
                    id: `existing-${assignment.id}`,
                    assignment_id: assignment.id,
                    enrollment_id: '',
                    status: 'submitted',
                    submitted_at: new Date().toISOString(),
                    is_late: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }
                }));
              }
              this.snackBar.open(error.error?.detail ?? 'Unable to submit assignment.', 'Dismiss', { duration: 4500 });
            }
          });
      });
  }
}
