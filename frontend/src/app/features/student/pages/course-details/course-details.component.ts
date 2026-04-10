import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type { CourseDetail, CourseModule, EnrolledCourseItem, Lesson } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-course-details',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section course-details-page">
      <app-page-header
        eyebrow="Student"
        [title]="course()?.title || 'Course preview'"
        [description]="course()?.short_description || 'Review the syllabus, roadmap, and access details before you start.'">
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="detail-layout">
          <div class="stat-card skeleton skeleton--card"></div>
          <div class="stat-card skeleton skeleton--card"></div>
        </div>
      }

      @if (course(); as courseDetail) {
        <div class="detail-layout">
          <section class="surface-card detail-hero">
            <div class="detail-hero__copy">
              <div class="detail-hero__eyebrow">
                <span>{{ courseDetail.category?.name || 'Course' }}</span>
                @if (courseDetail.is_featured) {
                  <strong>Featured track</strong>
                } @else {
                  <strong>Preview ready</strong>
                }
              </div>

              <h2>Course snapshot</h2>
              <p class="detail-hero__summary">
                {{ courseDetail.short_description || courseDetail.description || 'No description provided yet.' }}
              </p>

              <div class="detail-hero__facts">
                <div class="detail-hero__fact">
                  <span>Duration</span>
                  <strong>{{ courseDetail.estimated_duration_minutes || 0 }} min</strong>
                </div>
                <div class="detail-hero__fact">
                  <span>Modules</span>
                  <strong>{{ modules().length }}</strong>
                </div>
                <div class="detail-hero__fact">
                  <span>Lessons</span>
                  <strong>{{ lessonCount() }}</strong>
                </div>
              </div>

              <div class="detail-hero__chips">
                <mat-chip-set class="detail-hero__chip-set">
                  <mat-chip [highlighted]="true">{{ formatLabel(courseDetail.level) }}</mat-chip>
                  <mat-chip>{{ languageLabel(courseDetail.language) }}</mat-chip>
                  <mat-chip>{{ formatLabel(courseDetail.visibility) }}</mat-chip>
                </mat-chip-set>
              </div>

              <div class="detail-hero__actions">
                @if (isEnrolled()) {
                  <a mat-flat-button color="primary" [routerLink]="['/app/student/learning', courseDetail.id]">Go to learning</a>
                } @else {
                  <button mat-flat-button color="primary" type="button" (click)="enroll(courseDetail.id)">Enroll now</button>
                }
                <a mat-stroked-button routerLink="/app/student/browse">Back to catalog</a>
              </div>
            </div>
          </section>

          <mat-card class="surface-card detail-outline">
            <div class="detail-outline__header">
              <div>
                <p>Course outline</p>
                <mat-card-title>Learning roadmap</mat-card-title>
              </div>
              <span>{{ modules().length }} sections</span>
            </div>
            <mat-card-content>
              @if (modules().length) {
                <div class="outline-list">
                  @for (module of modules(); track module.id; let index = $index) {
                    <div class="outline-list__item">
                      <div class="outline-list__index">{{ index + 1 }}</div>
                      <div class="outline-list__copy">
                        <strong>{{ module.title }}</strong>
                        <p>{{ module.description || 'Module overview will appear here.' }}</p>
                      </div>
                      <span class="outline-list__count">{{ (lessonsByModule()[module.id] || []).length }} lessons</span>
                    </div>
                  }
                </div>
              } @else {
                <app-empty-state
                  icon="view_module"
                  title="No published modules yet"
                  description="Published course content will appear here once it becomes available.">
                </app-empty-state>
              }
            </mat-card-content>
          </mat-card>
        </div>
      } @else if (!loading()) {
        <app-empty-state
          icon="school"
          title="Course unavailable"
          description="This course could not be loaded or is not available for your account.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    .course-details-page {
      gap: 1.05rem;
    }

    .detail-layout {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: 1fr;
      align-items: start;
    }

    .detail-hero {
      position: relative;
      display: grid;
      gap: 1.2rem;
      padding: 1.4rem;
      overflow: hidden;
      border: 0;
      border-radius: 30px;
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      box-shadow: 0 22px 54px rgba(15, 23, 42, 0.08);
    }

    .detail-hero__copy {
      display: grid;
      gap: 1.05rem;
      align-content: start;
      padding: 0;
    }

    .detail-hero__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.68rem;
      font-weight: 700;
    }

    .detail-hero__eyebrow strong {
      color: #1d4ed8;
      white-space: nowrap;
    }

    .detail-hero h2 {
      margin: 0;
      color: #14213d;
      font-size: clamp(1.55rem, 2.2vw, 2.1rem);
      line-height: 1.08;
      letter-spacing: -0.05em;
      max-width: 14ch;
    }

    .detail-hero__summary {
      margin: 0;
      color: #5f6f86;
      line-height: 1.68;
      font-size: 0.92rem;
      max-width: 56ch;
    }

    .detail-hero__facts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem;
    }

    .detail-hero__fact {
      display: grid;
      gap: 0.25rem;
      padding: 0.85rem 0.9rem;
      border-radius: 20px;
      border: 0;
      background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
      min-height: 4.5rem;
    }

    .detail-hero__fact span {
      color: #66758c;
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .detail-hero__fact strong {
      color: #172033;
      font-size: 0.9rem;
      line-height: 1.2;
    }

    .detail-hero__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .detail-hero__chip-set {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    :host ::ng-deep .detail-hero .mat-mdc-chip-set {
      margin: 0;
    }

    :host ::ng-deep .detail-hero .mat-mdc-chip {
      border: 0;
      background: #f3f7ff;
      color: #1e2f57;
      font-size: 0.84rem;
      font-weight: 600;
    }

    :host ::ng-deep .detail-hero .mat-mdc-chip.mat-mdc-chip-highlighted {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.16) 0%, rgba(37, 99, 235, 0.08) 100%);
      color: #1d4ed8;
    }

    .detail-hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      align-items: center;
      padding-top: 0.2rem;
    }

    .detail-hero__actions a,
    .detail-hero__actions button {
      font-size: 0.92rem;
    }

    .detail-outline {
      overflow: hidden;
      border: 0;
      border-radius: 30px;
      box-shadow: 0 22px 54px rgba(15, 23, 42, 0.08);
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .detail-outline__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1.2rem 1.25rem 1rem;
      border-bottom: 1px solid #e6edf7;
      background: linear-gradient(180deg, rgba(248, 250, 255, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
    }

    .detail-outline__header > div {
      display: grid;
      gap: 0.2rem;
      text-align: left;
    }

    .detail-outline__header p {
      margin: 0 0 0.35rem;
      color: #1d4ed8;
      font-size: 0.66rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-weight: 700;
    }

    .detail-outline__header mat-card-title {
      font-size: 1.1rem;
      letter-spacing: -0.03em;
    }

    .detail-outline__header span {
      color: #172033;
      font-size: 0.8rem;
      font-weight: 700;
      white-space: nowrap;
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      border: 1px solid #dbe4f1;
      background: #ffffff;
    }

    .detail-outline mat-card-content {
      padding: 0.25rem 1.15rem 1.05rem;
    }

    .outline-list {
      display: grid;
      gap: 0;
    }

    .outline-list__item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.95rem;
      align-items: start;
      padding: 1rem 0.25rem;
      border-top: 1px solid #edf2f8;
    }

    .outline-list__item:first-child {
      border-top: 0;
    }

    .outline-list__index {
      display: grid;
      place-items: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(79, 70, 229, 0.12) 100%);
      color: #1d4ed8;
      font-size: 0.92rem;
      font-weight: 800;
    }

    .outline-list__copy {
      display: grid;
      gap: 0.25rem;
    }

    .outline-list__copy strong {
      color: #172033;
      font-size: 0.9rem;
      line-height: 1.35;
    }

    .outline-list__copy p {
      margin: 0;
      color: #5f6f86;
      line-height: 1.58;
      font-size: 0.83rem;
    }

    .outline-list__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.45rem 0.7rem;
      border-radius: 999px;
      background: #eef4ff;
      color: #1d4ed8;
      font-size: 0.72rem;
      font-weight: 700;
      white-space: nowrap;
    }

    @media (max-width: 960px) {
      .detail-layout {
        grid-template-columns: 1fr;
      }

      .detail-hero__facts {
        grid-template-columns: 1fr;
      }

      .outline-list__item {
        grid-template-columns: auto 1fr;
      }

      .outline-list__count {
        grid-column: 2;
        justify-self: start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly course = signal<CourseDetail | null>(null);
  readonly modules = signal<CourseModule[]>([]);
  readonly lessonsByModule = signal<Record<string, Lesson[]>>({});
  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly isEnrolled = computed(() => {
    const courseId = this.course()?.id;
    return !!courseId && this.enrolledCourses().some((course) => course.course_id === courseId);
  });
  readonly lessonCount = computed(() => Object.values(this.lessonsByModule()).reduce((sum, items) => sum + items.length, 0));
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
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const courseId = params.get('courseId');
        if (courseId) {
          this.loadCourse(courseId);
        }
      });
  }

  loadCourse(courseId: string): void {
    this.loading.set(true);
    forkJoin({
      course: this.studentPortalService.getCourse(courseId),
      modules: this.studentPortalService.listModules(courseId),
      enrolledCourses: this.studentPortalService.listEnrolledCourses()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ course, modules, enrolledCourses }) => {
          this.course.set(course);
          this.modules.set(modules.items);
          this.enrolledCourses.set(enrolledCourses.items);
          if (!modules.items.length) {
            this.lessonsByModule.set({});
            this.loading.set(false);
            return;
          }

          const lessonRequests = Object.fromEntries(modules.items.map((module) => [module.id, this.studentPortalService.listLessons(module.id)]));
          forkJoin(lessonRequests)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (lessonMap) => {
                const mapped: Record<string, Lesson[]> = {};
                Object.entries(lessonMap).forEach(([moduleId, list]) => {
                  mapped[moduleId] = list.items;
                });
                this.lessonsByModule.set(mapped);
                this.loading.set(false);
              },
              error: () => {
                this.lessonsByModule.set({});
                this.loading.set(false);
              }
            });
        },
        error: () => {
          this.course.set(null);
          this.modules.set([]);
          this.lessonsByModule.set({});
          this.loading.set(false);
          this.snackBar.open('Unable to load course details.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  enroll(courseId: string): void {
    this.studentPortalService.enrollInCourse(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigate(['/app/student/learning', courseId]);
        },
        error: (error) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to enroll in this course.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  formatLabel(value: string | null | undefined): string {
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
}
