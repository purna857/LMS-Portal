import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AnalyticsApiService } from '@app/core/api/services/analytics-api.service';
import { AssignmentApiService } from '@app/core/api/services/assignment-api.service';
import { CourseApiService } from '@app/core/api/services/course-api.service';
import { EnrollmentApiService } from '@app/core/api/services/enrollment-api.service';
import { NotificationApiService } from '@app/core/api/services/notification-api.service';
import { ProgressApiService } from '@app/core/api/services/progress-api.service';
import { QuizApiService } from '@app/core/api/services/quiz-api.service';
import type {
  Assignment,
  AssignmentUploadResponse,
  AssignmentSubmissionResponse,
  AssignmentSubmitPayload,
  CourseDetail,
  CourseListItem,
  CourseListQuery,
  CourseModule,
  CourseLessonProgress,
  CourseProgress,
  EnrolledCourseListResponse,
  EnrollmentResponse,
  Lesson,
  NotificationItem,
  ProgressSummary,
  QuizAttemptHistoryResponse,
  QuizAttemptResult,
  QuizAttemptSubmitPayload,
  QuizDetail,
  QuizListItem,
  StudentDashboardStats
} from '@app/features/student/models/student.models';
import type { StudentAssignmentRecordListResponse } from '@app/features/student/models/student.models';


@Injectable({ providedIn: 'root' })
export class StudentPortalService {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly assignmentApi = inject(AssignmentApiService);
  private readonly courseApi = inject(CourseApiService);
  private readonly enrollmentApi = inject(EnrollmentApiService);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly progressApi = inject(ProgressApiService);
  private readonly quizApi = inject(QuizApiService);

  getDashboardStats(): Observable<StudentDashboardStats> {
    return this.analyticsApi.getStudentDashboardStats();
  }

  getProgressSummary(): Observable<ProgressSummary> {
    return this.progressApi.getProgressSummary();
  }

  listCourses(query: CourseListQuery = {}): Observable<{ items: CourseListItem[]; total: number; limit: number; offset: number }> {
    return this.courseApi.listCourses({ limit: 24, offset: 0, ...query });
  }

  getCourse(courseId: string): Observable<CourseDetail> {
    return this.courseApi.getCourse(courseId);
  }

  listModules(courseId: string): Observable<{ items: CourseModule[]; total: number }> {
    return this.courseApi.listModules(courseId);
  }

  listLessons(moduleId: string): Observable<{ items: Lesson[]; total: number }> {
    return this.courseApi.listLessons(moduleId);
  }

  listEnrolledCourses(): Observable<EnrolledCourseListResponse> {
    return this.enrollmentApi.listEnrolledCourses();
  }

  enrollInCourse(courseId: string): Observable<EnrollmentResponse> {
    return this.enrollmentApi.enrollInCourse(courseId);
  }

  getCourseProgress(courseId: string): Observable<CourseProgress> {
    return this.progressApi.getCourseProgress(courseId);
  }

  getCourseLessonProgress(courseId: string): Observable<CourseLessonProgress> {
    return this.progressApi.getCourseLessonProgress(courseId);
  }

  completeLesson(lessonId: string): Observable<CourseProgress> {
    return this.progressApi.completeLesson(lessonId);
  }

  listAssignments(courseId: string): Observable<{ items: Assignment[]; total: number }> {
    return this.assignmentApi.listAssignmentsByCourse(courseId);
  }

  submitAssignment(assignmentId: string, payload: AssignmentSubmitPayload): Observable<AssignmentSubmissionResponse> {
    return this.assignmentApi.submitAssignment(assignmentId, payload);
  }

  uploadAssignmentFile(file: File): Observable<AssignmentUploadResponse> {
    return this.assignmentApi.uploadAssignmentFile(file);
  }

  listMyAssignmentSubmissions(): Observable<StudentAssignmentRecordListResponse> {
    return this.assignmentApi.listMyAssignmentSubmissions();
  }

  listQuizzes(courseId: string): Observable<{ items: QuizListItem[]; total: number }> {
    return this.quizApi.listQuizzesByCourse(courseId);
  }

  getQuiz(quizId: string): Observable<QuizDetail> {
    return this.quizApi.getQuiz(quizId);
  }

  submitQuizAttempt(quizId: string, payload: QuizAttemptSubmitPayload): Observable<QuizAttemptResult> {
    return this.quizApi.submitAttempt(quizId, payload);
  }

  getQuizAttemptHistory(quizId: string): Observable<QuizAttemptHistoryResponse> {
    return this.quizApi.getAttemptHistory(quizId);
  }

  getQuizAttemptResult(attemptId: string): Observable<QuizAttemptResult> {
    return this.quizApi.getAttemptResult(attemptId);
  }

  listNotifications(): Observable<{ items: NotificationItem[]; total: number }> {
    return this.notificationApi.listMyNotifications();
  }

  markNotificationRead(notificationId: string): Observable<NotificationItem> {
    return this.notificationApi.markNotificationRead(notificationId);
  }
}
