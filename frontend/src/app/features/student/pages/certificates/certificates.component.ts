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
        description="Your course completion certificates will appear here once certificate generation is added.">
      </app-page-header>
      <mat-card class="visual-card">
        <mat-card-content>
          <div class="certificate-placeholder">
            <div class="certificate-placeholder__frame">
              <span class="material-symbols-outlined">workspace_premium</span>
            </div>
            <div class="certificate-placeholder__copy">
              <p class="certificate-placeholder__eyebrow">Credential Center</p>
              <h2>Certificates are coming soon</h2>
              <p>Finish courses and keep progressing. Certificate downloads, validation, and shareable records will be available in a future release.</p>
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button routerLink="/app/student/results">View results</a>
          <a mat-flat-button color="primary" routerLink="/app/student/courses">Go to my learning</a>
        </mat-card-actions>
      </mat-card>
    </section>
  `,
  styles: [`
    .certificate-placeholder {
      display: grid;
      gap: 1.25rem;
      justify-items: start;
      margin-bottom: 1.5rem;
    }
    .certificate-placeholder__frame {
      display: grid;
      place-items: center;
      width: 88px;
      height: 88px;
      border-radius: 28px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(20, 184, 166, 0.14));
      color: var(--primary-strong);
    }
    .certificate-placeholder__frame .material-symbols-outlined {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
    }
    .certificate-placeholder__eyebrow {
      margin: 0 0 0.75rem;
      color: var(--primary-strong);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.74rem;
      font-weight: 700;
    }
    .certificate-placeholder__copy h2 {
      margin: 0;
      font-size: clamp(1.6rem, 2vw, 2.2rem);
      letter-spacing: -0.04em;
    }
    .certificate-placeholder__copy p:last-child {
      margin: 0.8rem 0 0;
      color: var(--muted);
      line-height: 1.65;
      max-width: 58ch;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CertificatesComponent {}
