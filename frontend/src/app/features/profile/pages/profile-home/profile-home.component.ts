import { formatDate } from '@angular/common';
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


type ProfileFact = {
  label: string;
  value: string;
  detail: string;
};

@Component({
  selector: 'app-profile-home',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Profile"
        title="Profile & Settings"
        description="Maintain your account details, avatar, profile metadata, and security settings from one secure workspace.">
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="profile-layout">
        <mat-card class="surface-card profile-summary-card">
          <mat-card-content>
            <div class="profile-summary">
              <div class="profile-summary__hero">
                <div class="profile-avatar">
                  @if (avatarUrl()) {
                    <img [src]="avatarUrl()" [alt]="displayName()" />
                  } @else {
                    <span>{{ initials() }}</span>
                  }
                </div>

                <div class="profile-summary__copy">
                  <p class="profile-summary__eyebrow">Account Summary</p>
                  <h2>{{ displayName() }}</h2>
                  <p class="profile-summary__headline">{{ headlineText() }}</p>
                  <p class="profile-summary__email">{{ emailAddress() }}</p>

                  <mat-chip-set class="profile-chip-row">
                    @for (role of roleLabels(); track role) {
                      <mat-chip class="profile-chip profile-chip--role">{{ role }}</mat-chip>
                    }
                    <mat-chip class="profile-chip profile-chip--status">{{ statusLabel() }}</mat-chip>
                    <mat-chip class="profile-chip" [class.profile-chip--success]="profile()?.email_verified">
                      {{ profile()?.email_verified ? 'Email verified' : 'Email pending' }}
                    </mat-chip>
                  </mat-chip-set>

                  <div class="profile-summary__actions">
                    <input
                      #avatarInput
                      class="profile-summary__file"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      (change)="onAvatarSelected($event)" />
                    <button mat-stroked-button type="button" class="profile-summary__upload" (click)="avatarInput.click()">
                      <span class="material-symbols-outlined" aria-hidden="true">photo_camera</span>
                      Upload photo
                    </button>
                    @if (avatarUrl()) {
                      <button mat-button type="button" class="profile-summary__remove" (click)="clearAvatar()">
                        Remove photo
                      </button>
                    }
                  </div>
                  <p class="profile-summary__hint">PNG, JPG, or WEBP. Up to 5 MB.</p>
                </div>
              </div>

              <div class="profile-facts">
                @for (fact of profileFacts(); track fact.label) {
                  <article class="profile-fact">
                    <span class="profile-fact__label">{{ fact.label }}</span>
                    <strong>{{ fact.value }}</strong>
                    <p>{{ fact.detail }}</p>
                  </article>
                }
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card profile-form-card">
          <mat-card-header class="profile-form-card__header">
            <div>
              <mat-card-title>Profile Details</mat-card-title>
              <p class="profile-form-card__subtitle">Update how your profile appears across the LMS.</p>
            </div>
            <span class="profile-form-card__badge">Live sync</span>
          </mat-card-header>

          <mat-card-content>
            <form [formGroup]="profileForm" class="profile-form">
              <div class="profile-form__section">
                <p class="profile-form__eyebrow">Identity</p>
                <div class="form-grid">
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
                </div>
              </div>

              <div class="profile-form__section">
                <p class="profile-form__eyebrow">Location</p>
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Country</mat-label>
                    <input matInput formControlName="country" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>State</mat-label>
                    <input matInput formControlName="state" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>City</mat-label>
                    <input matInput formControlName="city" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Postal Code</mat-label>
                    <input matInput formControlName="postal_code" />
                  </mat-form-field>
                </div>
              </div>

              <div class="profile-form__section">
                <p class="profile-form__eyebrow">Preferences</p>
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Timezone</mat-label>
                    <input matInput formControlName="timezone" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Language</mat-label>
                    <input matInput formControlName="language" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Date of Birth</mat-label>
                    <input matInput [matDatepicker]="dobPicker" formControlName="date_of_birth" readonly />
                    <mat-datepicker-toggle matIconSuffix [for]="dobPicker"></mat-datepicker-toggle>
                    <mat-datepicker #dobPicker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Website</mat-label>
                    <input matInput formControlName="website_url" />
                  </mat-form-field>
                </div>
              </div>

              <div class="profile-form__section">
                <p class="profile-form__eyebrow">About You</p>
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="form-grid__full">
                    <mat-label>Bio</mat-label>
                    <textarea matInput rows="5" formControlName="bio"></textarea>
                  </mat-form-field>
                </div>
              </div>
            </form>
          </mat-card-content>

          <mat-card-actions align="end">
            <button mat-flat-button color="primary" type="button" (click)="saveProfile()">Save Profile</button>
          </mat-card-actions>
        </mat-card>
      </div>

      <mat-card class="surface-card profile-security-card">
        <mat-card-header class="profile-security-card__header">
          <div>
            <mat-card-title>Security Settings</mat-card-title>
            <p class="profile-security-card__subtitle">Keep your account protected with a strong password.</p>
          </div>
          <span class="profile-security-card__badge">Secure</span>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="passwordForm" class="toolbar-grid toolbar-grid--security">
            <mat-form-field appearance="outline">
              <mat-label>Current Password</mat-label>
              <input matInput type="password" formControlName="current_password" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>New Password</mat-label>
              <input matInput type="password" formControlName="new_password" />
            </mat-form-field>

            <div class="toolbar-grid__actions toolbar-grid__actions--security">
              <button mat-flat-button color="primary" type="button" (click)="changePassword()">Update Password</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'IBM Plex Sans', sans-serif !important;
    }

    .page-section {
      display: grid;
      gap: 1.1rem;
    }

    .profile-layout {
      display: grid;
      grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.48fr);
      gap: 1.25rem;
      align-items: start;
    }

    .profile-summary-card,
    .profile-form-card,
    .profile-security-card {
      position: relative;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(251, 253, 255, 0.99));
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.045);
      overflow: hidden;
    }

    .profile-summary-card mat-card-content,
    .profile-form-card mat-card-content,
    .profile-security-card mat-card-content {
      padding: 1.35rem 1.4rem 1.1rem;
    }

    .profile-summary {
      display: grid;
      gap: 1rem;
    }

    .profile-summary__hero {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 1.1rem;
      align-items: start;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .profile-avatar {
      display: grid;
      place-items: center;
      width: 104px;
      height: 104px;
      border-radius: 32px;
      background:
        radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 28%),
        linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(20, 184, 166, 0.12));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.82),
        0 16px 30px rgba(37, 99, 235, 0.08);
      color: var(--primary);
      overflow: hidden;
      flex-shrink: 0;
    }

    .profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-avatar span {
      font-size: 2.15rem;
      font-weight: 800;
      letter-spacing: -0.05em;
    }

    .profile-summary__copy {
      display: grid;
      gap: 0.35rem;
      align-content: start;
      max-width: 40rem;
    }

    .profile-summary__eyebrow,
    .profile-form__eyebrow {
      margin: 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.76rem;
      font-weight: 800;
    }

    .profile-summary__copy h2 {
      margin: 0;
      font-size: clamp(1.48rem, 2vw, 1.95rem);
      line-height: 1.02;
      letter-spacing: -0.05em;
      color: var(--primary-strong);
    }

    .profile-summary__headline {
      margin: 0;
      color: var(--primary-strong);
      font-size: 0.9rem;
      font-weight: 600;
      line-height: 1.5;
    }

    .profile-summary__email {
      margin: 0;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.5;
    }

    .profile-chip-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 0.5rem;
      margin-top: 0.2rem;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      overflow: visible;
    }

    :host ::ng-deep .profile-chip-row.mat-mdc-chip-set {
      display: grid !important;
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      justify-content: start;
      width: fit-content;
      max-width: 100%;
    }

    .profile-chip {
      border-radius: 999px !important;
      background: #f8fafc !important;
      color: #42607f !important;
      font-weight: 700;
      border: 0 !important;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04) !important;
      --mdc-chip-outline-width: 0;
      --mdc-chip-outline-color: transparent;
      --mdc-chip-container-height: 28px;
      padding-inline: 0.05rem;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .profile-chip--role {
      background: #f8fafc !important;
      color: #334155 !important;
    }

    .profile-chip--status {
      background: #edf4ff !important;
      color: var(--primary) !important;
    }

    .profile-chip--success {
      background: #f0fdf4 !important;
      color: #166534 !important;
    }

    .profile-chip-row .profile-chip .mdc-evolution-chip__text-label,
    .profile-chip-row .profile-chip .mat-mdc-chip-action-label {
      color: inherit !important;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .profile-summary__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
      margin-top: 0.2rem;
    }

    .profile-summary__file {
      display: none;
    }

    .profile-summary__upload,
    .profile-summary__remove {
      min-width: 0;
      height: 2.2rem;
      padding: 0 0.95rem;
      border-radius: 999px !important;
      font-family: 'IBM Plex Sans', sans-serif !important;
      font-size: 0.84rem;
      font-weight: 700;
    }

    .profile-summary__upload {
      color: var(--primary) !important;
      border-color: rgba(37, 99, 235, 0.14) !important;
      background: rgba(237, 244, 255, 0.72) !important;
    }

    .profile-summary__upload .material-symbols-outlined {
      margin-right: 0.35rem;
      font-size: 1rem;
      line-height: 1;
    }

    .profile-summary__remove {
      color: var(--muted) !important;
    }

    .profile-summary__hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .profile-facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }

    .profile-fact {
      display: grid;
      gap: 0.22rem;
      padding: 0.92rem 1rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(250, 252, 255, 0.98));
      box-shadow: 0 7px 16px rgba(15, 23, 42, 0.028);
    }

    .profile-fact__label {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .profile-fact strong {
      color: var(--primary-strong);
      font-size: 1rem;
      line-height: 1.28;
      overflow-wrap: anywhere;
    }

    .profile-fact p {
      margin: 0;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .profile-form-card__header,
    .profile-security-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 1.2rem 1.2rem 0;
    }

    .profile-form-card__subtitle,
    .profile-security-card__subtitle {
      margin: 0.35rem 0 0;
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .profile-form-card__badge,
    .profile-security-card__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary);
      font-weight: 800;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      white-space: nowrap;
    }

    .profile-form {
      display: grid;
      gap: 1rem;
    }

    .profile-form__section {
      display: grid;
      gap: 0.7rem;
    }

    .profile-form__section .mat-mdc-form-field {
      font-size: 0.92rem;
    }

    .profile-form__section .mat-mdc-text-field-wrapper {
      border-radius: 18px;
    }

    .profile-form__section .mat-mdc-form-field .mat-mdc-floating-label {
      font-size: 0.82rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.1rem;
    }

    .form-grid__full {
      grid-column: 1 / -1;
    }

    .toolbar-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
      gap: 1.05rem;
      align-items: end;
    }

    .toolbar-grid--security {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      align-items: center;
    }

    .toolbar-grid__actions {
      display: flex;
      justify-content: flex-end;
    }

    .toolbar-grid__actions--security {
      align-self: center;
    }

    .toolbar-grid__actions--security button {
      width: auto;
      min-width: 10.5rem;
      height: 2.8rem;
      min-height: 2.8rem;
      padding-inline: 1.15rem;
    }

    .toolbar-grid--security .mat-mdc-form-field {
      width: 100%;
      min-width: 0;
    }

    .profile-form-card mat-card-actions,
    .profile-security-card mat-card-actions {
      padding: 0 1.4rem 1.35rem;
    }

    .profile-form-card button,
    .profile-security-card button {
      min-width: 0;
      height: 2.4rem;
      padding: 0 1rem;
      border-radius: 999px !important;
      font-family: 'IBM Plex Sans', sans-serif !important;
      font-size: 0.86rem;
      font-weight: 700;
    }

    .profile-form-card button[mat-flat-button],
    .profile-security-card button[mat-flat-button] {
      color: #ffffff !important;
      background: var(--primary) !important;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.16);
    }

    @media (max-width: 1080px) {
      .profile-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 980px) {
      .toolbar-grid,
      .form-grid,
      .profile-facts {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .profile-summary__hero {
        grid-template-columns: 1fr;
      }

      .profile-avatar {
        width: 74px;
        height: 74px;
        border-radius: 22px;
      }

      .profile-form-card__header,
      .profile-security-card__header {
        flex-direction: column;
      }

      .profile-form-card mat-card-actions,
      .profile-security-card mat-card-actions {
        padding-inline: 1rem;
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
  readonly avatarPreviewUrl = signal<string | null>(null);
  readonly displayName = computed(() => {
    const profile = this.profile();
    const fallback = this.sessionService.user();
    const firstName = profile?.first_name ?? fallback?.first_name ?? '';
    const lastName = profile?.last_name ?? fallback?.last_name ?? '';
    return `${firstName} ${lastName}`.trim() || 'Profile';
  });
  readonly emailAddress = computed(() => this.profile()?.email ?? this.sessionService.user()?.email ?? 'No email available');
  readonly avatarUrl = computed(() =>
    this.avatarPreviewUrl() !== null
      ? this.avatarPreviewUrl() ?? ''
      : this.profile()?.profile?.avatar_url?.trim() ?? ''
  );
  readonly headlineText = computed(() => this.profile()?.profile?.headline?.trim() || 'Student profile');
  readonly roleLabels = computed(() => (this.profile()?.roles ?? this.sessionService.user()?.roles ?? []).map((role) => this.formatLabel(role)));
  readonly statusLabel = computed(() => this.formatLabel(this.profile()?.status ?? 'active'));
  readonly locationLabel = computed(() => {
    const profile = this.profile()?.profile;
    return [profile?.city, profile?.state, profile?.country].filter(Boolean).join(', ') || 'Location not set';
  });
  readonly timezoneLabel = computed(() => this.profile()?.profile?.timezone?.trim() || 'Timezone not set');
  readonly joinedLabel = computed(() => this.formatProfileDate(this.profile()?.profile?.created_at) || 'Recent');
  readonly updatedLabel = computed(() => this.formatProfileDate(this.profile()?.profile?.updated_at) || 'Not updated yet');
  readonly profileFacts = computed<ProfileFact[]>(() => [
    {
      label: 'Status',
      value: this.statusLabel(),
      detail: this.profile()?.is_superuser ? 'Administrator access' : 'Role-based account'
    },
    {
      label: 'Email',
      value: this.profile()?.email_verified ? 'Verified' : 'Pending',
      detail: this.emailAddress()
    },
    {
      label: 'Location',
      value: this.locationLabel(),
      detail: this.timezoneLabel()
    },
    {
      label: 'Updated',
      value: this.updatedLabel(),
      detail: `Joined ${this.joinedLabel()}`
    }
  ]);
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
    avatar_url: [''],
    country: [''],
    state: [''],
    city: [''],
    postal_code: [''],
    website_url: [''],
    timezone: [''],
    language: [''],
    date_of_birth: [null as string | Date | null],
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
          this.avatarPreviewUrl.set(null);
          this.sessionService.patchUser({
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
            status: profile.status,
            avatar_url: profile.profile?.avatar_url ?? null
          });
          this.profileForm.patchValue({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone ?? '',
            headline: profile.profile?.headline ?? '',
            avatar_url: profile.profile?.avatar_url ?? '',
            country: profile.profile?.country ?? '',
            state: profile.profile?.state ?? '',
            city: profile.profile?.city ?? '',
            postal_code: profile.profile?.postal_code ?? '',
            website_url: profile.profile?.website_url ?? '',
            timezone: profile.profile?.timezone ?? '',
            language: profile.profile?.language ?? '',
            date_of_birth: this.parseProfileDate(profile.profile?.date_of_birth),
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
      avatar_url: String(value.avatar_url ?? '').trim() || null,
      country: String(value.country ?? '').trim() || null,
      state: String(value.state ?? '').trim() || null,
      city: String(value.city ?? '').trim() || null,
      postal_code: String(value.postal_code ?? '').trim() || null,
      website_url: String(value.website_url ?? '').trim() || null,
      timezone: String(value.timezone ?? '').trim() || null,
      language: String(value.language ?? '').trim() || null,
      date_of_birth: this.serializeDateValue(value.date_of_birth),
      bio: String(value.bio ?? '').trim() || null
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.avatarPreviewUrl.set(null);
          this.profileForm.patchValue({
            avatar_url: profile.profile?.avatar_url ?? ''
          }, { emitEvent: false });
          this.snackBar.open('Profile updated successfully.', 'Dismiss', { duration: 3200 });
        },
        error: (error: HttpErrorResponse) => {
          this.snackBar.open(error.error?.detail ?? 'Unable to update profile.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please choose a PNG, JPG, or WEBP image.', 'Dismiss', { duration: 3200 });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.snackBar.open('Please choose an image smaller than 5 MB.', 'Dismiss', { duration: 3200 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!avatarUrl) {
        this.snackBar.open('Unable to read the selected image.', 'Dismiss', { duration: 3200 });
        return;
      }

      this.avatarPreviewUrl.set(avatarUrl);
      this.profileForm.patchValue({ avatar_url: avatarUrl });
      this.sessionService.patchUser({ avatar_url: avatarUrl });
    };
    reader.onerror = () => {
      this.snackBar.open('Unable to read the selected image.', 'Dismiss', { duration: 3200 });
    };
    reader.readAsDataURL(file);
  }

  clearAvatar(): void {
    this.avatarPreviewUrl.set(null);
    this.profileForm.patchValue({ avatar_url: '' });
    this.sessionService.patchUser({ avatar_url: this.profile()?.profile?.avatar_url ?? null });
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

  private formatLabel(value: string): string {
    return value
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private formatProfileDate(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return formatDate(parsed, 'MMM d, y', 'en-US');
  }

  private parseProfileDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return new Date(parsed);
  }

  private serializeDateValue(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatDate(value, 'yyyy-MM-dd', 'en-US');
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        return trimmed;
      }
      return formatDate(parsed, 'yyyy-MM-dd', 'en-US');
    }

    return null;
  }
}
