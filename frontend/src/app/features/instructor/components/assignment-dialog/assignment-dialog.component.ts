import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { Assignment, AssignmentPayload, CourseModule, Lesson } from '@app/features/instructor/models/instructor.models';
import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalFormGridComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface AssignmentDialogData {
  mode: 'create' | 'edit';
  assignment?: Assignment;
  modules: CourseModule[];
  lessons: Lesson[];
}


@Component({
  selector: 'app-assignment-dialog',
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
        eyebrow="Assignment builder"
        [title]="data.mode === 'create' ? 'Create Assignment' : 'Edit Assignment'"
        [subtitle]="data.mode === 'create'
        ? 'Create an assignment with module binding, due dates, and scoring details ready for students.'
        : 'Update the assignment structure, rules, and publishing state from a single focused modal.'"
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <form [formGroup]="form" id="assignment-form" (ngSubmit)="submit()">
          <app-modal-section
            title="Assignment details"
            description="Attach the assignment to the right course structure and set the scoring model.">
            <app-modal-form-grid>
              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Module</mat-label>
                <mat-select formControlName="module_id">
                  <mat-option [value]="null">Course-level</mat-option>
                  @for (module of data.modules; track module.id) {
                    <mat-option [value]="module.id">{{ module.title }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Lesson</mat-label>
                <mat-select formControlName="lesson_id">
                  <mat-option [value]="null">No lesson binding</mat-option>
                  @for (lesson of filteredLessons(); track lesson.id) {
                    <mat-option [value]="lesson.id">{{ lesson.title }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Max Score</mat-label>
                <input matInput type="number" formControlName="max_score" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Pass Score</mat-label>
                <input matInput type="number" formControlName="pass_score" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Due Date</mat-label>
                <input matInput type="datetime-local" formControlName="due_at" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="draft">Draft</mat-option>
                  <mat-option value="published">Published</mat-option>
                  <mat-option value="closed">Closed</mat-option>
                  <mat-option value="archived">Archived</mat-option>
                </mat-select>
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>

          <app-modal-section
            title="Submission rules"
            description="Set delivery expectations, supporting copy, and timing flexibility for learners.">
            <app-modal-form-grid>
              <mat-checkbox formControlName="allow_late_submission" class="modal-form-grid__full">Allow late submissions</mat-checkbox>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Description</mat-label>
                <textarea matInput rows="3" formControlName="description"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Instructions</mat-label>
                <textarea matInput rows="5" formControlName="instructions"></textarea>
              </mat-form-field>
            </app-modal-form-grid>
          </app-modal-section>
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="assignment-form">
          {{ data.mode === 'create' ? 'Create Assignment' : 'Save Assignment' }}
        </button>
      </app-modal-footer>
    </app-base-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentDialogComponent {
  readonly data = inject<AssignmentDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignmentDialogComponent, AssignmentPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.formBuilder.group({
    module_id: [this.data.assignment?.module_id ?? null],
    lesson_id: [this.data.assignment?.lesson_id ?? null],
    title: [this.data.assignment?.title ?? '', [Validators.required, Validators.maxLength(255)]],
    description: [this.data.assignment?.description ?? ''],
    instructions: [this.data.assignment?.instructions ?? ''],
    max_score: [this.data.assignment?.max_score ?? 100, [Validators.required, Validators.min(0)]],
    pass_score: [this.data.assignment?.pass_score ?? null],
    due_at: [this.toDateInput(this.data.assignment?.due_at)],
    allow_late_submission: [this.data.assignment?.allow_late_submission ?? false],
    status: [this.data.assignment?.status ?? 'draft', [Validators.required]]
  });

  constructor() {
    this.form.controls.module_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((moduleId) => {
      const lessonId = this.form.controls.lesson_id.value;
      if (!lessonId) {
        return;
      }

      const availableLessonIds = new Set(
        (moduleId ? this.data.lessons.filter((lesson) => lesson.module_id === moduleId) : this.data.lessons)
          .map((lesson) => lesson.id)
      );

      if (!availableLessonIds.has(lessonId)) {
        this.form.patchValue({ lesson_id: null }, { emitEvent: false });
      }
      });
  }

  readonly filteredLessons = () => {
    const moduleId = this.form.controls.module_id.value;
    return moduleId ? this.data.lessons.filter((lesson) => lesson.module_id === moduleId) : this.data.lessons;
  };

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const maxScore = Number(value.max_score);
    const passScore = value.pass_score === null ? null : Number(value.pass_score);
    if (passScore !== null && passScore > maxScore) {
      this.snackBar.open('Pass score cannot exceed the max score.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.dialogRef.close({
      module_id: value.module_id || null,
      lesson_id: value.lesson_id || null,
      title: String(value.title ?? '').trim(),
      description: String(value.description ?? '').trim() || null,
      instructions: String(value.instructions ?? '').trim() || null,
      max_score: maxScore,
      pass_score: passScore,
      due_at: value.due_at ? new Date(value.due_at).toISOString() : null,
      allow_late_submission: !!value.allow_late_submission,
      status: value.status
    });
  }

  private toDateInput(value?: string | null): string {
    if (!value) {
      return '';
    }
    return new Date(value).toISOString().slice(0, 16);
  }
}
