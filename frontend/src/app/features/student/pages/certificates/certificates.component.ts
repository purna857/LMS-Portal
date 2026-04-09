import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-student-certificates',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, ...materialImports],
  template: `
    <section class="page-section">
      <app-page-header
        eyebrow="Student"
        title="Certificates"
        description="Your course completion certificates will appear here once certificate generation is enabled.">
      </app-page-header>
      <mat-card class="certificate-card">
        <mat-card-content>
          <div class="certificate-hero">
            <div class="certificate-hero__icon">
              <span class="material-symbols-outlined">workspace_premium</span>
            </div>
            <div class="certificate-hero__copy">
              <p class="certificate-hero__eyebrow">Credential Center</p>
              <h2>Certificates are coming soon</h2>
              <p>Finish courses and keep progressing. Certificate downloads, validation, and shareable records will be available in a future release.</p>
              <div class="certificate-hero__pills">
                <span class="certificate-pill">Auto issue</span>
                <span class="certificate-pill">PDF download</span>
                <span class="certificate-pill">Shareable record</span>
              </div>
            </div>
          </div>

          <div class="certificate-grid">
            <article class="certificate-panel">
              <p class="certificate-panel__eyebrow">What to expect</p>
              <h3>Complete the course, unlock the certificate</h3>
              <ul class="certificate-steps">
                <li>
                  <strong>Finish all required lessons</strong>
                  <span>Keep your course progress moving toward completion.</span>
                </li>
                <li>
                  <strong>Pass the final assessment</strong>
                  <span>Once certificate generation is enabled, eligible learners will see it here automatically.</span>
                </li>
                <li>
                  <strong>Download or share instantly</strong>
                  <span>When available, your certificate will be ready for export and validation.</span>
                </li>
              </ul>
            </article>

            <article class="certificate-panel certificate-panel--accent">
              <p class="certificate-panel__eyebrow">Current status</p>
              <strong class="certificate-panel__metric">0</strong>
              <p class="certificate-panel__metric-copy">certificates ready to download</p>
              <div class="certificate-panel__divider"></div>
              <div class="certificate-readiness">
                <div class="certificate-readiness__row">
                  <span>Completion tracking</span>
                  <strong>Live</strong>
                </div>
                <div class="certificate-readiness__row">
                  <span>Validation support</span>
                  <strong>Coming soon</strong>
                </div>
                <div class="certificate-readiness__row">
                  <span>Shareable records</span>
                  <strong>Planned</strong>
                </div>
              </div>
            </article>
          </div>
        </mat-card-content>
        <mat-card-actions align="end" class="certificate-actions">
          <a class="certificate-action" mat-button routerLink="/app/student/results">View results</a>
          <a class="certificate-action certificate-action--primary" mat-flat-button color="primary" routerLink="/app/student/courses">Go to my learning</a>
        </mat-card-actions>
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

    .certificate-card {
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 252, 255, 0.98));
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }

    .certificate-card mat-card-content {
      display: grid;
      gap: 1.1rem;
      padding: 1.25rem 1.25rem 0.9rem;
    }

    .certificate-hero {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 1rem 1.15rem;
      align-items: start;
    }

    .certificate-hero__icon {
      display: grid;
      place-items: center;
      width: 92px;
      height: 92px;
      border-radius: 28px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(20, 184, 166, 0.12));
      color: var(--primary-strong);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .certificate-hero__icon .material-symbols-outlined {
      font-size: 2.6rem;
      width: 2.6rem;
      height: 2.6rem;
    }

    .certificate-hero__copy {
      display: grid;
      gap: 0.65rem;
      align-content: start;
    }

    .certificate-hero__eyebrow,
    .certificate-panel__eyebrow {
      margin: 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.7rem;
      font-weight: 800;
    }

    .certificate-hero__copy h2 {
      margin: 0;
      font-size: clamp(1.75rem, 2.3vw, 2.5rem);
      line-height: 1.05;
      letter-spacing: -0.05em;
      color: var(--primary-strong);
    }

    .certificate-hero__copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      max-width: 64ch;
    }

    .certificate-hero__pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-top: 0.1rem;
    }

    .certificate-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary-strong);
      font-weight: 700;
      font-size: 0.8rem;
    }

    .certificate-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
      gap: 1rem;
    }

    .certificate-panel {
      display: grid;
      gap: 0.9rem;
      padding: 1rem 1.05rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.95);
    }

    .certificate-panel--accent {
      background: linear-gradient(180deg, rgba(237, 244, 255, 0.8), rgba(255, 255, 255, 0.95));
    }

    .certificate-panel h3 {
      margin: 0;
      color: var(--primary-strong);
      font-size: 1.05rem;
      line-height: 1.35;
      letter-spacing: -0.03em;
    }

    .certificate-steps {
      display: grid;
      gap: 0.8rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .certificate-steps li {
      display: grid;
      gap: 0.25rem;
      padding-left: 0.9rem;
      border-left: 2px solid rgba(37, 99, 235, 0.16);
    }

    .certificate-steps strong {
      color: var(--primary-strong);
      font-size: 0.95rem;
      line-height: 1.35;
    }

    .certificate-steps span,
    .certificate-panel__metric-copy,
    .certificate-readiness__row span {
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.88rem;
    }

    .certificate-panel__metric {
      font-size: clamp(2.6rem, 4vw, 3.2rem);
      line-height: 1;
      letter-spacing: -0.06em;
      color: var(--primary-strong);
    }

    .certificate-panel__metric-copy {
      margin: 0;
      font-weight: 500;
    }

    .certificate-panel__divider {
      width: 100%;
      height: 1px;
      background: rgba(148, 163, 184, 0.18);
    }

    .certificate-readiness {
      display: grid;
      gap: 0.65rem;
    }

    .certificate-readiness__row {
      display: flex;
      justify-content: space-between;
      gap: 0.8rem;
      align-items: center;
    }

    .certificate-readiness__row strong {
      color: var(--primary-strong);
      font-size: 0.86rem;
      white-space: nowrap;
    }

    .certificate-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.65rem;
      padding: 0.25rem 1.25rem 1.25rem;
    }

    .certificate-action {
      min-width: 0;
      height: 2.8rem;
      padding: 0 1.15rem;
      border-radius: 999px !important;
      font-family: 'IBM Plex Sans', sans-serif !important;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .certificate-action--primary {
      color: #ffffff !important;
      background: var(--primary) !important;
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.18);
    }

    .certificate-action--primary:hover {
      background: #1d4ed8 !important;
    }

    .certificate-action:not(.certificate-action--primary) {
      color: var(--primary) !important;
    }

    @media (max-width: 960px) {
      .certificate-grid {
        grid-template-columns: 1fr;
      }

      .certificate-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 720px) {
      .certificate-card mat-card-content {
        padding-inline: 1rem;
      }

      .certificate-hero {
        grid-template-columns: 1fr;
      }

      .certificate-hero__icon {
        width: 78px;
        height: 78px;
        border-radius: 24px;
      }

      .certificate-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .certificate-action {
        width: 100%;
        justify-content: center;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CertificatesComponent {}
