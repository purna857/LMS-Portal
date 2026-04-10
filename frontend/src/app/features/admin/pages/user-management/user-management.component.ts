import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import type { AdminUserListItem } from '@app/features/admin/models/admin.models';
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
                [value]="searchQuery()"
                (input)="setSearchQuery($any($event.target).value ?? '')"
                placeholder="Name, email, phone, or role" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">All statuses</mat-option>
                <mat-option value="active">Active</mat-option>
                <mat-option value="suspended">Blocked</mat-option>
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

            <mat-form-field appearance="outline">
              <mat-label>Sort by</mat-label>
              <mat-select formControlName="sort">
                <mat-option value="recent">Newest</mat-option>
                <mat-option value="name">Name</mat-option>
                <mat-option value="last_login">Last login</mat-option>
                <mat-option value="status">Status</mat-option>
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

          @if (pagedUsers().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="pagedUsers()" class="data-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>User</th>
                  <td mat-cell *matCellDef="let user">
                    <div class="cell-title">
                      <strong>{{ user.first_name }} {{ user.last_name }}</strong>
                      <span>{{ user.email }}</span>
                      <div class="user-meta">
                        @if (user.email_verified) {
                          <mat-chip-set>
                            <mat-chip data-tone="success">Verified</mat-chip>
                          </mat-chip-set>
                        }
                        @if (user.is_superuser) {
                          <mat-chip-set>
                            <mat-chip data-tone="info">Super Admin</mat-chip>
                          </mat-chip-set>
                        }
                      </div>
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
                      <mat-chip [attr.data-tone]="chipToneForUserStatus(user.status)">{{ userStatusLabel(user.status) }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="activity">
                  <th mat-header-cell *matHeaderCellDef>Activity</th>
                  <td mat-cell *matCellDef="let user">
                    <div class="cell-title">
                      <strong>{{ user.last_login_at ? (user.last_login_at | date:'mediumDate') : 'Never' }}</strong>
                      <span>{{ user.created_at | date:'mediumDate' }} joined</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let user">
                    <div class="action-row">
                      @if (user.status === 'pending') {
                        <button
                          mat-stroked-button
                          color="primary"
                          type="button"
                          [disabled]="!canUpdateStatus(user)"
                          (click)="reviewUser(user, 'approve')">
                          Approve
                        </button>
                        <button
                          mat-stroked-button
                          color="warn"
                          type="button"
                          [disabled]="!canUpdateStatus(user)"
                          (click)="reviewUser(user, 'reject')">
                          Reject
                        </button>
                      } @else if (user.status !== 'suspended') {
                        <button
                          mat-stroked-button
                          color="warn"
                          type="button"
                          [disabled]="!canUpdateStatus(user)"
                          (click)="toggleBlock(user, true)">
                          Block
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

                      <button
                        mat-icon-button
                        type="button"
                        [matMenuTriggerFor]="userMenu"
                        [matMenuTriggerData]="{ user: user }"
                        [disabled]="!canUpdateStatus(user)">
                        <span class="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>

            <div class="table-footer">
              <p class="table-footer__summary">
                Showing {{ pageStart() + 1 }}-{{ pageEnd() }} of {{ sortedUsers().length }} users
              </p>

              <div class="table-footer__actions">
                <mat-form-field appearance="outline" class="table-footer__size">
                  <mat-label>Rows</mat-label>
                  <mat-select [value]="pageSize()" (valueChange)="setPageSize($event)">
                    <mat-option [value]="5">5</mat-option>
                    <mat-option [value]="10">10</mat-option>
                    <mat-option [value]="20">20</mat-option>
                  </mat-select>
                </mat-form-field>

                <button mat-stroked-button type="button" (click)="previousPage()" [disabled]="currentPage() === 0">Previous</button>
                <button mat-stroked-button type="button" (click)="nextPage()" [disabled]="pageEnd() >= sortedUsers().length">Next</button>
              </div>
            </div>
          } @else if (users().length) {
            <app-empty-state
              icon="search_off"
              [title]="normalizedSearchQuery() ? 'No users match your search' : 'No users match this view'"
              [description]="normalizedSearchQuery() ? 'Try a different name, email, role, or status.' : 'Adjust the filters to see more user records or onboarding activity.'">
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

    <mat-menu #userMenu="matMenu">
      <ng-template matMenuContent let-user="user">
        @if (user?.status === 'pending') {
          <button mat-menu-item type="button" (click)="reviewUser(user, 'approve')">
            <span class="material-symbols-outlined">check_circle</span>
            <span>Approve User</span>
          </button>
          <button mat-menu-item type="button" (click)="reviewUser(user, 'reject')">
            <span class="material-symbols-outlined">cancel</span>
            <span>Reject User</span>
          </button>
        }
        @if (user?.status !== 'suspended') {
          <button mat-menu-item type="button" (click)="toggleBlock(user, true)">
            <span class="material-symbols-outlined">block</span>
            <span>Block User</span>
          </button>
        } @else {
          <button mat-menu-item type="button" (click)="toggleBlock(user, false)">
            <span class="material-symbols-outlined">lock_open</span>
            <span>Restore Access</span>
          </button>
        }
        <button mat-menu-item type="button" (click)="deleteUser(user)">
          <span class="material-symbols-outlined">delete</span>
          <span>Delete User</span>
        </button>
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    .action-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }

    .user-meta {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
    }

    .table-footer {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      padding-top: 1rem;
      flex-wrap: wrap;
    }

    .table-footer__summary {
      margin: 0;
      color: var(--muted);
      font-size: 0.88rem;
    }

    .table-footer__actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .table-footer__size {
      width: 96px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionService = inject(SessionService);

  readonly loading = signal(false);
  readonly users = signal<AdminUserListItem[]>([]);
  readonly searchQuery = signal('');
  readonly normalizedSearchQuery = computed(() => this.searchQuery().trim().toLowerCase());
  readonly currentPage = signal(0);
  readonly pageSize = signal(10);
  readonly displayedColumns = ['name', 'roles', 'status', 'activity', 'actions'];
  readonly filteredUsers = computed(() => {
    const query = this.normalizedSearchQuery();
    if (!query) {
      return this.users();
    }

    return this.users().filter((user) =>
      this.matchesSearch(
        query,
        user.first_name,
        user.last_name,
        user.email,
        user.phone ?? '',
        user.status,
        user.roles.join(' ')
      )
    );
  });
  readonly sortedUsers = computed(() => {
    const sort = this.filtersForm.controls.sort.value ?? 'recent';
    const users = [...this.filteredUsers()];
    return users.sort((a, b) => {
      switch (sort) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case 'last_login':
          return new Date(b.last_login_at ?? 0).getTime() - new Date(a.last_login_at ?? 0).getTime();
        case 'status':
          return this.userStatusLabel(a.status).localeCompare(this.userStatusLabel(b.status));
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  });
  readonly pageStart = computed(() => this.currentPage() * this.pageSize());
  readonly pageEnd = computed(() => Math.min(this.pageStart() + this.pageSize(), this.sortedUsers().length));
  readonly pagedUsers = computed(() => this.sortedUsers().slice(this.pageStart(), this.pageEnd()));
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
        label: 'Blocked',
        value: String(users.filter((user) => user.status === 'suspended').length),
        hint: 'Accounts temporarily blocked from access',
        icon: 'block'
      },
      {
        label: 'Pending',
        value: String(users.filter((user) => user.status === 'pending').length),
        hint: 'Accounts waiting for admin approval',
        icon: 'hourglass_top'
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
    role: [''],
    sort: ['recent']
  });

  readonly chipToneForRole = chipToneForRole;
  readonly chipToneForUserStatus = chipToneForUserStatus;

  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.currentPage.set(0);
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
      role: '',
      sort: 'recent'
    });
    this.currentPage.set(0);
    this.searchQuery.set('');
    this.loadUsers();
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(String(value).trimStart());
    this.currentPage.set(0);
  }

  userStatusLabel(status: string): string {
    if (status === 'suspended') {
      return 'Blocked';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  setPageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(0);
  }

  previousPage(): void {
    this.currentPage.update((page) => Math.max(0, page - 1));
  }

  nextPage(): void {
    if (this.pageEnd() < this.sortedUsers().length) {
      this.currentPage.update((page) => page + 1);
    }
  }

  isCurrentUser(user: AdminUserListItem): boolean {
    return this.sessionService.user()?.id === user.id;
  }

  canUpdateStatus(user: AdminUserListItem): boolean {
    return !this.isCurrentUser(user) && !user.is_superuser;
  }

  private matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
    return values
      .filter((value): value is string => !!value)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }

  toggleBlock(user: AdminUserListItem, block: boolean): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: block ? 'Block User' : 'Restore User',
        message: `${block ? 'Block' : 'Restore'} access for ${user.first_name} ${user.last_name}?`,
        confirmLabel: block ? 'Block User' : 'Restore User',
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

  reviewUser(user: AdminUserListItem, mode: 'approve' | 'reject'): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: `${mode === 'approve' ? 'Approve' : 'Reject'} User`,
        message: `${mode === 'approve' ? 'Approve' : 'Reject'} access for ${user.first_name} ${user.last_name}?`,
        confirmLabel: mode === 'approve' ? 'Approve User' : 'Reject User',
        confirmColor: mode === 'approve' ? 'primary' : 'warn',
        noteLabel: 'Review Notes',
        notePlaceholder: 'Add optional review notes for this account decision'
      },
      ...portalDialogConfig('sm')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      const request$ = mode === 'approve'
        ? this.adminPortalService.approveUser(user.id, result.note)
        : this.adminPortalService.rejectUser(user.id, result.note);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
          this.loadUsers();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update the user review state.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteUser(user: AdminUserListItem): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete User',
        message: `Delete ${user.first_name} ${user.last_name}'s account from the platform? This action cannot be undone.`,
        confirmLabel: 'Delete User',
        confirmColor: 'warn'
      },
      ...portalDialogConfig('sm')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      this.adminPortalService.deleteUser(user.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            this.loadUsers();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete the user.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }
}
