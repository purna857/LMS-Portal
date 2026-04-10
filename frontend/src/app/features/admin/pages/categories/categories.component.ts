import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { CategoryDialogComponent } from '@app/features/admin/components/category-dialog/category-dialog.component';
import type { CourseCategory } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForCategoryStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Catalog Taxonomy"
        description="Shape the catalog taxonomy used across course discovery, management, and reporting.">
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
              <mat-label>Search categories</mat-label>
              <input matInput formControlName="search" placeholder="Name, slug, or parent category" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">All statuses</mat-option>
                <mat-option value="active">Active</mat-option>
                <mat-option value="inactive">Inactive</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Sort by</mat-label>
              <mat-select formControlName="sort">
                <mat-option value="sort_order">Sort order</mat-option>
                <mat-option value="name">Name</mat-option>
                <mat-option value="recent">Recently updated</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="openCategoryDialog()">Create Category</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          @if (loading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          @if (pagedCategories().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="pagedCategories()" class="data-table">
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
                      <mat-chip [attr.data-tone]="chipToneForCategoryStatus(category.status)">{{ category.status }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="sort">
                  <th mat-header-cell *matHeaderCellDef>Sort Order</th>
                  <td mat-cell *matCellDef="let category">
                    <div class="cell-title">
                      <strong>{{ category.sort_order }}</strong>
                      <span>{{ category.updated_at | date:'mediumDate' }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let category">
                    <div class="action-row">
                      <button mat-stroked-button type="button" (click)="openCategoryDialog(category)">Edit</button>
                      <button
                        mat-icon-button
                        type="button"
                        [matMenuTriggerFor]="categoryMenu"
                        [matMenuTriggerData]="{ category: category }">
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
                Showing {{ pageStart() + 1 }}-{{ pageEnd() }} of {{ sortedCategories().length }} categories
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
                <button mat-stroked-button type="button" (click)="nextPage()" [disabled]="pageEnd() >= sortedCategories().length">Next</button>
              </div>
            </div>
          } @else if (categories().length) {
            <app-empty-state
              icon="search_off"
              title="No categories match this view"
              description="Try a different name, parent, or status filter to find existing taxonomy entries.">
            </app-empty-state>
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

    <mat-menu #categoryMenu="matMenu">
      <ng-template matMenuContent let-category="category">
        <button mat-menu-item type="button" (click)="openCategoryDialog(category)">
          <span class="material-symbols-outlined">edit</span>
          <span>Edit category</span>
        </button>
        <button mat-menu-item type="button" (click)="deleteCategory(category)">
          <span class="material-symbols-outlined">delete</span>
          <span>Delete category</span>
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
export class CategoriesComponent {
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(false);
  readonly categories = signal<CourseCategory[]>([]);
  readonly currentPage = signal(0);
  readonly pageSize = signal(10);
  readonly displayedColumns = ['name', 'parent', 'status', 'sort', 'actions'];
  readonly summaryCards = computed(() => {
    const categories = this.categories();
    return [
      {
        label: 'Categories',
        value: String(categories.length),
        hint: 'Total catalog categories loaded',
        icon: 'category'
      },
      {
        label: 'Active',
        value: String(categories.filter((category) => category.status === 'active').length),
        hint: 'Categories available for use',
        icon: 'check_circle'
      },
      {
        label: 'Inactive',
        value: String(categories.filter((category) => category.status === 'inactive').length),
        hint: 'Hidden or paused taxonomy entries',
        icon: 'pause_circle'
      },
      {
        label: 'Top-level',
        value: String(categories.filter((category) => !category.parent_id).length),
        hint: 'Root categories in the hierarchy',
        icon: 'account_tree'
      }
    ];
  });
  readonly filteredCategories = computed(() => {
    const raw = this.filtersForm.getRawValue();
    const query = String(raw.search ?? '').trim().toLowerCase();
    const status = raw.status ?? '';
    return this.categories().filter((category) => {
      const matchesStatus = !status || category.status === status;
      const parent = this.parentName(category.parent_id);
      const matchesQuery = !query || [category.name, category.slug, parent].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  });
  readonly sortedCategories = computed(() => {
    const sort = this.filtersForm.controls.sort.value ?? 'sort_order';
    const categories = [...this.filteredCategories()];
    return categories.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'sort_order':
        default:
          return a.sort_order - b.sort_order;
      }
    });
  });
  readonly pageStart = computed(() => this.currentPage() * this.pageSize());
  readonly pageEnd = computed(() => Math.min(this.pageStart() + this.pageSize(), this.sortedCategories().length));
  readonly pagedCategories = computed(() => this.sortedCategories().slice(this.pageStart(), this.pageEnd()));

  readonly chipToneForCategoryStatus = chipToneForCategoryStatus;
  readonly filtersForm = this.formBuilder.group({
    search: [''],
    status: [''],
    sort: ['sort_order']
  });

  constructor() {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.currentPage.set(0);
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

  resetFilters(): void {
    this.filtersForm.reset({
      search: '',
      status: '',
      sort: 'sort_order'
    });
    this.currentPage.set(0);
  }

  previousPage(): void {
    this.currentPage.update((page) => Math.max(0, page - 1));
  }

  setPageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(0);
  }

  nextPage(): void {
    if (this.pageEnd() < this.sortedCategories().length) {
      this.currentPage.update((page) => page + 1);
    }
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
      ...portalDialogConfig('md')
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
      ...portalDialogConfig('sm')
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
