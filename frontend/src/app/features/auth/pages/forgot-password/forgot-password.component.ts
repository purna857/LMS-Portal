import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type { ForgotPasswordResponse } from '@app/core/models/auth.model';
import { AuthService } from '@app/core/services/auth.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...materialImports],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly devResetToken = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.devResetToken.set('');

    this.authService.requestPasswordReset(this.form.getRawValue()).subscribe({
      next: (response: ForgotPasswordResponse) => {
        this.loading.set(false);
        this.successMessage.set(response.message);
        this.devResetToken.set(response.reset_token ?? '');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(getApiErrorMessage(error, 'Unable to request a reset link right now.'));
      }
    });
  }
}
