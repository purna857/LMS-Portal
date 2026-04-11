import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, startWith, switchMap, tap } from 'rxjs/operators';

import type { AdminUserListItem, AdminUserListResponse } from '@app/features/admin/models/admin.models';
import { AdminPortalService } from '@app/features/admin/services/admin-portal.service';
import type { EnrollmentResponse } from '@app/features/student/models/student.models';
import {
  BaseModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalFormGridComponent,
  ModalHeaderComponent,
  ModalSectionComponent
} from '@app/shared/components/base-modal/base-modal.component';
import { materialImports } from '@app/shared/material/material-imports';
import { chipToneForRole, chipToneForUserStatus } from '@app/shared/utils/chip-tone';


export interface AssignCourseDialogData {
  courseId: string;
  courseTitle: string;
}


@Component({
  selector: 'app-assign-course-dialog',
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
        eyebrow="Admin assignment"
        title="Assign Course"
        [subtitle]="'Choose a student to receive access to ' + data.courseTitle + '.'"
        closeLabel="Close assignment dialog"
        (closeRequested)="dialogRef.close()">
      </app-modal-header>

      <app-modal-body>
        <form [formGroup]="form" id="assign-course-form" class="assign-course-dialog" (ngSubmit)="confirm()">
          <app-modal-section
            title="Search students"
            description="Look up a student by name or email, then select the learner who should receive this course.">
            <app-modal-form-grid [columns]="1">
              <mat-form-field appearance="outline" class="modal-form-grid__full">
                <mat-label>Search students</mat-label>
                <input matInput formControlName="query" placeholder="Search by name or email" />
                <span matSuffix class="material-symbols-outlined assign-course-dialog__search-icon">search</span>
              </mat-form-field>
            </app-modal-form-grid>

            @if (loading()) {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }

            @if (searchError()) {
              <p class="assign-course-dialog__error">{{ searchError() }}</p>
            }

            @if (students().length) {
              <div class="assign-course-dialog__results">
                @for (student of students(); track student.id) {
                  <button
                    type="button"
                    class="assign-course-dialog__row"
                    [class.assign-course-dialog__row--selected]="selectedStudent()?.id === student.id"
                    [disabled]="assigning()"
                    (click)="selectStudent(student)">
                    <div class="assign-course-dialog__row-main">
                      <strong>{{ studentName(student) }}</strong>
                      <span>{{ student.email }}</span>
                    </div>

                    <div class="assign-course-dialog__row-meta">
                      <mat-chip-set class="assign-course-dialog__chips">
                        @for (role of student.roles; track role) {
                          <mat-chip [attr.data-tone]="chipToneForRole(role)">{{ roleLabel(role) }}</mat-chip>
                        }
                        @if (student.email_verified) {
                          <mat-chip data-tone="success">Verified</mat-chip>
                        }
                        <mat-chip [attr.data-tone]="chipToneForUserStatus(student.status)">{{ userStatusLabel(student.status) }}</mat-chip>
                      </mat-chip-set>
                    </div>
                  </button>
                }
              </div>
            } @else if (!loading()) {
              <div class="assign-course-dialog__empty">
                <span class="material-symbols-outlined">manage_search</span>
                <strong>No matching students</strong>
                <p>Try a different name or email address.</p>
              </div>
            }

            @if (selectedStudent(); as selected) {
              <div class="assign-course-dialog__selected">
                <div class="assign-course-dialog__selected-copy">
                  <p>Selected student</p>
                  <strong>{{ studentName(selected) }}</strong>
                  <span>{{ selected.email }}</span>
                </div>

                <mat-chip-set>
                  <mat-chip [attr.data-tone]="chipToneForUserStatus(selected.status)">{{ userStatusLabel(selected.status) }}</mat-chip>
                </mat-chip-set>
              </div>
            }
          </app-modal-section>
        </form>
      </app-modal-body>

      <app-modal-footer>
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" form="assign-course-form" [disabled]="!selectedStudent() || assigning()">
          {{ assigning() ? 'Assigning...' : 'Assign Course' }}
        </button>
      </app-modal-footer>
    </app-base-modal>
  `,
  styles: [`
    .assign-course-dialog {
      display: grid;
      gap: 1rem;
      width: min(92vw, 760px);
    }

    .assign-course-dialog__search-icon {
      color: var(--muted);
      font-size: 1.15rem;
      line-height: 1;
    }

    .assign-course-dialog__error {
      margin: 0.2rem 0 0;
      color: #c83c3c;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .assign-course-dialog__results {
      display: grid;
      gap: 0.75rem;
      margin-top: 0.15rem;
    }

    .assign-course-dialog__row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      width: 100%;
      padding: 0.95rem 1rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: #ffffff;
      text-align: left;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
    }

    .assign-course-dialog__row:hover:not([disabled]) {
      border-color: rgba(37, 99, 235, 0.22);
      box-shadow: 0 10px 28px rgba(37, 99, 235, 0.08);
      transform: translateY(-1px);
    }

    .assign-course-dialog__row--selected {
      border-color: rgba(37, 99, 235, 0.38);
      background: linear-gradient(180deg, rgba(243, 247, 255, 0.92), rgba(255, 255, 255, 1));
      box-shadow: 0 12px 30px rgba(37, 99, 235, 0.1);
    }

    .assign-course-dialog__row-main {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .assign-course-dialog__row-main strong {
      color: var(--text);
      font-size: 0.98rem;
      line-height: 1.25;
    }

    .assign-course-dialog__row-main span {
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.4;
    }

    .assign-course-dialog__row-meta {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      min-width: 0;
    }

    .assign-course-dialog__chips {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .assign-course-dialog__selected {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1rem;
      border-radius: 18px;
      border: 1px solid rgba(37, 99, 235, 0.14);
      background: linear-gradient(180deg, rgba(248, 251, 255, 0.98), rgba(255, 255, 255, 1));
    }

    .assign-course-dialog__selected-copy {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }

    .assign-course-dialog__selected-copy p {
      margin: 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .assign-course-dialog__selected-copy strong {
      color: var(--text);
      font-size: 0.98rem;
      line-height: 1.25;
    }

    .assign-course-dialog__selected-copy span {
      color: var(--muted);
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .assign-course-dialog__empty {
      display: grid;
      justify-items: center;
      gap: 0.3rem;
      padding: 1.1rem 1rem;
      border-radius: 18px;
      border: 1px dashed rgba(148, 163, 184, 0.24);
      background: rgba(248, 250, 255, 0.75);
      text-align: center;
    }

    .assign-course-dialog__empty .material-symbols-outlined {
      color: var(--primary);
      font-size: 1.25rem;
    }

    .assign-course-dialog__empty strong {
      color: var(--text);
      font-size: 0.95rem;
    }

    .assign-course-dialog__empty p {
      margin: 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.45;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignCourseDialogComponent {
  readonly data = inject<AssignCourseDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignCourseDialogComponent, EnrollmentResponse | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminPortalService = inject(AdminPortalService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly assigning = signal(false);
  readonly students = signal<AdminUserListItem[]>([]);
  readonly selectedStudent = signal<AdminUserListItem | null>(null);
  readonly searchError = signal('');

  readonly form = this.formBuilder.group({
    query: ['']
  });

  readonly chipToneForRole = chipToneForRole;
  readonly chipToneForUserStatus = chipToneForUserStatus;

  constructor() {
    this.form.controls.query.valueChanges.pipe(
      startWith(this.form.controls.query.value ?? ''),
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => {
        this.loading.set(true);
        this.searchError.set('');
      }),
      switchMap((query) =>
        this.adminPortalService.listUsers({
          role: 'student',
          search: String(query ?? '').trim() || undefined,
          limit: 8,
          offset: 0
        }).pipe(
          catchError((error: HttpErrorResponse) => {
            this.searchError.set(error.error?.detail ?? 'Unable to load students.');
            return of<AdminUserListResponse>({ items: [], total: 0, limit: 8, offset: 0 });
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.students.set(response.items);
      this.loading.set(false);
    });
  }

  selectStudent(student: AdminUserListItem): void {
    this.selectedStudent.set(student);
  }

  confirm(): void {
    const selected = this.selectedStudent();
    if (!selected || this.assigning()) {
      return;
    }

    this.assigning.set(true);
    this.adminPortalService.assignCourse({
      course_id: this.data.courseId,
      student_id: selected.id
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assigning.set(false);
          this.snackBar.open(`Assigned ${this.data.courseTitle} to ${this.studentName(selected)}.`, 'Dismiss', { duration: 3200 });
          this.dialogRef.close(response);
        },
        error: (error: HttpErrorResponse) => {
          this.assigning.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to assign the course.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  studentName(student: AdminUserListItem): string {
    return `${student.first_name} ${student.last_name}`.trim() || student.email;
  }

  roleLabel(role: string): string {
    if (!role) {
      return 'Role';
    }

    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  userStatusLabel(status: string): string {
    if (!status) {
      return 'Unknown';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
