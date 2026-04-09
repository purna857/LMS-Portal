import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import { AnalyticsApiService } from '@app/core/api/services/analytics-api.service';
import { AssignmentApiService } from '@app/core/api/services/assignment-api.service';
import { CourseApiService } from '@app/core/api/services/course-api.service';
import { NotificationApiService } from '@app/core/api/services/notification-api.service';
import type { MessageResponse } from '@app/core/models/auth.model';
import type {
  AdminDashboardStats,
  AdminAssignmentTrackerListResponse,
  AdminUserListResponse,
  AnnouncementResponse,
  CourseCategory,
  CourseCategoryPayload,
  CourseDetail,
  CourseListQuery,
  CourseListResponse,
  CoursePublishActionResponse,
  CourseUpdatePayload,
  InstructorApprovalActionResponse,
  InstructorApprovalListResponse,
  NotificationItem,
  NotificationListResponse,
  PlatformAnnouncementPayload,
  UserListQuery
} from '@app/features/admin/models/admin.models';


@Injectable({ providedIn: 'root' })
export class AdminPortalService {
  private readonly api = inject(ApiClientService);
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly assignmentApi = inject(AssignmentApiService);
  private readonly courseApi = inject(CourseApiService);
  private readonly notificationApi = inject(NotificationApiService);

  getAdminDashboardStats(): Observable<AdminDashboardStats> {
    return this.analyticsApi.getAdminDashboardStats();
  }

  listUsers(query: UserListQuery = {}): Observable<AdminUserListResponse> {
    return this.api.get<AdminUserListResponse>('/users', query);
  }

  blockUser(userId: string): Observable<MessageResponse> {
    return this.api.post<MessageResponse>(`/users/${userId}/block`, {});
  }

  unblockUser(userId: string): Observable<MessageResponse> {
    return this.api.post<MessageResponse>(`/users/${userId}/unblock`, {});
  }

  listInstructorApprovals(status?: string): Observable<InstructorApprovalListResponse> {
    return this.api.get<InstructorApprovalListResponse>('/instructor-approvals', { status });
  }

  approveInstructor(requestId: string, reviewNotes?: string): Observable<InstructorApprovalActionResponse> {
    return this.api.post<InstructorApprovalActionResponse>(
      `/instructor-approvals/${requestId}/approve`,
      { review_notes: reviewNotes?.trim() || null }
    );
  }

  rejectInstructor(requestId: string, reviewNotes?: string): Observable<InstructorApprovalActionResponse> {
    return this.api.post<InstructorApprovalActionResponse>(
      `/instructor-approvals/${requestId}/reject`,
      { review_notes: reviewNotes?.trim() || null }
    );
  }

  listCourses(query: CourseListQuery = {}): Observable<CourseListResponse> {
    return this.courseApi.listCourses(query);
  }

  getCourse(courseId: string): Observable<CourseDetail> {
    return this.courseApi.getCourse(courseId);
  }

  updateCourse(courseId: string, payload: CourseUpdatePayload): Observable<CourseDetail> {
    return this.courseApi.updateCourse(courseId, payload);
  }

  publishCourse(courseId: string): Observable<CoursePublishActionResponse> {
    return this.courseApi.publishCourse(courseId);
  }

  unpublishCourse(courseId: string): Observable<CoursePublishActionResponse> {
    return this.courseApi.unpublishCourse(courseId);
  }

  deleteCourse(courseId: string): Observable<MessageResponse> {
    return this.courseApi.deleteCourse(courseId);
  }

  listCategories(): Observable<CourseCategory[]> {
    return this.courseApi.listCategories();
  }

  createCategory(payload: CourseCategoryPayload): Observable<CourseCategory> {
    return this.api.post<CourseCategory>('/categories', payload);
  }

  updateCategory(categoryId: string, payload: Partial<CourseCategoryPayload>): Observable<CourseCategory> {
    return this.api.patch<CourseCategory>(`/categories/${categoryId}`, payload);
  }

  deleteCategory(categoryId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/categories/${categoryId}`);
  }

  createPlatformAnnouncement(payload: PlatformAnnouncementPayload): Observable<AnnouncementResponse> {
    return this.notificationApi.createPlatformAnnouncement(payload);
  }

  listMyNotifications(): Observable<NotificationListResponse> {
    return this.notificationApi.listMyNotifications();
  }

  markNotificationRead(notificationId: string): Observable<NotificationItem> {
    return this.notificationApi.markNotificationRead(notificationId);
  }

  listAssignmentTracker(): Observable<AdminAssignmentTrackerListResponse> {
    return this.assignmentApi.listAdminAssignmentTracker();
  }
}
