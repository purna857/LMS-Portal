import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { CourseEditorDialogComponent } from '@app/features/admin/components/course-editor-dialog/course-editor-dialog.component';
import type { CourseCategory, CourseListItem } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-course-management',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Admin"
        title="Course Management"
        description="Oversee the catalog, refine course metadata, and control publishing state across the LMS.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="filtersForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Search courses</mat-label>
              <input matInput formControlName="search" placeholder="Course title or slug" />
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

          @if (courses().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="courses()" class="data-table">
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
                      <mat-chip [highlighted]="course.status === 'published'">{{ course.status }}</mat-chip>
                      <mat-chip>{{ course.visibility }}</mat-chip>
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
          } @else {
            <app-empty-state
              icon="library_add"
              title="No courses match this view"
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

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly categories = signal<CourseCategory[]>([]);
  readonly displayedColumns = ['title', 'category', 'owner', 'status', 'actions'];

  readonly filtersForm = this.formBuilder.group({
    search: [''],
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
      search: raw.search?.trim() || undefined,
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
      search: '',
      status: '',
      category_id: ''
    });
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
            width: 'min(94vw, 760px)',
            maxWidth: 'min(94vw, 760px)',
            panelClass: ['lms-dialog-panel', 'lms-course-editor-dialog']
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
