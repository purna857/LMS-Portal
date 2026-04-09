import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { NotificationItem } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-student-notifications',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        title="Notifications"
        description="Stay up to date with course announcements, grading updates, and platform alerts.">
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="notifications-summary notifications-summary--skeleton">
          @for (item of [1, 2, 3]; track item) {
            <div class="notification-stat skeleton skeleton--card"></div>
          }
        </div>
      }

      @if (!loading()) {
        <div class="notifications-summary">
          <article class="notification-stat">
            <span class="notification-stat__label">Inbox</span>
            <strong>{{ totalCount() }}</strong>
            <p>Total notifications</p>
          </article>
          <article class="notification-stat">
            <span class="notification-stat__label">Unread</span>
            <strong>{{ unreadCount() }}</strong>
            <p>Need your attention</p>
          </article>
          <article class="notification-stat">
            <span class="notification-stat__label">Read</span>
            <strong>{{ readCount() }}</strong>
            <p>Already reviewed</p>
          </article>
        </div>
      }

      @if (!loading() && filteredNotifications().length) {
        <mat-card class="surface-card notification-card">
          <mat-card-header class="notification-card__header">
            <div>
              <mat-card-title>Inbox</mat-card-title>
              <p class="notification-card__subtitle">Newest updates from your courses and the platform.</p>
            </div>
            <span class="notification-card__badge">{{ filteredNotifications().length }} visible</span>
          </mat-card-header>
          <mat-card-content>
            <div class="notification-list">
              @for (notification of filteredNotifications(); track notification.id) {
                <article class="notification-item" [class.notification-item--read]="notification.is_read">
                  <div class="notification-item__icon">
                    <mat-icon>{{ notification.is_read ? 'drafts' : 'notifications_active' }}</mat-icon>
                  </div>
                  <div class="notification-item__copy">
                    <div class="notification-item__eyebrow">
                      <span>{{ formatNotificationType(notification.notification_type) }}</span>
                      @if (!notification.is_read) {
                        <strong>New</strong>
                      } @else {
                        <strong class="notification-item__eyebrow--muted">Read</strong>
                      }
                    </div>
                    <strong>{{ notification.title }}</strong>
                    <p>{{ notification.body }}</p>
                    <div class="notification-item__meta">
                      <span>{{ notification.created_at | date:'medium' }}</span>
                    </div>
                  </div>
                  <div class="notification-item__actions">
                    @if (!notification.is_read) {
                      <button class="notification-action-button" mat-flat-button color="primary" type="button" (click)="markAsRead(notification)">
                        Mark read
                      </button>
                    } @else {
                      <span class="notification-read-chip">Read</span>
                    }
                  </div>
                </article>
              }
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (!loading()) {
        <app-empty-state
          icon="notifications"
          title="No notifications yet"
          description="Announcements and updates will appear here once they are available for your account.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'IBM Plex Sans', sans-serif !important;
    }

    .page-section {
      display: grid;
      gap: 1.1rem;
    }

    .notifications-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .notifications-summary--skeleton {
      min-height: 6rem;
    }

    .notification-stat {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border: 1px solid rgba(37, 99, 235, 0.11);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
    }

    .notification-stat__label,
    .notification-card__badge {
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.68rem;
      font-weight: 800;
    }

    .notification-stat strong {
      font-size: clamp(1.3rem, 1.8vw, 1.8rem);
      line-height: 1;
      color: var(--primary-strong);
      letter-spacing: -0.04em;
    }

    .notification-stat p {
      margin: 0;
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.45;
    }

    .notification-card {
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 28px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98));
    }

    .notification-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.05rem 1.15rem 0;
    }

    .notification-card__subtitle {
      margin: 0.35rem 0 0;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }

    .notification-card__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.45rem 0.78rem;
      border-radius: 999px;
      background: #edf4ff;
      white-space: nowrap;
    }

    .notification-list {
      display: grid;
      gap: 0.9rem;
      padding-top: 0.9rem;
    }

    .notification-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: start;
      gap: 1rem;
      padding: 1rem 1.05rem;
      border-radius: 22px;
      border: 1px solid rgba(37, 99, 235, 0.1);
      background: #ffffff;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.03);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .notification-item:hover {
      transform: translateY(-1px);
      border-color: rgba(37, 99, 235, 0.2);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
    }

    .notification-item--read {
      background: linear-gradient(180deg, #ffffff, #fbfdff);
    }

    .notification-item__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 18px;
      background: #edf4ff;
      color: var(--primary);
      flex-shrink: 0;
    }

    .notification-item__icon mat-icon {
      width: 22px;
      height: 22px;
      font-size: 22px;
      line-height: 22px;
    }

    .notification-item__copy {
      display: grid;
      gap: 0.45rem;
      min-width: 0;
    }

    .notification-item__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.74rem;
    }

    .notification-item__eyebrow strong {
      color: var(--primary-strong);
    }

    .notification-item__eyebrow--muted {
      color: var(--muted) !important;
    }

    .notification-item__copy strong {
      font-size: 1rem;
      line-height: 1.4;
      color: var(--primary-strong);
    }

    .notification-item__copy p,
    .notification-item__meta {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.9rem;
    }

    .notification-item__meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .notification-item__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-width: 8rem;
    }

    .notification-action-button {
      min-width: 0;
      height: 2.7rem;
      padding: 0 1.15rem;
      border-radius: 999px !important;
      font-family: 'IBM Plex Sans', sans-serif !important;
      font-size: 0.9rem;
      font-weight: 700;
      color: #ffffff !important;
      background: var(--primary) !important;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
    }

    .notification-action-button:hover {
      background: #1d4ed8 !important;
    }

    .notification-read-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 6rem;
      padding: 0.62rem 0.95rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary);
      font-weight: 700;
      font-size: 0.88rem;
    }

    @media (max-width: 960px) {
      .notifications-summary {
        grid-template-columns: 1fr;
      }

      .notification-item {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .notification-item__actions {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }

    @media (max-width: 720px) {
      .notification-card__header {
        flex-direction: column;
      }

      .notification-item {
        grid-template-columns: 1fr;
      }

      .notification-item__actions {
        justify-content: flex-start;
        min-width: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentNotificationsComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(true);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly totalCount = computed(() => this.notifications().length);
  readonly unreadCount = computed(() => this.notifications().filter((notification) => !notification.is_read).length);
  readonly readCount = computed(() => this.notifications().filter((notification) => notification.is_read).length);
  readonly filteredNotifications = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    if (!query) {
      return this.notifications();
    }

    return this.notifications().filter((notification) =>
      [
        notification.title,
        notification.body,
        notification.notification_type
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });

  constructor() {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.studentPortalService.listNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.notifications.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.notifications.set([]);
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load notifications.', 'Dismiss', { duration: 4000 });
        }
      });
  }

  markAsRead(notification: NotificationItem): void {
    this.studentPortalService.markNotificationRead(notification.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.notifications.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update notification state.', 'Dismiss', { duration: 4000 });
        }
      });
  }

  formatNotificationType(value: string | null | undefined): string {
    if (!value) {
      return 'Notification';
    }

    return value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
