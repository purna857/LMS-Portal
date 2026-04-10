import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PortalDialogShellComponent } from '@app/shared/components/portal-dialog-shell/portal-dialog-shell.component';
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
  imports: [ReactiveFormsModule, PortalDialogShellComponent, ...materialImports],
  template: `
    <app-portal-dialog-shell
      size="sm"
      [variant]="data.confirmColor === 'warn' ? 'destructive' : 'confirm'"
      [eyebrow]="data.confirmColor === 'warn' ? 'Destructive action' : 'Action confirmation'"
      [title]="data.title"
      [description]="data.message"
      [closeLabel]="'Close confirmation dialog'"
      (closeRequested)="dialogRef.close()">
      <form dialogBody [formGroup]="form" class="dialog-grid dialog-grid--single" id="admin-action-form" (ngSubmit)="confirm()">
        <div class="dialog-copy">
          <p>{{ data.message }}</p>
        </div>

        @if (data.noteLabel) {
          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>{{ data.noteLabel }}</strong>
              <p>{{ data.noteRequired ? 'Add a short note before confirming this action.' : 'Optional note for the record.' }}</p>
            </div>

            <mat-form-field appearance="outline" class="dialog-grid__full">
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
          </section>
        }
      </form>

      <div dialogFooter class="dialog-footer-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button
          mat-flat-button
          type="submit"
          [color]="data.confirmColor ?? 'primary'"
          [disabled]="form.invalid"
          form="admin-action-form">
          {{ data.confirmLabel }}
        </button>
      </div>
    </app-portal-dialog-shell>
  `,
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
