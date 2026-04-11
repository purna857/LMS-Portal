import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { AssignCourseDialogComponent } from '@app/features/admin/components/assign-course-dialog/assign-course-dialog.component';
import { CourseEditorDialogComponent } from '@app/features/admin/components/course-editor-dialog/course-editor-dialog.component';
import type { CourseCategory, CourseListItem } from '@app/features/admin/models/admin.models';
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
                [value]="searchQuery()"
                (input)="setSearchQuery($any($event.target).value ?? '')"
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

            <mat-form-field appearance="outline">
              <mat-label>Sort by</mat-label>
              <mat-select formControlName="sort">
                <mat-option value="recent">Newest</mat-option>
                <mat-option value="title">Title</mat-option>
                <mat-option value="instructor">Instructor</mat-option>
                <mat-option value="status">Status</mat-option>
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

          @if (pagedCourses().length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="pagedCourses()" class="data-table">
                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Course</th>
                  <td mat-cell *matCellDef="let course">
                    <div class="cell-title">
                      <strong>{{ course.title }}</strong>
                      <span>{{ course.short_description || course.slug }}</span>
                      <div class="course-meta">
                        @if (course.is_featured) {
                          <mat-chip-set>
                            <mat-chip data-tone="info">Featured</mat-chip>
                          </mat-chip-set>
                        }
                        <span>{{ course.created_at | date:'mediumDate' }}</span>
                      </div>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef>Category</th>
                  <td mat-cell *matCellDef="let course">{{ course.category_name || 'Uncategorized' }}</td>
                </ng-container>

                <ng-container matColumnDef="owner">
                  <th mat-header-cell *matHeaderCellDef>Instructor</th>
                  <td mat-cell *matCellDef="let course">
                    <div class="cell-title">
                      <strong>{{ course.primary_instructor_name || 'Unknown' }}</strong>
                      <span>{{ course.language | uppercase }} · {{ course.level }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="learners">
                  <th mat-header-cell *matHeaderCellDef>Learners</th>
                  <td mat-cell *matCellDef="let course">
                    <div class="cell-title">
                      <strong>{{ enrollmentCount(course.id) }}</strong>
                      <span>{{ enrollmentCount(course.id) === 1 ? 'enrolled learner' : 'enrolled learners' }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let course">
                    <mat-chip-set class="course-status-set">
                      <mat-chip [attr.data-tone]="chipToneForCourseStatus(course.status)">{{ courseStatusLabel(course.status) }}</mat-chip>
                      <mat-chip [attr.data-tone]="chipToneForVisibility(course.visibility)">{{ visibilityLabel(course.visibility) }}</mat-chip>
                    </mat-chip-set>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Actions</th>
                  <td mat-cell *matCellDef="let course">
                    <div class="action-row course-actions">
                      <button mat-stroked-button type="button" (click)="editCourse(course)">Edit</button>
                      @if (course.status === 'published') {
                        <button mat-stroked-button type="button" (click)="togglePublish(course, false)">Unpublish</button>
                      } @else {
                        <button mat-stroked-button color="primary" type="button" (click)="togglePublish(course, true)">Publish</button>
                      }
                      <button
                        mat-icon-button
                        type="button"
                        [matMenuTriggerFor]="courseMenu"
                        [matMenuTriggerData]="{ course: course }">
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
                Showing {{ pageStart() + 1 }}-{{ pageEnd() }} of {{ sortedCourses().length }} courses
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
                <button mat-stroked-button type="button" (click)="nextPage()" [disabled]="pageEnd() >= sortedCourses().length">Next</button>
              </div>
            </div>
          } @else if (courses().length) {
            <app-empty-state
              icon="search_off"
              [title]="normalizedSearchQuery() ? 'No matching courses' : 'No courses match this view'"
              [description]="normalizedSearchQuery() ? 'Try a different search term or clear the current filters.' : 'Update the filters to find more of the catalog or newly authored courses.'">
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

    <mat-menu #courseMenu="matMenu">
      <ng-template matMenuContent let-course="course">
        <button mat-menu-item type="button" (click)="editCourse(course)">
          <span class="material-symbols-outlined">edit</span>
          <span>Edit course</span>
        </button>
        <button mat-menu-item type="button" (click)="assignCourse(course)">
          <span class="material-symbols-outlined">person_add</span>
          <span>Assign to student</span>
        </button>
        @if (course?.status === 'published') {
          <button mat-menu-item type="button" (click)="togglePublish(course, false)">
            <span class="material-symbols-outlined">unpublished</span>
            <span>Unpublish</span>
          </button>
        } @else {
          <button mat-menu-item type="button" (click)="togglePublish(course, true)">
            <span class="material-symbols-outlined">publish</span>
            <span>Publish</span>
          </button>
        }
        <button mat-menu-item type="button" (click)="deleteCourse(course)">
          <span class="material-symbols-outlined">delete</span>
          <span>Delete course</span>
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

    .action-row.course-actions {
      align-items: flex-start;
      gap: 0.4rem;
    }

    .action-row.course-actions button:not([mat-icon-button]) {
      min-width: 5rem;
      height: 2.35rem;
      padding-inline: 0.85rem;
      font-size: 0.84rem;
      border-radius: 14px !important;
    }

    .action-row.course-actions button[mat-icon-button] {
      width: 2.35rem;
      height: 2.35rem;
      min-width: 2.35rem;
      min-height: 2.35rem;
    }

    .data-table .course-status-set {
      display: flex;
      flex-wrap: nowrap;
      gap: 0.35rem;
      align-items: center;
      justify-content: flex-start;
      min-width: 0;
    }

    .data-table .course-status-set .mat-mdc-chip {
      min-height: 2.05rem;
      height: 2.05rem;
      padding-inline: 0.45rem;
      font-size: 0.68rem;
    }

    .data-table .course-status-set .mat-mdc-chip .mat-mdc-chip-action-label,
    .data-table .course-status-set .mat-mdc-chip .mdc-evolution-chip__text-label {
      line-height: 1;
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

    .workflow-card__actions,
    .course-meta {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .course-meta {
      margin-top: 0.5rem;
      color: var(--muted);
      font-size: 0.8rem;
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
export class CourseManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly categories = signal<CourseCategory[]>([]);
  readonly courseEnrollmentCounts = signal<Record<string, number>>({});
  readonly searchQuery = signal('');
  readonly normalizedSearchQuery = computed(() => this.searchQuery().trim().toLowerCase());
  readonly currentPage = signal(0);
  readonly pageSize = signal(10);
  readonly displayedColumns = ['title', 'category', 'owner', 'learners', 'status', 'actions'];
  readonly summaryCards = computed(() => {
    const courses = this.courses();
    const totalLearners = Object.values(this.courseEnrollmentCounts()).reduce((sum, count) => sum + count, 0);
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
        label: 'Learner Seats',
        value: String(totalLearners),
        hint: 'Existing enrollments across loaded courses',
        icon: 'group'
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
    const query = this.normalizedSearchQuery();
    if (!query) {
      return this.courses();
    }

    return this.courses().filter((course) =>
      this.matchesSearch(
        query,
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
  readonly sortedCourses = computed(() => {
    const sort = this.filtersForm.controls.sort.value ?? 'recent';
    const courses = [...this.filteredCourses()];
    return courses.sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'instructor':
          return (a.primary_instructor_name ?? '').localeCompare(b.primary_instructor_name ?? '');
        case 'status':
          return a.status.localeCompare(b.status);
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  });
  readonly pageStart = computed(() => this.currentPage() * this.pageSize());
  readonly pageEnd = computed(() => Math.min(this.pageStart() + this.pageSize(), this.sortedCourses().length));
  readonly pagedCourses = computed(() => this.sortedCourses().slice(this.pageStart(), this.pageEnd()));

  readonly chipToneForCourseStatus = chipToneForCourseStatus;
  readonly chipToneForVisibility = chipToneForVisibility;

  readonly filtersForm = this.formBuilder.group({
    status: [''],
    category_id: [''],
    sort: ['recent']
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
    this.currentPage.set(0);
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
          this.loadEnrollmentCounts(response.items);
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
      category_id: '',
      sort: 'recent'
    });
    this.currentPage.set(0);
    this.searchQuery.set('');
    this.loadCourses();
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(String(value).trimStart());
    this.currentPage.set(0);
  }

  setPageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(0);
  }

  enrollmentCount(courseId: string): number {
    return this.courseEnrollmentCounts()[courseId] ?? 0;
  }

  courseStatusLabel(status: string): string {
    if (!status) {
      return 'Unknown';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  visibilityLabel(visibility: string): string {
    if (!visibility) {
      return 'Unknown';
    }

    return visibility.charAt(0).toUpperCase() + visibility.slice(1);
  }

  previousPage(): void {
    this.currentPage.update((page) => Math.max(0, page - 1));
  }

  nextPage(): void {
    if (this.pageEnd() < this.sortedCourses().length) {
      this.currentPage.update((page) => page + 1);
    }
  }

  private matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
    return values
      .filter((value): value is string => !!value)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }

  private loadEnrollmentCounts(courses: CourseListItem[]): void {
    if (!courses.length) {
      this.courseEnrollmentCounts.set({});
      return;
    }

    forkJoin(
      courses.map((course) =>
        this.adminPortalService.getEnrollmentStats(course.id).pipe(
          catchError(() =>
            of({
              total_enrollments: 0,
              active_enrollments: 0,
              completed_enrollments: 0,
              dropped_enrollments: 0,
              suspended_enrollments: 0
            })
          )
        )
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((stats) => {
        const counts = courses.reduce<Record<string, number>>((result, course, index) => {
          result[course.id] = stats[index]?.total_enrollments ?? 0;
          return result;
        }, {});
        this.courseEnrollmentCounts.set(counts);
      });
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

  assignCourse(course: CourseListItem): void {
    const dialogRef = this.dialog.open(AssignCourseDialogComponent, {
      data: {
        courseId: course.id,
        courseTitle: course.title
      },
      ...portalDialogConfig('lg')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      this.loadCourses();
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
