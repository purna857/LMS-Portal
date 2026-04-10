import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { QuizDetail, QuizPayload } from '@app/features/instructor/models/instructor.models';
import { PortalDialogShellComponent } from '@app/shared/components/portal-dialog-shell/portal-dialog-shell.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface QuizDialogData {
  mode: 'create' | 'edit';
  quiz?: QuizDetail;
}


@Component({
  selector: 'app-quiz-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, PortalDialogShellComponent, ...materialImports],
  template: `
    <app-portal-dialog-shell
      size="lg"
      eyebrow="Quiz builder"
      [title]="data.mode === 'create' ? 'Create Quiz' : 'Edit Quiz'"
      [description]="data.mode === 'create'
        ? 'Set up the quiz experience, scoring rules, and learner instructions in one clean panel.'
        : 'Adjust the quiz details, publishing status, and evaluation settings without leaving the screen.'"
      (closeRequested)="dialogRef.close()">
      <form dialogBody [formGroup]="form" class="dialog-grid dialog-grid--single" id="quiz-form" (ngSubmit)="submit()">
          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Quiz details</strong>
              <p>Define the quiz identity, learner instructions, and overall framing.</p>
            </div>

            <div class="dialog-grid">
              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Description</mat-label>
                <textarea matInput rows="3" formControlName="description"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Instructions</mat-label>
                <textarea matInput rows="4" formControlName="instructions"></textarea>
              </mat-form-field>
            </div>
          </section>

          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Scoring & delivery</strong>
              <p>Set the score thresholds, attempts, status, and question ordering behavior.</p>
            </div>

            <div class="dialog-grid">
              <mat-form-field appearance="outline">
                <mat-label>Passing Score</mat-label>
                <input matInput type="number" formControlName="passing_score" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Max Attempts</mat-label>
                <input matInput type="number" formControlName="max_attempts" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="draft">Draft</mat-option>
                  <mat-option value="published">Published</mat-option>
                  <mat-option value="archived">Archived</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-checkbox formControlName="shuffle_questions" class="dialog-grid__full">Shuffle questions for students</mat-checkbox>
            </div>
          </section>
      </form>

      <div dialogFooter class="dialog-footer-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="quiz-form">
          {{ data.mode === 'create' ? 'Create Quiz' : 'Save Quiz' }}
        </button>
      </div>
    </app-portal-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuizDialogComponent {
  readonly data = inject<QuizDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<QuizDialogComponent, QuizPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly form = this.formBuilder.group({
    title: [this.data.quiz?.title ?? '', [Validators.required, Validators.maxLength(255)]],
    description: [this.data.quiz?.description ?? ''],
    instructions: [this.data.quiz?.instructions ?? ''],
    passing_score: [this.data.quiz?.passing_score ?? null],
    max_attempts: [this.data.quiz?.max_attempts ?? 1, [Validators.required, Validators.min(1)]],
    shuffle_questions: [this.data.quiz?.shuffle_questions ?? false],
    status: [this.data.quiz?.status ?? 'draft', [Validators.required]]
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const passingScore = value.passing_score === null ? null : Number(value.passing_score);
    if (passingScore !== null && passingScore < 0) {
      this.snackBar.open('Passing score must be zero or greater.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.dialogRef.close({
      title: String(value.title ?? '').trim(),
      description: String(value.description ?? '').trim() || null,
      instructions: String(value.instructions ?? '').trim() || null,
      passing_score: passingScore,
      max_attempts: Number(value.max_attempts),
      shuffle_questions: !!value.shuffle_questions,
      status: value.status
    });
  }
}
