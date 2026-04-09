import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type { MessageResponse } from '@app/core/models/auth.model';
import type {
  QuizDetail,
  QuizListResponse,
  QuizPayload,
  QuizQuestion,
  QuizQuestionPayload
} from '@app/features/instructor/models/instructor.models';
import type {
  QuizAttemptHistoryResponse,
  QuizAttemptResult,
  QuizAttemptSubmitPayload
} from '@app/features/student/models/student.models';


@Injectable({ providedIn: 'root' })
export class QuizApiService {
  private readonly api = inject(ApiClientService);

  listQuizzesByCourse(courseId: string): Observable<QuizListResponse> {
    return this.api.get<QuizListResponse>(`/courses/${courseId}/quizzes`);
  }

  getQuiz(quizId: string): Observable<QuizDetail> {
    return this.api.get<QuizDetail>(`/quizzes/${quizId}`);
  }

  createQuiz(courseId: string, payload: QuizPayload): Observable<QuizDetail> {
    return this.api.post<QuizDetail>(`/courses/${courseId}/quizzes`, payload);
  }

  updateQuiz(quizId: string, payload: Partial<QuizPayload>): Observable<QuizDetail> {
    return this.api.patch<QuizDetail>(`/quizzes/${quizId}`, payload);
  }

  deleteQuiz(quizId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/quizzes/${quizId}`);
  }

  createQuestion(quizId: string, payload: QuizQuestionPayload): Observable<QuizQuestion> {
    return this.api.post<QuizQuestion>(`/quizzes/${quizId}/questions`, payload);
  }

  updateQuestion(questionId: string, payload: Partial<QuizQuestionPayload>): Observable<QuizQuestion> {
    return this.api.patch<QuizQuestion>(`/quiz-questions/${questionId}`, payload);
  }

  deleteQuestion(questionId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/quiz-questions/${questionId}`);
  }

  submitAttempt(quizId: string, payload: QuizAttemptSubmitPayload): Observable<QuizAttemptResult> {
    return this.api.post<QuizAttemptResult>(`/quizzes/${quizId}/attempts`, payload);
  }

  getAttemptHistory(quizId: string): Observable<QuizAttemptHistoryResponse> {
    return this.api.get<QuizAttemptHistoryResponse>(`/quizzes/${quizId}/attempts/me`);
  }

  getAttemptResult(attemptId: string): Observable<QuizAttemptResult> {
    return this.api.get<QuizAttemptResult>(`/quiz-attempts/${attemptId}/result`);
  }
}
