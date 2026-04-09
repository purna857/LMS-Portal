import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';

import type { EnrolledCourseItem, QuizAttemptHistoryItem, QuizAttemptResult, QuizDetail, QuizListItem } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-student-quizzes',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        title="Quizzes"
        description="Review quiz availability, complete attempts, and revisit your recent results.">
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
              <button mat-stroked-button type="button" (click)="loadQuizzes()">Refresh</button>
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
                  <ng-container matColumnDef="quiz">
                    <th mat-header-cell *matHeaderCellDef>Quiz</th>
                    <td mat-cell *matCellDef="let quiz">
                      <div class="cell-title">
                        <strong>{{ quiz.title }}</strong>
                        <span>{{ quiz.question_count }} questions · {{ quiz.total_points }} points</span>
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
                        <button mat-button type="button" (click)="selectQuiz(quiz)">Open</button>
                        <a mat-button [routerLink]="['/app/student/results']">History</a>
                      </div>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="columns"></tr>
                  <tr mat-row *matRowDef="let row; columns: columns"></tr>
                </table>
              </div>
            } @else {
              <app-empty-state
                icon="quiz"
                title="No quizzes available"
                description="Published quizzes for the selected course will appear here.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>{{ selectedQuiz()?.title || 'Attempt Workspace' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (selectedQuiz(); as quiz) {
              <div class="quiz-head">
                <p>{{ quiz.instructions || quiz.description || 'Review each question and submit your answers when ready.' }}</p>
                <mat-chip-set>
                  <mat-chip>{{ quiz.max_attempts }} attempts allowed</mat-chip>
                  <mat-chip>{{ quiz.total_points }} total points</mat-chip>
                </mat-chip-set>
              </div>
              <div class="history-preview">
                @for (attempt of attemptHistory(); track attempt.attempt_id) {
                  <a mat-stroked-button [routerLink]="['/app/student/results', attempt.attempt_id]">Attempt {{ attempt.attempt_number }} · {{ attempt.percentage }}%</a>
                }
              </div>
              <div class="question-stack">
                @for (question of quiz.questions; track question.id) {
                  <div class="question-card">
                    <strong>{{ question.position }}. {{ question.question_text }}</strong>
                    <p>{{ question.points }} points</p>
                    <div class="option-list">
                      @for (option of question.options; track option.id) {
                        <label class="option-item">
                          @if (question.allow_multiple_answers) {
                            <input type="checkbox" [checked]="isSelected(question.id, option.id)" (change)="toggleOption(question.id, option.id, $any($event.target).checked, true)" />
                          } @else {
                            <input type="radio" [name]="question.id" [checked]="isSelected(question.id, option.id)" (change)="toggleOption(question.id, option.id, $any($event.target).checked, false)" />
                          }
                          <span>{{ option.option_text }}</span>
                        </label>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <app-empty-state
                icon="fact_check"
                title="Select a quiz"
                description="Choose a quiz from the left panel to review questions and attempt history.">
              </app-empty-state>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-flat-button color="primary" type="button" [disabled]="!selectedQuiz()" (click)="submitAttempt()">Submit Attempt</button>
          </mat-card-actions>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .quiz-layout {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
    }
    .action-row,
    .history-preview {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .quiz-head p,
    .question-card p {
      color: var(--muted);
      margin: 0.4rem 0 0.8rem;
    }
    .history-preview {
      margin: 1rem 0;
    }
    .question-stack {
      display: grid;
      gap: 1rem;
    }
    .question-card {
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .question-card:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .option-list {
      display: grid;
      gap: 0.6rem;
    }
    .option-item {
      display: flex;
      gap: 0.75rem;
      align-items: start;
    }
    @media (max-width: 1100px) {
      .quiz-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentQuizzesComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly quizzes = signal<QuizListItem[]>([]);
  readonly filteredQuizzes = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    const selectedCourseId = this.courseForm.getRawValue().course_id;
    const selectedCourseTitle = this.enrolledCourses().find((course) => course.course_id === selectedCourseId)?.title ?? '';

    if (!query) {
      return this.quizzes();
    }

    return this.quizzes().filter((quiz) =>
      [
        quiz.title,
        quiz.description,
        quiz.status,
        selectedCourseTitle
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
  readonly selectedQuiz = signal<QuizDetail | null>(null);
  readonly attemptHistory = signal<QuizAttemptHistoryItem[]>([]);
  readonly answers = signal<Record<string, string[]>>({});
  readonly loading = signal(false);
  readonly columns = ['quiz', 'status', 'actions'];
  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  constructor() {
    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        this.quizzes.set([]);
        this.selectedQuiz.set(null);
        this.attemptHistory.set([]);
        this.answers.set({});
        if (courseId) {
          this.loadQuizzes();
        }
      });

    this.studentPortalService.listEnrolledCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.enrolledCourses.set(response.items);
          this.courseForm.patchValue({ course_id: response.items[0]?.course_id ?? '' });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load enrolled courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadQuizzes(): void {
    const courseId = this.courseForm.getRawValue().course_id;
    if (!courseId) {
      return;
    }
    this.loading.set(true);
    this.studentPortalService.listQuizzes(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.quizzes.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.quizzes.set([]);
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load quizzes.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  selectQuiz(quiz: QuizListItem): void {
    this.loading.set(true);
    this.answers.set({});
    this.studentPortalService.getQuiz(quiz.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selectedQuiz.set(detail);
          this.loadAttemptHistory(detail.id);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load quiz details.', 'Dismiss', { duration: 4500 });
          this.loading.set(false);
        }
      });
  }

  loadAttemptHistory(quizId: string): void {
    this.studentPortalService.getQuizAttemptHistory(quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => this.attemptHistory.set(history.items),
        error: () => this.attemptHistory.set([])
      });
  }

  isSelected(questionId: string, optionId: string): boolean {
    return (this.answers()[questionId] ?? []).includes(optionId);
  }

  toggleOption(questionId: string, optionId: string, checked: boolean, allowMultiple: boolean): void {
    this.answers.update((current) => {
      const existing = current[questionId] ?? [];
      if (!checked) {
        return { ...current, [questionId]: existing.filter((id) => id !== optionId) };
      }
      return {
        ...current,
        [questionId]: allowMultiple ? [...new Set([...existing, optionId])] : [optionId]
      };
    });
  }

  submitAttempt(): void {
    const quiz = this.selectedQuiz();
    if (!quiz) {
      return;
    }
    const payload = {
      answers: quiz.questions.map((question) => ({
        question_id: question.id,
        selected_option_ids: this.answers()[question.id] ?? []
      }))
    };
    this.studentPortalService.submitQuizAttempt(quiz.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: QuizAttemptResult) => {
          this.snackBar.open('Quiz submitted successfully.', 'Dismiss', { duration: 3200 });
          this.loadAttemptHistory(quiz.id);
          void this.router.navigate(['/app/student/results', result.attempt_id]);
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to submit quiz attempt.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
