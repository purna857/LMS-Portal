import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { CategoryDialogComponent } from '@app/features/admin/components/category-dialog/category-dialog.component';
import type { CourseCategory } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Course Categories"
        description="Shape the catalog taxonomy used across course discovery, management, and reporting.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-actions align="end">
          <button mat-flat-button color="primary" type="button" (click)="openCategoryDialog()">Create Category</button>
        </mat-card-actions>
        <mat-card-content>
          @if (loading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          @if (categories().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="categories()" class="data-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Name</th>
                  <td mat-cell *matCellDef="let category">
                    <div class="cell-title">
                      <strong>{{ category.name }}</strong>
                      <span>{{ category.slug }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="parent">
                  <th mat-header-cell *matHeaderCellDef>Parent</th>
                  <td mat-cell *matCellDef="let category">{{ parentName(category.parent_id) }}</td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let category">
                    <mat-chip-set>
                      <mat-chip [highlighted]="category.status === 'active'">{{ category.status }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="sort">
                  <th mat-header-cell *matHeaderCellDef>Sort Order</th>
                  <td mat-cell *matCellDef="let category">{{ category.sort_order }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let category">
                    <div class="action-row">
                      <button mat-stroked-button type="button" (click)="openCategoryDialog(category)">Edit</button>
                      <button mat-stroked-button color="warn" type="button" (click)="deleteCategory(category)">Delete</button>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>
          } @else {
            <app-empty-state
              icon="category"
              title="No categories found"
              description="Create your first category to organize the LMS catalog.">
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
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesComponent {
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly categories = signal<CourseCategory[]>([]);
  readonly displayedColumns = ['name', 'parent', 'status', 'sort', 'actions'];

  constructor() {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.adminPortalService.listCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load categories.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  parentName(parentId?: string | null): string {
    if (!parentId) {
      return 'None';
    }

    return this.categories().find((item) => item.id === parentId)?.name ?? 'Unknown';
  }

  openCategoryDialog(category?: CourseCategory): void {
    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      data: {
        mode: category ? 'edit' : 'create',
        category,
        categories: this.categories()
      },
      panelClass: ['lms-dialog-panel'],
      width: 'min(94vw, 640px)',
      maxWidth: 'min(94vw, 640px)',
      autoFocus: false
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload) {
        return;
      }

      const request$ = category
        ? this.adminPortalService.updateCategory(category.id, payload)
        : this.adminPortalService.createCategory(payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open(`Category ${category ? 'updated' : 'created'} successfully.`, 'Dismiss', { duration: 3200 });
          this.loadCategories();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save category.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteCategory(category: CourseCategory): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Category',
        message: `Delete "${category.name}" from the catalog structure?`,
        confirmLabel: 'Delete Category',
        confirmColor: 'warn'
      },
      panelClass: ['lms-dialog-panel'],
      width: '420px',
      maxWidth: '92vw',
      maxHeight: '80vh',
      autoFocus: false
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      this.adminPortalService.deleteCategory(category.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            this.loadCategories();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete category.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }
}
