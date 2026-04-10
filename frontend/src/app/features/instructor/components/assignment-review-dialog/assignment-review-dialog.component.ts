import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { AssignmentGradePayload, AssignmentSubmission } from '@app/features/instructor/models/instructor.models';
import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalFormGridComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface AssignmentReviewDialogData {
  submission: AssignmentSubmission;
  maxScore: number;
}


@Component({
  selector: 'app-assignment-review-dialog',
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
        eyebrow="Submission review"
        title="Review Submission"
        subtitle="Review the learner submission, confirm the score, and leave feedback before saving the grade."
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <app-modal-section [title]="data.submission.student_name" [description]="data.submission.student_email">
          <mat-chip-set>
            <mat-chip>{{ data.submission.status }}</mat-chip>
            <mat-chip>{{ data.maxScore }} pts max</mat-chip>
            @if (data.submission.is_late) {
              <mat-chip>Late</mat-chip>
            }
          </mat-chip-set>
        </app-modal-section>

        <div class="submission-preview">
          @if (data.submission.submission_text) {
            <app-modal-section title="Submission text">
              <p>{{ data.submission.submission_text }}</p>
            </app-modal-section>
          }

          @if (data.submission.submission_link) {
            <app-modal-section title="Submission link">
              <a [href]="data.submission.submission_link" target="_blank" rel="noreferrer">
                {{ data.submission.submission_link }}
              </a>
            </app-modal-section>
          }

          @if (data.submission.submission_file_url && data.submission.submission_file_name) {
            <app-modal-section title="Uploaded file">
              <a [href]="data.submission.submission_file_url" target="_blank" rel="noreferrer">
                {{ data.submission.submission_file_name }}
              </a>
            </app-modal-section>
          }
        </div>

        <form [formGroup]="form" id="assignment-review-form" (ngSubmit)="submit()">
          <app-modal-section
            title="Review & grade"
            description="Assign a score and provide feedback that helps the learner improve.">
            <app-modal-form-grid>
              <mat-form-field appearance="outline">
                <mat-label>Score</mat-label>
                <input matInput type="number" formControlName="score" />
                @if (form.controls.score.invalid && form.controls.score.touched) {
                  <mat-error>Enter a score between 0 and {{ data.maxScore }}.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Feedback</mat-label>
                <textarea matInput rows="5" formControlName="feedback"></textarea>
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="assignment-review-form">Save Review</button>
      </app-modal-footer>
    </app-base-modal>
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
