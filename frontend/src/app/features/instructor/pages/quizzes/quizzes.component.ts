import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { QuizDialogComponent } from '@app/features/instructor/components/quiz-dialog/quiz-dialog.component';
import { QuizQuestionDialogComponent } from '@app/features/instructor/components/quiz-question-dialog/quiz-question-dialog.component';
import type { CourseListItem, QuizDetail, QuizListItem, QuizQuestion } from '@app/features/instructor/models/instructor.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForCourseStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-instructor-quizzes',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Assessments"
        description="Manage quiz structure, question sets, passing thresholds, and publishing state across your courses.">
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

            @if (filteredQuizzes().length) {
              <div class="table-wrap">
                <table mat-table [dataSource]="filteredQuizzes()" class="data-table">
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
                        <mat-chip [attr.data-tone]="chipToneForCourseStatus(quiz.status)">{{ quiz.status }}</mat-chip>
                        <mat-chip data-tone="info">{{ quiz.max_attempts }} attempts</mat-chip>
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
            } @else if (quizzes().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching quizzes' : 'No quizzes yet'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different quiz title, question count, or status.' : 'Create a quiz for the selected course to start building assessments.'">
              </app-empty-state>
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

            @if (filteredSelectedQuestions().length) {
              <div class="stack-list">
                @for (question of filteredSelectedQuestions(); track question.id) {
                  <div class="stack-list__item">
                    <div>
                      <strong>{{ question.position }}. {{ question.question_text }}</strong>
                      <p>{{ question.points }} pts · {{ question.allow_multiple_answers ? 'Multiple answers' : 'Single answer' }}</p>
                      <mat-chip-set>
                        @for (option of question.options; track option.id) {
                          <mat-chip [attr.data-tone]="option.is_correct ? 'success' : 'neutral'">{{ option.option_text }}</mat-chip>
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
            } @else if (selectedQuizDetail()?.questions?.length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching questions' : 'No quiz questions yet'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try another question text, option, or point value.' : 'Select a quiz and add questions to shape the assessment experience.'">
              </app-empty-state>
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
      align-items: center;
    }

    .inline-actions {
      margin-bottom: 1rem;
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

    @media (max-width: 720px) {
      .stack-list__item {
        grid-template-columns: 1fr;
      }

      .stack-list__item > :last-child {
        justify-self: start;
      }
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
  readonly workspaceSearch = inject(WorkspaceSearchService);
  private readonly route = inject(ActivatedRoute);

  readonly courses = signal<CourseListItem[]>([]);
  readonly quizzes = signal<QuizListItem[]>([]);
  readonly selectedQuizDetail = signal<QuizDetail | null>(null);
  readonly selectedCourseId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly quizColumns = ['title', 'status', 'actions'];
  readonly chipToneForCourseStatus = chipToneForCourseStatus;
  readonly summaryCards = computed(() => {
    const quizzes = this.quizzes();
    const selectedQuiz = this.selectedQuizDetail();
    const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.question_count, 0);
    const totalPoints = quizzes.reduce((sum, quiz) => sum + quiz.total_points, 0);

    return [
      {
        label: 'Quizzes',
        value: String(quizzes.length),
        hint: 'Assessment sets in the selected course',
        icon: 'quiz'
      },
      {
        label: 'Published',
        value: String(quizzes.filter((quiz) => quiz.status === 'published').length),
        hint: 'Quizzes currently available to learners',
        icon: 'rocket_launch'
      },
      {
        label: 'Questions',
        value: String(selectedQuiz?.question_count ?? totalQuestions),
        hint: 'Question count for the selected quiz or aggregate total',
        icon: 'help'
      },
      {
        label: 'Points',
        value: String(selectedQuiz?.total_points ?? totalPoints),
        hint: 'Scoring weight across the course quiz set',
        icon: 'military_tech'
      }
    ];
  });
  readonly filteredQuizzes = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.quizzes();
    }

    return this.quizzes().filter((quiz) =>
      this.workspaceSearch.matches(
        quiz.title,
        quiz.description,
        quiz.status,
        String(quiz.question_count),
        String(quiz.total_points)
      )
    );
  });
  readonly filteredSelectedQuestions = computed(() => {
    const quiz = this.selectedQuizDetail();
    const query = this.workspaceSearch.normalizedQuery();

    if (!quiz) {
      return [];
    }

    if (!query) {
      return quiz.questions ?? [];
    }

    return (quiz.questions ?? []).filter((question) =>
      this.workspaceSearch.matches(
        question.question_text,
        question.explanation,
        String(question.points),
        question.options.map((option) => option.option_text).join(' ')
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
          const preferredCourseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';
          const selectedCourseId = response.items.find((course) => course.id === preferredCourseId)?.id ?? response.items[0]?.id ?? '';
          this.courseForm.patchValue({ course_id: selectedCourseId });
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
      ...portalDialogConfig('lg')
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
      ...portalDialogConfig('sm')
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
      ...portalDialogConfig('xl')
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
      ...portalDialogConfig('sm')
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
