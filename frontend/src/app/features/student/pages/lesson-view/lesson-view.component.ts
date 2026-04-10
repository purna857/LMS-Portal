import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type { CourseDetail, CourseLessonProgress, CourseModule, CourseProgress, Lesson } from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

interface CourseVideoPreview {
  embedUrl: string;
  watchUrl: string;
  label: string;
}

interface PdfLine {
  text: string;
  kind: 'title' | 'subtitle' | 'section' | 'body' | 'meta' | 'spacer';
}

interface LessonNotePage {
  page: number;
  title: string;
  paragraphs: string[];
  footer: string;
}

interface LessonResourceCard {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  icon: string;
  tone: 'blue' | 'cyan' | 'violet';
  actionLabel?: string;
  href?: string | null;
  routerLink?: string[] | null;
}

const COURSE_VIDEO_PREVIEWS: Record<string, CourseVideoPreview> = {
  'python-fastapi-bootcamp': {
    embedUrl: 'https://www.youtube.com/embed/0sOvCWFmrtA?rel=0&modestbranding=1&playsinline=1',
    watchUrl: 'https://www.youtube.com/watch?v=0sOvCWFmrtA',
    label: 'FastAPI course preview'
  },
  'data-sql-foundations': {
    embedUrl: 'https://www.youtube.com/embed/HXV3zeQKqGY?rel=0&modestbranding=1&playsinline=1',
    watchUrl: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
    label: 'SQL course preview'
  }
};

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
                <div class="player-stage__frame" [class.player-stage__frame--notes]="selectedLesson()?.lesson_type === 'text'">
                  @if (selectedLesson(); as lesson) {
                    @if (lesson.lesson_type === 'text') {
                      @if (currentNotePage(); as notePage) {
                        <div class="player-stage__notes-view">
                          <div class="player-stage__notes-header">
                            <div class="player-stage__notes-heading">
                              <span class="player-stage__notes-badge">Notes lecture</span>
                              <h2>{{ notePage.title }}</h2>
                              <p>{{ currentModuleTitle() || 'Lecture notes' }}</p>
                            </div>
                            <div class="player-stage__notes-actions">
                              <button mat-stroked-button type="button" (click)="downloadNotesPdf()" [disabled]="!notePages().length">
                                Download PDF
                              </button>
                            </div>
                          </div>

                          <article class="player-stage__notes-paper">
                            <div class="player-stage__notes-paper-head">
                              <div>
                                <span class="player-stage__notes-paper-eyebrow">{{ currentModuleTitle() || 'Lecture notes' }}</span>
                                <strong>{{ notePage.title }}</strong>
                              </div>
                              <span class="player-stage__notes-page">{{ notePageLabel() }}</span>
                            </div>

                            <div class="player-stage__notes-paper-body">
                              @for (paragraph of notePage.paragraphs; track $index) {
                                <p class="player-stage__notes-paragraph">{{ paragraph }}</p>
                              }
                            </div>

                            <div class="player-stage__notes-paper-foot">
                              <span>{{ notePage.footer }}</span>
                              <div class="player-stage__notes-page-nav">
                                <button mat-stroked-button type="button" (click)="goToNotePage(-1)">
                                  Previous page
                                </button>
                                <button mat-stroked-button type="button" (click)="goToNotePage(1)">
                                  Next page
                                </button>
                              </div>
                            </div>
                          </article>
                        </div>
                      } @else {
                        <div class="player-stage__notes-view player-stage__notes-view--empty">
                          <app-empty-state
                            icon="sticky_note_2"
                            title="Notes not available"
                            description="This lecture does not include written notes yet.">
                          </app-empty-state>
                        </div>
                      }
                    } @else {
                      @if (videoPreview(); as preview) {
                        <iframe
                          class="player-stage__embed"
                          [src]="preview.embedUrl"
                          [title]="preview.label + ' - ' + lesson.title"
                          loading="lazy"
                          referrerpolicy="strict-origin-when-cross-origin"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowfullscreen>
                        </iframe>
                      } @else if (lesson.lesson_type === 'video' && lesson.video_url) {
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
                        @if (lessonDetails(lesson); as lessonDisplay) {
                          <div class="player-stage__overlay">
                            <div class="player-stage__badge">{{ lessonDisplay.label }}</div>
                            <div class="player-stage__card">
                              <div
                              class="player-stage__icon"
                              [class.player-stage__icon--video]="lesson.lesson_type === 'video'"
                              [class.player-stage__icon--resource]="lesson.lesson_type === 'resource_link'">
                              <span class="material-symbols-outlined">{{ lessonDisplay.icon }}</span>
                            </div>
                              <div class="player-stage__copy">
                                <span>{{ lessonDisplay.label }}</span>
                                <strong>{{ lesson.title }}</strong>
                                <p>{{ lessonDisplay.description }}</p>
                              </div>
                            </div>
                          </div>
                        }
                      }
                    }
                  }
                </div>

                @if (selectedLesson(); as lesson) {
                  @if (lesson.lesson_type !== 'text') {
                    <div class="player-stage__tabs">
                      <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'overview'" (click)="activeTab.set('overview')">Overview</button>
                      <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'resources'" (click)="activeTab.set('resources')">Resources</button>
                      <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'notes'" (click)="activeTab.set('notes')">Notes</button>
                      <button type="button" class="player-tab" [class.player-tab--active]="activeTab() === 'announcements'" (click)="activeTab.set('announcements')">Announcements</button>
                    </div>
                  }
                }
              </section>

                @if (selectedLesson(); as lesson) {
                  @if (lesson.lesson_type !== 'text') {
                    <section class="lesson-summary">
                  @switch (activeTab()) {
                    @case ('overview') {
                      <div class="lesson-summary__header">
                        <div class="lesson-summary__title-block">
                          <p class="lesson-summary__eyebrow">{{ currentModuleTitle() || 'Current lesson' }}</p>
                          <h1>{{ lesson.title }}</h1>
                          <div class="lesson-summary__meta">
                            <span>{{ currentLessonNumber() }} of {{ orderedLessons().length }}</span>
                            <span>{{ lessonDetails(lesson).label }}</span>
                            <span>{{ lesson.duration_minutes || 0 }} min</span>
                            <span>{{ progress()?.completed_lessons ?? 0 }}/{{ progress()?.total_lessons ?? 0 }} lessons complete</span>
                          </div>
                        </div>

                        <div class="lesson-summary__actions">
                          @if (currentVideoLink()) {
                            <a mat-stroked-button [href]="currentVideoLink()" target="_blank" rel="noopener">Open video</a>
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

                      @if (lesson.content) {
                        <div class="lesson-summary__content">{{ lesson.content }}</div>
                      } @else {
                        <p class="lesson-summary__content lesson-summary__content--muted">
                          Lesson details are available in the course outline. Continue through the next section to keep building momentum.
                        </p>
                      }
                    }
                    @case ('resources') {
                      <div class="tab-panel tab-panel--resources">
                        <div class="resources-card">
                          <div class="resources-card__header">
                            <div>
                              <p>Resources</p>
                              <h3>Reference material for {{ lesson.title }}</h3>
                            </div>
                            <span>{{ resourceCards().length }} items</span>
                          </div>

                          <div class="resources-grid">
                            @for (resource of resourceCards(); track resource.title) {
                              <article class="resources-item" [class.resources-item--cyan]="resource.tone === 'cyan'" [class.resources-item--violet]="resource.tone === 'violet'">
                                <div class="resources-item__icon">
                                  <span class="material-symbols-outlined">{{ resource.icon }}</span>
                                </div>
                                <div class="resources-item__copy">
                                  <span class="resources-item__eyebrow">{{ resource.eyebrow }}</span>
                                  <div class="resources-item__head">
                                    <h4>{{ resource.title }}</h4>
                                    <span>{{ resource.meta }}</span>
                                  </div>
                                  <p>{{ resource.description }}</p>
                                  @if (resource.href) {
                                    <a mat-stroked-button [href]="resource.href" target="_blank" rel="noopener">{{ resource.actionLabel }}</a>
                                  } @else if (resource.routerLink) {
                                    <a mat-stroked-button [routerLink]="resource.routerLink">{{ resource.actionLabel }}</a>
                                  }
                                </div>
                              </article>
                            }
                          </div>
                        </div>
                      </div>
                    }
                    @case ('notes') {
                      <div class="tab-panel tab-panel--notes">
                        <div class="notes-card">
                          <div class="notes-card__header">
                            <div>
                              <p>Notes</p>
                              <h3>Readable recap for {{ lesson.title }}</h3>
                            </div>
                          </div>

                          <div class="notes-card__intro">
                            Review the key points below, keep the main idea in mind, and download the PDF whenever you want a copy.
                          </div>

                          <div class="notes-list">
                            @for (note of lessonNotes(); track note.title) {
                              <div class="notes-list__item">
                                <span class="material-symbols-outlined notes-list__icon">check_circle</span>
                                <div class="notes-list__copy">
                                  <strong>{{ note.title }}</strong>
                                  <p>{{ note.body }}</p>
                                </div>
                              </div>
                            }
                          </div>

                          <div class="notes-card__footer">
                            <div class="notes-card__next">
                              <span>Next up</span>
                              <strong>{{ nextLesson()?.title || 'No more lessons in this course' }}</strong>
                            </div>
                            <div class="notes-card__footer-actions">
                              <button mat-stroked-button type="button" (click)="downloadNotesPdf()">
                                Download PDF
                              </button>
                            </div>
                          </div>
                        </div>
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
                }
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
                  <span>{{ modules().length }} sections &middot; {{ orderedLessons().length }} lectures</span>
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
                        @if (lessonDetails(lesson); as lessonDisplay) {
                          <a
                            class="lecture-item"
                            [class.lecture-item--complete]="completedLessonIds().has(lesson.id)"
                            [class.lecture-item--active]="selectedLesson()?.id === lesson.id"
                            [routerLink]="['/app/student/learning', courseDetail.id, 'lessons', lesson.id]">
                            <div
                              class="lecture-item__icon"
                              [class.lecture-item__icon--video]="lesson.lesson_type === 'video'"
                              [class.lecture-item__icon--resource]="lesson.lesson_type === 'resource_link'"
                              [class.lecture-item__icon--notes]="lesson.lesson_type === 'text'">
                              @if (completedLessonIds().has(lesson.id)) {
                                <span class="material-symbols-outlined lecture-item__check">check_circle</span>
                              } @else {
                                <span class="material-symbols-outlined">{{ lessonDisplay.icon }}</span>
                              }
                            </div>
                            <div class="lecture-item__copy">
                              <strong>{{ lessonIndex + 1 }}. {{ lesson.title }}</strong>
                              <span>{{ lessonDisplay.label }} &middot; {{ lesson.duration_minutes || 0 }} min</span>
                            </div>
                          </a>
                        }
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
      font-family: 'IBM Plex Sans', sans-serif !important;
    }

    .player-page {
      display: grid;
      gap: 1rem;
      background: transparent;
    }

    .player-shell {
      display: grid;
      gap: 0;
      border: 1px solid #d7d7d7;
      border-radius: 32px;
      background: #ffffff;
      overflow: hidden;
      box-shadow: none;
    }

    .player-shell__header {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.3rem;
      background: #f6f8fb;
      color: #111827;
      border-bottom: 1px solid #e1e5eb;
      overflow: visible;
    }

    .player-shell__header::after {
      content: none;
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
      color: #1f2937;
      text-decoration: none;
      background: #eef2f7;
      border: 1px solid #d8dee8;
    }

    .player-shell__course span,
    .player-shell__progress span {
      display: block;
      color: #6b778c;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .player-shell__course strong,
    .player-shell__progress strong {
      display: block;
      font-size: 0.92rem;
      font-weight: 700;
      color: #172033;
    }

    .player-shell__progress-bar {
      width: 140px;
      height: 8px;
      border-radius: 999px;
      background: #dde3eb;
      overflow: hidden;
    }

    .player-shell__progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #5d7fd6;
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

    .player-stage__frame--notes {
      background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.14), transparent 32%),
        radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.1), transparent 36%),
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
    }

    .player-stage__embed,
    .player-stage__thumb,
    .player-stage__fallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .player-stage__thumb {
      object-fit: cover;
      opacity: 0.58;
      display: block;
    }

    .player-stage__embed {
      display: block;
      border: 0;
      background: #000;
    }

    .player-stage__video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
      object-fit: contain;
    }

    .player-stage__fallback {
      display: grid;
      place-items: center;
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
      gap: 0.9rem;
      padding: 2rem;
      background:
        linear-gradient(180deg, rgba(8, 8, 14, 0.18) 0%, rgba(8, 8, 14, 0.56) 100%),
        radial-gradient(circle at top, rgba(59, 130, 246, 0.14), transparent 42%);
      backdrop-filter: blur(4px);
      text-align: center;
    }

    .player-stage__notes-view {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.25rem;
      overflow: auto;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(248, 251, 255, 0.98) 100%);
      backdrop-filter: blur(2px);
    }

    .player-stage__notes-view--empty {
      display: grid;
      place-items: center;
    }

    .player-stage__notes-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .player-stage__notes-heading {
      display: grid;
      gap: 0.42rem;
      max-width: 44rem;
    }

    .player-stage__notes-badge {
      display: inline-flex;
      align-items: center;
      align-self: start;
      padding: 0.34rem 0.78rem;
      border-radius: 999px;
      border: 1px solid rgba(79, 70, 229, 0.18);
      background: rgba(79, 70, 229, 0.08);
      color: #4f46e5;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      width: fit-content;
    }

    .player-stage__notes-heading h2 {
      margin: 0;
      color: #162033;
      font-size: clamp(1.55rem, 2.2vw, 2.1rem);
      line-height: 1.1;
      letter-spacing: -0.04em;
    }

    .player-stage__notes-heading p {
      margin: 0;
      color: #55657d;
      font-size: 0.95rem;
      line-height: 1.7;
    }

    .player-stage__notes-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .player-stage__notes-paper {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 100%;
      padding: 1.15rem 1.2rem;
      border-radius: 28px;
      border: 1px solid #dfe8f4;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 252, 255, 0.98) 100%);
      box-shadow: 0 24px 52px rgba(15, 23, 42, 0.08);
    }

    .player-stage__notes-paper-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid #e6edf7;
    }

    .player-stage__notes-paper-head > div {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
    }

    .player-stage__notes-paper-eyebrow {
      color: #4f46e5;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .player-stage__notes-paper-head strong {
      color: #162033;
      font-size: clamp(1.25rem, 1.8vw, 1.7rem);
      line-height: 1.15;
      letter-spacing: -0.04em;
    }

    .player-stage__notes-page {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.4rem 0.75rem;
      border-radius: 999px;
      background: #eef4ff;
      color: #1d4ed8;
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .player-stage__notes-paper-body {
      display: grid;
      gap: 0.9rem;
      flex: 1;
    }

    .player-stage__notes-paragraph {
      margin: 0;
      color: #334155;
      font-size: 0.98rem;
      line-height: 1.8;
    }

    .player-stage__notes-paper-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding-top: 0.85rem;
      border-top: 1px solid #e6edf7;
      flex-wrap: wrap;
      margin-top: auto;
    }

    .player-stage__notes-paper-foot span {
      color: #5f6f86;
      font-size: 0.88rem;
      line-height: 1.5;
    }

    .player-stage__notes-page-nav {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
    }

    .player-stage__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.38rem 0.82rem;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.82);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .player-stage__card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 1rem;
      width: min(100%, 540px);
      padding: 1.1rem 1.2rem;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(9, 16, 32, 0.58);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
    }

    .player-stage__icon {
      display: grid;
      place-items: center;
      width: 4.5rem;
      height: 4.5rem;
      border-radius: 1.4rem;
      color: #fff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.26), 0 14px 24px rgba(15, 23, 42, 0.22);
    }

    .player-stage__icon--video {
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
    }

    .player-stage__icon--resource {
      background: linear-gradient(135deg, #0891b2 0%, #0ea5e9 100%);
    }

    .player-stage__icon--notes {
      background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
    }

    .player-stage__icon .material-symbols-outlined {
      font-size: 2rem;
    }

    .player-stage__copy span {
      display: block;
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .player-stage__copy strong {
      display: block;
      margin-top: 0.45rem;
      color: #fff;
      font-size: clamp(1.15rem, 1.8vw, 1.45rem);
      line-height: 1.3;
    }

    .player-stage__copy p {
      margin: 0.45rem 0 0;
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.92rem;
      line-height: 1.7;
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
      gap: 0.95rem;
      padding: 1.75rem 1.85rem;
      background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
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
      margin: 0 0 0.28rem;
      color: #4f46e5;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .lesson-summary h1 {
      margin: 0;
      font-size: clamp(1.35rem, 1.7vw, 1.85rem);
      line-height: 1.08;
      letter-spacing: -0.04em;
    }

    .lesson-summary__meta {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
      margin-top: 0.55rem;
    }

    .lesson-summary__meta span {
      color: #52627b;
      font-size: 0.66rem;
      font-weight: 600;
      padding: 0.3rem 0.6rem;
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
      gap: 0.28rem;
      padding: 0.92rem 1rem;
      border: 1px solid #e6edf7;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .lesson-stat__label {
      color: #66758c;
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
    }

    .lesson-stat strong {
      font-size: 0.84rem;
      line-height: 1.35;
      color: #172033;
    }

    .lesson-summary__content {
      padding: 0.9rem 1rem;
      color: #374151;
      font-size: 0.86rem;
      line-height: 1.7;
      white-space: pre-wrap;
      border: 1px solid #e6edf7;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .lesson-summary__content--muted {
      color: #6b7280;
      background: #f8fbff;
    }

    .tab-panel {
      display: grid;
      gap: 0.85rem;
    }

    .tab-panel h3 {
      margin: 0;
      font-size: 1rem;
    }

    .tab-panel--notes {
      gap: 1rem;
    }

    .tab-panel--resources {
      gap: 1rem;
    }

    .resources-card {
      display: grid;
      gap: 1rem;
      padding: 1.1rem 1.15rem;
      border: 1px solid #e6edf7;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .resources-card__header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }

    .resources-card__header p {
      margin: 0 0 0.25rem;
      color: #0f62fe;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .resources-card__header h3 {
      margin: 0;
      font-size: 1.05rem;
      line-height: 1.25;
      color: #172033;
    }

    .resources-card__header span {
      align-self: center;
      color: #60718a;
      font-size: 0.8rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .resources-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .resources-item {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      border: 1px solid #e6edf7;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .resources-item--cyan {
      background: linear-gradient(180deg, #ffffff 0%, #f0fbff 100%);
    }

    .resources-item--violet {
      background: linear-gradient(180deg, #ffffff 0%, #f5f0ff 100%);
    }

    .resources-item__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 14px;
      background: rgba(17, 24, 39, 0.92);
      color: #fff;
    }

    .resources-item--cyan .resources-item__icon {
      background: linear-gradient(135deg, #0891b2 0%, #0ea5e9 100%);
    }

    .resources-item--violet .resources-item__icon {
      background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
    }

    .resources-item__icon .material-symbols-outlined {
      font-size: 1.45rem;
    }

    .resources-item__copy {
      display: grid;
      gap: 0.5rem;
    }

    .resources-item__eyebrow {
      color: #66758c;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .resources-item__head {
      display: grid;
      gap: 0.15rem;
    }

    .resources-item__head h4 {
      margin: 0;
      color: #172033;
      font-size: 0.98rem;
      line-height: 1.35;
    }

    .resources-item__head span {
      color: #66758c;
      font-size: 0.72rem;
    }

    .resources-item__copy p {
      margin: 0;
      color: #44546a;
      font-size: 0.88rem;
      line-height: 1.7;
    }

    .resources-item a {
      justify-self: start;
    }

    .notes-card {
      display: grid;
      gap: 1rem;
      padding: 1.1rem 1.15rem;
      border: 1px solid #e6edf7;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .notes-card__header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }

    .notes-card__header p {
      margin: 0 0 0.25rem;
      color: #4f46e5;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .notes-card__header h3 {
      margin: 0;
      font-size: 1.05rem;
      line-height: 1.25;
      color: #172033;
    }

    .notes-card__intro {
      padding: 0.9rem 1rem;
      border-radius: 18px;
      border: 1px solid #e6edf7;
      background: #fff;
      color: #374151;
      font-size: 0.92rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .notes-list {
      display: grid;
      gap: 0.8rem;
    }

    .notes-list__item {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      gap: 0.8rem;
      padding: 0.88rem 0.95rem;
      border-radius: 18px;
      border: 1px solid #e6edf7;
      background: #ffffff;
    }

    .notes-list__icon {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      color: #16a34a;
      font-size: 1.05rem;
    }

    .notes-list__copy {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .notes-list__copy strong {
      color: #172033;
      font-size: 0.92rem;
      line-height: 1.35;
    }

    .notes-list__copy p {
      margin: 0;
      color: #5f6f86;
      font-size: 0.88rem;
      line-height: 1.6;
    }

    .notes-card__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding-top: 0.2rem;
      border-top: 1px solid #e6edf7;
      flex-wrap: wrap;
    }

    .notes-card__footer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .notes-card__next {
      display: grid;
      gap: 0.12rem;
    }

    .notes-card__next span {
      color: #66758c;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
    }

    .notes-card__next strong {
      color: #172033;
      font-size: 0.92rem;
      line-height: 1.35;
    }

    .lesson-summary__footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.7rem;
      padding-top: 0.9rem;
      border-top: 1px solid #e6edf7;
    }

    .curriculum-panel {
      display: grid;
      align-content: start;
      border-left: 1px solid #e6edf7;
      background: linear-gradient(180deg, #f8fafc 0%, #f4f7fc 100%);
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
      font-size: 1.28rem;
      line-height: 1.1;
    }

    .curriculum-panel__top span {
      display: block;
      margin-top: 0.28rem;
      color: #66758c;
      font-size: 0.72rem;
    }

    .curriculum-panel__top strong {
      color: #172033;
      font-size: 0.82rem;
      white-space: nowrap;
    }

    .curriculum-accordion {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
    }

    :host ::ng-deep .curriculum-accordion .mat-expansion-panel {
      border: 1px solid #dfe8f4;
      border-radius: 20px !important;
      overflow: hidden;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
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
      padding: 0.2rem 0.95rem 0.85rem;
    }

    .lecture-item {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 0.7rem;
      align-items: start;
      padding: 0.85rem 0.8rem;
      color: inherit;
      text-decoration: none;
      border-top: 1px solid #eef2f7;
      border-radius: 16px;
      transition: background-color var(--transition-base), transform var(--transition-base), box-shadow var(--transition-base);
    }

    .lecture-item:first-child {
      border-top: 0;
      margin-top: 0.15rem;
    }

    .lecture-item__icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: #eef4fb;
      color: #172033;
      transition: transform var(--transition-base), box-shadow var(--transition-base), background-color var(--transition-base), color var(--transition-base);
    }

    .lecture-item__icon--video {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(79, 70, 229, 0.12));
      color: #1d4ed8;
    }

    .lecture-item__icon--resource {
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(8, 145, 178, 0.12));
      color: #0369a1;
    }

    .lecture-item__icon--notes {
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(139, 92, 246, 0.12));
      color: #6d28d9;
    }

    .lecture-item__copy {
      display: grid;
      gap: 0.15rem;
    }

    .lecture-item__copy strong {
      font-size: 0.86rem;
      line-height: 1.35;
      color: #172033;
    }

    .lecture-item__copy span {
      color: #66758c;
      font-size: 0.7rem;
    }

    .lecture-item--complete .lecture-item__icon {
      background: linear-gradient(135deg, #ecfdf3 0%, #d1fae5 100%);
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
      background: linear-gradient(90deg, rgba(37, 99, 235, 0.08), transparent);
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
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

      .player-stage__notes-header {
        flex-direction: column;
        align-items: stretch;
      }

      .player-stage__notes-actions,
      .player-stage__notes-paper-foot {
        justify-content: flex-start;
      }

      .resources-card__header,
      .notes-card__header {
        flex-direction: column;
        align-items: stretch;
      }

      .resources-grid {
        grid-template-columns: 1fr;
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
  private readonly sanitizer = inject(DomSanitizer);

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
  readonly videoPreview = computed(() => {
    const course = this.course();
    const lesson = this.selectedLesson();
    if (!course || !lesson || lesson.lesson_type !== 'video') {
      return null;
    }

    const preview = COURSE_VIDEO_PREVIEWS[course.slug];
    if (!preview) {
      return null;
    }

    return {
      label: preview.label,
      watchUrl: preview.watchUrl,
      embedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(preview.embedUrl) as SafeResourceUrl
    };
  });
  readonly currentVideoLink = computed(() => {
    const preview = this.videoPreview();
    if (preview) {
      return preview.watchUrl;
    }

    const lesson = this.selectedLesson();
    return lesson?.lesson_type === 'video' ? lesson.video_url ?? null : null;
  });
  readonly nextLesson = computed(() => {
    const currentLesson = this.selectedLesson();
    if (!currentLesson) {
      return null;
    }

    const lessons = this.orderedLessons();
    const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    return currentIndex >= 0 ? lessons[currentIndex + 1] ?? null : null;
  });
  readonly previousLesson = computed(() => {
    const currentLesson = this.selectedLesson();
    if (!currentLesson) {
      return null;
    }

    const lessons = this.orderedLessons();
    const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    return currentIndex > 0 ? lessons[currentIndex - 1] ?? null : null;
  });
  readonly notePageIndex = signal(0);
  readonly notePages = computed<LessonNotePage[]>(() => {
    const lesson = this.selectedLesson();
    if (!lesson) {
      return [];
    }

    const lessonContent = this.normalizePdfText(lesson.content ?? '').trim();
    return this.buildLessonNotePages(lesson, lessonContent);
  });
  readonly currentNotePage = computed(() => this.notePages()[this.notePageIndex()] ?? this.notePages()[0] ?? null);
  readonly notePageLabel = computed(() => {
    const pages = this.notePages();
    const pageIndex = pages.length ? Math.min(this.notePageIndex(), pages.length - 1) : 0;
    return pages.length ? `${pageIndex + 1} / ${pages.length}` : '0 / 0';
  });
  readonly lessonNotes = computed(() =>
    this.notePages().map((page) => ({
      title: `${page.title} - Page ${page.page}`,
      body: page.paragraphs.join(' ')
    }))
  );
  readonly resourceCards = computed<LessonResourceCard[]>(() => {
    const lesson = this.selectedLesson();
    if (!lesson) {
      return [];
    }

    const courseId = this.course()?.id ?? null;
    const moduleTitle = this.currentModuleTitle() || 'Course reference';
    const noteParagraphs = this.extractLessonNoteParagraphs(lesson.content ?? '');
    const firstParagraph = noteParagraphs[0] ?? '';
    const secondParagraph = noteParagraphs[1] ?? noteParagraphs[0] ?? '';
    const nextLesson = this.nextLesson();

    const referenceCard: LessonResourceCard = {
      eyebrow: 'Lesson reference',
      title: moduleTitle,
      description: firstParagraph || `Use the written lesson content for ${lesson.title} as your main study reference.`,
      meta: `${lesson.lesson_type === 'video' ? 'Video lecture' : lesson.lesson_type === 'resource_link' ? 'Resource lesson' : 'Notes lesson'} · ${lesson.duration_minutes || 0} min`,
      icon: lesson.lesson_type === 'video' ? 'play_circle' : lesson.lesson_type === 'resource_link' ? 'description' : 'sticky_note_2',
      tone: 'blue'
    };

    const extractCard: LessonResourceCard = {
      eyebrow: 'What to review',
      title: lesson.title,
      description: secondParagraph || firstParagraph || 'This lecture keeps its reference details inside the lesson content itself.',
      meta: 'Key reading from the current lecture',
      icon: 'menu_book',
      tone: 'cyan'
    };

    const nextCard: LessonResourceCard = {
      eyebrow: 'Next up',
      title: nextLesson?.title || 'No more lectures',
      description: nextLesson
        ? `Continue with ${nextLesson.title} after you finish this lesson.`
        : 'You have reached the end of the course content.',
      meta: nextLesson ? `${nextLesson.lesson_type === 'video' ? 'Video' : nextLesson.lesson_type === 'resource_link' ? 'Resource' : 'Notes'} lesson` : 'Course complete',
      icon: nextLesson ? 'arrow_forward' : 'flag',
      tone: 'violet',
      routerLink: nextLesson && courseId ? ['/app/student/learning', courseId, 'lessons', nextLesson.id] : null,
      actionLabel: nextLesson ? 'Open next lecture' : undefined
    };

    return [referenceCard, extractCard, nextCard];
  });
  readonly remainingLessonsCount = computed(() =>
    Math.max(this.orderedLessons().length - this.completedLessonIds().size, 0)
  );

  private readonly notesTabSync = effect(() => {
    const lesson = this.selectedLesson();
    if (!lesson) {
      return;
    }

    if (lesson.lesson_type === 'text') {
      if (this.activeTab() !== 'notes') {
        this.activeTab.set('notes');
      }
      return;
    }

    if (this.activeTab() === 'notes') {
      this.activeTab.set('overview');
    }
  });

  private lastNoteLessonId: string | null = null;
  private readonly notesPageSync = effect(() => {
    const lesson = this.selectedLesson();
    const lessonId = lesson?.id ?? null;
    if (lessonId !== this.lastNoteLessonId) {
      this.lastNoteLessonId = lessonId;
      if (this.notePageIndex() !== 0) {
        this.notePageIndex.set(0);
      }
    }
    if (!lessonId) {
      this.lastNoteLessonId = null;
      this.notePageIndex.set(0);
    }
  });

  readonly lessonDetails = (lesson: Lesson) => {
    switch (lesson.lesson_type) {
      case 'video':
        return {
          icon: 'play_circle',
          label: 'Video lecture',
          description: 'Watch the walkthrough and follow the recording at your own pace.'
        };
      case 'resource_link':
        return {
          icon: 'description',
          label: 'Resource',
          description: 'Open the attached reading, reference file, or supporting material.'
        };
      default:
        return {
          icon: 'sticky_note_2',
          label: 'Notes',
          description: 'Read the recap, keep the key points in view, and download the PDF copy if needed.'
        };
    }
  };

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

  goToNotePage(delta: number): void {
    const pages = this.notePages();
    if (!pages.length) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(this.notePageIndex() + delta, pages.length - 1));
    this.notePageIndex.set(nextIndex);
  }

  downloadNotesPdf(): void {
    const course = this.course();
    const lesson = this.selectedLesson();
    if (!course || !lesson || !this.notePages().length) {
      if (lesson && !this.notePages().length) {
        this.snackBar.open('This lecture does not have notes to download yet.', 'Dismiss', { duration: 2800 });
      }
      return;
    }

    const pdfBytes = this.buildNotesPdfBytes(course.title, lesson.title);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slugify(course.title)}-${this.slugify(lesson.title)}-notes.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    this.snackBar.open('Notes PDF downloaded.', 'Dismiss', { duration: 2800 });
  }

  private buildNotesPdfBytes(courseTitle: string, lessonTitle: string): Uint8Array {
    const moduleTitle = this.currentModuleTitle() || 'Lesson notes';
    const pages = this.notePages();
    const generatedAt = new Date();
    const bodyWidthChars = 80;
    const lines: PdfLine[] = [
      { text: 'COURSE NOTES', kind: 'meta' },
      { text: courseTitle, kind: 'title' },
      { text: `${moduleTitle} - ${lessonTitle}`, kind: 'subtitle' },
      { text: `Downloaded ${generatedAt.toLocaleDateString()} at ${generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, kind: 'meta' },
      { text: '', kind: 'spacer' }
    ];

    pages.forEach((page, index) => {
      lines.push({ text: `PAGE ${index + 1} OF ${pages.length}`, kind: 'meta' });
      lines.push({ text: page.title, kind: 'title' });
      lines.push({ text: '', kind: 'spacer' });
      page.paragraphs.forEach((paragraph, paragraphIndex) => {
        lines.push(...this.wrapPdfParagraph(paragraph, bodyWidthChars).map((text) => ({ text, kind: 'body' as const })));
        if (paragraphIndex < page.paragraphs.length - 1) {
          lines.push({ text: '', kind: 'spacer' });
        }
      });

      lines.push({ text: '', kind: 'spacer' });
      lines.push({ text: page.footer, kind: 'meta' });

      if (index < pages.length - 1) {
        lines.push({ text: '', kind: 'spacer' });
        lines.push({ text: '', kind: 'spacer' });
      }
    });

    return this.composePdfDocument(lines);
  }

  private composePdfDocument(lines: PdfLine[]): Uint8Array {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 54;
    const contentHeight = pageHeight - margin * 2;
    const pages: PdfLine[][] = [];
    let currentPage: PdfLine[] = [];
    let usedHeight = 0;

    for (const line of lines) {
      const lineHeight = this.pdfLineHeight(line.kind);
      if (currentPage.length && usedHeight + lineHeight > contentHeight) {
        pages.push(currentPage);
        currentPage = [];
        usedHeight = 0;
      }

      currentPage.push(line);
      usedHeight += lineHeight;
    }

    if (currentPage.length) {
      pages.push(currentPage);
    }

    const encoder = new TextEncoder();
    const objects: string[] = [];
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
    const kids = pages.map((_, index) => `${6 + index * 2} 0 R`).join(' ');
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [ ${kids} ] /Count ${pages.length} >>\nendobj`);
    objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
    objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');

    pages.forEach((pageLines, index) => {
      const contentId = 5 + index * 2;
      const pageId = 6 + index * 2;
      const content = this.renderPdfPage(pageLines, index + 1, pages.length, pageWidth, pageHeight, margin);
      const contentBytes = encoder.encode(content);
      objects.push(`${contentId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}endstream\nendobj`);
      objects.push(
        `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`
      );
    });

    const header = encoder.encode('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
    const bodyParts: Uint8Array[] = [header];
    const offsets: number[] = [0];
    let offset = header.length;

    for (const object of objects) {
      const objectBytes = encoder.encode(`${object}\n`);
      offsets.push(offset);
      bodyParts.push(objectBytes);
      offset += objectBytes.length;
    }

    const xrefStart = offset;
    const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
    for (let i = 1; i < offsets.length; i += 1) {
      xrefLines.push(`${offsets[i].toString().padStart(10, '0')} 00000 n `);
    }
    const trailer = [
      'trailer',
      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
      'startxref',
      `${xrefStart}`,
      '%%EOF'
    ].join('\n');
    const xrefBytes = encoder.encode(`${xrefLines.join('\n')}\n${trailer}\n`);
    bodyParts.push(xrefBytes);

    return this.concatUint8Arrays(bodyParts);
  }

  private renderPdfPage(
    pageLines: PdfLine[],
    pageNumber: number,
    totalPages: number,
    pageWidth: number,
    pageHeight: number,
    margin: number
  ): string {
    const commands: string[] = [];
    let cursorY = pageHeight - margin;

    const writeLine = (font: '/F1' | '/F2', size: number, text: string, step: number) => {
      commands.push('BT');
      commands.push(`${font} ${size} Tf`);
      commands.push(`${margin} ${cursorY} Td`);
      commands.push(`(${this.escapePdfText(text)}) Tj`);
      commands.push('ET');
      cursorY -= step;
    };

    commands.push('q');
    commands.push('0.94 0.96 1 rg');
    commands.push(`0 ${pageHeight - 36} ${pageWidth} 36 re`);
    commands.push('f');
    commands.push('Q');

    pageLines.forEach((line) => {
      if (line.kind === 'spacer') {
        cursorY -= 10;
        return;
      }

      switch (line.kind) {
        case 'title':
          writeLine('/F2', 20, line.text, 28);
          break;
        case 'subtitle':
          writeLine('/F2', 13.5, line.text, 18);
          break;
        case 'section':
          writeLine('/F2', 12.5, line.text.toUpperCase(), 16);
          break;
        case 'meta':
          writeLine('/F1', 9.5, line.text, 13);
          break;
        default:
          writeLine('/F1', 11.5, line.text, 15);
          break;
      }
    });

    commands.push('BT');
    commands.push('/F1 9 Tf');
    commands.push(`${margin} 24 Td`);
    commands.push(`(Page ${pageNumber} of ${totalPages}) Tj`);
    commands.push('ET');

    return `${commands.join('\n')}\n`;
  }

  private pdfLineHeight(kind: PdfLine['kind']): number {
    switch (kind) {
      case 'title':
        return 30;
      case 'subtitle':
        return 20;
      case 'section':
        return 18;
      case 'meta':
        return 13;
      case 'spacer':
        return 10;
      default:
        return 15;
    }
  }

  private wrapPdfParagraph(text: string, maxChars: number): string[] {
    const normalized = this.normalizePdfText(text).trim();
    if (!normalized) {
      return [''];
    }

    const paragraphs = normalized.split(/\r?\n/);
    const lines: string[] = [];

    paragraphs.forEach((paragraph, index) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let currentLine = '';

      words.forEach((word) => {
        if (!currentLine) {
          currentLine = word;
          return;
        }

        if (`${currentLine} ${word}`.length <= maxChars) {
          currentLine += ` ${word}`;
          return;
        }

        lines.push(currentLine);
        currentLine = word;
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      if (index < paragraphs.length - 1) {
        lines.push('');
      }
    });

    return lines;
  }

  private normalizePdfText(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[Ã¢â‚¬Å“Ã¢â‚¬Â]/g, '"')
      .replace(/[Ã¢â‚¬ËœÃ¢â‚¬â„¢]/g, "'")
      .replace(/[Ã¢â‚¬â€œÃ¢â‚¬â€]/g, '-')
      .replace(/[Ã¢â‚¬Â¢]/g, '*')
      .replace(/[Ã¢â‚¬Â¦]/g, '...')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
  }

  private buildLessonNotePages(lesson: Lesson, lessonContent: string): LessonNotePage[] {
    const sectionTitle = this.currentModuleTitle() || 'Current section';
    const lessonLabel = this.lessonDetails(lesson).label;
    const previousLesson = this.previousLesson();
    const nextLesson = this.nextLesson();
    const contentParagraphs = this.extractLessonNoteParagraphs(lessonContent);
    const contextParagraphs = [
      `${sectionTitle} is the current section for this lecture.`,
      `Lesson type: ${lessonLabel}. Duration: ${lesson.duration_minutes || 0} min.`,
      lesson.lesson_type === 'video'
        ? 'Watch the video in short passes, pause at each transition, and rewrite the steps in your own words.'
        : lesson.lesson_type === 'resource_link'
          ? 'Open the resource beside these notes and compare the reference material with the key points below.'
          : 'Read the lesson content carefully and keep the important ideas visible while you study.',
      previousLesson
        ? `Previous lecture: ${previousLesson.title}.`
        : `This is the first lecture in ${sectionTitle}.`,
      nextLesson
        ? `Next lecture: ${nextLesson.title}.`
        : `This is the last lecture in ${sectionTitle}.`,
      `Keep these notes open while you move through ${sectionTitle} so you can connect this lesson to the section flow.`,
      lessonContent
        ? `The lecture content above is the source of these notes, so the PDF mirrors the same study flow students see in the workspace.`
        : `The lesson does not have a written body, so these notes use the live section context and lecture metadata instead.`
    ];

    const combinedParagraphs = [...contentParagraphs, ...contextParagraphs].filter(Boolean);
    const pages = this.chunkNotePages(combinedParagraphs, lesson.title);
    const pageTitles = [
      lesson.title,
      'Key notes',
      'Section map',
      'Quick review'
    ];

    return pages.map((page, index) => ({
      ...page,
      title: pageTitles[index] ?? `${lesson.title} - Part ${index + 1}`,
      footer: `Page ${index + 1} of ${pages.length} • ${index === 0 ? 'Section recap' : index === 1 ? 'Core ideas' : index === 2 ? 'Section navigation' : 'Study review'}`
    }));
  }

  private extractLessonNoteParagraphs(content: string): string[] {
    const normalized = this.normalizePdfText(content)
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .trim();

    if (!normalized) {
      return [];
    }

    const explicitParagraphs = normalized
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (explicitParagraphs.length > 1) {
      return explicitParagraphs;
    }

    const sentences = normalized
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length > 1) {
      const paragraphs: string[] = [];
      let currentParagraph = '';
      const maxChars = 260;

      sentences.forEach((sentence) => {
        if (!currentParagraph) {
          currentParagraph = sentence;
          return;
        }

        if (`${currentParagraph} ${sentence}`.length <= maxChars) {
          currentParagraph += ` ${sentence}`;
          return;
        }

        paragraphs.push(currentParagraph);
        currentParagraph = sentence;
      });

      if (currentParagraph) {
        paragraphs.push(currentParagraph);
      }

      return paragraphs;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [];
    }

    const desiredChunks = Math.max(3, Math.min(4, Math.ceil(normalized.length / 220)));
    const wordsPerChunk = Math.max(1, Math.ceil(words.length / desiredChunks));
    const paragraphs: string[] = [];
    let currentWords: string[] = [];

    words.forEach((word) => {
      currentWords.push(word);
      const shouldFlush = currentWords.length >= wordsPerChunk && paragraphs.length < desiredChunks - 1;
      if (shouldFlush) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
    });

    if (currentWords.length) {
      paragraphs.push(currentWords.join(' '));
    }

    return paragraphs;
  }

  private chunkNotePages(paragraphs: string[], lessonTitle: string): LessonNotePage[] {
    if (!paragraphs.length) {
      return [];
    }

    const totalChars = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
    const targetPageCount = Math.max(3, Math.min(4, Math.ceil(totalChars / 700)));
    const maxCharsPerPage = Math.max(220, Math.ceil(totalChars / targetPageCount));
    const pages: LessonNotePage[] = [];
    let currentParagraphs: string[] = [];
    let currentChars = 0;

    const commitPage = () => {
      if (!currentParagraphs.length) {
        return;
      }

      pages.push({
        page: pages.length + 1,
        title: lessonTitle,
        paragraphs: [...currentParagraphs],
        footer: `Page ${pages.length + 1} of ${targetPageCount}`
      });

      currentParagraphs = [];
      currentChars = 0;
    };

    paragraphs.forEach((paragraph) => {
      const paragraphLength = paragraph.length;
      const shouldWrap = currentParagraphs.length > 0
        && currentChars + paragraphLength > maxCharsPerPage
        && pages.length < targetPageCount - 1;

      if (shouldWrap) {
        commitPage();
      }

      currentParagraphs.push(paragraph);
      currentChars += paragraphLength;
    });

    commitPage();

    return pages.map((page, index) => ({
      ...page,
      page: index + 1,
      footer: `Page ${index + 1} of ${pages.length}`
    }));
  }

  private escapePdfText(value: string): string {
    return this.normalizePdfText(value)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private slugify(value: string): string {
    return this.normalizePdfText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'notes';
  }

  private concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    parts.forEach((part) => {
      result.set(part, offset);
      offset += part.length;
    });

    return result;
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

