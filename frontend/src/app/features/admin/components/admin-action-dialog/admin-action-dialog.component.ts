import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalFormGridComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface AdminActionDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  noteValue?: string;
}

export interface AdminActionDialogResult {
  note?: string;
}


@Component({
  selector: 'app-admin-action-dialog',
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
    <app-base-modal size="sm" [variant]="data.confirmColor === 'warn' ? 'destructive' : 'default'">
      <app-modal-header
        [eyebrow]="data.confirmColor === 'warn' ? 'Destructive action' : 'Action confirmation'"
        [title]="data.title"
        [subtitle]="data.message"
        closeLabel="Close confirmation dialog"
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <form [formGroup]="form" id="admin-action-form" (ngSubmit)="confirm()">
        @if (data.noteLabel) {
          <app-modal-section
            [title]="data.noteLabel"
            [description]="data.noteRequired ? 'Add a short note before confirming this action.' : 'Optional note for the record.'">
            <app-modal-form-grid [columns]="1">
              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>{{ data.noteLabel }}</mat-label>
                <textarea
                  matInput
                  rows="5"
                  [placeholder]="data.notePlaceholder ?? ''"
                  [formControl]="form.controls.note">
                </textarea>
                @if (form.controls.note.invalid && form.controls.note.touched) {
                  <mat-error>Review notes are required for this action.</mat-error>
                }
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>
        } @else {
          <app-modal-section title="Confirm action" description="Review the impact, then confirm when you're ready.">
            <p class="admin-action-dialog__message">{{ data.message }}</p>
          </app-modal-section>
        }
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button
          mat-flat-button
          type="submit"
          [color]="data.confirmColor ?? 'primary'"
          [disabled]="form.invalid"
          form="admin-action-form">
          {{ data.confirmLabel }}
        </button>
      </app-modal-footer>
    </app-base-modal>
  `,
  styles: [`
    .admin-action-dialog__message {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminActionDialogComponent {
  readonly data = inject<AdminActionDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AdminActionDialogComponent, AdminActionDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group({
    note: [
      this.data.noteValue ?? '',
      this.data.noteRequired ? [Validators.required] : []
    ]
  });

  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.dialogRef.close({
      note: this.form.controls.note.value?.trim() || undefined
    });
  }
}
