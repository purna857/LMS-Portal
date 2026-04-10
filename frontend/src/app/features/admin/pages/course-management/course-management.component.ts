import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { CourseEditorDialogComponent } from '@app/features/admin/components/course-editor-dialog/course-editor-dialog.component';
import type { CourseCategory, CourseListItem } from '@app/features/admin/models/admin.models';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForCourseStatus, chipToneForVisibility } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-course-management',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Catalog Control"
        description="Oversee the catalog, refine course metadata, and control publishing state across the LMS.">
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

      <mat-card class="surface-card workflow-card">
        <mat-card-header>
          <mat-card-title>Catalog Control Path</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="workflow-card__copy">
            Keep the catalog moving through approvals, user governance, taxonomy, and reporting without leaving the page.
          </p>

          <div class="workflow-card__actions">
            <a mat-stroked-button routerLink="/app/admin/approvals">Instructor Reviews</a>
            <a mat-stroked-button routerLink="/app/admin/users">User Governance</a>
            <a mat-stroked-button routerLink="/app/admin/categories">Taxonomy</a>
            <a mat-stroked-button routerLink="/app/admin/analytics">Platform Reports</a>
            <a mat-stroked-button routerLink="/app/admin/announcements">Broadcasts</a>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="filtersForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Search courses</mat-label>
              <input
                matInput
                [value]="workspaceSearch.query()"
                (input)="workspaceSearch.setQuery($any($event.target).value ?? '')"
                placeholder="Title, slug, instructor, or category" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">All statuses</mat-option>
                <mat-option value="draft">Draft</mat-option>
                <mat-option value="published">Published</mat-option>
                <mat-option value="archived">Archived</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Category</mat-label>
              <mat-select formControlName="category_id">
                <mat-option value="">All categories</mat-option>
                @for (category of categories(); track category.id) {
                  <mat-option [value]="category.id">{{ category.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="loadCourses()">Apply Filters</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          @if (loading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          @if (filteredCourses().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="filteredCourses()" class="data-table">
                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Course</th>
                  <td mat-cell *matCellDef="let course">
                    <div class="cell-title">
                      <strong>{{ course.title }}</strong>
                      <span>{{ course.short_description || course.slug }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef>Category</th>
                  <td mat-cell *matCellDef="let course">{{ course.category_name || 'Uncategorized' }}</td>
                </ng-container>

                <ng-container matColumnDef="owner">
                  <th mat-header-cell *matHeaderCellDef>Instructor</th>
                  <td mat-cell *matCellDef="let course">{{ course.primary_instructor_name || 'Unknown' }}</td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let course">
                    <mat-chip-set>
                      <mat-chip [attr.data-tone]="chipToneForCourseStatus(course.status)">{{ course.status }}</mat-chip>
                      <mat-chip [attr.data-tone]="chipToneForVisibility(course.visibility)">{{ course.visibility }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let course">
                    <div class="action-row">
                      <button mat-stroked-button type="button" (click)="editCourse(course)">Edit</button>
                      @if (course.status === 'published') {
                        <button mat-stroked-button type="button" (click)="togglePublish(course, false)">Unpublish</button>
                      } @else {
                        <button mat-stroked-button color="primary" type="button" (click)="togglePublish(course, true)">Publish</button>
                      }
                      <button mat-stroked-button color="warn" type="button" (click)="deleteCourse(course)">Delete</button>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>
          } @else if (courses().length) {
            <app-empty-state
              icon="search_off"
              [title]="workspaceSearch.normalizedQuery() ? 'No matching courses' : 'No courses match this view'"
              [description]="workspaceSearch.normalizedQuery() ? 'Try a different search term or clear the current filters.' : 'Update the filters to find more of the catalog or newly authored courses.'">
            </app-empty-state>
          } @else {
            <app-empty-state
              icon="library_add"
              title="No courses found"
              description="Update the filters to find more of the catalog or newly authored courses.">
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

    .workflow-card {
      overflow: hidden;
    }

    .workflow-card mat-card-content {
      display: grid;
      gap: 1rem;
      padding-top: 0.35rem;
    }

    .workflow-card__copy {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.92rem;
    }

    .workflow-card__actions {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
      align-items: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly categories = signal<CourseCategory[]>([]);
  readonly displayedColumns = ['title', 'category', 'owner', 'status', 'actions'];
  readonly summaryCards = computed(() => {
    const courses = this.courses();
    return [
      {
        label: 'Total Courses',
        value: String(courses.length),
        hint: 'Catalog items currently loaded',
        icon: 'library_books'
      },
      {
        label: 'Published',
        value: String(courses.filter((course) => course.status === 'published').length),
        hint: 'Courses visible to learners',
        icon: 'rocket_launch'
      },
      {
        label: 'Drafts',
        value: String(courses.filter((course) => course.status === 'draft').length),
        hint: 'Courses still under review',
        icon: 'edit_note'
      },
      {
        label: 'Featured',
        value: String(courses.filter((course) => course.is_featured).length),
        hint: 'Highlighted in the catalog experience',
        icon: 'star'
      }
    ];
  });
  readonly filteredCourses = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return this.courses();
    }

    return this.courses().filter((course) =>
      this.workspaceSearch.matches(
        course.title,
        course.slug,
        course.short_description,
        course.category_name,
        course.primary_instructor_name,
        course.language,
        course.level,
        course.status
      )
    );
  });

  readonly chipToneForCourseStatus = chipToneForCourseStatus;
  readonly chipToneForVisibility = chipToneForVisibility;

  readonly filtersForm = this.formBuilder.group({
    status: [''],
    category_id: ['']
  });

  constructor() {
    this.loadCategories();
    this.loadCourses();
  }

  loadCategories(): void {
    this.adminPortalService.listCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => undefined
      });
  }

  loadCourses(): void {
    this.loading.set(true);
    const raw = this.filtersForm.getRawValue();
    this.adminPortalService.listCourses({
      limit: 50,
      offset: 0,
      status: raw.status || undefined,
      category_id: raw.category_id || undefined
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.items);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  resetFilters(): void {
    this.filtersForm.reset({
      status: '',
      category_id: ''
    });
    this.workspaceSearch.clear();
    this.loadCourses();
  }

  editCourse(course: CourseListItem): void {
    forkJoin({
      detail: this.adminPortalService.getCourse(course.id),
      categories: this.adminPortalService.listCategories()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ detail, categories }) => {
          const dialogRef = this.dialog.open(CourseEditorDialogComponent, {
            data: {
              mode: 'edit',
              course: detail,
              categories
            },
            ...portalDialogConfig('xl')
          });

          dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
            if (!payload) {
              return;
            }

            this.adminPortalService.updateCourse(course.id, payload)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => {
                  this.snackBar.open('Course updated successfully.', 'Dismiss', { duration: 3200 });
                  this.loadCourses();
                },
                error: (error: HttpErrorResponse) => {
                  this.snackBar.open(error.error?.detail ?? 'Unable to update the course.', 'Dismiss', { duration: 4500 });
                }
              });
          });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load the course editor.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  togglePublish(course: CourseListItem, publish: boolean): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: publish ? 'Publish Course' : 'Unpublish Course',
        message: `${publish ? 'Publish' : 'Move back to draft'} "${course.title}"?`,
        confirmLabel: publish ? 'Publish' : 'Unpublish',
        confirmColor: publish ? 'primary' : 'warn'
      },
      ...portalDialogConfig('sm')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      const request$ = publish
        ? this.adminPortalService.publishCourse(course.id)
        : this.adminPortalService.unpublishCourse(course.id);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
          this.loadCourses();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to change course publishing state.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteCourse(course: CourseListItem): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Course',
        message: `Delete "${course.title}" from the platform catalog? This action cannot be undone.`,
        confirmLabel: 'Delete Course',
        confirmColor: 'warn'
      },
      ...portalDialogConfig('sm')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      this.adminPortalService.deleteCourse(course.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            this.loadCourses();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete the course.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }
}
