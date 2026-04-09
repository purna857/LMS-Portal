import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type { CourseDetail, CourseLessonProgress, CourseModule, CourseProgress, Lesson } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-lesson-view',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, ...materialImports],
  template: `
    <section class="player-page">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      @if (course(); as courseDetail) {
        <section class="player-shell">
          <header class="player-shell__header">
            <div class="player-shell__brand">
              <a routerLink="/app/student/courses" class="player-shell__back">
                <span class="material-symbols-outlined">arrow_back</span>
              </a>
              <div class="player-shell__course">
                <span>Back to my learning</span>
                <strong>{{ courseDetail.title }}</strong>
              </div>
            </div>

            <div class="player-shell__actions">
              <div class="player-shell__progress">
                <span>Your progress</span>
                <strong>{{ progress()?.progress_percentage ?? 0 }}%</strong>
              </div>
              <div class="player-shell__progress-bar">
                <span [style.width.%]="progress()?.progress_percentage ?? 0"></span>
              </div>
              <button mat-stroked-button type="button" (click)="markCurrentLessonComplete()" [disabled]="!selectedLesson()">
                Mark complete
              </button>
            </div>
          </header>

          <div class="player-shell__body">
            <div class="player-main">
              <section class="player-stage">
                <div class="player-stage__frame">
                  @if (selectedLesson(); as lesson) {
                    @if (lesson.lesson_type === 'video' && lesson.video_url) {
                      <video
                        class="player-stage__video"
                        controls
                        playsinline
                        (ended)="markCurrentLessonComplete()"
                        [poster]="courseDetail.thumbnail_url || undefined">
                        <source [src]="lesson.video_url" type="video/mp4" />
                      </video>
                    } @else if (courseDetail.thumbnail_url) {
                      <img class="player-stage__thumb" [src]="courseDetail.thumbnail_url" [alt]="courseDetail.title" />
                    } @else {
                      <div class="player-stage__fallback">{{ courseDetail.title.charAt(0) }}</div>
                    }

                    @if (!(lesson.lesson_type === 'video' && lesson.video_url)) {
                      <div class="player-stage__overlay">
                        <button type="button" class="player-stage__play" aria-label="Open lesson">
                          <span class="material-symbols-outlined">play_arrow</span>
                        </button>
                        <div class="player-stage__copy">
                          <span>{{ lesson.lesson_type === 'video' ? 'Video lecture' : 'Course lesson' }}</span>
                          <strong>{{ lesson.title }}</strong>
                        </div>
                      </div>
                    }
                  }
                </div>

                <div class="player-stage__tabs">
                  <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'overview'" (click)="activeTab.set('overview')">Overview</button>
                  <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'resources'" (click)="activeTab.set('resources')">Resources</button>
                  <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'notes'" (click)="activeTab.set('notes')">Notes</button>
                  <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'announcements'" (click)="activeTab.set('announcements')">Announcements</button>
                </div>
              </section>

              @if (selectedLesson(); as lesson) {
                <section class="lesson-summary">
                  <div class="lesson-summary__header">
                    <div class="lesson-summary__title-block">
                      <p class="lesson-summary__eyebrow">{{ currentModuleTitle() || 'Current lesson' }}</p>
                      <h1>{{ lesson.title }}</h1>
                      <div class="lesson-summary__meta">
                        <span>{{ currentLessonNumber() }} of {{ orderedLessons().length }}</span>
                        <span>{{ lesson.lesson_type.replace('_', ' ') }}</span>
                        <span>{{ lesson.duration_minutes || 0 }} min</span>
                        <span>{{ progress()?.completed_lessons ?? 0 }}/{{ progress()?.total_lessons ?? 0 }} lessons complete</span>
                      </div>
                    </div>

                    <div class="lesson-summary__actions">
                      @if (lesson.video_url) {
                        <a mat-stroked-button [href]="lesson.video_url" target="_blank" rel="noopener">Open video</a>
                      }
                      @if (lesson.resource_url) {
                        <a mat-stroked-button [href]="lesson.resource_url" target="_blank" rel="noopener">Open resource</a>
                      }
                    </div>
                  </div>

                  <div class="lesson-summary__stats">
                    <div class="lesson-stat">
                      <span class="lesson-stat__label">Current section</span>
                      <strong>{{ currentModuleTitle() || 'Course content' }}</strong>
                    </div>
                    <div class="lesson-stat">
                      <span class="lesson-stat__label">Watch time</span>
                      <strong>{{ lesson.duration_minutes || 0 }} min</strong>
                    </div>
                    <div class="lesson-stat">
                      <span class="lesson-stat__label">Completion</span>
                      <strong>{{ progress()?.progress_percentage ?? 0 }}%</strong>
                    </div>
                  </div>

                  @switch (activeTab()) {
                    @case ('overview') {
                      @if (lesson.content) {
                        <div class="lesson-summary__content">{{ lesson.content }}</div>
                      } @else {
                        <p class="lesson-summary__content lesson-summary__content--muted">
                          Lesson details are available in the course outline. Continue through the next section to keep building momentum.
                        </p>
                      }
                    }
                    @case ('resources') {
                      <div class="tab-panel">
                        <h3>Resources</h3>
                        @if (lesson.resource_url) {
                          <a mat-stroked-button [href]="lesson.resource_url" target="_blank" rel="noopener">Open lesson resource</a>
                        } @else if (lesson.video_url) {
                          <a mat-stroked-button [href]="lesson.video_url" target="_blank" rel="noopener">Open lesson video</a>
                        } @else {
                          <p class="lesson-summary__content lesson-summary__content--muted">No extra resources are attached to this lecture yet.</p>
                        }
                      </div>
                    }
                    @case ('notes') {
                      <div class="tab-panel">
                        <h3>Notes</h3>
                        <p class="lesson-summary__content">
                          {{ lesson.content || 'Use this notes area to review the lecture summary, important points, and your own follow-up actions.' }}
                        </p>
                      </div>
                    }
                    @default {
                      <div class="tab-panel">
                        <h3>Announcements</h3>
                        <p class="lesson-summary__content lesson-summary__content--muted">
                          Continue through the course content panel to keep your lecture completion and section progress up to date.
                        </p>
                      </div>
                    }
                  }

                  <div class="lesson-summary__footer">
                    <button mat-stroked-button type="button" (click)="goToPrevious()">Previous lecture</button>
                    <button mat-flat-button color="primary" type="button" (click)="goToNext()">Next lecture</button>
                  </div>
                </section>
              } @else {
                <section class="lesson-summary">
                  <app-empty-state
                    icon="menu_book"
                    title="No lesson selected"
                    description="Choose a lesson from the course content panel to begin.">
                  </app-empty-state>
                </section>
              }
            </div>

            <aside class="curriculum-panel">
              <div class="curriculum-panel__top">
                <div>
                  <h2>Course content</h2>
                  <span>{{ modules().length }} sections • {{ orderedLessons().length }} lectures</span>
                </div>
                <strong>{{ remainingLessonsCount() }} left</strong>
              </div>

              <mat-accordion class="curriculum-accordion" multi>
                @for (module of modules(); track module.id; let index = $index) {
                  <mat-expansion-panel [expanded]="index === 0">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <span class="section-header__title">
                          @if (completedModuleIds().has(module.id)) {
                            <span class="material-symbols-outlined section-header__check">check_circle</span>
                          }
                          {{ index + 1 }}. {{ module.title }}
                        </span>
                      </mat-panel-title>
                      <mat-panel-description>
                        {{ (lessonsByModule()[module.id] || []).length }} lectures
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <div class="lecture-list">
                      @for (lesson of (lessonsByModule()[module.id] || []); track lesson.id; let lessonIndex = $index) {
                        <a
                          class="lecture-item"
                          [class.lecture-item--complete]="completedLessonIds().has(lesson.id)"
                          [class.lecture-item--active]="selectedLesson()?.id === lesson.id"
                          [routerLink]="['/app/student/learning', courseDetail.id, 'lessons', lesson.id]">
                          <div class="lecture-item__icon">
                            @if (completedLessonIds().has(lesson.id)) {
                              <span class="material-symbols-outlined lecture-item__check">check_circle</span>
                            } @else {
                              <span class="material-symbols-outlined">
                                {{ lesson.lesson_type === 'video' ? 'play_circle' : lesson.lesson_type === 'resource_link' ? 'description' : 'menu_book' }}
                              </span>
                            }
                          </div>
                          <div class="lecture-item__copy">
                            <strong>{{ lessonIndex + 1 }}. {{ lesson.title }}</strong>
                            <span>{{ lesson.lesson_type === 'video' ? 'Lecture' : lesson.lesson_type === 'resource_link' ? 'Resource' : 'Lesson' }} • {{ lesson.duration_minutes || 0 }} min</span>
                          </div>
                        </a>
                      }
                    </div>
                  </mat-expansion-panel>
                }
              </mat-accordion>
            </aside>
          </div>
        </section>
      } @else if (!loading()) {
        <app-empty-state
          icon="school"
          title="Learning workspace unavailable"
          description="We couldn't load this course right now. Try opening it again from My Learning.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'IBM Plex Serif', serif !important;
    }

    .player-page {
      display: grid;
      gap: 1rem;
      background: transparent;
    }

    .player-shell {
      display: grid;
      gap: 0;
      border: 1px solid #dde6f2;
      border-radius: 28px;
      background: #fff;
      overflow: hidden;
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.08);
    }

    .player-shell__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.3rem;
      background: linear-gradient(135deg, #151723 0%, #1c2031 100%);
      color: #fff;
    }

    .player-shell__brand,
    .player-shell__actions {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .player-shell__back {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 999px;
      color: #fff;
      text-decoration: none;
      background: rgba(255, 255, 255, 0.08);
    }

    .player-shell__course span,
    .player-shell__progress span {
      display: block;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .player-shell__course strong,
    .player-shell__progress strong {
      display: block;
      font-size: 1rem;
      font-weight: 700;
    }

    .player-shell__progress-bar {
      width: 140px;
      height: 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      overflow: hidden;
    }

    .player-shell__progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #7dd3fc 0%, #3b82f6 100%);
    }

    .player-shell__body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 430px;
      min-height: calc(100vh - 190px);
    }

    .player-main {
      display: grid;
      align-content: start;
      background: #fff;
    }

    .player-stage {
      background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
    }

    .player-stage__frame {
      position: relative;
      min-height: 540px;
      background:
        radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 28%),
        linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
      overflow: hidden;
    }

    .player-stage__thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.58;
      display: block;
    }

    .player-stage__video {
      width: 100%;
      min-height: 540px;
      height: 100%;
      display: block;
      background: #000;
      object-fit: contain;
    }

    .player-stage__fallback {
      display: grid;
      place-items: center;
      width: 100%;
      min-height: 540px;
      background: linear-gradient(135deg, #172554 0%, #1e293b 100%);
      color: #fff;
      font-size: 5rem;
      font-weight: 700;
    }

    .player-stage__overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      gap: 1rem;
      padding: 2rem;
      background: linear-gradient(180deg, rgba(8, 8, 14, 0.18) 0%, rgba(8, 8, 14, 0.52) 100%);
      text-align: center;
    }

    .player-stage__play {
      display: grid;
      place-items: center;
      width: 90px;
      height: 90px;
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.96);
      color: #111118;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      cursor: pointer;
    }

    .player-stage__play .material-symbols-outlined {
      font-size: 3rem;
    }

    .player-stage__copy span {
      display: block;
      color: rgba(255, 255, 255, 0.74);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .player-stage__copy strong {
      display: block;
      margin-top: 0.45rem;
      color: #fff;
      font-size: 1.2rem;
      line-height: 1.3;
    }

    .player-stage__tabs {
      display: flex;
      gap: 1.4rem;
      padding: 0 2rem;
      border-bottom: 1px solid #e6edf7;
      background: #fff;
      overflow-x: auto;
    }

    .player-tab {
      border: 0;
      border-bottom: 3px solid transparent;
      padding: 1rem 0;
      background: transparent;
      color: #66758c;
      font: inherit;
      font-size: 0.94rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .player-tab--active {
      border-color: #111827;
      color: #111827;
      font-weight: 700;
    }

    .lesson-summary {
      display: grid;
      gap: 1.1rem;
      padding: 2rem;
      background: #fff;
    }

    .lesson-summary__header {
      display: flex;
      justify-content: space-between;
      gap: 1.25rem;
      align-items: start;
    }

    .lesson-summary__title-block {
      display: grid;
      gap: 0.35rem;
    }

    .lesson-summary__eyebrow {
      margin: 0 0 0.35rem;
      color: #4f46e5;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .lesson-summary h1 {
      margin: 0;
      font-size: clamp(1.9rem, 2.4vw, 2.5rem);
      line-height: 1.08;
      letter-spacing: -0.04em;
    }

    .lesson-summary__meta {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
      margin-top: 0.7rem;
    }

    .lesson-summary__meta span {
      color: #52627b;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: #f5f8fc;
      border: 1px solid #e4ebf5;
    }

    .lesson-summary__actions {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
      justify-content: end;
    }

    .lesson-summary__stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .lesson-stat {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.05rem;
      border: 1px solid #e6edf7;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .lesson-stat__label {
      color: #66758c;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
    }

    .lesson-stat strong {
      font-size: 1rem;
      line-height: 1.35;
      color: #172033;
    }

    .lesson-summary__content {
      color: #374151;
      font-size: 1rem;
      line-height: 1.75;
      white-space: pre-wrap;
    }

    .lesson-summary__content--muted {
      color: #6b7280;
    }

    .tab-panel {
      display: grid;
      gap: 0.85rem;
    }

    .tab-panel h3 {
      margin: 0;
      font-size: 1rem;
    }

    .lesson-summary__footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.8rem;
      padding-top: 1rem;
      border-top: 1px solid #e6edf7;
    }

    .curriculum-panel {
      display: grid;
      align-content: start;
      border-left: 1px solid #e6edf7;
      background: #f8fafc;
      max-height: calc(100vh - 190px);
      overflow: auto;
    }

    .curriculum-panel__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.15rem 1.2rem;
      border-bottom: 1px solid #e6edf7;
      position: sticky;
      top: 0;
      background: rgba(248, 250, 252, 0.96);
      backdrop-filter: blur(14px);
      z-index: 2;
    }

    .curriculum-panel__top h2 {
      margin: 0;
      font-size: 1.5rem;
      line-height: 1.1;
    }

    .curriculum-panel__top span {
      display: block;
      margin-top: 0.28rem;
      color: #66758c;
      font-size: 0.8rem;
    }

    .curriculum-panel__top strong {
      color: #172033;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .curriculum-accordion {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
    }

    :host ::ng-deep .curriculum-accordion .mat-expansion-panel {
      border: 1px solid #e0e7f1;
      border-radius: 18px !important;
      overflow: hidden;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
      background: #fff;
    }

    :host ::ng-deep .curriculum-accordion .mat-expansion-panel-header {
      min-height: 72px;
      padding: 0 1rem;
    }

    .section-header__title {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-weight: 700;
      color: #172033;
    }

    .section-header__check {
      color: #16a34a;
      font-size: 1.05rem;
    }

    .lecture-list {
      display: grid;
      padding: 0.2rem 1rem 0.85rem;
    }

    .lecture-item {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 0.7rem;
      align-items: start;
      padding: 0.9rem 0;
      color: inherit;
      text-decoration: none;
      border-top: 1px solid #eef2f7;
    }

    .lecture-item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .lecture-item__icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      background: #eef4fb;
      color: #172033;
    }

    .lecture-item__copy {
      display: grid;
      gap: 0.15rem;
    }

    .lecture-item__copy strong {
      font-size: 0.92rem;
      line-height: 1.35;
      color: #172033;
    }

    .lecture-item__copy span {
      color: #66758c;
      font-size: 0.76rem;
    }

    .lecture-item--complete .lecture-item__icon {
      background: #ecfdf3;
      color: #16a34a;
    }

    .lecture-item__check {
      color: #16a34a;
    }

    .lecture-item--active .lecture-item__icon {
      background: #111827;
      color: #fff;
    }

    .lecture-item--active .lecture-item__copy strong {
      color: #111827;
    }

    .lecture-item--active {
      background: linear-gradient(90deg, rgba(37, 99, 235, 0.06), transparent);
    }

    @media (max-width: 1280px) {
      .player-shell__body {
        grid-template-columns: 1fr;
      }

      .curriculum-panel {
        max-height: none;
        border-left: 0;
        border-top: 1px solid #e5e7eb;
      }
    }

    @media (max-width: 820px) {
      .player-shell__header,
      .lesson-summary__header,
      .lesson-summary__footer {
        flex-direction: column;
        align-items: stretch;
      }

      .player-shell__actions {
        justify-content: space-between;
        flex-wrap: wrap;
      }

      .player-stage__frame,
      .player-stage__fallback,
      .player-stage__video {
        min-height: 300px;
      }

      .lesson-summary {
        padding: 1.3rem;
      }

      .lesson-summary__stats {
        grid-template-columns: 1fr;
      }

      .lesson-summary h1 {
        font-size: 1.5rem;
      }

      .player-stage__tabs {
        padding: 0 1.2rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LessonViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly course = signal<CourseDetail | null>(null);
  readonly modules = signal<CourseModule[]>([]);
  readonly lessonsByModule = signal<Record<string, Lesson[]>>({});
  readonly progress = signal<CourseProgress | null>(null);
  readonly lessonProgress = signal<CourseLessonProgress | null>(null);
  readonly selectedLessonId = signal<string | null>(null);
  readonly activeTab = signal<'overview' | 'resources' | 'notes' | 'announcements'>('overview');
  readonly orderedLessons = computed(() => this.modules().flatMap((module) => this.lessonsByModule()[module.id] ?? []));
  readonly selectedLesson = computed(() => this.orderedLessons().find((lesson) => lesson.id === this.selectedLessonId()) ?? null);
  readonly completedLessonIds = computed(() => new Set(this.lessonProgress()?.completed_lesson_ids ?? []));
  readonly completedModuleIds = computed(() => new Set(this.lessonProgress()?.completed_module_ids ?? []));
  readonly currentLessonNumber = computed(() => {
    const lessonId = this.selectedLessonId();
    const lessonIndex = this.orderedLessons().findIndex((lesson) => lesson.id === lessonId);
    return lessonIndex >= 0 ? lessonIndex + 1 : 0;
  });
  readonly currentModuleTitle = computed(() => {
    const lessonId = this.selectedLessonId();
    if (!lessonId) {
      return null;
    }

    const module = this.modules().find((item) => (this.lessonsByModule()[item.id] ?? []).some((lesson) => lesson.id === lessonId));
    return module?.title ?? null;
  });
  readonly remainingLessonsCount = computed(() =>
    Math.max(this.orderedLessons().length - this.completedLessonIds().size, 0)
  );

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const courseId = params.get('courseId');
        const lessonId = params.get('lessonId');
        this.selectedLessonId.set(lessonId);
        if (courseId) {
          this.loadLearning(courseId, lessonId);
        }
      });
  }

  loadLearning(courseId: string, preferredLessonId: string | null): void {
    this.loading.set(true);
    forkJoin({
      course: this.studentPortalService.getCourse(courseId),
      modules: this.studentPortalService.listModules(courseId),
      progress: this.studentPortalService.getCourseProgress(courseId),
      lessonProgress: this.studentPortalService.getCourseLessonProgress(courseId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ course, modules, progress, lessonProgress }) => {
          this.course.set(course);
          this.modules.set(modules.items);
          this.progress.set(progress);
          this.lessonProgress.set(lessonProgress);
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
                const availableLessons = modules.items.flatMap((module) => mapped[module.id] ?? []);
                const firstVideoLesson = availableLessons.find((lesson) => lesson.lesson_type === 'video');
                const fallbackLessonId = preferredLessonId && availableLessons.some((lesson) => lesson.id === preferredLessonId)
                  ? preferredLessonId
                  : firstVideoLesson?.id ?? availableLessons[0]?.id ?? null;
                this.selectedLessonId.set(fallbackLessonId);
                this.loading.set(false);
              },
              error: () => {
                this.lessonsByModule.set({});
                this.loading.set(false);
                this.snackBar.open('Unable to load lesson content.', 'Dismiss', { duration: 4500 });
              }
            });
        },
        error: () => {
          this.course.set(null);
          this.modules.set([]);
          this.lessonsByModule.set({});
          this.progress.set(null);
          this.lessonProgress.set(null);
          this.loading.set(false);
          this.snackBar.open('Unable to open this learning workspace.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  markComplete(lessonId: string): void {
    this.studentPortalService.completeLesson(lessonId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          this.progress.set(progress);
          const courseId = this.course()?.id;
          if (courseId) {
            this.studentPortalService.getCourseLessonProgress(courseId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (lessonProgress) => this.lessonProgress.set(lessonProgress),
              });
          }
          this.snackBar.open('Lesson marked complete.', 'Dismiss', { duration: 2800 });
        },
        error: (error) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update lesson progress.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  markCurrentLessonComplete(): void {
    const lessonId = this.selectedLesson()?.id;
    if (!lessonId) {
      return;
    }
    this.markComplete(lessonId);
  }

  goToPrevious(): void {
    this.navigateRelative(-1);
  }

  goToNext(): void {
    this.navigateRelative(1);
  }

  private navigateRelative(delta: number): void {
    const currentLesson = this.selectedLesson();
    const courseId = this.course()?.id;
    if (!currentLesson || !courseId) {
      return;
    }
    const lessons = this.orderedLessons();
    const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    const nextLesson = lessons[currentIndex + delta];
    if (!nextLesson) {
      return;
    }
    void this.router.navigate(['/app/student/learning', courseId, 'lessons', nextLesson.id]);
  }
}
