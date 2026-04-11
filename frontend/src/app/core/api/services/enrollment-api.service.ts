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

  enroll(courseId: string): Observable<EnrollmentResponse> {
    return this.api.post<EnrollmentResponse>('/enroll', { course_id: courseId });
  }

  enrollInCourse(courseId: string): Observable<EnrollmentResponse> {
    return this.enroll(courseId);
  }

  listMyCourses(): Observable<EnrolledCourseListResponse> {
    return this.api.get<EnrolledCourseListResponse>('/my-courses');
  }

  listEnrolledCourses(): Observable<EnrolledCourseListResponse> {
    return this.listMyCourses();
  }

  listCourseEnrollments(courseId: string): Observable<EnrolledStudentsResponse> {
    return this.api.get<EnrolledStudentsResponse>(`/courses/${courseId}/enrollments`);
  }

  listCourseStudents(courseId: string): Observable<EnrolledStudentsResponse> {
    return this.listCourseEnrollments(courseId);
  }

  getEnrollmentStats(courseId?: string): Observable<EnrollmentStats> {
    return this.api.get<EnrollmentStats>('/enrollments/stats', { course_id: courseId });
  }

  assignCourse(payload: { course_id: string; student_id: string }): Observable<EnrollmentResponse> {
    return this.api.post<EnrollmentResponse>('/assign-course', payload);
  }
}
