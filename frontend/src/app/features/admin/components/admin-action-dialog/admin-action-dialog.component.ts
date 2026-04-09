import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

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
  imports: [ReactiveFormsModule, ...materialImports],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content class="dialog-content">
      <p>{{ data.message }}</p>

      @if (data.noteLabel) {
        <mat-form-field appearance="outline">
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
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        type="button"
        [color]="data.confirmColor ?? 'primary'"
        [disabled]="form.invalid"
        (click)="confirm()">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      display: grid;
      gap: 1rem;
      min-width: min(92vw, 420px);
    }

    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
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
