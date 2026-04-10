import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { QuizQuestion, QuizQuestionPayload } from '@app/features/instructor/models/instructor.models';
import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalFormGridComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface QuizQuestionDialogData {
  mode: 'create' | 'edit';
  question?: QuizQuestion;
}


@Component({
  selector: 'app-quiz-question-dialog',
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
    <app-base-modal size="xl">
      <app-modal-header
        eyebrow="Question editor"
        [title]="data.mode === 'create' ? 'Add Question' : 'Edit Question'"
        [subtitle]="data.mode === 'create'
        ? 'Add a question, define the point value, and build answer options that are easy to review.'
        : 'Refine the question text, scoring, and answer choices while preserving the quiz structure.'"
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <form [formGroup]="form" id="quiz-question-form" (ngSubmit)="submit()">
          <app-modal-section
            title="Question details"
            description="Write the prompt, define points, and set the grading behavior.">
            <app-modal-form-grid>
              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Question</mat-label>
                <textarea matInput rows="4" formControlName="question_text"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Points</mat-label>
                <input matInput type="number" formControlName="points" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Position</mat-label>
                <input matInput type="number" formControlName="position" />
              </mat-form-field>

              <mat-checkbox formControlName="allow_multiple_answers" class="modal-form-grid__full">Allow multiple correct answers</mat-checkbox>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Explanation</mat-label>
                <textarea matInput rows="3" formControlName="explanation"></textarea>
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>

          <app-modal-section
            title="Answer options"
            description="Add at least two options and mark the correct answer or answers that should pass grading.">
            <button sectionAction mat-stroked-button type="button" (click)="addOption()">Add Option</button>
            <div class="options-list" formArrayName="options">
              @for (option of options.controls; track $index) {
                <div class="option-row" [formGroupName]="$index">
                  <mat-form-field appearance="outline">
                    <mat-label>Option {{ $index + 1 }}</mat-label>
                    <input matInput formControlName="option_text" />
                  </mat-form-field>
                  <mat-checkbox formControlName="is_correct">Correct</mat-checkbox>
                  <button mat-icon-button type="button" [disabled]="options.length <= 2" (click)="removeOption($index)">
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              }
            </div>
          </app-modal-section>
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="quiz-question-form">
          {{ data.mode === 'create' ? 'Add Question' : 'Save Question' }}
        </button>
      </app-modal-footer>
    </app-base-modal>
  `,
  styles: [`
    .options-list {
      display: grid;
      gap: 0.95rem;
    }

    .option-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 0.85rem;
      align-items: center;
      padding: 1rem;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 20px;
      background: rgba(248, 251, 255, 0.78);
    }

    .option-row .mat-mdc-form-field {
      min-width: 0;
    }

    @media (max-width: 720px) {
      .option-row {
        grid-template-columns: 1fr;
        align-items: start;
      }

      .option-row > :last-child {
        justify-self: start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuizQuestionDialogComponent {
  readonly data = inject<QuizQuestionDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<QuizQuestionDialogComponent, QuizQuestionPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly form = this.formBuilder.group({
    question_text: [this.data.question?.question_text ?? '', [Validators.required]],
    explanation: [this.data.question?.explanation ?? ''],
    points: [this.data.question?.points ?? 1, [Validators.required, Validators.min(0.01)]],
    position: [this.data.question?.position ?? null, [Validators.min(1)]],
    allow_multiple_answers: [this.data.question?.allow_multiple_answers ?? false],
    options: this.formBuilder.array(
      (this.data.question?.options ?? [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false }
      ]).map((option) => this.createOption(option.option_text, option.is_correct))
    )
  });

  get options(): FormArray {
    return this.form.controls.options as FormArray;
  }

  addOption(): void {
    this.options.push(this.createOption('', false));
  }

  removeOption(index: number): void {
    if (this.options.length <= 2) {
      return;
    }
    this.options.removeAt(index);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const options = value.options
      .map((option) => ({
        option_text: String(option.option_text ?? '').trim(),
        is_correct: !!option.is_correct
      }))
      .filter((option) => option.option_text.length > 0);

    if (options.length < 2) {
      this.snackBar.open('Add at least two non-empty answer options.', 'Dismiss', { duration: 4000 });
      return;
    }

    const correctOptions = options.filter((option) => option.is_correct);
    if (!correctOptions.length) {
      this.snackBar.open('Mark at least one correct answer option.', 'Dismiss', { duration: 4000 });
      return;
    }

    if (!value.allow_multiple_answers && correctOptions.length !== 1) {
      this.snackBar.open('Single-answer questions must have exactly one correct option.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.dialogRef.close({
      question_text: String(value.question_text ?? '').trim(),
      explanation: String(value.explanation ?? '').trim() || null,
      points: Number(value.points),
      position: value.position === null ? null : Number(value.position),
      allow_multiple_answers: !!value.allow_multiple_answers,
      options
    });
  }

  private createOption(optionText: string, isCorrect: boolean) {
    return this.formBuilder.group({
      option_text: [optionText, [Validators.required]],
      is_correct: [isCorrect]
    });
  }
}
