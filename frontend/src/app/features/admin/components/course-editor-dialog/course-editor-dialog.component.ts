import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { CourseCategory, CourseDetail, CourseUpdatePayload } from '@app/features/admin/models/admin.models';
import type { CourseCreatePayload } from '@app/features/instructor/models/instructor.models';
import { materialImports } from '@app/shared/material/material-imports';


export interface CourseEditorDialogData {
  mode: 'create' | 'edit';
  course?: CourseDetail;
  categories: CourseCategory[];
}


@Component({
  selector: 'app-course-editor-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ...materialImports],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Create Course' : 'Edit Course' }}</h2>

    <mat-dialog-content class="dialog-shell">
      <form [formGroup]="form" class="dialog-grid">
        <mat-form-field appearance="outline" class="dialog-grid__full">
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
            @for (category of data.categories; track category.id) {
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

        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Thumbnail URL</mat-label>
          <input matInput formControlName="thumbnail_url" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Short Description</mat-label>
          <textarea matInput rows="3" formControlName="short_description"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Description</mat-label>
          <textarea matInput rows="5" formControlName="description"></textarea>
        </mat-form-field>

        <mat-checkbox formControlName="is_featured" class="dialog-grid__full">
          Feature this course in the admin catalog
        </mat-checkbox>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">
        {{ data.mode === 'create' ? 'Create Course' : 'Save Course' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      width: min(94vw, 760px);
      max-width: 760px;
      padding-top: 0.5rem;
    }

    .dialog-shell {
      overflow: hidden;
    }

    .dialog-grid__full {
      grid-column: 1 / -1;
    }

    @media (max-width: 760px) {
      .dialog-grid {
        grid-template-columns: 1fr;
        width: 100%;
        max-width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourseEditorDialogComponent {
  readonly data = inject<CourseEditorDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<CourseEditorDialogComponent, (CourseUpdatePayload | CourseCreatePayload) | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group({
    category_id: [this.data.course?.category?.id ?? null],
    title: [this.data.course?.title ?? '', [Validators.required, Validators.maxLength(255)]],
    slug: [this.data.course?.slug ?? '', [Validators.required, Validators.maxLength(255)]],
    short_description: [this.data.course?.short_description ?? '', [Validators.maxLength(500)]],
    description: [this.data.course?.description ?? ''],
    thumbnail_url: [this.data.course?.thumbnail_url ?? ''],
    level: [this.data.course?.level ?? 'beginner', [Validators.required]],
    language: [this.data.course?.language ?? 'en', [Validators.required, Validators.maxLength(20)]],
    visibility: [this.data.course?.visibility ?? 'public', [Validators.required]],
    estimated_duration_minutes: [this.data.course?.estimated_duration_minutes ?? null],
    is_featured: [this.data.course?.is_featured ?? false]
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const estimatedDuration = value.estimated_duration_minutes;
    this.dialogRef.close({
      category_id: value.category_id || null,
      title: String(value.title ?? '').trim() || null,
      slug: String(value.slug ?? '').trim() || null,
      short_description: String(value.short_description ?? '').trim() || null,
      description: String(value.description ?? '').trim() || null,
      thumbnail_url: String(value.thumbnail_url ?? '').trim() || null,
      level: value.level,
      language: String(value.language ?? '').trim() || null,
      visibility: value.visibility,
      estimated_duration_minutes: estimatedDuration === null ? null : Number(estimatedDuration),
      is_featured: !!value.is_featured
    });
  }
}
