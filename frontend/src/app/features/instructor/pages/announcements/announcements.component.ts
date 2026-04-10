import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import type { CourseListItem, NotificationItem } from '@app/features/instructor/models/instructor.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForNotificationType } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-instructor-announcements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Course Broadcasts"
        description="Notify your learners, coordinate instructors, and keep course communication clear and timely.">
      </app-page-header>

      <div class="page-grid">
        @for (card of summaryCards(); track card.label) {
          <mat-card class="stat-card stat-card--metric">
            <mat-card-content>
              <div class="metric-card__top">
                <span class="metric-card__icon material-symbols-outlined">{{ card.icon }}</span>
                <p class="metric-card__label">{{ card.label }}</p>
              </div>
              <strong class="metric-card__value">{{ card.value }}</strong>
              <span class="metric-card__hint">{{ card.hint }}</span>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <div class="announcement-layout">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Create Course Announcement</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Course</mat-label>
                <mat-select formControlName="course_id">
                  @for (course of courses(); track course.id) {
                    <mat-option [value]="course.id">{{ course.title }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-grid__full">
                <mat-label>Message</mat-label>
                <textarea matInput rows="6" formControlName="body"></textarea>
              </mat-form-field>

              <div class="audience-row form-grid__full">
                <mat-checkbox formControlName="include_students">Notify students</mat-checkbox>
                <mat-checkbox formControlName="include_instructors">Notify instructors</mat-checkbox>
              </div>
            </form>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-flat-button color="primary" type="button" (click)="publishAnnouncement()">Publish Announcement</button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>My Notification Feed</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (loading()) {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }

            @if (filteredNotifications().length) {
              <div class="stack-list">
                @for (notification of filteredNotifications(); track notification.id) {
                  <div class="stack-list__item">
                    <div>
                      <strong>{{ notification.title }}</strong>
                      <p>{{ notification.body }}</p>
                      <div class="stack-list__meta">
                        <mat-chip-set>
                          <mat-chip [attr.data-tone]="chipToneForNotificationType(notification.notification_type)">{{ notification.notification_type }}</mat-chip>
                        </mat-chip-set>
                        <span>{{ notification.created_at | date:'medium' }}</span>
                      </div>
                    </div>
                    @if (!notification.is_read) {
                      <button mat-stroked-button type="button" (click)="markAsRead(notification)">Mark Read</button>
                    } @else {
                      <mat-chip-set><mat-chip data-tone="success">Read</mat-chip></mat-chip-set>
                    }
                  </div>
                }
              </div>
            } @else if (notifications().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching notifications' : 'No notification history yet'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different announcement title, message, or type.' : 'Published announcements and notifications will appear here.'">
              </app-empty-state>
            } @else {
              <app-empty-state
                icon="campaign"
                title="No notification history yet"
                description="Published announcements and notifications will appear here.">
              </app-empty-state>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .announcement-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
      gap: 1.25rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .form-grid__full {
      grid-column: 1 / -1;
    }

    .audience-row,
    .stack-list {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .stack-list {
      display: grid;
      gap: 0.9rem;
    }

    .stack-list__item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: start;
      padding: 1rem 1.05rem;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(248, 251, 255, 0.92), #ffffff 72%);
    }

    .stack-list__item p,
    .meta,
    .stack-list__meta {
      margin: 0.35rem 0 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .stack-list__meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .stack-list__item .mat-mdc-chip-set {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    @media (max-width: 720px) {
      .stack-list__item {
        grid-template-columns: 1fr;
      }

      .stack-list__item > :last-child {
        justify-self: start;
      }
    }

    @media (max-width: 1100px) {
      .announcement-layout,
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementsComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspaceSearch = inject(WorkspaceSearchService);
  private readonly route = inject(ActivatedRoute);

  readonly courses = signal<CourseListItem[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly loading = signal(false);
  readonly summaryCards = computed(() => {
    const notifications = this.notifications();
    return [
      {
        label: 'Announcements',
        value: String(notifications.length),
        hint: 'Course notifications in your feed',
        icon: 'campaign'
      },
      {
        label: 'Unread',
        value: String(notifications.filter((notification) => !notification.is_read).length),
        hint: 'Updates still awaiting attention',
        icon: 'mark_email_unread'
      },
      {
        label: 'Course',
        value: String(notifications.filter((notification) => notification.notification_type === 'course').length),
        hint: 'Course-specific notices you sent',
        icon: 'school'
      },
      {
        label: 'Platform',
        value: String(notifications.filter((notification) => notification.notification_type === 'platform').length),
        hint: 'Broader platform announcements',
        icon: 'public'
      }
    ];
  });

  readonly chipToneForNotificationType = chipToneForNotificationType;
  readonly filteredNotifications = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.notifications();
    }

    return this.notifications().filter((notification) =>
      this.workspaceSearch.matches(
        notification.title,
        notification.body,
        notification.notification_type
      )
    );
  });

  readonly form = this.formBuilder.group({
    course_id: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    body: ['', [Validators.required]],
    include_students: [true],
    include_instructors: [true]
  });

  constructor() {
    this.instructorPortalService.listMyCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.items);
          const preferredCourseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';
          const selectedCourseId = response.items.find((course) => course.id === preferredCourseId)?.id ?? response.items[0]?.id ?? '';
          this.form.patchValue({ course_id: selectedCourseId });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load instructor courses.', 'Dismiss', { duration: 4500 });
        }
      });
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.instructorPortalService.listMyNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.notifications.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load notifications.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  publishAnnouncement(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    if (!value.include_students && !value.include_instructors) {
      this.snackBar.open('Choose at least one audience for the announcement.', 'Dismiss', { duration: 4000 });
      return;
    }
    const courseId = value.course_id || '';
    if (!courseId) {
      this.snackBar.open('Select a course for the announcement.', 'Dismiss', { duration: 4000 });
      return;
    }
    this.instructorPortalService.createCourseAnnouncement(courseId, {
      title: String(value.title ?? '').trim(),
      body: String(value.body ?? '').trim(),
      include_students: !!value.include_students,
      include_instructors: !!value.include_instructors
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Course announcement published.', 'Dismiss', { duration: 3200 });
          this.form.patchValue({
            title: '',
            body: '',
            include_students: true,
            include_instructors: true
          });
          this.loadNotifications();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to publish course announcement.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  markAsRead(notification: NotificationItem): void {
    this.instructorPortalService.markNotificationRead(notification.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.update((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update notification state.', 'Dismiss', { duration: 4000 });
        }
      });
  }
}
