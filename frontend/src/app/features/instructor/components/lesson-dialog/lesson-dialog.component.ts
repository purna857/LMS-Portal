import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { Lesson, LessonPayload } from '@app/features/instructor/models/instructor.models';
import { PortalDialogShellComponent } from '@app/shared/components/portal-dialog-shell/portal-dialog-shell.component';
import { materialImports } from '@app/shared/material/material-imports';


export interface LessonDialogData {
  mode: 'create' | 'edit';
  lesson?: Lesson;
}


@Component({
  selector: 'app-lesson-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, PortalDialogShellComponent, ...materialImports],
  template: `
    <app-portal-dialog-shell
      size="lg"
      eyebrow="Lesson builder"
      [title]="data.mode === 'create' ? 'Create Lesson' : 'Edit Lesson'"
      [description]="data.mode === 'create'
        ? 'Create a lesson with the right media type, ordering, and learner access level.'
        : 'Update the lesson details, content, and publishing state without leaving the modal.'"
      (closeRequested)="dialogRef.close()">
      <form dialogBody [formGroup]="form" class="dialog-grid dialog-grid--single" id="lesson-form" (ngSubmit)="submit()">
          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Lesson details</strong>
              <p>Set the lesson title, type, position, and publication state.</p>
            </div>

            <div class="dialog-grid">
              <mat-form-field appearance="outline" class="dialog-grid__full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Lesson Type</mat-label>
                <mat-select formControlName="lesson_type">
                  <mat-option value="video">Video</mat-option>
                  <mat-option value="text">Text</mat-option>
                  <mat-option value="resource_link">Resource Link</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="draft">Draft</mat-option>
                  <mat-option value="published">Published</mat-option>
                  <mat-option value="archived">Archived</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Position</mat-label>
                <input matInput type="number" formControlName="position" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Duration (Minutes)</mat-label>
                <input matInput type="number" formControlName="duration_minutes" />
              </mat-form-field>
            </div>
          </section>

          <section class="dialog-section">
            <div class="dialog-section__title">
              <strong>Content & access</strong>
              <p>Control preview access and provide the lesson content that matches the selected type.</p>
            </div>

            <div class="dialog-grid">
              <mat-checkbox formControlName="is_preview" class="dialog-grid__full">Allow preview access</mat-checkbox>

              @if (showContent()) {
                <mat-form-field appearance="outline" class="dialog-grid__full">
                  <mat-label>Content</mat-label>
                  <textarea matInput rows="5" formControlName="content"></textarea>
                </mat-form-field>
              }

              @if (showVideo()) {
                <mat-form-field appearance="outline" class="dialog-grid__full">
                  <mat-label>Video URL</mat-label>
                  <input matInput formControlName="video_url" />
                </mat-form-field>
              }

              @if (showResource()) {
                <mat-form-field appearance="outline" class="dialog-grid__full">
                  <mat-label>Resource URL</mat-label>
                  <input matInput formControlName="resource_url" />
                </mat-form-field>
              }
            </div>
          </section>
      </form>

      <div dialogFooter class="dialog-footer-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="lesson-form">
          {{ data.mode === 'create' ? 'Create Lesson' : 'Save Lesson' }}
        </button>
      </div>
    </app-portal-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LessonDialogComponent {
  readonly data = inject<LessonDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<LessonDialogComponent, LessonPayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group({
    title: [this.data.lesson?.title ?? '', [Validators.required, Validators.maxLength(255)]],
    lesson_type: [this.data.lesson?.lesson_type ?? 'text', [Validators.required]],
    content: [this.data.lesson?.content ?? ''],
    video_url: [this.data.lesson?.video_url ?? ''],
    resource_url: [this.data.lesson?.resource_url ?? ''],
    duration_minutes: [this.data.lesson?.duration_minutes ?? null],
    position: [this.data.lesson?.position ?? null],
    status: [this.data.lesson?.status ?? 'draft', [Validators.required]],
    is_preview: [this.data.lesson?.is_preview ?? false]
  });

  readonly showContent = computed(() => this.form.controls.lesson_type.value === 'text');
  readonly showVideo = computed(() => this.form.controls.lesson_type.value === 'video');
  readonly showResource = computed(() => this.form.controls.lesson_type.value === 'resource_link');

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      title: String(value.title ?? '').trim(),
      lesson_type: value.lesson_type,
      content: String(value.content ?? '').trim() || null,
      video_url: String(value.video_url ?? '').trim() || null,
      resource_url: String(value.resource_url ?? '').trim() || null,
      duration_minutes: value.duration_minutes === null ? null : Number(value.duration_minutes),
      position: value.position === null ? null : Number(value.position),
      status: value.status,
      is_preview: !!value.is_preview
    });
  }
}
