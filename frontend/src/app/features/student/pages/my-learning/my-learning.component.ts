import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import type { CourseModule, CourseProgress, EnrolledCourseItem, Lesson } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

type LearningFilter = 'all' | 'in_progress' | 'completed';
type LearningSort = 'recent' | 'title' | 'progress';

interface LearningLibraryItem {
  course: EnrolledCourseItem;
  progress: CourseProgress | null;
  modules: CourseModule[];
  lessons: Lesson[];
  videoLessonCount: number;
  totalDurationMinutes: number;
  currentModuleTitle: string | null;
  currentLessonTitle: string | null;
}

@Component({
  selector: 'app-my-learning',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, ...materialImports],
  template: `
    <section class="page-section learning-library-page">
      <header class="library-header surface-card">
        <div class="library-header__content">
          <h1>My learning</h1>
          <p>Pick up where you left off, revisit key lessons, and keep your momentum moving.</p>
        </div>
      </header>

      <section class="library-toolbar surface-card">
        <div class="library-toolbar__filters">
          @for (tab of tabs; track tab.value) {
            <button
              type="button"
              class="filter-pill"
              [class.filter-pill--active]="activeFilter() === tab.value"
              (click)="activeFilter.set(tab.value)">
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="library-toolbar__actions">
          <div class="library-toolbar__count">{{ visibleCourses().length }} courses</div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Sort by</mat-label>
            <mat-select [value]="sortMode()" (selectionChange)="sortMode.set($event.value)">
              <mat-option value="recent">Recently accessed</mat-option>
              <mat-option value="progress">Highest progress</mat-option>
              <mat-option value="title">Title</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </section>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <section class="course-grid">
          @for (item of [1, 2, 3, 4]; track item) {
            <article class="course-card surface-card skeleton skeleton--card"></article>
          }
        </section>
      }

      @if (!loading() && visibleCourses().length) {
        <section class="course-grid">
          @for (item of visibleCourses(); track item.course.course_id) {
            <article class="course-card surface-card">
              <div class="course-card__media">
                <div class="course-card__thumbnail">
                  @if (item.course.thumbnail_url) {
                    <img [src]="item.course.thumbnail_url" [alt]="item.course.title" />
                  } @else {
                    <div class="course-card__fallback">{{ item.course.title.charAt(0) }}</div>
                  }

                  @if (item.videoLessonCount > 0) {
                    <button type="button" class="play-button" aria-label="Continue learning">
                      <span class="material-symbols-outlined">play_arrow</span>
                    </button>
                  }

                  <button type="button" class="more-button" aria-label="Course actions">
                    <span class="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              </div>

              <div class="course-card__body">
                <h2>{{ item.course.title }}</h2>
                <p class="course-card__instructor">{{ item.course.primary_instructor_name || 'Course instructor' }}</p>

                <div class="course-card__meta">
                  <span>{{ item.modules.length }} sections</span>
                  <span>{{ item.videoLessonCount }} lectures</span>
                  <span>{{ item.totalDurationMinutes }} min</span>
                </div>

                <div class="course-card__progress-block">
                  @if ((item.progress?.progress_percentage ?? 0) > 0) {
                    <div class="course-card__progress-label">
                      <span>{{ item.progress?.progress_percentage ?? 0 }}% complete</span>
                    </div>
                    <mat-progress-bar mode="determinate" [value]="item.progress?.progress_percentage ?? 0"></mat-progress-bar>
                  } @else {
                    <div class="course-card__start-line">Start course</div>
                  }
                </div>

                <div class="course-card__footer">
                  <span>{{ item.currentModuleTitle || 'Open course content' }}</span>
                  <a [routerLink]="['/app/student/learning', item.course.course_id]" class="course-card__cta">
                    {{ (item.progress?.progress_percentage ?? 0) > 0 ? 'Continue learning' : 'Start course' }}
                  </a>
                </div>
              </div>
            </article>
          }
        </section>
      } @else if (!loading()) {
        <app-empty-state
          icon="auto_stories"
          title="No courses match this view"
          description="Try another filter or search term to find a course in your learning library.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'IBM Plex Sans', sans-serif !important;
    }

    .learning-library-page {
      gap: 1.45rem;
      background: transparent;
    }

    .library-header {
      padding: 1.75rem 1.5rem;
      border: 1px solid #e7eef9;
      border-radius: 30px;
      background:
        radial-gradient(circle at top right, rgba(79, 147, 255, 0.16), transparent 34%),
        linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
      box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
    }

    .library-header__content {
      display: grid;
      gap: 0.6rem;
    }

    .library-header h1 {
      margin: 0;
      font-size: clamp(1.5rem, 2vw, 2rem);
      line-height: 1;
      letter-spacing: -0.03em;
      color: #14213d;
    }

    .library-header p {
      margin: 0;
      max-width: 44rem;
      color: #5f6f86;
      font-size: 0.98rem;
      line-height: 1.6;
    }

    .library-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 1.15rem 1.2rem;
      background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border: 1px solid #e7eef9;
      border-radius: 30px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }

    .library-toolbar__filters {
      display: flex;
      gap: 0.8rem;
      flex-wrap: wrap;
    }

    .filter-pill {
      border: 1px solid #d7dfeb;
      border-radius: 999px;
      padding: 0.78rem 1.2rem;
      background: #ffffff;
      color: #172033;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }

    .filter-pill:hover,
    .filter-pill--active {
      border-color: #bfd4ff;
      background: linear-gradient(135deg, #edf4ff 0%, #f9fbff 100%);
      color: #1d4ed8;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.12);
      transform: translateY(-1px);
    }

      .library-toolbar__actions {
      display: grid;
      grid-template-columns: auto 190px;
      gap: 0.85rem;
      align-items: start;
    }

    .library-toolbar__count {
      display: flex;
      align-items: center;
      min-height: 56px;
      color: #172033;
      font-size: 0.95rem;
      font-weight: 700;
      white-space: nowrap;
      padding-inline: 0.25rem;
    }

    .course-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 336px));
      gap: 1.25rem 1.1rem;
      justify-content: start;
      align-items: start;
    }

    .course-card {
      display: grid;
      gap: 0.9rem;
      background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border: 1px solid #dfe8f7;
      border-radius: 28px;
      padding: 0.9rem;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }

    .course-card:hover {
      transform: translateY(-4px);
      border-color: #bfd4ff;
      box-shadow: 0 26px 56px rgba(37, 99, 235, 0.16);
    }

    .course-card__thumbnail {
      position: relative;
      aspect-ratio: 16 / 9;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 22px;
      background:
        linear-gradient(145deg, rgba(9, 18, 38, 0.96) 0%, rgba(15, 29, 58, 0.96) 100%);
      overflow: hidden;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .course-card__thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transform: scale(1.01);
    }

    .course-card__fallback {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle at top, rgba(93, 135, 255, 0.42), transparent 35%),
        linear-gradient(135deg, #0f1b35 0%, #18284d 100%);
      color: #f8fbff;
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: -0.04em;
    }

    .play-button,
    .more-button {
      position: absolute;
      display: grid;
      place-items: center;
      border: 0;
      cursor: pointer;
    }

    .play-button {
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.95);
      color: #172033;
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.28);
      backdrop-filter: blur(12px);
    }

    .play-button .material-symbols-outlined {
      font-size: 2.35rem;
      margin-left: 0.15rem;
    }

    .more-button {
      top: 0.7rem;
      right: 0.7rem;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.98);
      color: #172033;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
    }

    .course-card__body {
      display: grid;
      gap: 0.45rem;
      padding: 0.1rem 0.15rem 0.2rem;
    }

    .course-card__body h2 {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.2;
      color: #14213d;
      min-height: 2.35rem;
      letter-spacing: -0.03em;
    }

    .course-card__instructor {
      margin: 0;
      color: #5f6f86;
      font-size: 0.88rem;
      line-height: 1.45;
      font-weight: 500;
    }

    .course-card__meta {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
      color: #52627b;
      font-size: 0.72rem;
      min-height: 1.2rem;
      margin-top: 0.1rem;
    }

    .course-card__meta span {
      padding: 0.32rem 0.65rem;
      border-radius: 999px;
      background: #f3f7fd;
      border: 1px solid #e2eaf6;
      font-weight: 600;
    }

    .course-card__progress-block {
      display: grid;
      gap: 0.5rem;
      margin-top: 0.35rem;
    }

    .course-card__progress-label,
    .course-card__start-line {
      color: #172033;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .course-card__start-line {
      padding-top: 0.6rem;
      border-top: 1px solid #dbe4f1;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
    }

    .course-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-top: 0.85rem;
      border-top: 1px solid #e4ebf5;
      margin-top: 0.1rem;
    }

    .course-card__footer span {
      color: #5f6f86;
      font-size: 0.82rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .course-card__cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 1rem;
      border-radius: 999px;
      background: linear-gradient(135deg, #1d63e8 0%, #2f80ff 100%);
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      box-shadow: 0 14px 26px rgba(29, 99, 232, 0.24);
    }

    @media (max-width: 1320px) {
      .course-grid {
        grid-template-columns: repeat(auto-fill, minmax(260px, 320px));
      }
    }

    @media (max-width: 1080px) {
      .library-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .library-toolbar__actions {
        grid-template-columns: minmax(0, 1fr);
      }

      .course-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 300px));
      }
    }

    @media (max-width: 720px) {
      .library-toolbar__actions,
      .course-grid {
        grid-template-columns: 1fr;
      }

      .library-header h1 {
        font-size: 1.8rem;
      }

      .library-header {
        padding: 1.35rem 1.15rem;
        border-radius: 24px;
      }

      .course-card {
        padding: 0.85rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyLearningComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(true);
  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly progressMap = signal<Record<string, CourseProgress | null>>({});
  readonly moduleMap = signal<Record<string, CourseModule[]>>({});
  readonly lessonMap = signal<Record<string, Lesson[]>>({});
  readonly activeFilter = signal<LearningFilter>('all');
  readonly sortMode = signal<LearningSort>('recent');

  readonly tabs: Array<{ label: string; value: LearningFilter }> = [
    { label: 'All courses', value: 'all' },
    { label: 'In progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' }
  ];

  readonly courseCards = computed<LearningLibraryItem[]>(() =>
    this.enrolledCourses().map((course) => {
      const modules = this.moduleMap()[course.course_id] ?? [];
      const lessons = this.lessonMap()[course.course_id] ?? [];
      const progress = this.progressMap()[course.course_id] ?? null;
      const currentModuleTitle = modules[0]?.title ?? null;
      const currentLessonTitle =
        lessons.find((lesson) => lesson.lesson_type === 'video')?.title ??
        lessons[0]?.title ??
        null;

      return {
        course,
        progress,
        modules,
        lessons,
        videoLessonCount: lessons.filter((lesson) => lesson.lesson_type === 'video').length,
        totalDurationMinutes: lessons.reduce((total, lesson) => total + (lesson.duration_minutes ?? 0), 0),
        currentModuleTitle,
        currentLessonTitle
      };
    })
  );

  readonly visibleCourses = computed(() => {
    const query = this.workspaceSearch.query().trim().toLowerCase();
    const filter = this.activeFilter();
    const sort = this.sortMode();

    let items = this.courseCards();

    if (filter !== 'all') {
      items = items.filter((item) => item.progress?.progress_status === filter);
    }

    if (query) {
      items = items.filter((item) =>
        `${item.course.title} ${item.course.short_description ?? ''} ${item.course.primary_instructor_name ?? ''}`
          .toLowerCase()
          .includes(query)
      );
    }

    return [...items].sort((a, b) => {
      if (sort === 'title') {
        return a.course.title.localeCompare(b.course.title);
      }

      if (sort === 'progress') {
        return (b.progress?.progress_percentage ?? 0) - (a.progress?.progress_percentage ?? 0);
      }

      return new Date(b.course.enrolled_at ?? 0).getTime() - new Date(a.course.enrolled_at ?? 0).getTime();
    });
  });

  constructor() {
    this.loadLearning();
  }

  loadLearning(): void {
    this.loading.set(true);
    this.studentPortalService.listEnrolledCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.enrolledCourses.set(response.items);

          if (!response.items.length) {
            this.progressMap.set({});
            this.moduleMap.set({});
            this.lessonMap.set({});
            this.loading.set(false);
            return;
          }

          const progressRequests = Object.fromEntries(
            response.items.map((course) => [course.course_id, this.studentPortalService.getCourseProgress(course.course_id)])
          );

          const moduleRequests = Object.fromEntries(
            response.items.map((course) => [course.course_id, this.studentPortalService.listModules(course.course_id)])
          );

          forkJoin({
            progress: forkJoin(progressRequests),
            modules: forkJoin(moduleRequests)
          })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: ({ progress, modules }) => {
                this.progressMap.set(progress);

                const moduleMap = Object.fromEntries(
                  Object.entries(modules).map(([courseId, moduleResponse]) => [courseId, moduleResponse.items])
                );
                this.moduleMap.set(moduleMap);

                const lessonRequests = Object.fromEntries(
                  Object.entries(moduleMap).map(([courseId, items]) => [
                    courseId,
                    items.length
                      ? forkJoin(
                          items.map((module) =>
                            this.studentPortalService.listLessons(module.id).pipe(
                              catchError(() => of({ items: [], total: 0 }))
                            )
                          )
                        )
                      : of([])
                  ])
                );

                forkJoin(lessonRequests)
                  .pipe(takeUntilDestroyed(this.destroyRef))
                  .subscribe({
                    next: (lessonsByCourse) => {
                      this.lessonMap.set(
                        Object.fromEntries(
                          Object.entries(lessonsByCourse).map(([courseId, lessonResponses]) => [
                            courseId,
                            lessonResponses.flatMap((response) => response.items)
                          ])
                        )
                      );
                      this.loading.set(false);
                    },
                    error: () => {
                      this.lessonMap.set({});
                      this.loading.set(false);
                      this.snackBar.open('Unable to load lesson details for your courses.', 'Dismiss', { duration: 4500 });
                    }
                  });
              },
              error: () => {
                this.progressMap.set({});
                this.moduleMap.set({});
                this.lessonMap.set({});
                this.loading.set(false);
                this.snackBar.open('Unable to load course progress and module details.', 'Dismiss', { duration: 4500 });
              }
            });
        },
        error: () => {
          this.enrolledCourses.set([]);
          this.progressMap.set({});
          this.moduleMap.set({});
          this.lessonMap.set({});
          this.loading.set(false);
          this.snackBar.open('Unable to load enrolled courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
