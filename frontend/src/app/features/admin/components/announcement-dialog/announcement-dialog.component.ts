import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { PlatformAnnouncementPayload } from '@app/features/admin/models/admin.models';
import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalFormGridComponent,
  ModalHeaderComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface AnnouncementDialogData {
  title?: string;
  body?: string;
  target_roles?: string[] | null;
}

@Component({
  selector: 'app-announcement-dialog',
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
    <app-base-modal size="lg">
      <app-modal-header
        eyebrow="Broadcast center"
        title="Create Announcement"
        subtitle="Publish a platform notice for all users or target specific roles with the existing admin announcement flow."
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <form [formGroup]="form" id="announcement-form" (ngSubmit)="submit()">
          <app-modal-section
            title="Announcement details"
            description="Use the current announcement API to publish a clean platform broadcast.">
            <app-modal-form-grid>
              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
                @if (form.controls.title.invalid && form.controls.title.touched) {
                  <mat-error>Title is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Message</mat-label>
                <textarea matInput rows="7" formControlName="body"></textarea>
                @if (form.controls.body.invalid && form.controls.body.touched) {
                  <mat-error>Message body is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Target Roles</mat-label>
                <mat-select formControlName="target_roles" multiple>
                  <mat-option value="admin">Admins</mat-option>
                  <mat-option value="instructor">Instructors</mat-option>
                  <mat-option value="student">Students</mat-option>
                </mat-select>
                <mat-hint>Leave empty to notify all active users.</mat-hint>
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="announcement-form">Publish Announcement</button>
      </app-modal-footer>
    </app-base-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementDialogComponent {
  readonly data = inject<AnnouncementDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  readonly dialogRef = inject(MatDialogRef<AnnouncementDialogComponent, PlatformAnnouncementPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group({
    title: [this.data.title ?? '', [Validators.required, Validators.maxLength(255)]],
    body: [this.data.body ?? '', [Validators.required]],
    target_roles: [this.data.target_roles ?? [] as string[]]
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    this.dialogRef.close({
      title: String(raw.title ?? '').trim(),
      body: String(raw.body ?? '').trim(),
      target_roles: raw.target_roles?.length ? raw.target_roles : null
    });
  }
}
