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
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        [title]="course()?.title || 'Course Details'"
        [description]="course()?.short_description || 'Review course content, structure, and enrollment access.'">
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
          <mat-card class="surface-card detail-hero">
            <mat-card-content>
              <div class="detail-hero__eyebrow">
                <span>{{ courseDetail.category?.name || 'Course' }}</span>
                @if (courseDetail.is_featured) {
                  <strong>Featured Track</strong>
                }
              </div>
              <div class="chip-row">
                <mat-chip-set>
                  <mat-chip>{{ courseDetail.level }}</mat-chip>
                  <mat-chip>{{ courseDetail.language }}</mat-chip>
                  <mat-chip>{{ courseDetail.visibility }}</mat-chip>
                </mat-chip-set>
              </div>
              <p class="detail-copy">{{ courseDetail.description || courseDetail.short_description || 'No description provided yet.' }}</p>
              <div class="meta-grid">
                <div><strong>Category</strong><span>{{ courseDetail.category?.name || 'General' }}</span></div>
                <div><strong>Duration</strong><span>{{ courseDetail.estimated_duration_minutes || 0 }} minutes</span></div>
                <div><strong>Lessons</strong><span>{{ lessonCount() }}</span></div>
                <div><strong>Modules</strong><span>{{ modules().length }}</span></div>
              </div>
            </mat-card-content>
            <mat-card-actions align="end">
              @if (isEnrolled()) {
                <a mat-flat-button color="primary" [routerLink]="['/app/student/learning', courseDetail.id]">Go to learning</a>
              } @else {
                <button mat-flat-button color="primary" type="button" (click)="enroll(courseDetail.id)">Enroll now</button>
              }
            </mat-card-actions>
          </mat-card>

          <mat-card class="surface-card detail-outline">
            <mat-card-header>
              <mat-card-title>Course Outline</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (modules().length) {
                <div class="outline-list">
                  @for (module of modules(); track module.id) {
                    <div class="outline-list__item">
                      <div>
                        <strong>{{ module.position }}. {{ module.title }}</strong>
                        <p>{{ module.description || 'Module overview will appear here.' }}</p>
                      </div>
                      <span>{{ lessonsByModule()[module.id].length || 0 }} lessons</span>
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
    .detail-layout {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.95fr);
    }
    .chip-row {
      margin-bottom: 1rem;
    }
    .detail-hero__eyebrow {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.9rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.74rem;
    }
    .detail-hero__eyebrow strong {
      color: var(--primary-strong);
    }
    .detail-copy {
      margin: 0 0 1rem;
      color: var(--muted);
      line-height: 1.72;
      font-size: 0.98rem;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }
    .meta-grid div {
      display: grid;
      gap: 0.25rem;
    }
    .meta-grid span,
    .outline-list__item p {
      color: var(--muted);
    }
    .outline-list {
      display: grid;
      gap: 1rem;
    }
    .outline-list__item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }
    .outline-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .outline-list__item p {
      margin: 0.35rem 0 0;
    }
    @media (max-width: 960px) {
      .detail-layout {
        grid-template-columns: 1fr;
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
}
