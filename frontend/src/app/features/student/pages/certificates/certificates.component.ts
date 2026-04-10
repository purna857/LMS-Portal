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
      --certificate-accent: #365fd8;
      --certificate-accent-strong: #2448b8;
      --certificate-accent-rgb: 54, 95, 216;
      --certificate-surface: #ffffff;
      --certificate-surface-soft: #f8fbff;
      --certificate-border: rgba(148, 163, 184, 0.18);
    }

    .page-section {
      display: grid;
      gap: 1.1rem;
    }

    .certificate-card {
      border: 1px solid var(--certificate-border);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 251, 255, 0.99));
      box-shadow: 0 18px 44px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }

    .certificate-card mat-card-content {
      display: grid;
      gap: 1.15rem;
      padding: 1.35rem 1.35rem 1rem;
    }

    .certificate-hero {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 1rem 1.15rem;
      align-items: center;
    }

    .certificate-hero__icon {
      display: grid;
      place-items: center;
      width: 92px;
      height: 92px;
      border-radius: 28px;
      background:
        radial-gradient(circle at 30% 25%, rgba(var(--certificate-accent-rgb), 0.08), transparent 48%),
        linear-gradient(135deg, rgba(var(--certificate-accent-rgb), 0.09), rgba(148, 163, 184, 0.08));
      color: var(--certificate-accent-strong);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.8),
        0 14px 28px rgba(15, 23, 42, 0.04);
    }

    .certificate-hero__icon .material-symbols-outlined {
      font-size: 2.45rem;
      width: 2.45rem;
      height: 2.45rem;
    }

    .certificate-hero__copy {
      display: grid;
      gap: 0.6rem;
      align-content: start;
    }

    .certificate-hero__eyebrow,
    .certificate-panel__eyebrow {
      margin: 0;
      color: var(--certificate-accent);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.68rem;
      font-weight: 800;
    }

    .certificate-hero__copy h2 {
      margin: 0;
      font-size: clamp(1.55rem, 2vw, 2.15rem);
      line-height: 1.05;
      letter-spacing: -0.05em;
      color: #18233b;
    }

    .certificate-hero__copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      max-width: 58ch;
    }

    .certificate-hero__pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.1rem;
    }

    .certificate-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border-radius: 999px;
      background: rgba(var(--certificate-accent-rgb), 0.08);
      color: var(--certificate-accent-strong);
      border: 1px solid rgba(var(--certificate-accent-rgb), 0.1);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
      font-weight: 700;
      font-size: 0.8rem;
    }

    .certificate-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
      gap: 1.05rem;
    }

    .certificate-panel {
      display: grid;
      gap: 0.9rem;
      padding: 1rem 1.05rem;
      border: 1px solid var(--certificate-border);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98));
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.03);
    }

    .certificate-panel--accent {
      background:
        linear-gradient(180deg, rgba(var(--certificate-accent-rgb), 0.04), rgba(255, 255, 255, 0.98)),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98));
    }

    .certificate-panel h3 {
      margin: 0;
      color: #18233b;
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
      border-left: 2px solid rgba(var(--certificate-accent-rgb), 0.14);
    }

    .certificate-steps strong {
      color: #20304f;
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
      font-size: clamp(2.45rem, 3.8vw, 3rem);
      line-height: 1;
      letter-spacing: -0.06em;
      color: var(--certificate-accent-strong);
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
      color: var(--certificate-accent-strong);
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
      background: linear-gradient(180deg, var(--certificate-accent), var(--certificate-accent-strong)) !important;
      box-shadow: 0 12px 24px rgba(var(--certificate-accent-rgb), 0.16);
    }

    .certificate-action:not(.certificate-action--primary) {
      color: var(--certificate-accent) !important;
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
