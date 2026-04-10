import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AnnouncementDialogComponent } from '@app/features/admin/components/announcement-dialog/announcement-dialog.component';
import type { NotificationItem } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
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

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="filterForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Search broadcasts</mat-label>
              <input
                matInput
                [value]="searchQuery()"
                (input)="setSearchQuery($any($event.target).value ?? '')"
                placeholder="Title, body, or type" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Read status</mat-label>
              <mat-select formControlName="read_state">
                <mat-option value="">All</mat-option>
                <mat-option value="unread">Unread</mat-option>
                <mat-option value="read">Read</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select formControlName="type">
                <mat-option value="">All types</mat-option>
                <mat-option value="platform">Platform</mat-option>
                <mat-option value="course">Course</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="openAnnouncementDialog()">Create Broadcast</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-header>
          <mat-card-title>Broadcast Feed</mat-card-title>
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
                        @if (!notification.is_read) {
                          <mat-chip data-tone="warning">Unread</mat-chip>
                        } @else {
                          <mat-chip data-tone="success">Read</mat-chip>
                        }
                      </mat-chip-set>
                      <span>{{ notification.created_at | date:'medium' }}</span>
                    </div>
                  </div>

                  <div class="feed-actions">
                    @if (!notification.is_read) {
                      <button mat-stroked-button type="button" (click)="markAsRead(notification)">Mark Read</button>
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (notifications().length) {
            <app-empty-state
              icon="search_off"
              [title]="normalizedSearchQuery() ? 'No matching notifications' : 'No notifications yet'"
              [description]="normalizedSearchQuery() ? 'Try a different announcement title, message, or type.' : 'Announcements you publish and platform notifications will appear here.'">
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
    </section>
  `,
  styles: [`
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
      margin-top: 0.85rem;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .stack-list__item .mat-mdc-chip-set {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .feed-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    @media (max-width: 720px) {
      .stack-list__item {
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
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly searchQuery = signal('');
  readonly normalizedSearchQuery = computed(() => this.searchQuery().trim().toLowerCase());
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
  readonly filterForm = this.formBuilder.group({
    read_state: [''],
    type: ['']
  });
  readonly filteredNotifications = computed(() => {
    const query = this.normalizedSearchQuery();
    const raw = this.filterForm.getRawValue();
    return this.notifications().filter((notification) => {
      const matchesRead = !raw.read_state || (raw.read_state === 'read' ? notification.is_read : !notification.is_read);
      const matchesType = !raw.type || notification.notification_type === raw.type;
      const matchesQuery = !query || this.matchesSearch(
        query,
        notification.title,
        notification.body,
        notification.notification_type
      );
      return matchesRead && matchesType && matchesQuery;
    });
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

  resetFilters(): void {
    this.filterForm.reset({
      read_state: '',
      type: ''
    });
    this.searchQuery.set('');
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(String(value).trimStart());
  }

  openAnnouncementDialog(): void {
    const dialogRef = this.dialog.open(AnnouncementDialogComponent, portalDialogConfig('lg'));
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload) {
        return;
      }

      this.adminPortalService.createPlatformAnnouncement(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open('Platform announcement published.', 'Dismiss', { duration: 3200 });
            this.loadNotifications();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to publish the announcement.', 'Dismiss', { duration: 4500 });
          }
        });
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

  private matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
    return values
      .filter((value): value is string => !!value)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
