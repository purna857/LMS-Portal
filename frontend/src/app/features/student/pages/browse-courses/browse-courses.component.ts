import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import type { CourseListItem, EnrolledCourseItem, EnrolledCourseListResponse } from '@app/features/student/models/student.models';
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
              <button mat-flat-button color="primary" class="toolbar-grid__button toolbar-grid__button--primary" type="button" (click)="loadCourses()">Search</button>
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
                      <strong>Published</strong>
                    }
                  </div>

                  <div class="course-card__hero">
                    <div class="course-card__headline">
                      <h3>{{ course.title }}</h3>
                      <p>{{ course.short_description || 'A practical course built to help learners move from fundamentals to confident execution.' }}</p>
                    </div>

                    <div class="course-card__art" aria-hidden="true">
                      @if (course.thumbnail_url) {
                        <img class="course-card__art-image" [src]="course.thumbnail_url" [alt]="course.title" />
                      } @else {
                        <div class="course-card__emblem">
                          <span>{{ course.title.charAt(0) }}</span>
                          <small>{{ languageLabel(course.language) }}</small>
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <div class="course-card__chips">
                  <mat-chip-set class="course-card__chip-set">
                    <mat-chip [highlighted]="true" [disableRipple]="true">{{ displayLabel(course.level) }}</mat-chip>
                    <mat-chip [highlighted]="true" [disableRipple]="true">{{ languageLabel(course.language) }}</mat-chip>
                    <mat-chip [highlighted]="true" [disableRipple]="true">{{ displayLabel(course.visibility) }}</mat-chip>
                    <mat-chip class="course-card__status-chip" [highlighted]="true" [disableRipple]="true">{{ courseStatusLabel(course.status) }}</mat-chip>
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
                    <span>Learners</span>
                    <strong>{{ course.total_enrollments ?? 0 }}</strong>
                  </div>
                  <div class="course-card__stat">
                    <span>Focus</span>
                    <strong>{{ course.is_featured ? 'Featured' : 'Open preview' }}</strong>
                  </div>
                </div>

                <div class="course-card__actions">
                  <div class="course-card__primary-actions">
                    <a
                      mat-stroked-button
                      class="course-card__details-action"
                      [routerLink]="['/app/student/browse', course.id]">
                      View details
                    </a>
                    <a
                      mat-flat-button
                      color="primary"
                      class="course-card__preview-action"
                      [routerLink]="['/app/student/browse', course.id]">
                      Preview
                    </a>
                  </div>

                  @if (isCourseEnrolled(course.id)) {
                    <a
                      mat-flat-button
                      color="primary"
                      class="course-card__enrollment-action"
                      [routerLink]="['/app/student/learning', course.id]">
                      Continue Learning
                    </a>
                  } @else if (course.status === 'published') {
                    <button
                      mat-flat-button
                      color="primary"
                      type="button"
                      class="course-card__enrollment-action"
                      [disabled]="isEnrolling(course.id)"
                      (click)="enroll(course)">
                      {{ isEnrolling(course.id) ? 'Enrolling...' : 'Enroll Now' }}
                    </button>
                  }
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
      border-color: transparent !important;
      background: linear-gradient(135deg, #085fca 0%, #0a67d3 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 14px 24px rgba(8, 95, 202, 0.18) !important;
    }

    .course-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(280px, 420px));
      justify-content: start;
      justify-items: stretch;
    }

    .course-card {
      position: relative;
      min-height: 100%;
      overflow: hidden;
      width: 100%;
      max-width: none;
      justify-self: stretch;
      border: 1px solid #e6edf7;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
    }

    .course-card mat-card-content {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.8rem;
      padding: 0.95rem;
    }

    .course-card__banner {
      display: grid;
      gap: 0.85rem;
      padding: 0.9rem;
      border-radius: 22px;
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
      gap: 1rem;
      align-items: start;
    }

    .course-card__headline {
      display: grid;
      gap: 0.45rem;
    }

    .course-card__headline h3 {
      margin: 0;
      color: #14213d;
      font-size: 1.2rem;
      line-height: 1.12;
      letter-spacing: -0.04em;
    }

    .course-card__headline p {
      margin: 0;
      color: #5f6f86;
      font-size: 0.84rem;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.55rem;
    }

    .course-card__emblem {
      display: grid;
      place-items: center;
      gap: 0.25rem;
      width: 4.9rem;
      height: 4.9rem;
      padding: 0.55rem 0.45rem;
      border-radius: 1.35rem;
      background: #ffffff;
      border: 1px solid #dbe4f1;
      box-shadow: none;
      color: #1d4ed8;
    }

    .course-card__art {
      display: grid;
      place-items: stretch;
      width: 4.9rem;
      height: 4.9rem;
      border-radius: 1.35rem;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid #dbe4f1;
    }

    .course-card__art-image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .course-card__art .course-card__emblem {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: inherit;
      box-shadow: none;
    }

    .course-card__emblem span {
      font-size: 1.55rem;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.06em;
    }

    .course-card__emblem small {
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .course-card__chips {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
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
      padding: 0.32rem 0.65rem;
      border-radius: 999px;
      background: #eef4ff;
      color: #1d4ed8;
      font-size: 0.74rem;
      font-weight: 700;
      white-space: nowrap;
    }

    :host ::ng-deep .course-card .course-card__status-chip {
      border: 1px solid rgba(37, 99, 235, 0.22);
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.24) 0%, rgba(37, 99, 235, 0.12) 100%);
      color: #1d4ed8;
    }

    .course-card__stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.55rem;
      padding-top: 0;
    }

    .course-card__stat {
      display: grid;
      gap: 0.18rem;
      padding: 0.68rem 0.78rem;
      border: 1px solid #dbe4f1;
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .course-card__stat span {
      color: #66758c;
      font-size: 0.64rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .course-card__stat strong {
      color: #172033;
      font-size: 0.82rem;
      line-height: 1.3;
    }

    .course-card__actions {
      display: grid;
      gap: 0.45rem;
      padding-top: 0.2rem;
      border-top: 1px solid #e6edf7;
    }

    .course-card__primary-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.45rem;
      align-items: center;
    }

    .course-card__details-action,
    .course-card__preview-action,
    .course-card__enrollment-action {
      width: 100%;
      min-height: 2.2rem !important;
      padding: 0.34rem 0.78rem !important;
      border-radius: 12px !important;
      font-size: 0.8rem !important;
      font-weight: 600 !important;
      line-height: 1.1 !important;
      letter-spacing: 0.01em !important;
      box-shadow: none !important;
      transition:
        background-color var(--transition-base),
        border-color var(--transition-base),
        color var(--transition-base),
        box-shadow var(--transition-base);
    }

    .course-card__details-action {
      background: #ffffff !important;
      border-color: rgba(37, 99, 235, 0.18) !important;
      color: var(--primary-strong) !important;
    }

    .course-card__details-action:hover,
    .course-card__details-action:focus-visible {
      background: #f8fbff !important;
      border-color: rgba(37, 99, 235, 0.28) !important;
    }

    .course-card__preview-action,
    .course-card__enrollment-action {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.92) 0%, rgba(29, 78, 216, 0.96) 100%) !important;
      color: #ffffff !important;
      border: 1px solid transparent !important;
    }

    .course-card__preview-action:hover,
    .course-card__preview-action:focus-visible,
    .course-card__enrollment-action:hover,
    .course-card__enrollment-action:focus-visible {
      box-shadow: 0 10px 18px rgba(37, 99, 235, 0.14) !important;
    }

    .course-card__details-action:focus-visible,
    .course-card__preview-action:focus-visible,
    .course-card__enrollment-action:focus-visible {
      outline: none !important;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
    }

    @media (max-width: 960px) {
      .course-grid {
        grid-template-columns: 1fr;
      }

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

      .course-card__hero {
        grid-template-columns: 1fr;
        flex-direction: column;
        align-items: stretch;
      }

      .course-card__primary-actions {
        grid-template-columns: 1fr;
      }

      .course-card__emblem {
        width: 4.35rem;
        height: 4.35rem;
        border-radius: 1.25rem;
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly enrolledCourseIds = signal<Record<string, true>>({});
  readonly enrollingCourseIds = signal<Record<string, true>>({});
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

    this.loadEnrolledCourses();
    this.loadCourses();
  }

  loadCourses(): void {
    this.loading.set(true);
    const value = this.filtersForm.getRawValue();
    this.studentPortalService.listPublishedCourses({
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

  loadEnrolledCourses(): void {
    this.studentPortalService.listEnrolledCourses()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of({ items: [] as EnrolledCourseItem[], total: 0 } as EnrolledCourseListResponse))
      )
      .subscribe({
        next: (response) => {
          const enrolledCourseIds = response.items.reduce<Record<string, true>>((result, item) => {
            result[item.course_id] = true;
            return result;
          }, {});
          this.enrolledCourseIds.set(enrolledCourseIds);
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

  courseStatusLabel(value: string | null | undefined): string {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return 'Status';
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

  isCourseEnrolled(courseId: string): boolean {
    return !!this.enrolledCourseIds()[courseId];
  }

  isEnrolling(courseId: string): boolean {
    return !!this.enrollingCourseIds()[courseId];
  }

  enroll(course: CourseListItem): void {
    if (this.isCourseEnrolled(course.id) || this.isEnrolling(course.id) || course.status !== 'published') {
      return;
    }

    this.enrollingCourseIds.update((current) => ({ ...current, [course.id]: true }));
    this.studentPortalService.enrollInCourse(course.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enrollingCourseIds.update((current) => {
            const next = { ...current };
            delete next[course.id];
            return next;
          });
          this.enrolledCourseIds.update((current) => ({ ...current, [course.id]: true }));
          this.snackBar.open(`Enrolled in ${course.title}.`, 'Dismiss', { duration: 3500 });
          this.loadEnrolledCourses();
        },
        error: (error: HttpErrorResponse) => {
          this.enrollingCourseIds.update((current) => {
            const next = { ...current };
            delete next[course.id];
            return next;
          });

          if (error.status === 409 || `${error.error?.detail ?? ''}`.toLowerCase().includes('already enrolled')) {
            this.enrolledCourseIds.update((current) => ({ ...current, [course.id]: true }));
            this.snackBar.open(`You are already enrolled in ${course.title}.`, 'Dismiss', { duration: 3500 });
            this.loadEnrolledCourses();
            return;
          }

          this.snackBar.open(error.error?.detail ?? 'Unable to enroll in this course.', 'Dismiss', { duration: 4500 });
        }
      });
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
