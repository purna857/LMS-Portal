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
        <div class="stack-list">
          @for (item of [1, 2, 3]; track item) {
            <div class="stat-card skeleton skeleton--card"></div>
          }
        </div>
      }

      @if (!loading() && filteredNotifications().length) {
        <mat-card class="surface-card notification-card">
          <mat-card-header>
            <mat-card-title>Inbox</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stack-list">
              @for (notification of filteredNotifications(); track notification.id) {
                <div class="stack-list__item">
                  <div class="stack-list__copy">
                    <div class="stack-list__eyebrow">
                      <span>{{ notification.notification_type.replace('_', ' ') }}</span>
                      @if (!notification.is_read) {
                        <strong>New</strong>
                      }
                    </div>
                    <strong>{{ notification.title }}</strong>
                    <p>{{ notification.body }}</p>
                    <span class="meta">{{ notification.created_at | date:'medium' }}</span>
                  </div>
                  @if (!notification.is_read) {
                    <button mat-flat-button color="primary" type="button" (click)="markAsRead(notification)">Mark read</button>
                  } @else {
                    <mat-chip-set><mat-chip highlighted>Read</mat-chip></mat-chip-set>
                  }
                </div>
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
    .stack-list {
      display: grid;
      gap: 1rem;
    }
    .stack-list__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.6rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.74rem;
    }
    .stack-list__eyebrow strong {
      color: var(--primary-strong);
    }
    .stack-list__item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }
    .stack-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .stack-list__copy strong {
      font-size: 1rem;
      line-height: 1.4;
    }
    .stack-list__item p,
    .meta {
      margin: 0.35rem 0 0;
      color: var(--muted);
    }
    @media (max-width: 720px) {
      .stack-list__item {
        flex-direction: column;
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
}
