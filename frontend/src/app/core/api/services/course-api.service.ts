import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type { MessageResponse } from '@app/core/models/auth.model';
import type {
  CourseCategory,
  CourseCreatePayload,
  CourseDetail,
  CourseListResponse,
  CoursePublishActionResponse,
  CourseUpdatePayload,
  CourseModule,
  CourseModuleListResponse,
  CourseModulePayload,
  Lesson,
  LessonListResponse,
  LessonPayload
} from '@app/features/instructor/models/instructor.models';
import type { EnrollmentResponse } from '@app/features/student/models/student.models';
import type { CourseListQuery } from '@app/features/student/models/student.models';


@Injectable({ providedIn: 'root' })
export class CourseApiService {
  private readonly api = inject(ApiClientService);

  listCourses(query: CourseListQuery = {}): Observable<CourseListResponse> {
    return this.api.get<CourseListResponse>('/courses', query);
  }

  listPublishedCourses(query: CourseListQuery = {}): Observable<CourseListResponse> {
    return this.api.get<CourseListResponse>('/courses/published', query);
  }

  listMyCourses(query: { status?: string; limit?: number; offset?: number } = {}): Observable<CourseListResponse> {
    return this.api.get<CourseListResponse>('/courses/mine', query);
  }

  getCourse(courseId: string): Observable<CourseDetail> {
    return this.api.get<CourseDetail>(`/courses/${courseId}`);
  }

  createCourse(payload: CourseCreatePayload): Observable<CourseDetail> {
    return this.api.post<CourseDetail>('/courses', payload);
  }

  updateCourse(courseId: string, payload: CourseUpdatePayload): Observable<CourseDetail> {
    return this.api.patch<CourseDetail>(`/courses/${courseId}`, payload);
  }

  deleteCourse(courseId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/courses/${courseId}`);
  }

  publishCourse(courseId: string): Observable<CoursePublishActionResponse> {
    return this.api.post<CoursePublishActionResponse>(`/courses/${courseId}/publish`, {});
  }

  unpublishCourse(courseId: string): Observable<CoursePublishActionResponse> {
    return this.api.post<CoursePublishActionResponse>(`/courses/${courseId}/unpublish`, {});
  }

  setCoursePublishState(courseId: string, status: 'draft' | 'published'): Observable<CoursePublishActionResponse> {
    return this.api.patch<CoursePublishActionResponse>(`/courses/${courseId}/publish`, { status });
  }

  assignCourse(payload: { course_id: string; student_id: string }): Observable<EnrollmentResponse> {
    return this.api.post<EnrollmentResponse>('/assign-course', payload);
  }

  listCategories(): Observable<CourseCategory[]> {
    return this.api.get<CourseCategory[]>('/categories');
  }

  listModules(courseId: string): Observable<CourseModuleListResponse> {
    return this.api.get<CourseModuleListResponse>(`/courses/${courseId}/modules`);
  }

  createModule(courseId: string, payload: CourseModulePayload): Observable<CourseModule> {
    return this.api.post<CourseModule>(`/courses/${courseId}/modules`, payload);
  }

  updateModule(moduleId: string, payload: Partial<CourseModulePayload>): Observable<CourseModule> {
    return this.api.patch<CourseModule>(`/course-modules/${moduleId}`, payload);
  }

  deleteModule(moduleId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/course-modules/${moduleId}`);
  }

  listLessons(moduleId: string): Observable<LessonListResponse> {
    return this.api.get<LessonListResponse>(`/course-modules/${moduleId}/lessons`);
  }

  createLesson(moduleId: string, payload: LessonPayload): Observable<Lesson> {
    return this.api.post<Lesson>(`/course-modules/${moduleId}/lessons`, payload);
  }

  updateLesson(lessonId: string, payload: Partial<LessonPayload>): Observable<Lesson> {
    return this.api.patch<Lesson>(`/lessons/${lessonId}`, payload);
  }

  deleteLesson(lessonId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/lessons/${lessonId}`);
  }
}
