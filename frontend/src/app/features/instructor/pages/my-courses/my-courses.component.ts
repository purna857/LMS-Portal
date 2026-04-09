import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { distinctUntilChanged, map } from 'rxjs';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { CourseEditorDialogComponent } from '@app/features/admin/components/course-editor-dialog/course-editor-dialog.component';
import type {
  CourseCategory,
  CourseCreatePayload,
  CourseDetail,
  CourseListItem,
  CourseUpdatePayload
} from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-my-courses',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="My Courses"
        description="Create, edit, publish, and maintain your course catalog from a single teaching workspace.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="filtersForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Search</mat-label>
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

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="openCourseDialog()">Create Course</button>
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
                      <button mat-stroked-button type="button" (click)="openCourseDialog(course)">Edit</button>
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
              title="No matching courses"
              description="Try a different search term or clear the current filters.">
            </app-empty-state>
          } @else {
            <app-empty-state
              icon="library_add"
              title="No courses yet"
              description="Create your first course to start building your learning catalog.">
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
export class MyCoursesComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly categories = signal<CourseCategory[]>([]);
  readonly displayedColumns = ['title', 'category', 'status', 'actions'];
  readonly filtersForm = this.formBuilder.group({
    search: [''],
    status: ['']
  });

  readonly filteredCourses = signal<CourseListItem[]>([]);

  constructor() {
    this.filtersForm.controls.search.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((value) => value?.trim().toLowerCase() ?? ''),
        distinctUntilChanged()
      )
      .subscribe(() => this.applyCourseFilters());

    this.filtersForm.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe(() => this.loadCourses());

    this.loadCategories();
    this.loadCourses();
  }

  loadCategories(): void {
    this.instructorPortalService.listCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load course categories.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadCourses(): void {
    this.loading.set(true);
    const raw = this.filtersForm.getRawValue();
    this.instructorPortalService.listMyCourses(raw.status || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.items);
          this.applyCourseFilters();
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load instructor courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  resetFilters(): void {
    this.filtersForm.reset({ search: '', status: '' });
  }

  openCourseDialog(course?: CourseListItem): void {
    if (course) {
      this.instructorPortalService.getCourse(course.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (detail) => this.openCourseEditor({
            mode: 'edit',
            course: detail,
            categories: this.categories()
          }),
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to load course details.', 'Dismiss', { duration: 4500 });
          }
        });
      return;
    }

    this.openCourseEditor({
      mode: 'create',
      categories: this.categories()
    });
  }

  private openCourseEditor(data: { mode: 'create' | 'edit'; course?: CourseDetail; categories: CourseCategory[] }): void {
    const dialogRef = this.dialog.open(CourseEditorDialogComponent, { data });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload: CourseCreatePayload | CourseUpdatePayload | undefined) => {
      if (!payload) {
        return;
      }

      const currentCourse = data.course;
      if (data.mode === 'edit' && !currentCourse) {
        return;
      }

      const request$ = data.mode === 'create' && !currentCourse
        ? this.instructorPortalService.createCourse(payload as CourseCreatePayload)
        : this.instructorPortalService.updateCourse(currentCourse!.id, payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open(`Course ${data.mode === 'create' ? 'created' : 'updated'} successfully.`, 'Dismiss', { duration: 3200 });
          this.loadCourses();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save the course.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  togglePublish(course: CourseListItem, publish: boolean): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: publish ? 'Publish Course' : 'Unpublish Course',
        message: `${publish ? 'Publish' : 'Move to draft'} "${course.title}"?`,
        confirmLabel: publish ? 'Publish' : 'Unpublish',
        confirmColor: publish ? 'primary' : 'warn'
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      const request$ = publish
        ? this.instructorPortalService.publishCourse(course.id)
        : this.instructorPortalService.unpublishCourse(course.id);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
          this.loadCourses();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to change publish state.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteCourse(course: CourseListItem): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Course',
        message: `Delete "${course.title}"? This also removes related course content.`,
        confirmLabel: 'Delete Course',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      this.instructorPortalService.deleteCourse(course.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            this.loadCourses();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete course.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }

  private applyCourseFilters(): void {
    const query = this.filtersForm.controls.search.value?.trim().toLowerCase() ?? '';
    const items = this.courses();
    this.filteredCourses.set(
      query
        ? items.filter((course) => `${course.title} ${course.slug}`.toLowerCase().includes(query))
        : items
    );
  }
}
