import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '@app/core/services/auth.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...materialImports],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    token: [this.route.snapshot.queryParamMap.get('token') ?? '', [Validators.required]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit(): void {
    if (
      this.form.invalid ||
      this.form.value.new_password !== this.form.value.confirm_password ||
      this.loading()
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const raw = this.form.getRawValue();
    this.authService.resetPassword(raw).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.successMessage.set(response.message);
        setTimeout(() => {
          void this.router.navigate(['/auth/login']);
        }, 1200);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(getApiErrorMessage(error, 'Reset failed. Please request a new reset link.'));
      }
    });
  }
}
