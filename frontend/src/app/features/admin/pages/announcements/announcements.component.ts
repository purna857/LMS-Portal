import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { NotificationItem } from '@app/features/admin/models/admin.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForNotificationType } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Platform Broadcasts"
        description="Broadcast operational updates, maintenance notices, and role-specific platform communication.">
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
            <mat-card-title>Create Announcement</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="announcementForm" class="form-grid">
              <mat-form-field appearance="outline" class="form-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
                @if (announcementForm.controls.title.invalid && announcementForm.controls.title.touched) {
                  <mat-error>Title is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-grid__full">
                <mat-label>Message</mat-label>
                <textarea matInput rows="6" formControlName="body"></textarea>
                @if (announcementForm.controls.body.invalid && announcementForm.controls.body.touched) {
                  <mat-error>Message body is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-grid__full">
                <mat-label>Target Roles</mat-label>
                <mat-select formControlName="target_roles" multiple>
                  <mat-option value="admin">Admins</mat-option>
                  <mat-option value="instructor">Instructors</mat-option>
                  <mat-option value="student">Students</mat-option>
                </mat-select>
                <mat-hint>Leave empty to notify all active users.</mat-hint>
              </mat-form-field>
            </form>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-flat-button color="primary" type="button" (click)="createAnnouncement()">Publish Announcement</button>
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
                      <mat-chip-set>
                        <mat-chip data-tone="success">Read</mat-chip>
                      </mat-chip-set>
                    }
                  </div>
                }
              </div>
            } @else if (notifications().length) {
              <app-empty-state
                icon="search_off"
                [title]="workspaceSearch.normalizedQuery() ? 'No matching notifications' : 'No notifications yet'"
                [description]="workspaceSearch.normalizedQuery() ? 'Try a different announcement title, message, or type.' : 'Announcements you publish and platform notifications will appear here.'">
              </app-empty-state>
            } @else {
              <app-empty-state
                icon="campaign"
                title="No notifications yet"
                description="Announcements you publish and platform notifications will appear here.">
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
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 1.25rem;
    }

    .form-grid {
      display: grid;
      gap: 1rem;
    }

    .form-grid__full {
      grid-column: 1 / -1;
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

    .stack-list__item p {
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
      .announcement-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly summaryCards = computed(() => {
    const notifications = this.notifications();
    return [
      {
        label: 'Notifications',
        value: String(notifications.length),
        hint: 'Announcement feed items currently loaded',
        icon: 'campaign'
      },
      {
        label: 'Unread',
        value: String(notifications.filter((notification) => !notification.is_read).length),
        hint: 'Messages still needing review',
        icon: 'mark_email_unread'
      },
      {
        label: 'Read',
        value: String(notifications.filter((notification) => notification.is_read).length),
        hint: 'Messages already acknowledged',
        icon: 'done_all'
      },
      {
        label: 'Platform',
        value: String(notifications.filter((notification) => notification.notification_type === 'platform').length),
        hint: 'Platform-wide notices in the feed',
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

  readonly announcementForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    body: ['', [Validators.required]],
    target_roles: [[] as string[]]
  });

  constructor() {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.adminPortalService.listMyNotifications()
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

  createAnnouncement(): void {
    this.announcementForm.markAllAsTouched();
    if (this.announcementForm.invalid) {
      return;
    }

    const raw = this.announcementForm.getRawValue();
    this.adminPortalService.createPlatformAnnouncement({
      title: String(raw.title ?? '').trim(),
      body: String(raw.body ?? '').trim(),
      target_roles: raw.target_roles?.length ? raw.target_roles : null
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Platform announcement published.', 'Dismiss', { duration: 3200 });
          this.announcementForm.reset({
            title: '',
            body: '',
            target_roles: []
          });
          this.loadNotifications();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to publish the announcement.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  markAsRead(notification: NotificationItem): void {
    this.adminPortalService.markNotificationRead(notification.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.update((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to mark notification as read.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
