import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';
import type { QuizQuestion } from '@app/features/instructor/models/instructor.models';
import type {
  EnrolledCourseItem,
  QuizAttemptHistoryItem,
  QuizAttemptResult,
  QuizDetail,
  QuizListItem
} from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';

interface QuestionNavigatorItem {
  question: QuizQuestion;
  index: number;
  answered: boolean;
  flagged: boolean;
  current: boolean;
  visited: boolean;
}

@Component({
  selector: 'app-student-quizzes',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  templateUrl: './quizzes.component.html',
  styleUrls: ['./quizzes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentQuizzesComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  private selectionToken = 0;
  private timerHandle: ReturnType<typeof window.setInterval> | null = null;

  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly selectedCourseId = signal('');
  readonly quizzes = signal<QuizListItem[]>([]);
  readonly selectedQuiz = signal<QuizDetail | null>(null);
  readonly examQuestions = signal<QuizQuestion[]>([]);
  readonly attemptHistory = signal<QuizAttemptHistoryItem[]>([]);
  readonly answers = signal<Record<string, string[]>>({});
  readonly reviewMarks = signal<Record<string, boolean>>({});
  readonly visitedQuestionIds = signal<Record<string, boolean>>({});
  readonly activeQuestionIndex = signal(0);
  readonly catalogLoading = signal(false);
  readonly detailLoading = signal(false);
  readonly submitting = signal(false);
  readonly remainingSeconds = signal(0);
  readonly timerExpired = signal(false);
  readonly showInstructions = signal(true);
  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  readonly selectedCourse = computed(() => this.enrolledCourses().find((course) => course.course_id === this.selectedCourseId()) ?? null);
  readonly selectedCourseTitle = computed(() => this.selectedCourse()?.title ?? 'Selected course');
  readonly filteredQuizzes = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    const selectedCourseTitle = this.selectedCourseTitle();

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
  readonly questionNavigator = computed<QuestionNavigatorItem[]>(() => {
    const questions = this.examQuestions();
    const answers = this.answers();
    const reviewMarks = this.reviewMarks();
    const activeQuestionIndex = this.activeQuestionIndex();
    const visitedQuestionIds = this.visitedQuestionIds();

    return questions.map((question, index) => ({
      question,
      index,
      answered: (answers[question.id] ?? []).length > 0,
      flagged: !!reviewMarks[question.id],
      current: index === activeQuestionIndex,
      visited: !!visitedQuestionIds[question.id]
    }));
  });
  readonly currentQuestion = computed(() => this.examQuestions()[this.activeQuestionIndex()] ?? null);
  readonly answeredCount = computed(() => this.questionNavigator().filter((item) => item.answered).length);
  readonly flaggedCount = computed(() => this.questionNavigator().filter((item) => item.flagged).length);
  readonly visitedCount = computed(() => this.questionNavigator().filter((item) => item.visited).length);
  readonly notVisitedCount = computed(() => Math.max(this.examQuestions().length - this.visitedCount(), 0));
  readonly remainingCount = computed(() => Math.max(this.examQuestions().length - this.answeredCount(), 0));
  readonly progressPercent = computed(() => {
    const total = this.examQuestions().length;
    return total ? Math.round((this.answeredCount() / total) * 100) : 0;
  });
  readonly attemptsRemaining = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz) {
      return 0;
    }

    return Math.max(quiz.max_attempts - this.attemptHistory().length, 0);
  });
  readonly suggestedDurationMinutes = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz) {
      return 0;
    }

    return Math.max(12, Math.ceil((this.examQuestions().length || quiz.question_count || 0) * 1.5));
  });
  readonly timeRemainingLabel = computed(() => this.formatDuration(this.remainingSeconds()));
  readonly canSubmitAttempt = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz || this.examQuestions().length === 0) {
      return false;
    }

    return !this.submitting() && this.remainingCount() === 0;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const quizId = params.get('quizId');
        if (quizId) {
          this.loadQuizWorkspace(quizId);
          return;
        }

        this.resetExamState();
      });

    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        const selectedCourseId = courseId ?? '';
        this.selectedCourseId.set(selectedCourseId);
        this.resetExamState();
        this.quizzes.set([]);

        if (selectedCourseId) {
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

    this.catalogLoading.set(true);
    this.studentPortalService.listQuizzes(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.quizzes.set(response.items);
          this.catalogLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.quizzes.set([]);
          this.catalogLoading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load quizzes.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  selectQuiz(quiz: QuizListItem): void {
    void this.router.navigate(['/app/student/quizzes', quiz.id]);
  }

  loadAttemptHistory(quizId: string, requestToken = this.selectionToken): void {
    this.studentPortalService.getQuizAttemptHistory(quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          if (requestToken !== this.selectionToken) {
            return;
          }

          this.attemptHistory.set(history.items);
        },
        error: () => {
          if (requestToken === this.selectionToken) {
            this.attemptHistory.set([]);
          }
        }
      });
  }

  activateQuestion(index: number): void {
    if (index < 0 || index >= this.examQuestions().length) {
      return;
    }

    this.activeQuestionIndex.set(index);
    const question = this.examQuestions()[index];
    if (question) {
      this.markQuestionVisited(question.id);
    }
  }

  previousQuestion(): void {
    this.activateQuestion(this.activeQuestionIndex() - 1);
  }

  nextQuestion(): void {
    this.activateQuestion(this.activeQuestionIndex() + 1);
  }

  hasPrevious(): boolean {
    return this.activeQuestionIndex() > 0;
  }

  hasNext(): boolean {
    return this.activeQuestionIndex() < this.examQuestions().length - 1;
  }

  isSelected(questionId: string, optionId: string): boolean {
    return (this.answers()[questionId] ?? []).includes(optionId);
  }

  isCurrentQuestionFlagged(): boolean {
    const question = this.currentQuestion();
    return !!question && !!this.reviewMarks()[question.id];
  }

  selectOption(questionId: string, optionId: string, allowMultiple: boolean): void {
    this.markQuestionVisited(questionId);
    this.answers.update((current) => {
      const existing = current[questionId] ?? [];

      if (allowMultiple) {
        const hasSelection = existing.includes(optionId);
        return {
          ...current,
          [questionId]: hasSelection
            ? existing.filter((id) => id !== optionId)
            : [...existing, optionId]
        };
      }

      if (existing.length === 1 && existing[0] === optionId) {
        return current;
      }

      return { ...current, [questionId]: [optionId] };
    });
  }

  toggleReviewCurrentQuestion(): void {
    const question = this.currentQuestion();
    if (!question) {
      return;
    }

    this.reviewMarks.update((current) => {
      const next = { ...current };
      if (next[question.id]) {
        delete next[question.id];
      } else {
        next[question.id] = true;
      }
      return next;
    });
  }

  clearCurrentAnswer(): void {
    const question = this.currentQuestion();
    if (!question) {
      return;
    }

    this.answers.update((current) => {
      if (!(question.id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[question.id];
      return next;
    });
  }

  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  markReviewAndNext(): void {
    this.toggleReviewCurrentQuestion();
    this.nextQuestion();
  }

  saveAndNext(): void {
    this.nextQuestion();
  }

  toggleInstructions(): void {
    this.showInstructions.update((current) => !current);
  }

  openProfile(): void {
    void this.router.navigate(['/app/profile']);
  }

  scrollQuestionPaper(): void {
    queueMicrotask(() => {
      const questionPaper = document.querySelector('.exam-paper');
      questionPaper?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  submitAttempt(): void {
    if (!this.canSubmitAttempt()) {
      return;
    }

    const quiz = this.selectedQuiz();
    if (!quiz) {
      return;
    }

    this.submitSelectedQuiz(quiz);
  }

  private submitSelectedQuiz(quiz: QuizDetail): void {
    this.submitting.set(true);
    const payload = {
      answers: this.examQuestions().map((question) => ({
        question_id: question.id,
        selected_option_ids: this.answers()[question.id] ?? []
      }))
    };

    this.studentPortalService.submitQuizAttempt(quiz.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: QuizAttemptResult) => {
          this.stopTimer();
          this.snackBar.open('Quiz submitted successfully.', 'Dismiss', { duration: 3200 });
          this.loadAttemptHistory(quiz.id);
          void this.router.navigate(['/app/student/results', result.attempt_id]);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to submit quiz attempt.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  formatAttemptDate(value: string): string {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private resetExamState(): void {
    this.stopTimer();
    this.selectedQuiz.set(null);
    this.examQuestions.set([]);
    this.attemptHistory.set([]);
    this.answers.set({});
    this.reviewMarks.set({});
    this.visitedQuestionIds.set({});
    this.activeQuestionIndex.set(0);
    this.remainingSeconds.set(0);
    this.timerExpired.set(false);
    this.submitting.set(false);
    this.showInstructions.set(true);
  }

  private loadQuizWorkspace(quizId: string): void {
    this.selectionToken += 1;
    const requestToken = this.selectionToken;
    this.detailLoading.set(true);
    this.resetExamState();

    this.studentPortalService.getQuiz(quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (requestToken !== this.selectionToken) {
            return;
          }

          const orderedQuestions = this.orderQuestions(detail);
          this.selectedQuiz.set(detail);
          this.examQuestions.set(orderedQuestions);
          this.activeQuestionIndex.set(0);
          this.answers.set({});
          this.reviewMarks.set({});
          this.visitedQuestionIds.set(orderedQuestions[0]?.id ? { [orderedQuestions[0].id]: true } : {});
          this.showInstructions.set(true);
          this.loadAttemptHistory(detail.id, requestToken);
          this.startTimer(detail);
          this.detailLoading.set(false);
          this.scrollExamIntoView();
        },
        error: (error: HttpErrorResponse) => {
          if (requestToken !== this.selectionToken) {
            return;
          }

          this.selectedQuiz.set(null);
          this.examQuestions.set([]);
          this.detailLoading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load quiz details.', 'Dismiss', { duration: 4500 });
          void this.router.navigate(['/app/student/quizzes']);
        }
      });
  }

  private orderQuestions(quiz: QuizDetail): QuizQuestion[] {
    const questions = [...(quiz.questions ?? [])].sort((left, right) => left.position - right.position);
    if (!quiz.shuffle_questions) {
      return questions;
    }

    return this.shuffleQuestions(questions);
  }

  private shuffleQuestions(questions: QuizQuestion[]): QuizQuestion[] {
    const shuffled = [...questions];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  private startTimer(quiz: QuizDetail): void {
    this.stopTimer();

    const totalSeconds = this.estimateDurationSeconds(quiz);
    this.remainingSeconds.set(totalSeconds);
    this.timerExpired.set(false);

    this.timerHandle = window.setInterval(() => {
      const nextSeconds = Math.max(0, this.remainingSeconds() - 1);
      this.remainingSeconds.set(nextSeconds);

      if (nextSeconds === 0) {
        this.timerExpired.set(true);
        this.stopTimer();
      }
    }, 1000);
  }

  private estimateDurationSeconds(quiz: QuizDetail): number {
    const questionCount = Math.max(quiz.questions?.length ?? 0, quiz.question_count ?? 0);
    return Math.max(12 * 60, Math.ceil(questionCount * 1.5) * 60);
  }

  private stopTimer(): void {
    if (this.timerHandle !== null) {
      window.clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private scrollExamIntoView(): void {
    queueMicrotask(() => {
      const examWindow = document.querySelector('.exam-window');
      examWindow?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private markQuestionVisited(questionId: string): void {
    this.visitedQuestionIds.update((current) => ({ ...current, [questionId]: true }));
  }

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
