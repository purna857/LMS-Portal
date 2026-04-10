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

interface QuizInstructionItem {
  title: string;
  bullets: string[];
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
  readonly openingQuizId = signal<string | null>(null);
  readonly activeQuestionIndex = signal(0);
  readonly catalogLoading = signal(false);
  readonly detailLoading = signal(false);
  readonly submitting = signal(false);
  readonly remainingSeconds = signal(0);
  readonly timerExpired = signal(false);
  readonly showInstructions = signal(false);
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
  readonly currentQuestionAnswered = computed(() => {
    const question = this.currentQuestion();
    return !!question && (this.answers()[question.id] ?? []).length > 0;
  });
  readonly isLastQuestion = computed(() => this.examQuestions().length > 0 && this.activeQuestionIndex() === this.examQuestions().length - 1);
  readonly markReviewActionLabel = computed(() => this.currentQuestionAnswered() ? 'Mark for Review' : 'Mark for Review & Next');
  readonly quizInstructions = computed<QuizInstructionItem[]>(() => {
    const quiz = this.selectedQuiz();
    if (!quiz) {
      return [];
    }

    const totalQuestions = this.examQuestions().length || quiz.question_count || 0;

    return [
      {
        title: `This quiz contains ${totalQuestions || 'multiple'} questions and must be completed in one sitting.`,
        bullets: [
          'Use the question palette to move between questions quickly.',
          'Answer every question before you submit the attempt.'
        ]
      },
      {
        title: 'Read each question carefully before selecting an answer.',
        bullets: [
          'Some questions are single answer, while others may allow multiple answers.',
          'Use Clear Response if you want to change your choice.'
        ]
      },
      {
        title: 'Click Save & Next to store your answer and continue.',
        bullets: [
          'Mark for Review keeps a question easy to return to later.',
          'Answered questions appear green in the palette for quick tracking.'
        ]
      },
      {
        title: 'Questions marked for review are highlighted in violet.',
        bullets: [
          'You can revisit a marked question before final submission.',
          'The review state stays visible on both the question and palette.'
        ]
      },
      {
        title: 'The Submit button appears only after the last question is reached.',
        bullets: [
          'Submit is enabled only when all questions have been answered.',
          'After submission, the attempt is treated as final.'
        ]
      },
      {
        title: 'Keep an eye on the timer throughout the attempt.',
        bullets: [
          'Finish with a few minutes left so you can review flagged items.',
          'Once time expires, the remaining answers are locked.'
        ]
      }
    ];
  });
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
    if (this.detailLoading() || this.openingQuizId() === quiz.id || this.selectedQuiz()?.id === quiz.id) {
      return;
    }

    this.markQuizLaunch(quiz.id);
    this.openingQuizId.set(quiz.id);
    void this.router.navigate(['/app/student/quizzes', quiz.id], { replaceUrl: true });
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

    this.answers.set({});
    this.reviewMarks.set({});

    const firstQuestionId = this.examQuestions()[0]?.id ?? null;
    this.visitedQuestionIds.set(firstQuestionId ? { [firstQuestionId]: true } : {});
    this.activeQuestionIndex.set(0);
    this.showInstructions.set(false);
  }

  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  markReviewAndNext(): void {
    const question = this.currentQuestion();
    if (!question) {
      return;
    }

    const advanceToNext = !(this.answers()[question.id] ?? []).length;
    this.toggleReviewCurrentQuestion();
    if (advanceToNext) {
      this.nextQuestion();
    }
  }

  saveAndNext(): void {
    if (!this.currentQuestion()) {
      return;
    }

    // Saving should only advance the attempt; answer/review state is already
    // controlled by the option selection and mark-for-review actions.
    this.nextQuestion();
  }

  toggleInstructions(): void {
    this.showInstructions.update((current) => !current);
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
    this.openingQuizId.set(null);
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
    this.showInstructions.set(false);
  }

  private loadQuizWorkspace(quizId: string): void {
    if (!this.consumeQuizLaunch(quizId)) {
      this.resetExamState();
      this.detailLoading.set(false);
      void this.router.navigate(['/app/student/quizzes'], { replaceUrl: true });
      return;
    }

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
          this.showInstructions.set(false);
          this.loadAttemptHistory(detail.id, requestToken);
          this.startTimer(detail);
          this.openingQuizId.set(null);
          this.detailLoading.set(false);
          this.clearQuizLaunch(detail.id);
          this.scrollExamIntoView();
        },
        error: (error: HttpErrorResponse) => {
          if (requestToken !== this.selectionToken) {
            return;
          }

          this.selectedQuiz.set(null);
          this.examQuestions.set([]);
          this.openingQuizId.set(null);
          this.detailLoading.set(false);
          this.clearQuizLaunch(quizId);
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

  private quizLaunchKey(quizId: string): string {
    return `student-quiz-launch:${quizId}`;
  }

  private markQuizLaunch(quizId: string): void {
    sessionStorage.setItem(this.quizLaunchKey(quizId), String(Date.now()));
  }

  private consumeQuizLaunch(quizId: string): boolean {
    const key = this.quizLaunchKey(quizId);
    const token = sessionStorage.getItem(key);
    if (!token) {
      return false;
    }

    sessionStorage.removeItem(key);
    return true;
  }

  private clearQuizLaunch(quizId: string): void {
    sessionStorage.removeItem(this.quizLaunchKey(quizId));
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
