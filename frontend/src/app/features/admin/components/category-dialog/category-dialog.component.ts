import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { CourseCategory, CourseCategoryPayload } from '@app/features/admin/models/admin.models';
import { PortalDialogShellComponent } from '@app/shared/components/portal-dialog-shell/portal-dialog-shell.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface CategoryDialogData {
  mode: 'create' | 'edit';
  category?: CourseCategory;
  categories: CourseCategory[];
}


@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, PortalDialogShellComponent, ...materialImports],
  template: `
    <app-portal-dialog-shell
      size="md"
      eyebrow="Catalog structure"
      [title]="data.mode === 'create' ? 'Create Category' : 'Edit Category'"
      [description]="data.mode === 'create'
        ? 'Add a category that helps learners and instructors navigate the catalog more easily.'
        : 'Adjust the category naming, hierarchy, and ordering without breaking the structure.'"
      (closeRequested)="dialogRef.close()">
      <form dialogBody [formGroup]="form" class="dialog-grid dialog-grid--single" id="category-form" (ngSubmit)="submit()">
          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Category details</strong>
              <p>Capture the display name, slug, hierarchy, and ordering in one place.</p>
            </div>

            <div class="dialog-grid">
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

              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Parent Category</mat-label>
                <mat-select formControlName="parent_id">
                  <mat-option [value]="null">None</mat-option>
                  @for (category of availableParents; track category.id) {
                    <mat-option [value]="category.id">{{ category.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </section>

          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Description</strong>
              <p>Provide supporting copy that helps the catalog feel organized and descriptive.</p>
            </div>

            <div class="dialog-grid">
              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Description</mat-label>
                <textarea matInput rows="4" formControlName="description"></textarea>
              </mat-form-field>
            </div>
          </section>
      </form>

      <div dialogFooter class="dialog-footer-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="category-form">
          {{ data.mode === 'create' ? 'Create' : 'Save Changes' }}
        </button>
      </div>
    </app-portal-dialog-shell>
  `,
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
