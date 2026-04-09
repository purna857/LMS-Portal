import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type {
  AnnouncementResponse,
  NotificationItem,
  NotificationListResponse,
  PlatformAnnouncementPayload
} from '@app/features/admin/models/admin.models';
import type { CourseAnnouncementPayload } from '@app/features/instructor/models/instructor.models';


@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly api = inject(ApiClientService);

  createPlatformAnnouncement(payload: PlatformAnnouncementPayload): Observable<AnnouncementResponse> {
    return this.api.post<AnnouncementResponse>('/announcements/platform', payload);
  }

  createCourseAnnouncement(courseId: string, payload: CourseAnnouncementPayload): Observable<AnnouncementResponse> {
    return this.api.post<AnnouncementResponse>(`/courses/${courseId}/announcements`, payload);
  }

  listMyNotifications(): Observable<NotificationListResponse> {
    return this.api.get<NotificationListResponse>('/notifications/me');
  }

  markNotificationRead(notificationId: string): Observable<NotificationItem> {
    return this.api.post<NotificationItem>(`/notifications/${notificationId}/read`, {});
  }
}
