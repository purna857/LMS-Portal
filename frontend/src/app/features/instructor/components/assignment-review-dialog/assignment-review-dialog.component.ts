import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { AssignmentGradePayload, AssignmentSubmission } from '@app/features/instructor/models/instructor.models';
import { PortalDialogShellComponent } from '@app/shared/components/portal-dialog-shell/portal-dialog-shell.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface AssignmentReviewDialogData {
  submission: AssignmentSubmission;
  maxScore: number;
}


@Component({
  selector: 'app-assignment-review-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, PortalDialogShellComponent, ...materialImports],
  template: `
    <app-portal-dialog-shell
      size="lg"
      eyebrow="Submission review"
      title="Review Submission"
      description="Review the learner submission, confirm the score, and leave feedback before saving the grade."
      (closeRequested)="dialogRef.close()">
      <div dialogBody class="dialog-grid dialog-grid--single" id="assignment-review-body">
        <section class="dialog-section">
          <div class="dialog-section__title">
            <strong>{{ data.submission.student_name }}</strong>
            <p>{{ data.submission.student_email }}</p>
          </div>
          <mat-chip-set>
            <mat-chip>{{ data.submission.status }}</mat-chip>
            <mat-chip>{{ data.maxScore }} pts max</mat-chip>
            @if (data.submission.is_late) {
              <mat-chip>Late</mat-chip>
            }
          </mat-chip-set>
        </section>

        <div class="submission-preview">
          @if (data.submission.submission_text) {
            <section class="dialog-section">
              <div class="dialog-section__title">
                <strong>Submission text</strong>
              </div>
              <p>{{ data.submission.submission_text }}</p>
            </section>
          }

          @if (data.submission.submission_link) {
            <section class="dialog-section">
              <div class="dialog-section__title">
                <strong>Submission link</strong>
              </div>
              <a [href]="data.submission.submission_link" target="_blank" rel="noreferrer">
                {{ data.submission.submission_link }}
              </a>
            </section>
          }

          @if (data.submission.submission_file_url && data.submission.submission_file_name) {
            <section class="dialog-section">
              <div class="dialog-section__title">
                <strong>Uploaded file</strong>
              </div>
              <a [href]="data.submission.submission_file_url" target="_blank" rel="noreferrer">
                {{ data.submission.submission_file_name }}
              </a>
            </section>
          }
        </div>

        <form [formGroup]="form" class="dialog-grid dialog-grid--single" id="assignment-review-form" (ngSubmit)="submit()">
          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Review & grade</strong>
              <p>Assign a score and provide feedback that helps the learner improve.</p>
            </div>

            <div class="dialog-grid">
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
            </div>
          </section>
        </form>
      </div>

      <div dialogFooter class="dialog-footer-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="assignment-review-form">Save Review</button>
      </div>
    </app-portal-dialog-shell>
  `,
  styles: [`
    .submission-preview {
      display: grid;
      gap: 0.85rem;
    }

    .submission-preview p,
    .submission-preview a {
      margin: 0;
      line-height: 1.55;
      word-break: break-word;
    }

    .submission-preview a {
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
