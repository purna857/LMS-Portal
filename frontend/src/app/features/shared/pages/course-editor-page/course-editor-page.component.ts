import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import type { CourseCategory, CourseDetail, CourseUpdatePayload } from '@app/features/admin/models/admin.models';
import type { CourseCreatePayload } from '@app/features/instructor/models/instructor.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import { InstructorPortalService } from '@app/features/instructor/services/instructor-portal.service';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


type EditorRole = 'admin' | 'instructor';
type EditorMode = 'create' | 'edit';

@Component({
  selector: 'app-course-editor-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        [eyebrow]="role() === 'admin' ? 'Admin' : 'Instructor'"
        [title]="mode() === 'create' ? 'Create Course' : 'Edit Course'"
        [description]="role() === 'admin'
          ? 'Review course metadata, catalog presentation, and publish readiness in a full editor workspace.'
          : 'Build and refine your course in a full-page studio designed for longer editing workflows.'">
      </app-page-header>

      <mat-card class="surface-card editor-shell">
        <mat-card-content>
          @if (loading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          <form [formGroup]="form" id="course-editor-page-form" class="editor-layout" (ngSubmit)="submit()">
            <section class="editor-section">
              <div class="editor-section__copy">
                <h2>Basic information</h2>
                <p>Capture the course identity, catalog placement, and learning level.</p>
              </div>

              <div class="editor-grid">
                <mat-form-field appearance="outline" class="editor-grid__full">
                  <mat-label>Title</mat-label>
                  <input matInput formControlName="title" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Slug</mat-label>
                  <input matInput formControlName="slug" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Category</mat-label>
                  <mat-select formControlName="category_id">
                    <mat-option [value]="null">Uncategorized</mat-option>
                    @for (category of categories(); track category.id) {
                      <mat-option [value]="category.id">{{ category.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Level</mat-label>
                  <mat-select formControlName="level">
                    <mat-option value="beginner">Beginner</mat-option>
                    <mat-option value="intermediate">Intermediate</mat-option>
                    <mat-option value="advanced">Advanced</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Language</mat-label>
                  <input matInput formControlName="language" />
                </mat-form-field>
              </div>
            </section>

            <section class="editor-section">
              <div class="editor-section__copy">
                <h2>Catalog settings</h2>
                <p>Control visibility, duration, and the promotional presentation shown to learners.</p>
              </div>

              <div class="editor-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Visibility</mat-label>
                  <mat-select formControlName="visibility">
                    <mat-option value="public">Public</mat-option>
                    <mat-option value="private">Private</mat-option>
                    <mat-option value="restricted">Restricted</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Estimated Duration (Minutes)</mat-label>
                  <input matInput type="number" formControlName="estimated_duration_minutes" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="editor-grid__full">
                  <mat-label>Thumbnail URL</mat-label>
                  <input matInput formControlName="thumbnail_url" />
                </mat-form-field>

                <mat-checkbox formControlName="is_featured" class="editor-grid__full">
                  Feature this course in the catalog
                </mat-checkbox>
              </div>
            </section>

            <section class="editor-section">
              <div class="editor-section__copy">
                <h2>Description & overview</h2>
                <p>Use concise copy for discovery, then expand with the full course description.</p>
              </div>

              <div class="editor-grid">
                <mat-form-field appearance="outline" class="editor-grid__full">
                  <mat-label>Short Description</mat-label>
                  <textarea matInput rows="3" formControlName="short_description"></textarea>
                </mat-form-field>

                <mat-form-field appearance="outline" class="editor-grid__full">
                  <mat-label>Description</mat-label>
                  <textarea matInput rows="6" formControlName="description"></textarea>
                </mat-form-field>
              </div>
            </section>
          </form>
        </mat-card-content>

        <mat-card-actions align="end" class="editor-actions">
          <a mat-stroked-button [routerLink]="cancelRoute()">Cancel</a>
          <button mat-flat-button color="primary" type="submit" form="course-editor-page-form" [disabled]="saving()">
            {{ mode() === 'create' ? 'Create Course' : 'Save Course' }}
          </button>
        </mat-card-actions>
      </mat-card>
    </section>
  `,
  styles: [`
    .editor-shell {
      overflow: hidden;
    }

    .editor-shell mat-card-content {
      display: grid;
      gap: 1.25rem;
      padding-top: 1.1rem;
    }

    .editor-layout {
      display: grid;
      gap: 1.25rem;
    }

    .editor-section {
      display: grid;
      gap: 1rem;
      padding: 1.3rem;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(248, 251, 255, 0.94), #ffffff 72%);
    }

    .editor-section__copy {
      display: grid;
      gap: 0.3rem;
    }

    .editor-section__copy h2 {
      margin: 0;
      font-size: 1.04rem;
      letter-spacing: -0.03em;
    }

    .editor-section__copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .editor-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem 1.1rem;
      align-items: start;
    }

    .editor-grid__full {
      grid-column: 1 / -1;
    }

    .editor-actions {
      gap: 0.75rem;
      padding: 0 1.2rem 1.2rem !important;
    }

    @media (max-width: 900px) {
      .editor-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseEditorPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly instructorPortalService = inject(InstructorPortalService);
  private readonly adminPortalService = inject(AdminPortalService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly categories = signal<CourseCategory[]>([]);
  readonly course = signal<CourseDetail | null>(null);
  readonly role = signal<EditorRole>((this.route.snapshot.data['editorRole'] as EditorRole) ?? 'instructor');
  readonly mode = signal<EditorMode>((this.route.snapshot.data['editorMode'] as EditorMode) ?? 'create');
  readonly cancelRoute = computed(() => this.role() === 'admin' ? '/app/admin/courses' : '/app/instructor/courses');

  readonly form = this.formBuilder.group({
    category_id: [null as string | null],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    slug: ['', [Validators.required, Validators.maxLength(255)]],
    short_description: ['', [Validators.maxLength(500)]],
    description: [''],
    thumbnail_url: [''],
    level: ['beginner' as 'beginner' | 'intermediate' | 'advanced', [Validators.required]],
    language: ['en', [Validators.required, Validators.maxLength(20)]],
    visibility: ['public' as 'public' | 'private' | 'restricted', [Validators.required]],
    estimated_duration_minutes: [null as number | null],
    is_featured: [false]
  });

  constructor() {
    const courseId = this.route.snapshot.paramMap.get('courseId');
    const categoryRequest$ = this.role() === 'admin'
      ? this.adminPortalService.listCategories()
      : this.instructorPortalService.listCategories();
    const courseRequest$ = this.mode() === 'edit' && courseId
      ? (this.role() === 'admin'
          ? this.adminPortalService.getCourse(courseId)
          : this.instructorPortalService.getCourse(courseId))
      : of(null);

    forkJoin({
      categories: categoryRequest$,
      course: courseRequest$
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, course }) => {
          this.categories.set(categories);
          this.course.set(course);
          if (course) {
            this.form.patchValue({
              category_id: course.category?.id ?? null,
              title: course.title,
              slug: course.slug,
              short_description: course.short_description ?? '',
              description: course.description ?? '',
              thumbnail_url: course.thumbnail_url ?? '',
              level: course.level,
              language: course.language,
              visibility: course.visibility,
              estimated_duration_minutes: course.estimated_duration_minutes ?? null,
              is_featured: course.is_featured
            });
          }
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load the course editor.', 'Dismiss', { duration: 4500 });
          void this.router.navigateByUrl(this.cancelRoute());
        }
      });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      category_id: value.category_id || null,
      title: String(value.title ?? '').trim() || null,
      slug: String(value.slug ?? '').trim() || null,
      short_description: String(value.short_description ?? '').trim() || null,
      description: String(value.description ?? '').trim() || null,
      thumbnail_url: String(value.thumbnail_url ?? '').trim() || null,
      level: value.level,
      language: String(value.language ?? '').trim() || null,
      visibility: value.visibility,
      estimated_duration_minutes: value.estimated_duration_minutes === null ? null : Number(value.estimated_duration_minutes),
      is_featured: !!value.is_featured
    };

    const request$ = this.resolveSaveRequest(payload);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open(`Course ${this.mode() === 'create' ? 'created' : 'updated'} successfully.`, 'Dismiss', { duration: 3200 });
        void this.router.navigateByUrl(this.cancelRoute());
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.snackBar.open(error.error?.detail ?? 'Unable to save the course.', 'Dismiss', { duration: 4500 });
      }
    });
  }

  private resolveSaveRequest(payload: CourseUpdatePayload | CourseCreatePayload) {
    const existingCourse = this.course();
    if (this.role() === 'admin') {
      return this.adminPortalService.updateCourse(existingCourse!.id, payload as CourseUpdatePayload);
    }

    if (this.mode() === 'create') {
      return this.instructorPortalService.createCourse(payload as CourseCreatePayload);
    }

    return this.instructorPortalService.updateCourse(existingCourse!.id, payload as CourseUpdatePayload);
  }
}
