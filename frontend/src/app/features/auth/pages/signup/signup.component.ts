import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@app/core/services/auth.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { materialImports } from '@app/shared/material/material-imports';


type SignupMode = 'student' | 'instructor';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...materialImports],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly mode = signal<SignupMode>('student');

  readonly form = this.formBuilder.group({
    role: ['student' as SignupMode, [Validators.required]],
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, Validators.minLength(8)]],
    headline: ['', [Validators.maxLength(150)]],
    bio: [''],
    expertise: [''],
    experience_years: [null as number | null, [Validators.min(0)]],
    linkedin_url: [''],
    portfolio_url: [''],
    resume_file_url: ['']
  });

  readonly pageTitle = computed(() =>
    this.mode() === 'student' ? 'Create your learning account' : 'Apply as an instructor'
  );

  readonly pageDescription = computed(() =>
    this.mode() === 'student'
      ? 'Join the portal to access courses, assignments, quizzes, and progress tracking.'
      : 'Submit your teaching profile to create and manage courses once approved.'
  );

  switchMode(mode: SignupMode): void {
    this.mode.set(mode);
    this.form.controls.role.setValue(mode);
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  isInvalid(fieldName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  getErrorMessage(fieldName: keyof typeof this.form.controls): string {
    const control = this.form.controls[fieldName];
    if (control.hasError('required')) {
      const labels: Record<string, string> = {
        first_name: 'First name',
        last_name: 'Last name',
        email: 'Email',
        password: 'Password',
        confirm_password: 'Confirm password'
      };
      return `${labels[fieldName] ?? 'This field'} is required.`;
    }

    if (fieldName === 'email' && control.hasError('email')) {
      return 'Enter a valid email address.';
    }

    if ((fieldName === 'password' || fieldName === 'confirm_password') && control.hasError('minlength')) {
      return 'Password must be at least 8 characters.';
    }

    if ((fieldName === 'first_name' || fieldName === 'last_name') && control.hasError('maxlength')) {
      return 'Use 100 characters or fewer.';
    }

    if (fieldName === 'experience_years' && control.hasError('min')) {
      return 'Experience years cannot be negative.';
    }

    if (fieldName === 'headline' && control.hasError('maxlength')) {
      return 'Headline must be 150 characters or fewer.';
    }

    if (fieldName === 'phone' && control.hasError('maxlength')) {
      return 'Phone number must be 20 characters or fewer.';
    }

    if (fieldName === 'confirm_password' && this.form.value.password !== this.form.value.confirm_password) {
      return 'Passwords do not match.';
    }

    return '';
  }

  submit(): void {
    if (this.form.invalid || this.form.value.password !== this.form.value.confirm_password || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const raw = this.form.getRawValue();
    const commonPayload = {
      first_name: String(raw.first_name ?? '').trim(),
      last_name: String(raw.last_name ?? '').trim(),
      email: String(raw.email ?? '').trim().toLowerCase(),
      phone: String(raw.phone ?? '').trim() || null,
      password: String(raw.password ?? '')
    };

    const request$ = this.mode() === 'student'
      ? this.authService.signupStudent(commonPayload)
      : this.authService.signupInstructor({
          ...commonPayload,
          headline: String(raw.headline ?? '').trim() || null,
          bio: String(raw.bio ?? '').trim() || null,
          expertise: String(raw.expertise ?? '').trim() || null,
          experience_years: raw.experience_years ?? null,
          linkedin_url: String(raw.linkedin_url ?? '').trim() || null,
          portfolio_url: String(raw.portfolio_url ?? '').trim() || null,
          resume_file_url: String(raw.resume_file_url ?? '').trim() || null
        });

    request$.subscribe({
      next: (response) => {
        this.loading.set(false);
        this.successMessage.set(response.message);
        if (this.mode() === 'student') {
          setTimeout(() => {
            void this.router.navigate(['/auth/login']);
          }, 1200);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(getApiErrorMessage(error, 'Sign up failed. Please review the form and try again.'));
      }
    });
  }
}
