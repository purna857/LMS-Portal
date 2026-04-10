import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { CourseModule, CourseModulePayload } from '@app/features/instructor/models/instructor.models';
import { PortalDialogShellComponent } from '@app/shared/components/portal-dialog-shell/portal-dialog-shell.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface ModuleDialogData {
  mode: 'create' | 'edit';
  module?: CourseModule;
}


@Component({
  selector: 'app-module-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, PortalDialogShellComponent, ...materialImports],
  template: `
    <app-portal-dialog-shell
      size="md"
      eyebrow="Module builder"
      [title]="data.mode === 'create' ? 'Create Module' : 'Edit Module'"
      [description]="data.mode === 'create'
        ? 'Organize lessons into a focused module that gives learners a clear progression.'
        : 'Refine the module title, order, visibility, and preview access in one place.'"
      (closeRequested)="dialogRef.close()">
      <form dialogBody [formGroup]="form" class="dialog-grid dialog-grid--single" id="module-form" (ngSubmit)="submit()">
          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Module details</strong>
              <p>Set the module title, order, and publication state.</p>
            </div>

            <div class="dialog-grid">
              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Position</mat-label>
                <input matInput type="number" formControlName="position" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="draft">Draft</mat-option>
                  <mat-option value="published">Published</mat-option>
                  <mat-option value="archived">Archived</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </section>

          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Access & summary</strong>
              <p>Control preview access and provide a concise summary for the module.</p>
            </div>

            <div class="dialog-grid">
              <mat-checkbox formControlName="is_preview" class="dialog-grid__full">Allow preview access</mat-checkbox>

              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Description</mat-label>
                <textarea matInput rows="4" formControlName="description"></textarea>
              </mat-form-field>
            </div>
          </section>
      </form>

      <div dialogFooter class="dialog-footer-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="module-form">
          {{ data.mode === 'create' ? 'Create Module' : 'Save Module' }}
        </button>
      </div>
    </app-portal-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleDialogComponent {
  readonly data = inject<ModuleDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ModuleDialogComponent, CourseModulePayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group({
    title: [this.data.module?.title ?? '', [Validators.required, Validators.maxLength(255)]],
    description: [this.data.module?.description ?? ''],
    position: [this.data.module?.position ?? null],
    status: [this.data.module?.status ?? 'draft', [Validators.required]],
    is_preview: [this.data.module?.is_preview ?? false]
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      title: String(value.title ?? '').trim(),
      description: String(value.description ?? '').trim() || null,
      position: value.position === null ? null : Number(value.position),
      status: value.status,
      is_preview: !!value.is_preview
    });
  }
}
