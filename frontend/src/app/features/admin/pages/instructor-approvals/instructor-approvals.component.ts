import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import type { InstructorApprovalItem } from '@app/features/admin/models/admin.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForApprovalStatus, chipToneForUserStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-instructor-approvals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Instructor Reviews"
        description="Review teaching applications, verify expertise, and control who can publish learning content.">
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
              <mat-label>Approval Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">All requests</mat-option>
                <mat-option value="submitted">Submitted</mat-option>
                <mat-option value="under_review">Under Review</mat-option>
                <mat-option value="approved">Approved</mat-option>
                <mat-option value="rejected">Rejected</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="reset()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="loadApprovals()">Refresh</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          @if (loading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          @if (filteredApprovals().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="filteredApprovals()" class="data-table">
                <ng-container matColumnDef="applicant">
                  <th mat-header-cell *matHeaderCellDef>Applicant</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="cell-title">
                      <strong>{{ item.first_name }} {{ item.last_name }}</strong>
                      <span>{{ item.email }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="profile">
                  <th mat-header-cell *matHeaderCellDef>Profile</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="cell-title">
                      <strong>{{ item.headline || 'No headline provided' }}</strong>
                      <span>{{ item.expertise || 'Expertise not provided' }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let item">
                    <mat-chip-set>
                      <mat-chip [attr.data-tone]="chipToneForApprovalStatus(item.approval_status)">{{ item.approval_status }}</mat-chip>
                      <mat-chip [attr.data-tone]="chipToneForUserStatus(item.user_status)">{{ item.user_status }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="submitted">
                  <th mat-header-cell *matHeaderCellDef>Submitted</th>
                  <td mat-cell *matCellDef="let item">{{ item.submitted_at ? (item.submitted_at | date:'mediumDate') : 'N/A' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="action-row">
                      <button
                        mat-stroked-button
                        color="primary"
                        type="button"
                        [disabled]="item.approval_status === 'approved'"
                        (click)="review(item, 'approve')">
                        Approve
                      </button>
                      <button
                        mat-stroked-button
                        color="warn"
                        type="button"
                        [disabled]="item.approval_status === 'rejected'"
                        (click)="review(item, 'reject')">
                        Reject
                      </button>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>
          } @else if (approvals().length) {
            <app-empty-state
              icon="search_off"
              [title]="workspaceSearch.normalizedQuery() ? 'No matching approvals' : 'No approval requests found'"
              [description]="workspaceSearch.normalizedQuery() ? 'Try a different name, email, expertise, or status.' : 'Instructor applications that match this filter will appear here.'">
            </app-empty-state>
          } @else {
            <app-empty-state
              icon="how_to_reg"
              title="No approval requests found"
              description="Instructor applications that match this filter will appear here.">
            </app-empty-state>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .action-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstructorApprovalsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly approvals = signal<InstructorApprovalItem[]>([]);
  readonly displayedColumns = ['applicant', 'profile', 'status', 'submitted', 'actions'];
  readonly filteredApprovals = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.approvals();
    }

    return this.approvals().filter((item) =>
      this.workspaceSearch.matches(
        item.first_name,
        item.last_name,
        item.email,
        item.headline,
        item.expertise,
        item.approval_status,
        item.user_status,
        item.review_notes
      )
    );
  });
  readonly summaryCards = computed(() => {
    const approvals = this.approvals();
    return [
      {
        label: 'Requests',
        value: String(approvals.length),
        hint: 'Instructor applications in the current filter',
        icon: 'pending_actions'
      },
      {
        label: 'Submitted',
        value: String(approvals.filter((item) => item.approval_status === 'submitted').length),
        hint: 'Fresh requests awaiting triage',
        icon: 'inbox'
      },
      {
        label: 'Under Review',
        value: String(approvals.filter((item) => item.approval_status === 'under_review').length),
        hint: 'Applications actively being evaluated',
        icon: 'fact_check'
      },
      {
        label: 'Approved',
        value: String(approvals.filter((item) => item.approval_status === 'approved').length),
        hint: 'Instructors cleared to publish content',
        icon: 'verified'
      }
    ];
  });

  readonly chipToneForApprovalStatus = chipToneForApprovalStatus;
  readonly chipToneForUserStatus = chipToneForUserStatus;

  readonly filterForm = this.formBuilder.group({
    status: ['submitted']
  });

  constructor() {
    this.loadApprovals();
  }

  loadApprovals(): void {
    this.loading.set(true);
    const status = this.filterForm.getRawValue().status || undefined;
    this.adminPortalService.listInstructorApprovals(status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.approvals.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load approval requests.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  reset(): void {
    this.filterForm.reset({ status: 'submitted' });
    this.loadApprovals();
  }

  review(item: InstructorApprovalItem, mode: 'approve' | 'reject'): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: `${mode === 'approve' ? 'Approve' : 'Reject'} Instructor`,
        message: `${mode === 'approve' ? 'Approve' : 'Reject'} ${item.first_name} ${item.last_name}'s instructor request.`,
        confirmLabel: mode === 'approve' ? 'Approve Request' : 'Reject Request',
        confirmColor: mode === 'approve' ? 'primary' : 'warn',
        noteLabel: 'Review Notes',
        notePlaceholder: 'Add optional review notes for your decision'
      },
      ...portalDialogConfig('sm')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      const request$ = mode === 'approve'
        ? this.adminPortalService.approveInstructor(item.request_id, result.note)
        : this.adminPortalService.rejectInstructor(item.request_id, result.note);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
          this.loadApprovals();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to complete approval action.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }
}
