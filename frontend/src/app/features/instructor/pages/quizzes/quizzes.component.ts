import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { QuizDialogComponent } from '@app/features/instructor/components/quiz-dialog/quiz-dialog.component';
import { QuizQuestionDialogComponent } from '@app/features/instructor/components/quiz-question-dialog/quiz-question-dialog.component';
import type { CourseListItem, QuizDetail, QuizListItem, QuizQuestion } from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-instructor-quizzes',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Quizzes"
        description="Manage quiz structure, question sets, passing thresholds, and publishing state across your courses.">
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
              <button mat-stroked-button type="button" (click)="loadQuizzes()">Refresh</button>
              <button mat-flat-button color="primary" type="button" [disabled]="!selectedCourseId()" (click)="openQuizDialog()">Create Quiz</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <div class="quiz-layout">
        <mat-card class="surface-card">
          <mat-card-content>
            @if (loading()) {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }

            @if (quizzes().length) {
              <div class="table-wrap">
                <table mat-table [dataSource]="quizzes()" class="data-table">
                  <ng-container matColumnDef="title">
                    <th mat-header-cell *matHeaderCellDef>Quiz</th>
                    <td mat-cell *matCellDef="let quiz">
                      <div class="cell-title">
                        <strong>{{ quiz.title }}</strong>
                        <span>{{ quiz.question_count }} questions · {{ quiz.total_points }} pts</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let quiz">
                      <mat-chip-set>
                        <mat-chip [highlighted]="quiz.status === 'published'">{{ quiz.status }}</mat-chip>
                        <mat-chip>{{ quiz.max_attempts }} attempts</mat-chip>
                      </mat-chip-set>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let quiz">
                      <div class="action-row">
                        <button mat-button type="button" (click)="selectQuiz(quiz)">Questions</button>
                        <button mat-button type="button" (click)="openQuizDialog(quiz)">Edit</button>
                        <button mat-button color="warn" type="button" (click)="deleteQuiz(quiz)">Delete</button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="quizColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: quizColumns"></tr>
                </table>
              </div>
            } @else {
              <app-empty-state
                icon="quiz"
                title="No quizzes yet"
                description="Create a quiz for the selected course to start building assessments.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>{{ selectedQuizDetail()?.title || 'Question Builder' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="inline-actions">
              <button mat-stroked-button type="button" [disabled]="!selectedQuizDetail()" (click)="openQuestionDialog()">Add Question</button>
            </div>

            @if (selectedQuizDetail()?.questions?.length) {
              <div class="stack-list">
                @for (question of selectedQuizDetail()?.questions ?? []; track question.id) {
                  <div class="stack-list__item">
                    <div>
                      <strong>{{ question.position }}. {{ question.question_text }}</strong>
                      <p>{{ question.points }} pts · {{ question.allow_multiple_answers ? 'Multiple answers' : 'Single answer' }}</p>
                      <mat-chip-set>
                        @for (option of question.options; track option.id) {
                          <mat-chip [highlighted]="option.is_correct">{{ option.option_text }}</mat-chip>
                        }
                      </mat-chip-set>
                    </div>
                    <div class="action-row">
                      <button mat-button type="button" (click)="openQuestionDialog(question)">Edit</button>
                      <button mat-button color="warn" type="button" (click)="deleteQuestion(question)">Delete</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <app-empty-state
                icon="help"
                title="No quiz questions yet"
                description="Select a quiz and add questions to shape the assessment experience.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .quiz-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
      gap: 1.25rem;
    }

    .action-row,
    .inline-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .inline-actions {
      margin-bottom: 1rem;
    }

    .stack-list {
      display: grid;
      gap: 1rem;
    }

    .stack-list__item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      padding-bottom: 1rem;
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

    @media (max-width: 1100px) {
      .quiz-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuizzesComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<CourseListItem[]>([]);
  readonly quizzes = signal<QuizListItem[]>([]);
  readonly selectedQuizDetail = signal<QuizDetail | null>(null);
  readonly selectedCourseId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly quizColumns = ['title', 'status', 'actions'];

  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  constructor() {
    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        this.selectedCourseId.set(courseId || null);
        this.selectedQuizDetail.set(null);
        this.quizzes.set([]);
        if (courseId) {
          this.loadQuizzes();
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

  loadQuizzes(): void {
    const courseId = this.courseForm.getRawValue().course_id || this.selectedCourseId();
    if (!courseId) {
      return;
    }
    this.selectedCourseId.set(courseId);
    this.selectedQuizDetail.set(null);
    this.loading.set(true);
    this.instructorPortalService.listQuizzes(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.quizzes.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load quizzes.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  openQuizDialog(quiz?: QuizListItem): void {
    if (quiz) {
      this.instructorPortalService.getQuiz(quiz.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (detail) => this.presentQuizDialog({ mode: 'edit', quiz: detail }),
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to load quiz detail.', 'Dismiss', { duration: 4500 });
          }
        });
      return;
    }
    this.presentQuizDialog({ mode: 'create' });
  }

  private presentQuizDialog(data: { mode: 'create' | 'edit'; quiz?: QuizDetail }): void {
    const dialogRef = this.dialog.open(QuizDialogComponent, {
      data,
      panelClass: ['lms-dialog-panel'],
      width: 'min(94vw, 720px)',
      maxWidth: 'min(94vw, 720px)',
      autoFocus: false
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      const courseId = this.selectedCourseId();
      if (!payload || !courseId) {
        return;
      }
      const request$ = data.mode === 'create' || !data.quiz
        ? this.instructorPortalService.createQuiz(courseId, payload)
        : this.instructorPortalService.updateQuiz(data.quiz.id, payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (detail) => {
          this.snackBar.open(`Quiz ${data.mode === 'create' ? 'created' : 'updated'} successfully.`, 'Dismiss', { duration: 3200 });
          this.loadQuizzes();
          this.selectedQuizDetail.set(detail);
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save quiz.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  selectQuiz(quiz: QuizListItem): void {
    this.instructorPortalService.getQuiz(quiz.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => this.selectedQuizDetail.set(detail),
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load quiz questions.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  deleteQuiz(quiz: QuizListItem): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Quiz',
        message: `Delete "${quiz.title}" and its questions?`,
        confirmLabel: 'Delete Quiz',
        confirmColor: 'warn'
      },
      panelClass: ['lms-dialog-panel'],
      width: '420px',
      maxWidth: '92vw',
      maxHeight: '80vh',
      autoFocus: false
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }
      this.instructorPortalService.deleteQuiz(quiz.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            if (this.selectedQuizDetail()?.id === quiz.id) {
              this.selectedQuizDetail.set(null);
            }
            this.loadQuizzes();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete quiz.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }

  openQuestionDialog(question?: QuizQuestion): void {
    const quiz = this.selectedQuizDetail();
    if (!quiz) {
      return;
    }
    const dialogRef = this.dialog.open(QuizQuestionDialogComponent, {
      data: {
        mode: question ? 'edit' : 'create',
        question
      },
      panelClass: ['lms-dialog-panel'],
      width: 'min(94vw, 820px)',
      maxWidth: 'min(94vw, 820px)',
      autoFocus: false
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload) {
        return;
      }
      const request$ = question
        ? this.instructorPortalService.updateQuizQuestion(question.id, payload)
        : this.instructorPortalService.createQuizQuestion(quiz.id, payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open(`Question ${question ? 'updated' : 'created'} successfully.`, 'Dismiss', { duration: 3200 });
          this.refreshSelectedQuiz(quiz.id);
          this.loadQuizzes();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save quiz question.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteQuestion(question: QuizQuestion): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Question',
        message: 'Delete this question from the quiz?',
        confirmLabel: 'Delete Question',
        confirmColor: 'warn'
      },
      panelClass: ['lms-dialog-panel'],
      width: '420px',
      maxWidth: '92vw',
      maxHeight: '80vh',
      autoFocus: false
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }
      this.instructorPortalService.deleteQuizQuestion(question.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            const quiz = this.selectedQuizDetail();
            if (quiz) {
              this.refreshSelectedQuiz(quiz.id);
            }
            this.loadQuizzes();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete quiz question.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }

  private refreshSelectedQuiz(quizId: string): void {
    this.instructorPortalService.getQuiz(quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => this.selectedQuizDetail.set(detail),
        error: () => undefined
      });
  }
}
