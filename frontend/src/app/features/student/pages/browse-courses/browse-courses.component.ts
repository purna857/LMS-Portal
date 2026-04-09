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

      <mat-card class="surface-card browse-toolbar">
        <mat-card-content>
          <div class="toolbar-grid__header">
            <div>
              <p class="toolbar-grid__eyebrow">Refine catalog</p>
              <h3>Filter by level or language</h3>
            </div>
            <div class="toolbar-grid__count">{{ filteredCourses().length }} visible</div>
          </div>

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
                <div class="course-card__topline">
                  <span>{{ course.category_name || 'Curated Learning' }}</span>
                  @if (course.is_featured) {
                    <strong>Featured</strong>
                  } @else {
                    <strong>Preview ready</strong>
                  }
                </div>

                <div class="course-card__header">
                  <mat-chip-set>
                    <mat-chip [highlighted]="course.is_featured">{{ course.level }}</mat-chip>
                    <mat-chip>{{ course.language }}</mat-chip>
                  </mat-chip-set>
                  @if (course.estimated_duration_minutes) {
                    <span class="course-card__duration">{{ course.estimated_duration_minutes }} min</span>
                  }
                </div>

                <h3>{{ course.title }}</h3>
                <p>{{ course.short_description || 'No short description is available for this course yet.' }}</p>

                <div class="course-card__meta">
                  <span>{{ course.primary_instructor_name || 'Instructor TBD' }}</span>
                  <div class="course-card__meta-tags">
                    <mat-chip-set>
                      <mat-chip>{{ course.visibility }}</mat-chip>
                    </mat-chip-set>
                  </div>
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
          [title]="emptyStateTitle()"
          [description]="emptyStateDescription()">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    .toolbar-grid__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .toolbar-grid__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.75rem;
      padding: 0 1rem;
      border-radius: 999px;
      border: 1px solid rgba(37, 99, 235, 0.18);
      background: rgba(37, 99, 235, 0.06);
      color: var(--primary);
      font-weight: 700;
      white-space: nowrap;
    }

    .browse-toolbar mat-card-content {
      display: grid;
      gap: 1rem;
      padding: 1.15rem 1.25rem 1.25rem;
    }

    .toolbar-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: end;
    }

    .toolbar-grid__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .course-grid {
      display: grid;
      gap: 1.2rem;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
    .course-card__header,
    .course-card__meta {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
    .course-card {
      min-height: 100%;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }
    .course-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 28px 52px rgba(15, 23, 42, 0.09);
      border-color: rgba(37, 99, 235, 0.16);
    }
    .course-card__topline {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }
    .course-card__topline strong {
      color: var(--primary-strong);
    }
    .course-card h3 {
      margin: 1rem 0 0.7rem;
      font-size: 1.16rem;
      letter-spacing: -0.03em;
      line-height: 1.32;
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
      align-items: center;
      margin-top: 0.35rem;
    }
    .course-card__meta-tags {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .course-card__meta-tags mat-chip-set {
      display: flex;
    }
    .course-card__duration {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.08);
      color: var(--primary);
      font-weight: 700;
      font-size: 0.82rem;
    }

    .course-card mat-card-actions {
      padding-top: 0.25rem;
    }

    @media (max-width: 960px) {
      .toolbar-grid {
        grid-template-columns: 1fr;
      }
      .toolbar-grid__header {
        flex-direction: column;
      }
      .toolbar-grid__count {
        width: fit-content;
      }
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
    this.filtersForm.controls.level.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadCourses();
      });

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
    this.filtersForm.reset({ level: '', language: '' }, { emitEvent: false });
    this.workspaceSearch.clear();
    this.loadCourses();
  }

  emptyStateTitle(): string {
    const level = this.filtersForm.controls.level.value?.trim() ?? '';
    if (level) {
      return `No ${this.formatLabel(level)} courses found`;
    }
    return 'No courses found';
  }

  emptyStateDescription(): string {
    const level = this.filtersForm.controls.level.value?.trim() ?? '';
    const language = this.filtersForm.controls.language.value?.trim() ?? '';

    if (level && language) {
      return `No ${this.formatLabel(level)} courses matched the selected language. Try a different level or clear the filters to browse the full catalog.`;
    }

    if (level) {
      return `Try a different level or clear the filters to browse more ${this.formatLabel(level).toLowerCase()} courses.`;
    }

    if (language) {
      return 'Try a different language or clear the filters to discover more courses in the catalog.';
    }

    return 'Try adjusting your filters to discover more courses in the catalog.';
  }

  private formatLabel(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }
}
