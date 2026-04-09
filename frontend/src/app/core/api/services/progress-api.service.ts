import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type {
  CourseLessonProgress,
  CourseProgress,
  ProgressSummary
} from '@app/features/student/models/student.models';
import type { StudentCourseProgressListResponse } from '@app/features/instructor/models/instructor.models';


@Injectable({ providedIn: 'root' })
export class ProgressApiService {
  private readonly api = inject(ApiClientService);

  getCourseProgress(courseId: string): Observable<CourseProgress> {
    return this.api.get<CourseProgress>(`/progress/courses/${courseId}/me`);
  }

  getCourseLessonProgress(courseId: string): Observable<CourseLessonProgress> {
    return this.api.get<CourseLessonProgress>(`/progress/courses/${courseId}/lessons/me`);
  }

  completeLesson(lessonId: string): Observable<CourseProgress> {
    return this.api.post<CourseProgress>(`/progress/lessons/${lessonId}/complete`, {});
  }

  getProgressSummary(): Observable<ProgressSummary> {
    return this.api.get<ProgressSummary>('/progress/summary');
  }

  getCourseStudentProgress(courseId: string): Observable<StudentCourseProgressListResponse> {
    return this.api.get<StudentCourseProgressListResponse>(`/progress/courses/${courseId}/students`);
  }
}
