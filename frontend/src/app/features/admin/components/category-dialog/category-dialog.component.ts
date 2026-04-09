import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { CourseCategory, CourseCategoryPayload } from '@app/features/admin/models/admin.models';
import { materialImports } from '@app/shared/material/material-imports';


export interface CategoryDialogData {
  mode: 'create' | 'edit';
  category?: CourseCategory;
  categories: CourseCategory[];
}


@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ...materialImports],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Create Category' : 'Edit Category' }}</h2>

    <mat-dialog-content class="dialog-shell">
      <form [formGroup]="form" class="dialog-grid">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Slug</mat-label>
          <input matInput formControlName="slug" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            <mat-option value="active">Active</mat-option>
            <mat-option value="inactive">Inactive</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Sort Order</mat-label>
          <input matInput type="number" formControlName="sort_order" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Parent Category</mat-label>
          <mat-select formControlName="parent_id">
            <mat-option [value]="null">None</mat-option>
            @for (category of availableParents; track category.id) {
              <mat-option [value]="category.id">{{ category.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Description</mat-label>
          <textarea matInput rows="4" formControlName="description"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">
        {{ data.mode === 'create' ? 'Create' : 'Save Changes' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      width: min(94vw, 640px);
      max-width: 640px;
      padding-top: 0.5rem;
    }

    .dialog-grid__full {
      grid-column: 1 / -1;
    }

    .dialog-shell {
      overflow: hidden;
    }

    @media (max-width: 720px) {
      .dialog-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryDialogComponent {
  readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<CategoryDialogComponent, CourseCategoryPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly availableParents = this.data.categories.filter((category) => category.id !== this.data.category?.id);

  readonly form = this.formBuilder.group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    slug: [this.data.category?.slug ?? '', [Validators.required, Validators.maxLength(150)]],
    status: [this.data.category?.status ?? 'active', [Validators.required]],
    sort_order: [this.data.category?.sort_order ?? 0, [Validators.required, Validators.min(0)]],
    parent_id: [this.data.category?.parent_id ?? null],
    description: [this.data.category?.description ?? '']
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      name: String(value.name ?? '').trim(),
      slug: String(value.slug ?? '').trim(),
      status: value.status as 'active' | 'inactive',
      sort_order: Number(value.sort_order ?? 0),
      parent_id: value.parent_id || null,
      description: String(value.description ?? '').trim() || null
    });
  }
}
