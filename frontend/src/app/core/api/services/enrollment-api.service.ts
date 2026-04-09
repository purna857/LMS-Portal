import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type {
  EnrolledCourseListResponse,
  EnrollmentResponse
} from '@app/features/student/models/student.models';
import type {
  EnrolledStudentsResponse,
  EnrollmentStats
} from '@app/features/instructor/models/instructor.models';


@Injectable({ providedIn: 'root' })
export class EnrollmentApiService {
  private readonly api = inject(ApiClientService);

  enrollInCourse(courseId: string): Observable<EnrollmentResponse> {
    return this.api.post<EnrollmentResponse>(`/enrollments/courses/${courseId}`, {});
  }

  listEnrolledCourses(): Observable<EnrolledCourseListResponse> {
    return this.api.get<EnrolledCourseListResponse>('/enrollments/me/courses');
  }

  listCourseStudents(courseId: string): Observable<EnrolledStudentsResponse> {
    return this.api.get<EnrolledStudentsResponse>(`/enrollments/courses/${courseId}/students`);
  }

  getEnrollmentStats(courseId?: string): Observable<EnrollmentStats> {
    return this.api.get<EnrollmentStats>('/enrollments/stats', { course_id: courseId });
  }
}
