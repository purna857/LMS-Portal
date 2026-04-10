import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AdminActionDialogComponent } from '@app/features/admin/components/admin-action-dialog/admin-action-dialog.component';
import { LessonDialogComponent } from '@app/features/instructor/components/lesson-dialog/lesson-dialog.component';
import { ModuleDialogComponent } from '@app/features/instructor/components/module-dialog/module-dialog.component';
import type { CourseListItem, CourseModule, Lesson } from '@app/features/instructor/models/instructor.models';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { portalDialogConfig } from '@app/shared/dialogs/portal-dialog-helpers';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForCourseStatus } from '@app/shared/utils/chip-tone';


@Component({
  selector: 'app-content-management',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Instructor"
        title="Curriculum Builder"
        description="Organize course structure, sequencing, preview access, and lesson publishing from one content workspace.">
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

      <mat-card class="surface-card">
        <mat-card-content>
          <form [formGroup]="courseForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Course</mat-label>
              <mat-select formControlName="course_id">
                @for (course of courses(); track course.id) {
                  <mat-option [value]="course.id">{{ course.title }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-stroked-button type="button" (click)="loadContent()">Refresh</button>
              <button mat-flat-button color="primary" type="button" [disabled]="!selectedCourseId()" (click)="openModuleDialog()">Add Module</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      @if (modules().length) {
        <div class="module-grid">
          @for (module of modules(); track module.id) {
            <mat-card class="surface-card">
              <mat-card-header>
                <mat-card-title>{{ module.position }}. {{ module.title }}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="chip-row">
                  <mat-chip-set>
                    <mat-chip [attr.data-tone]="chipToneForCourseStatus(module.status)">{{ module.status }}</mat-chip>
                    @if (module.is_preview) {
                      <mat-chip data-tone="info">Preview</mat-chip>
                    }
                  </mat-chip-set>
                </div>
                <p class="muted-copy">{{ module.description || 'No description for this module yet.' }}</p>

                <div class="inline-actions">
                  <button mat-button type="button" (click)="openModuleDialog(module)">Edit Module</button>
                  <button mat-button type="button" (click)="openLessonDialog(module.id)">Add Lesson</button>
                  <button mat-button color="warn" type="button" (click)="deleteModule(module)">Delete</button>
                </div>

                <mat-divider></mat-divider>

                @if (lessonsByModule()[module.id].length) {
                  <div class="lesson-list">
                    @for (lesson of lessonsByModule()[module.id]; track lesson.id) {
                      <div class="lesson-row">
                        <div>
                          <strong>{{ lesson.position }}. {{ lesson.title }}</strong>
                          <p>{{ lesson.lesson_type }} · {{ lesson.duration_minutes || 0 }} min</p>
                        </div>
                        <div class="inline-actions">
                          <button mat-button type="button" (click)="openLessonDialog(module.id, lesson)">Edit</button>
                          <button mat-button color="warn" type="button" (click)="deleteLesson(lesson)">Delete</button>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <app-empty-state
                    icon="menu_book"
                    title="No lessons yet"
                    description="Add lessons to start building out this module.">
                  </app-empty-state>
                }
              </mat-card-content>
            </mat-card>
          }
        </div>
      } @else {
        <app-empty-state
          icon="view_module"
          title="No modules available"
          description="Select a course and add your first module to start structuring the content.">
        </app-empty-state>
      }
    </section>
  `,
  styles: [`
    .module-grid {
      display: grid;
      gap: 1.25rem;
    }

    .chip-row,
    .inline-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .muted-copy {
      margin: 0.75rem 0 1rem;
      color: var(--muted);
      line-height: 1.5;
    }

    .lesson-list {
      display: grid;
      gap: 0.9rem;
      margin-top: 1rem;
    }

    .lesson-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: start;
      padding: 1rem 1.05rem;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(248, 251, 255, 0.92), #ffffff 72%);
    }

    .lesson-row p {
      margin: 0.3rem 0 0;
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .lesson-row .mat-mdc-chip-set {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    @media (max-width: 720px) {
      .lesson-row {
        grid-template-columns: 1fr;
      }

      .lesson-row > :last-child {
        justify-self: start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentManagementComponent {
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly courses = signal<CourseListItem[]>([]);
  readonly modules = signal<CourseModule[]>([]);
  readonly lessonsByModule = signal<Record<string, Lesson[]>>({});
  readonly courseForm = this.formBuilder.group({
    course_id: ['']
  });

  readonly selectedCourseId = signal<string | null>(null);
  readonly summaryCards = computed(() => {
    const modules = this.modules();
    const lessonMap = this.lessonsByModule();
    const lessons = Object.values(lessonMap).flat();
    return [
      {
        label: 'Modules',
        value: String(modules.length),
        hint: 'Structure blocks in the selected course',
        icon: 'view_module'
      },
      {
        label: 'Lessons',
        value: String(lessons.length),
        hint: 'Total lessons attached to the modules',
        icon: 'menu_book'
      },
      {
        label: 'Published',
        value: String(modules.filter((module) => module.status === 'published').length),
        hint: 'Modules ready for learners',
        icon: 'rocket_launch'
      },
      {
        label: 'Preview Ready',
        value: String(modules.filter((module) => module.is_preview).length),
        hint: 'Modules with preview access enabled',
        icon: 'visibility'
      }
    ];
  });

  readonly chipToneForCourseStatus = chipToneForCourseStatus;

  constructor() {
    this.courseForm.controls.course_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((courseId) => {
        this.selectedCourseId.set(courseId || null);
        this.modules.set([]);
        this.lessonsByModule.set({});
        if (courseId) {
          this.loadContent();
        }
      });

    this.instructorPortalService.listMyCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.items);
          const preferredCourseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';
          const selectedCourseId = response.items.find((course) => course.id === preferredCourseId)?.id ?? response.items[0]?.id ?? '';
          this.courseForm.patchValue({ course_id: selectedCourseId });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to load instructor courses.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  loadContent(): void {
    const courseId = this.courseForm.getRawValue().course_id || this.selectedCourseId();
    if (!courseId) {
      return;
    }
    this.selectedCourseId.set(courseId);
    this.loading.set(true);
    this.instructorPortalService.listModules(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.modules.set(response.items);
          if (!response.items.length) {
            this.lessonsByModule.set({});
            this.loading.set(false);
            return;
          }
          forkJoin(
            Object.fromEntries(response.items.map((module) => [module.id, this.instructorPortalService.listLessons(module.id)]))
          )
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
              error: (error: HttpErrorResponse) => {
                this.loading.set(false);
                this.snackBar.open(error.error?.detail ?? 'Unable to load lessons.', 'Dismiss', { duration: 4500 });
              }
            });
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load modules.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  openModuleDialog(module?: CourseModule): void {
    const courseId = this.selectedCourseId();
    if (!courseId) {
      return;
    }
    const dialogRef = this.dialog.open(ModuleDialogComponent, {
      data: {
        mode: module ? 'edit' : 'create',
        module
      },
      ...portalDialogConfig('md')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload) {
        return;
      }
      const request$ = module
        ? this.instructorPortalService.updateModule(module.id, payload)
        : this.instructorPortalService.createModule(courseId, payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open(`Module ${module ? 'updated' : 'created'} successfully.`, 'Dismiss', { duration: 3200 });
          this.loadContent();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save the module.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteModule(module: CourseModule): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Module',
        message: `Delete "${module.title}" and all of its lessons?`,
        confirmLabel: 'Delete Module',
        confirmColor: 'warn'
      },
      ...portalDialogConfig('sm')
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }
      this.instructorPortalService.deleteModule(module.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            this.loadContent();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete module.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }

  openLessonDialog(moduleId: string, lesson?: Lesson): void {
    const dialogRef = this.dialog.open(LessonDialogComponent, {
      data: {
        mode: lesson ? 'edit' : 'create',
        lesson
      },
      ...portalDialogConfig('lg')
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload) {
        return;
      }
      const request$ = lesson
        ? this.instructorPortalService.updateLesson(lesson.id, payload)
        : this.instructorPortalService.createLesson(moduleId, payload);

      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open(`Lesson ${lesson ? 'updated' : 'created'} successfully.`, 'Dismiss', { duration: 3200 });
          this.loadContent();
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to save the lesson.', 'Dismiss', { duration: 4500 });
        }
      });
    });
  }

  deleteLesson(lesson: Lesson): void {
    const dialogRef = this.dialog.open(AdminActionDialogComponent, {
      data: {
        title: 'Delete Lesson',
        message: `Delete "${lesson.title}" from the module?`,
        confirmLabel: 'Delete Lesson',
        confirmColor: 'warn'
      },
      ...portalDialogConfig('sm')
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }
      this.instructorPortalService.deleteLesson(lesson.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
            this.loadContent();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(error.error?.detail ?? 'Unable to delete lesson.', 'Dismiss', { duration: 4500 });
          }
        });
    });
  }
}
