import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { AssignmentGradePayload, AssignmentSubmission } from '@app/features/instructor/models/instructor.models';
import { materialImports } from '@app/shared/material/material-imports';


export interface AssignmentReviewDialogData {
  submission: AssignmentSubmission;
  maxScore: number;
}


@Component({
  selector: 'app-assignment-review-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ...materialImports],
  template: `
    <h2 mat-dialog-title>Review Submission</h2>

    <mat-dialog-content class="dialog-shell">
      <div class="summary-card">
        <strong>{{ data.submission.student_name }}</strong>
        <p>{{ data.submission.student_email }}</p>
        <mat-chip-set>
          <mat-chip>{{ data.submission.status }}</mat-chip>
          <mat-chip>{{ data.maxScore }} pts max</mat-chip>
          @if (data.submission.is_late) {
            <mat-chip>Late</mat-chip>
          }
        </mat-chip-set>
      </div>

      <div class="submission-preview">
        @if (data.submission.submission_text) {
          <section class="preview-panel">
            <span class="preview-panel__label">Submission text</span>
            <p>{{ data.submission.submission_text }}</p>
          </section>
        }

        @if (data.submission.submission_link) {
          <section class="preview-panel">
            <span class="preview-panel__label">Submission link</span>
            <a [href]="data.submission.submission_link" target="_blank" rel="noreferrer">
              {{ data.submission.submission_link }}
            </a>
          </section>
        }

        @if (data.submission.submission_file_url && data.submission.submission_file_name) {
          <section class="preview-panel">
            <span class="preview-panel__label">Uploaded file</span>
            <a [href]="data.submission.submission_file_url" target="_blank" rel="noreferrer">
              {{ data.submission.submission_file_name }}
            </a>
          </section>
        }
      </div>

      <form [formGroup]="form" class="dialog-grid">
        <mat-form-field appearance="outline">
          <mat-label>Score</mat-label>
          <input matInput type="number" formControlName="score" />
          @if (form.controls.score.invalid && form.controls.score.touched) {
            <mat-error>Enter a score between 0 and {{ data.maxScore }}.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="dialog-grid__full">
          <mat-label>Feedback</mat-label>
          <textarea matInput rows="5" formControlName="feedback"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">Save Review</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-shell {
      display: grid;
      gap: 1rem;
      width: min(92vw, 620px);
      max-width: 620px;
      overflow: hidden;
    }

    .dialog-grid {
      display: grid;
      gap: 1rem;
    }

    .dialog-grid__full {
      grid-column: 1 / -1;
    }

    .summary-card p {
      margin: 0.35rem 0 0.75rem;
      color: var(--muted);
    }

    .submission-preview {
      display: grid;
      gap: 0.85rem;
    }

    .preview-panel {
      padding: 0.95rem 1rem;
      border-radius: 18px;
      background: #f8fbff;
      border: 1px solid rgba(37, 99, 235, 0.1);
    }

    .preview-panel__label {
      display: block;
      margin-bottom: 0.35rem;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .preview-panel p,
    .preview-panel a {
      margin: 0;
      line-height: 1.55;
      word-break: break-word;
    }

    .preview-panel a {
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentReviewDialogComponent {
  readonly data = inject<AssignmentReviewDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignmentReviewDialogComponent, AssignmentGradePayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group({
    score: [this.data.submission.score ?? 0, [Validators.required, Validators.min(0), Validators.max(this.data.maxScore)]],
    feedback: [this.data.submission.feedback ?? '']
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      score: Number(value.score),
      feedback: value.feedback?.trim() || null
    });
  }
}
