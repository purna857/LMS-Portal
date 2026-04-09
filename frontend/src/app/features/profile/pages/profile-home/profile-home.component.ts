import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { CurrentProfileResponse } from '@app/core/models/profile.model';
import { ProfileService } from '@app/core/services/profile.service';
import { SessionService } from '@app/core/services/session.service';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';


@Component({
  selector: 'app-profile-home',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Profile"
        title="Profile & Settings"
        description="Maintain your account details, profile metadata, and security settings from one secure workspace.">
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="profile-layout">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Account Summary</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="identity-card">
              <span class="identity-card__avatar">{{ initials() }}</span>
              <div>
                <strong>{{ profile()?.first_name }} {{ profile()?.last_name }}</strong>
                <p>{{ profile()?.email }}</p>
              </div>
            </div>

            <mat-chip-set class="chip-row">
              @for (role of profile()?.roles ?? []; track role) {
                <mat-chip>{{ role }}</mat-chip>
              }
            </mat-chip-set>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Profile Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="profileForm" class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="first_name" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="last_name" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Headline</mat-label>
                <input matInput formControlName="headline" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Country</mat-label>
                <input matInput formControlName="country" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City</mat-label>
                <input matInput formControlName="city" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Website</mat-label>
                <input matInput formControlName="website_url" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Timezone</mat-label>
                <input matInput formControlName="timezone" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-grid__full">
                <mat-label>Bio</mat-label>
                <textarea matInput rows="5" formControlName="bio"></textarea>
              </mat-form-field>
            </form>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-flat-button color="primary" type="button" (click)="saveProfile()">Save Profile</button>
          </mat-card-actions>
        </mat-card>
      </div>

      <mat-card class="surface-card">
        <mat-card-header>
          <mat-card-title>Security Settings</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="passwordForm" class="toolbar-grid">
            <mat-form-field appearance="outline">
              <mat-label>Current Password</mat-label>
              <input matInput type="password" formControlName="current_password" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>New Password</mat-label>
              <input matInput type="password" formControlName="new_password" />
            </mat-form-field>

            <div class="toolbar-grid__actions">
              <button mat-flat-button color="primary" type="button" (click)="changePassword()">Update Password</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .profile-layout {
      display: grid;
      grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.25fr);
      gap: 1.25rem;
    }

    .identity-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .identity-card__avatar {
      display: grid;
      place-items: center;
      width: 3.25rem;
      height: 3.25rem;
      border-radius: 20px;
      background: var(--primary-soft);
      color: var(--primary);
      font-weight: 700;
      font-size: 1.25rem;
    }

    .identity-card p {
      margin: 0.3rem 0 0;
      color: var(--muted);
    }

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .form-grid__full {
      grid-column: 1 / -1;
    }

    @media (max-width: 980px) {
      .profile-layout,
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileHomeComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly sessionService = inject(SessionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly profile = signal<CurrentProfileResponse | null>(null);
  readonly initials = computed(() => {
    const profile = this.profile();
    if (!profile) {
      const fallback = this.sessionService.user();
      return `${fallback?.first_name?.charAt(0) ?? ''}${fallback?.last_name?.charAt(0) ?? ''}`.trim() || 'U';
    }
    return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.trim();
  });

  readonly profileForm = this.formBuilder.group({
    first_name: ['', [Validators.required]],
    last_name: ['', [Validators.required]],
    phone: [''],
    headline: [''],
    country: [''],
    city: [''],
    website_url: [''],
    timezone: [''],
    bio: ['']
  });

  readonly passwordForm = this.formBuilder.group({
    current_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    this.profileService.getCurrentProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.profileForm.patchValue({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone ?? '',
            headline: profile.profile?.headline ?? '',
            country: profile.profile?.country ?? '',
            city: profile.profile?.city ?? '',
            website_url: profile.profile?.website_url ?? '',
            timezone: profile.profile?.timezone ?? '',
            bio: profile.profile?.bio ?? ''
          });
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.snackBar.open(error.error?.detail ?? 'Unable to load profile settings.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      return;
    }

    const value = this.profileForm.getRawValue();
    this.profileService.updateCurrentProfile({
      first_name: String(value.first_name ?? '').trim(),
      last_name: String(value.last_name ?? '').trim(),
      phone: String(value.phone ?? '').trim() || null,
      headline: String(value.headline ?? '').trim() || null,
      country: String(value.country ?? '').trim() || null,
      city: String(value.city ?? '').trim() || null,
      website_url: String(value.website_url ?? '').trim() || null,
      timezone: String(value.timezone ?? '').trim() || null,
      bio: String(value.bio ?? '').trim() || null
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.snackBar.open('Profile updated successfully.', 'Dismiss', { duration: 3200 });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update profile.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) {
      return;
    }

    const value = this.passwordForm.getRawValue();
    this.profileService.changePassword({
      current_password: String(value.current_password ?? ''),
      new_password: String(value.new_password ?? '')
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.passwordForm.reset();
          this.snackBar.open(response.message, 'Dismiss', { duration: 3200 });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to change password.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}
