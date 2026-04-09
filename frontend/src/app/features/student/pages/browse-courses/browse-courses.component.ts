import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type { CourseListItem } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-browse-courses',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        title="Browse Courses"
        description="Explore the catalog, filter by level, and preview courses before you enroll.">
      </app-page-header>

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="filtersForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Level</mat-label>
              <mat-select formControlName="level">
                <mat-option value="">All levels</mat-option>
                <mat-option value="beginner">Beginner</mat-option>
                <mat-option value="intermediate">Intermediate</mat-option>
                <mat-option value="advanced">Advanced</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Language</mat-label>
              <input matInput formControlName="language" placeholder="en" />
            </mat-form-field>
            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">Reset</button>
              <button mat-flat-button color="primary" type="button" (click)="loadCourses()">Search</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="course-grid">
          @for (item of [1, 2, 3, 4, 5, 6]; track item) {
            <div class="stat-card skeleton skeleton--card"></div>
          }
        </div>
      }

      @if (!loading() && filteredCourses().length) {
        <div class="course-grid">
          @for (course of filteredCourses(); track course.id) {
            <mat-card class="surface-card course-card">
              <mat-card-content>
                <div class="course-card__eyebrow">
                  <span>{{ course.category_name || 'Curated Learning' }}</span>
                  @if (course.is_featured) {
                    <strong>Featured</strong>
                  }
                </div>
                <div class="course-card__header">
                  <mat-chip-set>
                    <mat-chip [highlighted]="course.is_featured">{{ course.level }}</mat-chip>
                    <mat-chip>{{ course.language }}</mat-chip>
                  </mat-chip-set>
                </div>
                <h3>{{ course.title }}</h3>
                <p>{{ course.short_description || 'No short description is available for this course yet.' }}</p>
                <div class="course-card__meta">
                  <span>{{ course.primary_instructor_name || 'Instructor TBD' }}</span>
                  <span>{{ course.visibility }}</span>
                </div>
              </mat-card-content>
              <mat-card-actions align="end">
                <a mat-button [routerLink]="['/app/student/browse', course.id]">View details</a>
                <a mat-flat-button color="primary" [routerLink]="['/app/student/browse', course.id]">Preview</a>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      } @else if (!loading()) {
        <app-empty-state
          icon="travel_explore"
          title="No courses found"
          description="Try adjusting your filters to discover more courses in the catalog.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    .course-grid {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .course-card__header,
    .course-card__meta {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .course-card {
      min-height: 100%;
    }
    .course-card__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
      color: var(--muted);
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .course-card__eyebrow strong {
      color: var(--primary-strong);
    }
    .course-card h3 {
      margin: 1rem 0 0.65rem;
      font-size: 1.22rem;
      letter-spacing: -0.03em;
    }
    .course-card p {
      margin: 0 0 1rem;
      color: var(--muted);
      line-height: 1.65;
    }
    .course-card__meta {
      color: var(--muted);
      font-size: 0.9rem;
      justify-content: space-between;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowseCoursesComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly filteredCourses = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    if (!query) {
      return this.courses();
    }

    return this.courses().filter((course) =>
      [
        course.title,
        course.short_description,
        course.category_name,
        course.primary_instructor_name,
        course.language,
        course.level
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
  readonly filtersForm = this.formBuilder.group({
    level: [''],
    language: ['']
  });

  constructor() {
    this.loadCourses();
  }

  loadCourses(): void {
    this.loading.set(true);
    const value = this.filtersForm.getRawValue();
    this.studentPortalService.listCourses({
      level: value.level || undefined,
      language: value.language?.trim() || undefined
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.items);
          this.loading.set(false);
        },
        error: () => {
          this.courses.set([]);
          this.loading.set(false);
        }
      });
  }

  resetFilters(): void {
    this.filtersForm.reset({ level: '', language: '' });
    this.workspaceSearch.clear();
    this.loadCourses();
  }
}
