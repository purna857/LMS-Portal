import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '@app/core/services/auth.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...materialImports],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly portalStats = [
    {
      value: '120+',
      label: 'Courses',
      note: 'Lessons managed'
    },
    {
      value: '24/7',
      label: 'Access',
      note: 'Portal access'
    },
    {
      value: 'Role-based',
      label: 'Security',
      note: 'Secure sign-in'
    }
  ];
  readonly portalFeatures = [
    {
      icon: 'insights',
      title: 'Progress insights',
      description: 'Track learning activity, completion, and performance at a glance.'
    },
    {
      icon: 'groups',
      title: 'Role-based access',
      description: 'Admin, Instructor, and Student dashboards from one secure LMS workspace.'
    },
    {
      icon: 'sync',
      title: 'Live learning data',
      description: 'Courses, assignments, quizzes, progress, and notifications powered by the backend.'
    },
    {
      icon: 'verified_user',
      title: 'Secure sign-in',
      description: 'Role-aware navigation and JWT-backed access keep every workspace protected.'
    }
  ];

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  isInvalid(fieldName: 'email' | 'password'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  getErrorMessage(fieldName: 'email' | 'password'): string {
    const control = this.form.controls[fieldName];
    if (control.hasError('required')) {
      return fieldName === 'email' ? 'Email is required.' : 'Password is required.';
    }

    if (fieldName === 'email' && control.hasError('email')) {
      return 'Enter a valid email address.';
    }

    if (fieldName === 'password' && control.hasError('minlength')) {
      return 'Password must be at least 8 characters.';
    }

    return '';
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.form.getRawValue();

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl || '/app/dashboard');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(getApiErrorMessage(error, 'Login failed. Please try again.'));
      }
    });
  }
}
