import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type {
  EnrolledCourseItem,
  QuizAttemptHistoryItem,
  QuizAttemptHistoryResponse,
  QuizAttemptResult,
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
        title="Results"
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
              <div class="result-summary">
                <div>
                  <strong>{{ attemptResult.percentage }}%</strong>
                  <span>{{ attemptResult.score }}/{{ attemptResult.total_points }} points earned</span>
                </div>
                <mat-chip-set>
                  <mat-chip [highlighted]="attemptResult.passed">{{ attemptResult.passed ? 'Passed' : 'Not passed' }}</mat-chip>
                  <mat-chip>{{ attemptResult.answers.length }} questions</mat-chip>
                </mat-chip-set>
              </div>
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
            <mat-card-content>
              <div class="answer-list">
                @for (answer of filteredAnswers(); track answer.question_id) {
                  <div class="answer-list__item">
                    <div class="answer-list__copy">
                      <strong>{{ answer.question_text }}</strong>
                      <p>Selected: {{ answer.selected_option_ids.length ? answer.selected_option_ids.join(', ') : 'No answer' }}</p>
                      <p>Correct: {{ answer.correct_option_ids.join(', ') }}</p>
                    </div>
                    <div class="answer-list__meta">
                      <mat-chip-set>
                        <mat-chip [highlighted]="answer.is_correct">{{ answer.is_correct ? 'Correct' : 'Incorrect' }}</mat-chip>
                        <mat-chip>{{ answer.earned_points }}/{{ answer.max_points }} pts</mat-chip>
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
                      <mat-chip [highlighted]="item.passed">{{ item.passed ? 'Passed' : 'Review' }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let item">
                    <a mat-flat-button color="primary" [routerLink]="['/app/student/results', item.attempt_id]">View result</a>
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
    }
    .result-hero__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .result-summary {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      margin-bottom: 1.25rem;
    }
    .result-summary strong {
      display: block;
      font-size: clamp(2.3rem, 3vw, 3.4rem);
      letter-spacing: -0.06em;
    }
    .result-summary span,
    .answer-list__item p {
      color: var(--muted);
    }
    .result-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .result-stats div {
      display: grid;
      gap: 0.25rem;
      padding: 1rem 1.1rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.65);
    }
    .result-stats span {
      color: var(--muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .result-stats strong {
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }
    .answer-list {
      display: grid;
      gap: 1rem;
    }
    .answer-list__item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }
    .answer-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .answer-list__copy strong {
      font-size: 1rem;
      line-height: 1.4;
    }
    .answer-list__meta {
      min-width: 160px;
      display: flex;
      justify-content: end;
    }
    .answer-list__item p {
      margin: 0.35rem 0 0;
    }
    @media (max-width: 900px) {
      .answer-list__item,
      .result-summary {
        flex-direction: column;
      }
      .answer-list__meta {
        justify-content: start;
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
    this.studentPortalService.getQuizAttemptResult(attemptId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.results.set([]);
          this.loading.set(false);
        },
        error: () => {
          this.result.set(null);
          this.results.set([]);
          this.loading.set(false);
        }
      });
  }

  loadResultHistory(): void {
    this.loading.set(true);
    this.result.set(null);
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

  correctAnswerCount(result: QuizAttemptResult): number {
    return result.answers.filter((answer) => answer.is_correct).length;
  }
}
