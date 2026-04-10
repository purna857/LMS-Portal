import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { materialImports } from '@app/shared/material/material-imports';


type PortalDialogSize = 'sm' | 'md' | 'lg' | 'xl';
type PortalDialogVariant = 'confirm' | 'destructive';


@Component({
  selector: 'app-portal-dialog-shell',
  standalone: true,
  imports: [...materialImports],
  template: `
    <section
      class="portal-dialog-shell"
      [class.portal-dialog-shell--confirm]="variant() === 'confirm'"
      [class.portal-dialog-shell--destructive]="variant() === 'destructive'"
      [class.portal-dialog-shell--sm]="size() === 'sm'"
      [class.portal-dialog-shell--md]="size() === 'md'"
      [class.portal-dialog-shell--lg]="size() === 'lg'"
      [class.portal-dialog-shell--xl]="size() === 'xl'">
      <header class="portal-dialog-shell__header">
        <div class="portal-dialog-shell__headline">
          <p class="portal-dialog-shell__eyebrow">{{ eyebrow() }}</p>
          <h2>{{ title() }}</h2>
          @if (description()) {
            <p class="portal-dialog-shell__description">{{ description() }}</p>
          }
        </div>

        <button
          mat-icon-button
          type="button"
          class="portal-dialog-shell__close"
          (click)="closeRequested.emit()"
          [attr.aria-label]="closeLabel()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <div class="portal-dialog-shell__body">
        <ng-content select="[dialogBody]"></ng-content>
      </div>

      <footer class="portal-dialog-shell__footer">
        <ng-content select="[dialogFooter]"></ng-content>
      </footer>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .portal-dialog-shell {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      --dialog-accent: var(--primary);
      --dialog-surface-start: rgba(255, 255, 255, 0.995);
      --dialog-surface-end: rgba(248, 251, 255, 0.985);
      --dialog-border: rgba(148, 163, 184, 0.14);
      --dialog-section-border: rgba(148, 163, 184, 0.14);
      --dialog-section-bg: linear-gradient(180deg, rgba(248, 251, 255, 0.95), #ffffff 68%);
      --dialog-footer-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98));
      --dialog-close-bg: #f8fbff;
      --dialog-close-color: var(--primary);
      background: linear-gradient(180deg, var(--dialog-surface-start), var(--dialog-surface-end));
    }

    .portal-dialog-shell__header {
      position: relative;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.35rem 1.5rem 1rem;
      border-bottom: 1px solid var(--dialog-border);
    }

    .portal-dialog-shell__headline {
      display: grid;
      gap: 0.28rem;
      min-width: 0;
      max-width: 72ch;
    }

    .portal-dialog-shell__eyebrow {
      margin: 0;
      color: var(--dialog-accent);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.64rem;
      font-weight: 800;
    }

    h2 {
      margin: 0;
      font-size: clamp(1.35rem, 1.65vw, 1.7rem);
      line-height: 1.1;
      letter-spacing: -0.04em;
    }

    .portal-dialog-shell__description {
      margin: 0.05rem 0 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.92rem;
      max-width: 62ch;
    }

    .portal-dialog-shell__close {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: var(--dialog-close-bg);
      color: var(--dialog-close-color);
    }

    .portal-dialog-shell__body {
      display: grid;
      gap: 1rem;
      min-height: 0;
      overflow: auto;
      overflow-x: hidden;
      padding: 1rem 1.5rem 1.15rem;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: rgba(37, 99, 235, 0.55) rgba(15, 23, 42, 0.08);
    }

    .portal-dialog-shell__body::-webkit-scrollbar {
      width: 12px;
    }

    .portal-dialog-shell__body::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.08);
      border-radius: 999px;
    }

    .portal-dialog-shell__body::-webkit-scrollbar-thumb {
      background: rgba(37, 99, 235, 0.55);
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: 999px;
    }

    .portal-dialog-shell__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem 1.2rem;
      border-top: 1px solid var(--dialog-border);
      background: var(--dialog-footer-bg);
      min-height: 82px;
      flex-wrap: wrap;
    }

    .portal-dialog-shell__footer:empty {
      display: none;
    }

    .portal-dialog-shell--sm .portal-dialog-shell__body {
      gap: 0.9rem;
    }

    .portal-dialog-shell--sm .portal-dialog-shell__header,
    .portal-dialog-shell--sm .portal-dialog-shell__body,
    .portal-dialog-shell--sm .portal-dialog-shell__footer {
      padding-inline: 1.25rem;
    }

    .portal-dialog-shell--destructive {
      --dialog-accent: #dc2626;
      --dialog-surface-start: rgba(255, 249, 249, 0.995);
      --dialog-surface-end: rgba(255, 252, 252, 0.988);
      --dialog-border: rgba(220, 38, 38, 0.14);
      --dialog-section-border: rgba(220, 38, 38, 0.14);
      --dialog-section-bg: linear-gradient(180deg, rgba(255, 247, 247, 0.98), rgba(255, 252, 252, 0.98) 68%);
      --dialog-footer-bg: linear-gradient(180deg, rgba(255, 250, 250, 0.985), rgba(255, 245, 245, 0.98));
      --dialog-close-bg: rgba(254, 242, 242, 0.96);
      --dialog-close-color: #dc2626;
    }

    @media (max-width: 720px) {
      .portal-dialog-shell__header {
        padding: 1.15rem 1.2rem 0.9rem;
      }

      .portal-dialog-shell__body {
        padding: 0.95rem 1.2rem 1rem;
      }

      .portal-dialog-shell__footer {
        padding: 0.95rem 1.2rem 1.1rem;
        min-height: 76px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalDialogShellComponent {
  readonly size = input<PortalDialogSize>('lg');
  readonly variant = input<PortalDialogVariant>('confirm');
  readonly eyebrow = input('Workspace dialog');
  readonly title = input.required<string>();
  readonly description = input('');
  readonly closeLabel = input('Close dialog');
  readonly closeRequested = output<void>();
}
