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
              <input matInput formControlName="language" placeholder="English" />
            </mat-form-field>
            <div class="toolbar-grid__actions">
              <button mat-stroked-button class="toolbar-grid__button" type="button" (click)="resetFilters()">Reset</button>
              <button mat-stroked-button class="toolbar-grid__button toolbar-grid__button--primary" type="button" (click)="loadCourses()">Search</button>
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
                <div class="course-card__banner">
                  <div class="course-card__eyebrow">
                    <span>{{ course.category_name || 'Curated learning' }}</span>
                    @if (course.is_featured) {
                      <strong>Featured track</strong>
                    } @else {
                      <strong>Preview ready</strong>
                    }
                  </div>

                  <div class="course-card__hero">
                    <div class="course-card__headline">
                      <h3>{{ course.title }}</h3>
                      <p>{{ course.short_description || 'A practical course built to help learners move from fundamentals to confident execution.' }}</p>
                    </div>

                    <div class="course-card__emblem" aria-hidden="true">
                      <span>{{ course.title.charAt(0) }}</span>
                      <small>{{ languageLabel(course.language) }}</small>
                    </div>
                  </div>
                </div>

                <div class="course-card__chips">
                  <mat-chip-set class="course-card__chip-set">
                    <mat-chip [highlighted]="true" [disableRipple]="true">{{ displayLabel(course.level) }}</mat-chip>
                    <mat-chip [highlighted]="true" [disableRipple]="true">{{ languageLabel(course.language) }}</mat-chip>
                    <mat-chip [highlighted]="true" [disableRipple]="true">{{ displayLabel(course.visibility) }}</mat-chip>
                  </mat-chip-set>
                  @if (course.estimated_duration_minutes) {
                    <span class="course-card__duration">{{ course.estimated_duration_minutes }} min</span>
                  }
                </div>

                <div class="course-card__stats">
                  <div class="course-card__stat">
                    <span>Instructor</span>
                    <strong>{{ course.primary_instructor_name || 'Instructor TBD' }}</strong>
                  </div>
                  <div class="course-card__stat">
                    <span>Access</span>
                    <strong>{{ displayLabel(course.visibility) }}</strong>
                  </div>
                  <div class="course-card__stat">
                    <span>Focus</span>
                    <strong>{{ course.is_featured ? 'Featured' : 'Open preview' }}</strong>
                  </div>
                </div>

                <div class="course-card__actions">
                  <a mat-stroked-button [routerLink]="['/app/student/browse', course.id]">View details</a>
                  <a mat-flat-button color="primary" [routerLink]="['/app/student/browse', course.id]">Preview</a>
                </div>
              </mat-card-content>
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
      gap: 1.25rem;
      margin-bottom: 1.1rem;
    }

    .toolbar-grid__header > div:first-child {
      display: grid;
      gap: 0.35rem;
    }

    .toolbar-grid__eyebrow {
      margin: 0;
      color: #60708a;
      font-size: 0.78rem;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .toolbar-grid__header h3 {
      margin: 0;
      color: #14213d;
      font-size: 1.45rem;
      line-height: 1.15;
      letter-spacing: -0.03em;
    }

    .toolbar-grid__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 3.5rem;
      padding: 0 1.1rem;
      border-radius: 999px;
      border: 1px solid rgba(37, 99, 235, 0.18);
      background: rgba(37, 99, 235, 0.06);
      color: var(--primary);
      font-size: 0.95rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .browse-toolbar mat-card-content {
      display: grid;
      gap: 1.15rem;
      padding: 1.2rem 1.25rem 1.3rem;
    }

    .toolbar-grid {
      display: grid;
      grid-template-columns: minmax(16rem, 1fr) minmax(16rem, 1fr) auto;
      gap: 0.85rem;
      align-items: center;
    }

    .toolbar-grid__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.65rem;
      justify-self: stretch;
      align-self: center;
    }

    .toolbar-grid__button {
      min-height: 3rem;
      height: 3rem;
      width: 8.75rem !important;
      min-width: 8.75rem !important;
      max-width: 8.75rem !important;
      flex: 0 0 8.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding-inline: 0.9rem;
      border-radius: 16px;
      font-size: 0.9rem;
      font-weight: 700;
      line-height: 1;
      box-sizing: border-box;
      white-space: nowrap;
    }

    .toolbar-grid__button--primary {
      border-color: transparent;
      background: linear-gradient(135deg, #085fca 0%, #0a67d3 100%);
      color: #ffffff;
      box-shadow: 0 14px 24px rgba(8, 95, 202, 0.18);
    }

    .course-grid {
      display: grid;
      gap: 1.2rem;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    .course-card {
      position: relative;
      min-height: 100%;
      overflow: hidden;
      border: 1px solid #e6edf7;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
    }

    .course-card mat-card-content {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 1rem;
      padding: 1.15rem;
    }

    .course-card__banner {
      display: grid;
      gap: 1.15rem;
      padding: 1.15rem;
      border-radius: 24px;
      background:
        radial-gradient(circle at top right, rgba(255, 255, 255, 0.48), transparent 34%),
        linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .course-card__eyebrow {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .course-card__eyebrow strong {
      color: #1d4ed8;
      white-space: nowrap;
    }

    .course-card__hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1.35rem;
      align-items: start;
    }

    .course-card__headline {
      display: grid;
      gap: 0.65rem;
    }

    .course-card__headline h3 {
      margin: 0;
      color: #14213d;
      font-size: 1.45rem;
      line-height: 1.12;
      letter-spacing: -0.04em;
    }

    .course-card__headline p {
      margin: 0;
      color: #5f6f86;
      font-size: 0.88rem;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 4.55rem;
    }

    .course-card__emblem {
      display: grid;
      place-items: center;
      gap: 0.25rem;
      width: 5.6rem;
      height: 5.6rem;
      padding: 0.65rem 0.5rem;
      border-radius: 1.55rem;
      background: #ffffff;
      border: 1px solid #dbe4f1;
      box-shadow: none;
      color: #1d4ed8;
    }

    .course-card__emblem span {
      font-size: 1.86rem;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.06em;
    }

    .course-card__emblem small {
      font-size: 0.64rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .course-card__chips {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .course-card__chip-set {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    :host ::ng-deep .course-card .mat-mdc-chip-set {
      margin: 0;
      pointer-events: none;
      user-select: none;
    }

    :host ::ng-deep .course-card .mat-mdc-chip {
      border: 1px solid rgba(37, 99, 235, 0.18);
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(37, 99, 235, 0.1) 100%);
      color: #1d4ed8;
      font-weight: 600;
      pointer-events: none;
      box-shadow: none;
      --mdc-chip-hover-state-layer-opacity: 0;
      --mdc-chip-focus-state-layer-opacity: 0;
      --mdc-chip-pressed-state-layer-opacity: 0;
    }

    :host ::ng-deep .course-card .mat-mdc-chip.mat-mdc-chip-highlighted {
      border: 1px solid rgba(37, 99, 235, 0.18);
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(37, 99, 235, 0.1) 100%);
      color: #1d4ed8;
    }

    .course-card__duration {
      display: inline-flex;
      align-items: center;
      padding: 0.4rem 0.75rem;
      border-radius: 999px;
      background: #eef4ff;
      color: #1d4ed8;
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .course-card__stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.7rem;
      padding-top: 0.05rem;
    }

    .course-card__stat {
      display: grid;
      gap: 0.25rem;
      padding: 0.85rem 0.9rem;
      border: 1px solid #dbe4f1;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .course-card__stat span {
      color: #66758c;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .course-card__stat strong {
      color: #172033;
      font-size: 0.88rem;
      line-height: 1.35;
    }

    .course-card__actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding-top: 0.35rem;
      border-top: 1px solid #e6edf7;
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
      .toolbar-grid__actions {
        width: 100%;
        justify-content: flex-start;
      }

      .toolbar-grid__button {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        flex: 1 1 10rem;
      }

      .course-card__hero,
      .course-card__actions {
        grid-template-columns: 1fr;
        flex-direction: column;
        align-items: stretch;
      }

      .course-card__emblem {
        width: 4.6rem;
        height: 4.6rem;
        border-radius: 1.35rem;
      }

      .course-card__stats {
        grid-template-columns: 1fr;
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
  private readonly languageNames: Record<string, string> = {
    ar: 'Arabic',
    bengali: 'Bengali',
    de: 'German',
    dutch: 'Dutch',
    en: 'English',
    english: 'English',
    es: 'Spanish',
    french: 'French',
    fr: 'French',
    gujarati: 'Gujarati',
    hi: 'Hindi',
    hindi: 'Hindi',
    id: 'Indonesian',
    italian: 'Italian',
    it: 'Italian',
    ja: 'Japanese',
    japanese: 'Japanese',
    ko: 'Korean',
    korean: 'Korean',
    ml: 'Malayalam',
    mr: 'Marathi',
    nl: 'Dutch',
    pa: 'Punjabi',
    polish: 'Polish',
    pt: 'Portuguese',
    russian: 'Russian',
    ru: 'Russian',
    spanish: 'Spanish',
    tamil: 'Tamil',
    te: 'Telugu',
    thai: 'Thai',
    tr: 'Turkish',
    turkish: 'Turkish',
    uk: 'Ukrainian',
    ur: 'Urdu',
    vi: 'Vietnamese',
    zh: 'Chinese'
  };

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

  displayLabel(value: string | null | undefined): string {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return 'All';
    }
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  }

  languageLabel(value: string | null | undefined): string {
    const normalized = value?.trim().toLowerCase() ?? '';
    if (!normalized) {
      return 'English';
    }

    const code = normalized.split('-')[0];
    return this.languageNames[code] ?? `${code.charAt(0).toUpperCase()}${code.slice(1)}`;
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
