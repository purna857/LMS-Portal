import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AnalyticsApiService } from '@app/core/api/services/analytics-api.service';
import { AssignmentApiService } from '@app/core/api/services/assignment-api.service';
import { CourseApiService } from '@app/core/api/services/course-api.service';
import { EnrollmentApiService } from '@app/core/api/services/enrollment-api.service';
import { NotificationApiService } from '@app/core/api/services/notification-api.service';
import { ProgressApiService } from '@app/core/api/services/progress-api.service';
import { QuizApiService } from '@app/core/api/services/quiz-api.service';
import type { MessageResponse } from '@app/core/models/auth.model';
import type { CourseCategory } from '@app/features/admin/models/admin.models';
import type {
  Assignment,
  AssignmentListResponse,
  AssignmentPayload,
  AssignmentSubmissionDetail,
  AssignmentSubmissionListResponse,
  AssignmentGradePayload,
  CourseAnnouncementPayload,
  CourseCreatePayload,
  CourseModule,
  CourseModuleListResponse,
  CourseModulePayload,
  CourseDetail,
  CourseListResponse,
  CoursePublishActionResponse,
  CourseUpdatePayload,
  EnrolledStudentsResponse,
  EnrollmentStats,
  InstructorDashboardStats,
  Lesson,
  LessonListResponse,
  LessonPayload,
  NotificationItem,
  QuizDetail,
  QuizListResponse,
  QuizPayload,
  QuizQuestion,
  QuizQuestionPayload,
  StudentCourseProgressListResponse,
  AnnouncementResponse
} from '@app/features/instructor/models/instructor.models';


@Injectable({ providedIn: 'root' })
export class InstructorPortalService {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly assignmentApi = inject(AssignmentApiService);
  private readonly courseApi = inject(CourseApiService);
  private readonly enrollmentApi = inject(EnrollmentApiService);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly progressApi = inject(ProgressApiService);
  private readonly quizApi = inject(QuizApiService);

  getDashboardStats(): Observable<InstructorDashboardStats> {
    return this.analyticsApi.getInstructorDashboardStats();
  }

  listMyCourses(status?: string): Observable<CourseListResponse> {
    return this.courseApi.listMyCourses({ status, limit: 100, offset: 0 });
  }

  createCourse(payload: CourseCreatePayload): Observable<CourseDetail> {
    return this.courseApi.createCourse(payload);
  }

  updateCourse(courseId: string, payload: CourseUpdatePayload): Observable<CourseDetail> {
    return this.courseApi.updateCourse(courseId, payload);
  }

  deleteCourse(courseId: string): Observable<MessageResponse> {
    return this.courseApi.deleteCourse(courseId);
  }

  publishCourse(courseId: string): Observable<CoursePublishActionResponse> {
    return this.courseApi.publishCourse(courseId);
  }

  unpublishCourse(courseId: string): Observable<CoursePublishActionResponse> {
    return this.courseApi.unpublishCourse(courseId);
  }

  getCourse(courseId: string): Observable<CourseDetail> {
    return this.courseApi.getCourse(courseId);
  }

  listCategories(): Observable<CourseCategory[]> {
    return this.courseApi.listCategories();
  }

  listModules(courseId: string): Observable<CourseModuleListResponse> {
    return this.courseApi.listModules(courseId);
  }

  createModule(courseId: string, payload: CourseModulePayload): Observable<CourseModule> {
    return this.courseApi.createModule(courseId, payload);
  }

  updateModule(moduleId: string, payload: Partial<CourseModulePayload>): Observable<CourseModule> {
    return this.courseApi.updateModule(moduleId, payload);
  }

  deleteModule(moduleId: string): Observable<MessageResponse> {
    return this.courseApi.deleteModule(moduleId);
  }

  listLessons(moduleId: string): Observable<LessonListResponse> {
    return this.courseApi.listLessons(moduleId);
  }

  createLesson(moduleId: string, payload: LessonPayload): Observable<Lesson> {
    return this.courseApi.createLesson(moduleId, payload);
  }

  updateLesson(lessonId: string, payload: Partial<LessonPayload>): Observable<Lesson> {
    return this.courseApi.updateLesson(lessonId, payload);
  }

  deleteLesson(lessonId: string): Observable<MessageResponse> {
    return this.courseApi.deleteLesson(lessonId);
  }

  listAssignments(courseId: string): Observable<AssignmentListResponse> {
    return this.assignmentApi.listAssignmentsByCourse(courseId);
  }

  createAssignment(courseId: string, payload: AssignmentPayload): Observable<Assignment> {
    return this.assignmentApi.createAssignment(courseId, payload);
  }

  updateAssignment(assignmentId: string, payload: Partial<AssignmentPayload>): Observable<Assignment> {
    return this.assignmentApi.updateAssignment(assignmentId, payload);
  }

  deleteAssignment(assignmentId: string): Observable<MessageResponse> {
    return this.assignmentApi.deleteAssignment(assignmentId);
  }

  listAssignmentSubmissions(assignmentId: string): Observable<AssignmentSubmissionListResponse> {
    return this.assignmentApi.listAssignmentSubmissions(assignmentId);
  }

  gradeAssignmentSubmission(submissionId: string, payload: AssignmentGradePayload): Observable<AssignmentSubmissionDetail> {
    return this.assignmentApi.gradeSubmission(submissionId, payload);
  }

  listQuizzes(courseId: string): Observable<QuizListResponse> {
    return this.quizApi.listQuizzesByCourse(courseId);
  }

  createQuiz(courseId: string, payload: QuizPayload): Observable<QuizDetail> {
    return this.quizApi.createQuiz(courseId, payload);
  }

  updateQuiz(quizId: string, payload: Partial<QuizPayload>): Observable<QuizDetail> {
    return this.quizApi.updateQuiz(quizId, payload);
  }

  deleteQuiz(quizId: string): Observable<MessageResponse> {
    return this.quizApi.deleteQuiz(quizId);
  }

  getQuiz(quizId: string): Observable<QuizDetail> {
    return this.quizApi.getQuiz(quizId);
  }

  createQuizQuestion(quizId: string, payload: QuizQuestionPayload): Observable<QuizQuestion> {
    return this.quizApi.createQuestion(quizId, payload);
  }

  updateQuizQuestion(questionId: string, payload: Partial<QuizQuestionPayload>): Observable<QuizQuestion> {
    return this.quizApi.updateQuestion(questionId, payload);
  }

  deleteQuizQuestion(questionId: string): Observable<MessageResponse> {
    return this.quizApi.deleteQuestion(questionId);
  }

  listEnrolledStudents(courseId: string): Observable<EnrolledStudentsResponse> {
    return this.enrollmentApi.listCourseStudents(courseId);
  }

  getEnrollmentStats(courseId: string): Observable<EnrollmentStats> {
    return this.enrollmentApi.getEnrollmentStats(courseId);
  }

  listStudentProgress(courseId: string): Observable<StudentCourseProgressListResponse> {
    return this.progressApi.getCourseStudentProgress(courseId);
  }

  createCourseAnnouncement(courseId: string, payload: CourseAnnouncementPayload): Observable<AnnouncementResponse> {
    return this.notificationApi.createCourseAnnouncement(courseId, payload);
  }

  listMyNotifications(): Observable<{ items: NotificationItem[]; total: number }> {
    return this.notificationApi.listMyNotifications();
  }

  markNotificationRead(notificationId: string): Observable<NotificationItem> {
    return this.notificationApi.markNotificationRead(notificationId);
  }
}
