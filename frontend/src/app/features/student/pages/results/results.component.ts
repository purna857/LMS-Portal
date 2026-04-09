import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type {
  EnrolledCourseItem,
  QuizAttemptHistoryItem,
  QuizAttemptHistoryResponse,
  QuizAttemptResult,
  QuizDetail,
  QuizListItem
} from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

interface ResultListItem extends QuizAttemptHistoryItem {
  quiz_title: string;
  course_title: string;
}

@Component({
  selector: 'app-student-results',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        title="Quiz Results"
        description="Review quiz outcomes, revisit answer breakdowns, and track your assessment history.">
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="page-grid">
          @for (item of [1, 2, 3]; track item) {
            <div class="stat-card skeleton skeleton--card"></div>
          }
        </div>
      }

      @if (result(); as attemptResult) {
        <div class="result-layout">
          <mat-card class="visual-card result-hero">
            <mat-card-content>
              <div class="result-hero__eyebrow">
                <span>Attempt Performance</span>
                <span>Attempt {{ attemptResult.attempt_number }}</span>
              </div>
              <p class="result-submitted">Submitted {{ formatAttemptDate(attemptResult.submitted_at) }}</p>
              <div class="result-summary">
                <div>
                  <strong>{{ attemptResult.percentage }}%</strong>
                  <span>{{ attemptResult.score }}/{{ attemptResult.total_points }} points earned</span>
                </div>
                <mat-chip-set>
                  <mat-chip
                    class="result-hero-chip"
                    [class.result-hero-chip--success]="attemptResult.passed"
                    [class.result-hero-chip--danger]="!attemptResult.passed">
                    {{ attemptResult.passed ? 'Passed' : 'Not passed' }}
                  </mat-chip>
                  <mat-chip class="result-hero-chip result-hero-chip--neutral">{{ attemptResult.answers.length }} questions</mat-chip>
                </mat-chip-set>
              </div>
              <mat-progress-bar class="result-progress" mode="determinate" [value]="attemptResult.percentage"></mat-progress-bar>
              <div class="result-stats">
                <div>
                  <span>Correct Answers</span>
                  <strong>{{ correctAnswerCount(attemptResult) }}</strong>
                </div>
                <div>
                  <span>Accuracy</span>
                  <strong>{{ attemptResult.percentage }}%</strong>
                </div>
                <div>
                  <span>Submitted</span>
                  <strong>#{{ attemptResult.attempt_number }}</strong>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="surface-card result-breakdown">
            <mat-card-header>
              <mat-card-title>Answer Review</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="answer-list">
                @for (answer of filteredAnswers(); track answer.question_id) {
                  <div class="answer-list__item">
                    <div class="answer-list__copy">
                      <strong>{{ answer.question_text }}</strong>
                      <div class="answer-list__detail">
                        <span class="answer-list__label">Selected</span>
                        <span class="answer-list__value">{{ optionLabels(answer.question_id, answer.selected_option_ids) }}</span>
                      </div>
                      <div class="answer-list__detail">
                        <span class="answer-list__label">Correct</span>
                        <span class="answer-list__value">{{ optionLabels(answer.question_id, answer.correct_option_ids) }}</span>
                      </div>
                    </div>
                    <div class="answer-list__meta">
                      <mat-chip-set>
                        <mat-chip
                          class="result-status-chip"
                          [class.result-status-chip--success]="answer.is_correct"
                          [class.result-status-chip--danger]="!answer.is_correct">
                          {{ answer.is_correct ? 'Correct' : 'Incorrect' }}
                        </mat-chip>
                        <mat-chip class="result-score-chip">{{ answer.earned_points }}/{{ answer.max_points }} pts</mat-chip>
                      </mat-chip-set>
                    </div>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      } @else if (!loading() && filteredResults().length) {
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Attempt History</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="table-wrap">
              <table mat-table [dataSource]="filteredResults()" class="data-table">
                <ng-container matColumnDef="quiz">
                  <th mat-header-cell *matHeaderCellDef>Quiz</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="cell-title">
                      <strong>{{ item.quiz_title }}</strong>
                      <span>{{ item.course_title }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="score">
                  <th mat-header-cell *matHeaderCellDef>Result</th>
                  <td mat-cell *matCellDef="let item">{{ item.percentage }}%</td>
                </ng-container>
                <ng-container matColumnDef="attempt">
                  <th mat-header-cell *matHeaderCellDef>Attempt</th>
                  <td mat-cell *matCellDef="let item">#{{ item.attempt_number }}</td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let item">
                    <mat-chip-set>
                      <mat-chip class="result-status-chip" [highlighted]="item.passed">{{ item.passed ? 'Passed' : 'Review' }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let item">
                    <a
                      mat-flat-button
                      color="primary"
                      class="result-action-button"
                      [routerLink]="['/app/student/results', item.attempt_id]">
                      View result
                    </a>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns"></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (!loading()) {
        <app-empty-state
          icon="assessment"
          title="No quiz results yet"
          description="Complete a quiz attempt and your results will appear here.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    .result-layout {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
      align-items: start;
      color: var(--text);
      font-family: 'IBM Plex Sans', sans-serif !important;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .result-layout,
    .result-layout * {
      font-family: 'IBM Plex Sans', sans-serif !important;
    }
    .result-hero {
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid rgba(37, 99, 235, 0.1);
      background: #ffffff !important;
      color: var(--text);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
    }
    .result-hero mat-card-content {
      position: relative;
      z-index: 1;
      padding: 1.35rem 1.45rem 1.4rem;
      display: grid;
      gap: 0.9rem;
    }
    .result-hero__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.1rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.61rem;
      font-weight: 700;
    }
    .result-submitted {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.45;
    }
    .result-summary {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      margin-bottom: 0.45rem;
    }
    .result-summary strong {
      display: block;
      font-size: clamp(1.95rem, 2.5vw, 2.65rem);
      line-height: 1;
      letter-spacing: -0.05em;
      font-weight: 700;
      color: var(--primary-ink);
    }
    .result-summary span {
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.45;
    }
    .answer-list__item p {
      color: var(--muted);
    }
    .result-progress {
      margin-bottom: 0.9rem;
      border-radius: 999px;
      overflow: hidden;
    }
    .result-hero mat-chip,
    .result-status-chip,
    .result-score-chip {
      min-height: 34px;
      padding-inline: 0.78rem;
      border-radius: 999px !important;
      border: 1px solid transparent;
      font-size: 0.76rem;
      font-weight: 700;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    }
    .result-hero-chip {
      color: var(--primary-ink);
      background: rgba(37, 99, 235, 0.08);
      border-color: rgba(37, 99, 235, 0.12);
    }
    .result-hero-chip--neutral,
    .result-score-chip {
      color: var(--text);
      background: #f8fbff;
      border-color: rgba(148, 163, 184, 0.2);
    }
    .result-hero-chip--success,
    .result-status-chip--success {
      color: #16a34a;
      background: #ffffff;
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      --mdc-chip-outline-width: 0;
      --mdc-chip-outline-color: transparent;
      --mdc-chip-label-text-color: #16a34a;
      --mat-chip-trailing-icon-color: #16a34a;
    }
    .result-hero-chip--danger,
    .result-status-chip--danger {
      color: #dc2626;
      background: #ffffff;
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      --mdc-chip-outline-width: 0;
      --mdc-chip-outline-color: transparent;
      --mdc-chip-label-text-color: #dc2626;
      --mat-chip-trailing-icon-color: #dc2626;
    }
    .result-status-chip--success .mdc-evolution-chip__text-label,
    .result-status-chip--success .mat-mdc-chip-action-label,
    .result-status-chip--danger .mdc-evolution-chip__text-label,
    .result-status-chip--danger .mat-mdc-chip-action-label,
    .result-hero-chip--success .mdc-evolution-chip__text-label,
    .result-hero-chip--success .mat-mdc-chip-action-label,
    .result-hero-chip--danger .mdc-evolution-chip__text-label,
    .result-hero-chip--danger .mat-mdc-chip-action-label {
      color: inherit !important;
    }
    .result-score-chip {
      color: var(--primary-ink);
    }
    .result-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.85rem;
      margin-top: 0.9rem;
    }
    .result-stats div {
      display: grid;
      gap: 0.2rem;
      padding: 0.95rem 1rem;
      border-radius: 18px;
      background: #f7faff;
      border: 1px solid rgba(37, 99, 235, 0.12);
    }
    .result-stats span {
      color: var(--muted);
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.11em;
    }
    .result-stats strong {
      font-size: 1.1rem;
      letter-spacing: -0.04em;
      line-height: 1.1;
      color: var(--primary-ink);
    }
    .result-breakdown mat-card-header {
      padding-bottom: 0.85rem;
    }
    .result-breakdown mat-card-title {
      font-size: 0.96rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .result-action-button.mat-mdc-button-base,
    .result-status-chip {
      font-size: 0.86rem !important;
      font-weight: 700 !important;
      letter-spacing: -0.01em;
    }
    .result-action-button.mat-mdc-button-base {
      min-width: 8.75rem;
      min-height: 42px;
      padding-inline: 1rem;
      border-radius: 14px;
      box-shadow: 0 12px 22px rgba(37, 99, 235, 0.18);
    }
    .result-breakdown .result-status-chip {
      min-height: 34px;
      padding-inline: 0.75rem;
      border-radius: 999px !important;
    }
    .answer-list {
      display: grid;
      gap: 0.95rem;
    }
    .answer-list__item {
      display: flex;
      justify-content: space-between;
      gap: 1.1rem;
      padding: 1rem 1.05rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 255, 0.98));
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }
    .answer-list__item:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
      border-color: rgba(37, 99, 235, 0.18);
    }
    .answer-list__item:last-child {
      padding-bottom: 1rem;
    }
    .answer-list__copy strong {
      display: block;
      margin-bottom: 0.8rem;
      font-size: 0.95rem;
      line-height: 1.33;
      color: var(--text);
    }
    .answer-list__copy {
      display: grid;
      gap: 0.42rem;
      min-width: 0;
    }
    .answer-list__detail {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.55rem;
      min-width: 0;
    }
    .answer-list__label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 4.7rem;
      padding: 0.28rem 0.6rem;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.08);
      border: 1px solid rgba(37, 99, 235, 0.12);
      color: var(--primary-ink);
      font-size: 0.61rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      flex: 0 0 auto;
    }
    .answer-list__value {
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.4;
      min-width: 0;
      word-break: break-word;
    }
    .answer-list__meta {
      min-width: 168px;
      display: flex;
      justify-content: end;
      align-items: start;
    }
    .answer-list__meta mat-chip-set {
      display: grid;
      justify-items: end;
      gap: 0.55rem;
    }
    @media (max-width: 900px) {
      .result-layout {
        grid-template-columns: 1fr;
      }
      .answer-list__item,
      .result-summary {
        flex-direction: column;
      }
      .answer-list__meta {
        justify-content: start;
      }
      .answer-list__meta mat-chip-set {
        justify-items: start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(true);
  readonly result = signal<QuizAttemptResult | null>(null);
  readonly quizDetail = signal<QuizDetail | null>(null);
  readonly results = signal<ResultListItem[]>([]);
  readonly filteredResults = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    if (!query) {
      return this.results();
    }

    return this.results().filter((item) =>
      `${item.quiz_title} ${item.course_title} ${item.percentage}% attempt ${item.attempt_number}`
        .toLowerCase()
        .includes(query)
    );
  });
  readonly filteredAnswers = computed(() => {
    const attemptResult = this.result();
    const query = this.workspaceSearch.query().trim().toLowerCase();

    if (!attemptResult) {
      return [];
    }

    if (!query) {
      return attemptResult.answers;
    }

    return attemptResult.answers.filter((answer) =>
      `${answer.question_text} ${answer.selected_option_ids.join(' ')} ${answer.correct_option_ids.join(' ')}`
        .toLowerCase()
        .includes(query)
    );
  });
  readonly columns = ['quiz', 'score', 'attempt', 'status', 'actions'];

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const attemptId = params.get('attemptId');
        if (attemptId) {
          this.loadResult(attemptId);
        } else {
          this.loadResultHistory();
        }
      });
  }

  loadResult(attemptId: string): void {
    this.loading.set(true);
    this.quizDetail.set(null);
    this.studentPortalService.getQuizAttemptResult(attemptId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.results.set([]);
          this.studentPortalService.getQuiz(result.quiz_id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (quiz) => this.quizDetail.set(quiz),
              error: () => this.quizDetail.set(null)
            });
          this.loading.set(false);
        },
        error: () => {
          this.result.set(null);
          this.quizDetail.set(null);
          this.results.set([]);
          this.loading.set(false);
        }
      });
  }

  loadResultHistory(): void {
    this.loading.set(true);
    this.result.set(null);
    this.quizDetail.set(null);
    this.studentPortalService.listEnrolledCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (!response.items.length) {
            this.results.set([]);
            this.loading.set(false);
            return;
          }

          const quizRequests = Object.fromEntries(
            response.items.map((course) => [course.course_id, this.studentPortalService.listQuizzes(course.course_id)])
          );

          forkJoin(quizRequests)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (quizMap) => {
                const historyRequests: Record<string, ReturnType<StudentPortalService['getQuizAttemptHistory']>> = {};
                const quizIndex = new Map<string, { quiz: QuizListItem; course: EnrolledCourseItem }>();

                response.items.forEach((course) => {
                  (quizMap[course.course_id]?.items ?? []).forEach((quiz) => {
                    quizIndex.set(quiz.id, { quiz, course });
                    historyRequests[quiz.id] = this.studentPortalService.getQuizAttemptHistory(quiz.id);
                  });
                });

                if (!Object.keys(historyRequests).length) {
                  this.results.set([]);
                  this.loading.set(false);
                  return;
                }

                forkJoin(historyRequests)
                  .pipe(takeUntilDestroyed(this.destroyRef))
                  .subscribe({
                    next: (historyMap) => {
                      const items: ResultListItem[] = [];
                      Object.entries(historyMap as Record<string, QuizAttemptHistoryResponse>).forEach(([quizId, history]) => {
                        const meta = quizIndex.get(quizId);
                        if (!meta) {
                          return;
                        }
                        history.items.forEach((attempt: QuizAttemptHistoryItem) => {
                          items.push({ ...attempt, quiz_title: meta.quiz.title, course_title: meta.course.title });
                        });
                      });
                      items.sort((left, right) => new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime());
                      this.results.set(items);
                      this.loading.set(false);
                    },
                    error: () => {
                      this.results.set([]);
                      this.loading.set(false);
                    }
                  });
              },
              error: () => {
                this.results.set([]);
                this.loading.set(false);
              }
            });
        },
        error: () => {
          this.results.set([]);
          this.loading.set(false);
        }
      });
  }

  optionLabels(questionId: string, optionIds: string[]): string {
    if (!optionIds.length) {
      return 'No answer';
    }

    const question = this.quizDetail()?.questions.find((item) => item.id === questionId);
    if (!question) {
      return optionIds.join(', ');
    }

    const labels = optionIds
      .map((optionId) => question.options.find((option) => option.id === optionId)?.option_text ?? optionId)
      .filter((label) => !!label);

    return labels.length ? labels.join(', ') : 'No answer';
  }

  correctAnswerCount(result: QuizAttemptResult): number {
    return result.answers.filter((answer) => answer.is_correct).length;
  }

  formatAttemptDate(value: string): string {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}
