import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { CourseModule, CourseModulePayload } from '@app/features/instructor/models/instructor.models';
import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalFormGridComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface ModuleDialogData {
  mode: 'create' | 'edit';
  module?: CourseModule;
}


@Component({
  selector: 'app-module-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BaseModalComponent,
    ModalHeaderComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalSectionComponent,
    ModalFormGridComponent,
    ...materialImports
  ],
  template: `
    <app-base-modal size="md">
      <app-modal-header
        eyebrow="Module builder"
        [title]="data.mode === 'create' ? 'Create Module' : 'Edit Module'"
        [subtitle]="data.mode === 'create'
        ? 'Organize lessons into a focused module that gives learners a clear progression.'
        : 'Refine the module title, order, visibility, and preview access in one place.'"
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <form [formGroup]="form" id="module-form" (ngSubmit)="submit()">
          <app-modal-section
            title="Module details"
            description="Set the module title, order, and publication state.">
            <app-modal-form-grid>
              <mat-form-field appearance="outline" class="modal-form-grid__full">
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
            </app-modal-form-grid>
          </app-modal-section>

          <app-modal-section
            title="Access & summary"
            description="Control preview access and provide a concise summary for the module.">
            <app-modal-form-grid>
              <mat-checkbox formControlName="is_preview" class="modal-form-grid__full">Allow preview access</mat-checkbox>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Description</mat-label>
                <textarea matInput rows="4" formControlName="description"></textarea>
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="module-form">
          {{ data.mode === 'create' ? 'Create Module' : 'Save Module' }}
        </button>
      </app-modal-footer>
    </app-base-modal>
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
