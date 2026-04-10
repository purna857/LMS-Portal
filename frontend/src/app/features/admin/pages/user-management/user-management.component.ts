import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import type { AdminUserListItem } from '@app/features/admin/models/admin.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { SessionService } from '@app/core/services/session.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForRole, chipToneForUserStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="User Governance"
        description="Manage user access, account status, and role coverage across the entire LMS platform.">
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
          <form [formGroup]="filtersForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Search users</mat-label>
              <input
                matInput
                [value]="workspaceSearch.query()"
                (input)="workspaceSearch.setQuery($any($event.target).value ?? '')"
                placeholder="Name, email, or role" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">All statuses</mat-option>
                <mat-option value="active">Active</mat-option>
                <mat-option value="suspended">Suspended</mat-option>
                <mat-option value="inactive">Inactive</mat-option>
                <mat-option value="pending">Pending</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Role</mat-label>
              <mat-select formControlName="role">
                <mat-option value="">All roles</mat-option>
                <mat-option value="admin">Admin</mat-option>
                <mat-option value="instructor">Instructor</mat-option>
                <mat-option value="student">Student</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="loadUsers()">Apply Filters</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          @if (loading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          @if (filteredUsers().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="filteredUsers()" class="data-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>User</th>
                  <td mat-cell *matCellDef="let user">
                    <div class="cell-title">
                      <strong>{{ user.first_name }} {{ user.last_name }}</strong>
                      <span>{{ user.email }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="roles">
                  <th mat-header-cell *matHeaderCellDef>Roles</th>
                  <td mat-cell *matCellDef="let user">
                    <mat-chip-set>
                      @for (role of user.roles; track role) {
                        <mat-chip [attr.data-tone]="chipToneForRole(role)">{{ role }}</mat-chip>
                      }
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let user">
                    <mat-chip-set>
                      <mat-chip [attr.data-tone]="chipToneForUserStatus(user.status)">{{ user.status }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="activity">
                  <th mat-header-cell *matHeaderCellDef>Last Login</th>
                  <td mat-cell *matCellDef="let user">{{ user.last_login_at ? (user.last_login_at | date:'medium') : 'Never' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let user">
                    @if (user.status !== 'suspended') {
                      <button
                        mat-stroked-button
                        color="warn"
                        type="button"
                        [disabled]="!canUpdateStatus(user)"
                        (click)="toggleBlock(user, true)">
                        Suspend
                      </button>
                    } @else {
                      <button
                        mat-stroked-button
                        color="primary"
                        type="button"
                        [disabled]="!canUpdateStatus(user)"
                        (click)="toggleBlock(user, false)">
                        Restore
                      </button>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>
          } @else if (users().length) {
            <app-empty-state
              icon="search_off"
              [title]="workspaceSearch.normalizedQuery() ? 'No users match your search' : 'No users match this view'"
              [description]="workspaceSearch.normalizedQuery() ? 'Try a different name, email, role, or status.' : 'Adjust the filters to see more user records or onboarding activity.'">
            </app-empty-state>
          } @else {
            <app-empty-state
              icon="groups"
              title="No users found"
              description="Adjust the filters to see more user records or onboarding activity.">
            </app-empty-state>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionService = inject(SessionService);
  readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly users = signal<AdminUserListItem[]>([]);
  readonly displayedColumns = ['name', 'roles', 'status', 'activity', 'actions'];
  readonly filteredUsers = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.users();
    }

    return this.users().filter((user) =>
      this.workspaceSearch.matches(
        user.first_name,
        user.last_name,
        user.email,
        user.phone ?? '',
        user.status,
        user.roles.join(' ')
      )
    );
  });
  readonly summaryCards = computed(() => {
    const users = this.users();
    return [
      {
        label: 'Total Users',
        value: String(users.length),
        hint: 'Accounts currently loaded in this workspace view',
        icon: 'groups'
      },
      {
        label: 'Active',
        value: String(users.filter((user) => user.status === 'active').length),
        hint: 'Users with active platform access',
        icon: 'check_circle'
      },
      {
        label: 'Suspended',
        value: String(users.filter((user) => user.status === 'suspended').length),
        hint: 'Accounts temporarily blocked from access',
        icon: 'block'
      },
      {
        label: 'Instructors',
        value: String(users.filter((user) => user.roles.includes('instructor')).length),
        hint: 'Teaching staff represented in the portal',
        icon: 'school'
      }
    ];
  });

  readonly filtersForm = this.formBuilder.group({
    status: [''],
    role: ['']
  });

  readonly chipToneForRole = chipToneForRole;
  readonly chipToneForUserStatus = chipToneForUserStatus;

  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    const raw = this.filtersForm.getRawValue();
    this.adminPortalService
      .listUsers({
        status: raw.status || undefined,
        role: raw.role || undefined,
        limit: 50,
        offset: 0
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load users.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  resetFilters(): void {
    this.filtersForm.reset({
      status: '',
      role: ''
    });
    this.workspaceSearch.clear();
    this.loadUsers();
  }

  isCurrentUser(user: AdminUserListItem): boolean {
    return this.sessionService.user()?.id === user.id;
  }

  canUpdateStatus(user: AdminUserListItem): boolean {
    return !this.isCurrentUser(user) && !user.is_superuser;
  }

  toggleBlock(user: AdminUserListItem, block: boolean): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: block ? 'Suspend User' : 'Restore User',
        message: `${block ? 'Suspend' : 'Restore'} access for ${user.first_name} ${user.last_name}?`,
        confirmLabel: block ? 'Suspend User' : 'Restore User',
        confirmColor: block ? 'warn' : 'primary'
      },
      ...portalDialogConfig('sm')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      const request$ = block
        ? this.adminPortalService.blockUser(user.id)
        : this.adminPortalService.unblockUser(user.id);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
          this.loadUsers();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update user status.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }
}
