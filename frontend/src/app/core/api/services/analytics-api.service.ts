import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type { AdminDashboardStats } from '@app/features/admin/models/admin.models';
import type { InstructorDashboardStats } from '@app/features/instructor/models/instructor.models';
import type { StudentDashboardStats } from '@app/features/student/models/student.models';


@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly api = inject(ApiClientService);

  getAdminDashboardStats(): Observable<AdminDashboardStats> {
    return this.api.get<AdminDashboardStats>('/analytics/admin/dashboard');
  }

  getInstructorDashboardStats(): Observable<InstructorDashboardStats> {
    return this.api.get<InstructorDashboardStats>('/analytics/instructor/dashboard');
  }

  getStudentDashboardStats(): Observable<StudentDashboardStats> {
    return this.api.get<StudentDashboardStats>('/analytics/student/dashboard');
  }
}
