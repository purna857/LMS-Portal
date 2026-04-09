import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import type {
  Assignment,
  AssignmentSubmitPayload,
  AssignmentUploadResponse
} from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { materialImports } from '@app/shared/material/material-imports';


export interface AssignmentSubmitDialogData {
  assignment: Assignment;
}


@Component({
  selector: 'app-assignment-submit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ...materialImports],
  template: `
    <h2 mat-dialog-title>Submit Assignment</h2>

    <mat-dialog-content class="dialog-shell">
      <section class="dialog-summary">
        <span class="dialog-summary__eyebrow">Student submission</span>
        <strong>{{ data.assignment.title }}</strong>
        <p>
          Upload a file, add a written response, include a submission link, or combine them in a single delivery.
        </p>
      </section>

      <form [formGroup]="form" class="dialog-grid">
        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Submission text</mat-label>
          <textarea
            matInput
            rows="5"
            formControlName="submission_text"
            placeholder="Paste notes, code snippets, or a concise summary of the work you completed.">
          </textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Submission link</mat-label>
          <input matInput formControlName="submission_link" placeholder="https://example.com/your-work" />
          @if (form.controls.submission_link.invalid && form.controls.submission_link.touched) {
            <mat-error>Add a valid http or https link.</mat-error>
          }
        </mat-form-field>

        <section class="upload-panel dialog-grid__full">
          <div class="upload-panel__copy">
            <strong>Upload assignment file</strong>
            <p>Accepted formats: PDF, DOCX, TXT, CSV, XLSX, images, and ZIP files up to 10 MB.</p>
          </div>

          <div class="upload-panel__actions">
            <input #fileInput type="file" hidden (change)="onFileSelected($event)" />
            <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploading()">
              {{ uploading() ? 'Uploading...' : 'Choose file' }}
            </button>
          </div>

          @if (uploadedFile(); as file) {
            <div class="uploaded-file">
              <div>
                <strong>{{ file.file_name }}</strong>
                <span>{{ formatFileSize(file.file_size_bytes) }}</span>
              </div>
              <button mat-button type="button" color="warn" (click)="removeFile()">Remove</button>
            </div>
          } @else {
            <div class="upload-placeholder">
              <span class="material-symbols-outlined">upload_file</span>
              <span>No file uploaded yet</span>
            </div>
          }
        </section>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="uploading()">
        Submit Assignment
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }

    .dialog-shell {
      display: grid;
      gap: 0.85rem;
      width: min(92vw, 720px);
      max-width: 720px;
      padding-top: 0.15rem;
    }

    .dialog-summary {
      display: grid;
      gap: 0.45rem;
      padding: 0.65rem 1rem 0;
    }

    .dialog-summary__eyebrow {
      display: inline-flex;
      width: fit-content;
      padding: 0.28rem 0.7rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.68rem;
      font-weight: 700;
    }

    .dialog-summary strong {
      font-size: 1rem;
    }

    .dialog-summary p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .dialog-grid {
      display: grid;
      gap: 0.75rem;
      padding: 0 1rem 0;
    }

    .dialog-grid textarea[matInput] {
      min-height: 72px;
    }

    .dialog-grid__full {
      grid-column: 1 / -1;
    }

    .upload-panel {
      display: grid;
      gap: 0.65rem;
      padding: 0.8rem;
      border: 1px solid rgba(37, 99, 235, 0.14);
      border-radius: 22px;
      background: #f8fbff;
    }

    .upload-panel__copy p {
      margin: 0.25rem 0 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .upload-panel__actions {
      display: flex;
      justify-content: flex-start;
    }

    .upload-placeholder,
    .uploaded-file {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 0.9rem;
      border-radius: 18px;
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .upload-placeholder {
      justify-content: flex-start;
      color: var(--muted);
    }

    .upload-placeholder .material-symbols-outlined {
      color: var(--primary);
    }

    .uploaded-file strong,
    .uploaded-file span {
      display: block;
    }

    .uploaded-file span {
      margin-top: 0.2rem;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .dialog-actions {
      padding: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentSubmitDialogComponent {
  readonly data = inject<AssignmentSubmitDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignmentSubmitDialogComponent, AssignmentSubmitPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);

  readonly uploading = signal(false);
  readonly uploadedFile = signal<AssignmentUploadResponse | null>(null);

  readonly form = this.formBuilder.group({
    submission_text: [''],
    submission_link: ['', [Validators.pattern(/^https?:\/\/.+/i)]]
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.studentPortalService.uploadAssignmentFile(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.uploadedFile.set(response);
          this.snackBar.open('Assignment file uploaded successfully.', 'Dismiss', { duration: 2800 });
        },
        error: (error: { error?: { detail?: string } }) => {
          this.uploading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to upload the assignment file.', 'Dismiss', { duration: 4200 });
        }
      });

    if (input) {
      input.value = '';
    }
  }

  removeFile(): void {
    this.uploadedFile.set(null);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const submissionText = value.submission_text?.trim() || null;
    const submissionLink = value.submission_link?.trim() || null;
    const uploadedFile = this.uploadedFile();

    if (!submissionText && !submissionLink && !uploadedFile) {
      this.snackBar.open('Add submission text, a valid link, or upload a file.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.dialogRef.close({
      submission_text: submissionText,
      submission_link: submissionLink,
      submission_file_url: uploadedFile?.file_url ?? null,
      submission_file_name: uploadedFile?.file_name ?? null,
      submission_file_size_bytes: uploadedFile?.file_size_bytes ?? null
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
