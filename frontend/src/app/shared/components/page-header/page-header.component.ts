import { ChangeDetectionStrategy, Component, input } from '@angular/core';


@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div class="page-header__copy">
        <p class="page-header__eyebrow">{{ eyebrow() }}</p>
        <h1>{{ title() }}</h1>
        <p class="page-header__description">{{ description() }}</p>
      </div>
      <aside class="page-header__focus" aria-label="Workspace focus">
        <span class="material-symbols-outlined page-header__focus-icon">{{ focusIcon() }}</span>
        <div class="page-header__focus-copy">
          <span class="page-header__focus-eyebrow">{{ focusLabel() }}</span>
          <strong>{{ focusCopy() }}</strong>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .page-header {
      position: relative;
      isolation: isolate;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(230px, 320px);
      align-items: stretch;
      justify-content: flex-start;
      gap: 1rem;
      padding: 1.35rem 1.4rem 1.25rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 24px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(248, 251, 255, 0.985));
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.07) !important;
      font-family: 'IBM Plex Sans', sans-serif !important;
      overflow: hidden;
    }

    .page-header::before {
      content: '';
      position: absolute;
      inset: auto -74px -76px auto;
      width: 218px;
      height: 218px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0.05) 38%, transparent 72%);
      pointer-events: none;
      z-index: 0;
    }

    .page-header::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 160px;
      height: 4px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--primary), rgba(20, 184, 166, 0.75));
      opacity: 0.9;
      pointer-events: none;
      z-index: 0;
    }

    .page-header__copy {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.32rem;
      width: 100%;
      max-width: 72ch;
      align-content: start;
      padding-right: 0.25rem;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.55rem, 2vw, 2.15rem);
      letter-spacing: -0.04em;
      line-height: 1.06;
      font-weight: 800;
      color: #14213d;
    }

    .page-header__eyebrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      margin: 0 0 0.18rem;
      padding: 0.32rem 0.72rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.66rem;
    }

    .page-header__description {
      margin: 0.05rem 0 0;
      color: var(--muted);
      max-width: 64ch;
      line-height: 1.55;
      font-size: 0.92rem;
    }

    .page-header__focus {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 0.85rem;
      align-items: center;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 20px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 249, 255, 0.98));
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05) !important;
    }

    .page-header__focus-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(20, 184, 166, 0.15));
      color: var(--primary);
      font-size: 1.15rem;
    }

    .page-header__focus-copy {
      display: grid;
      gap: 0.22rem;
      min-width: 0;
    }

    .page-header__focus-eyebrow {
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.62rem;
      font-weight: 800;
    }

    .page-header__focus-copy strong {
      color: #14213d;
      font-size: 0.9rem;
      line-height: 1.28;
      letter-spacing: -0.02em;
    }

    @media (max-width: 720px) {
      .page-header {
        padding: 1.15rem 1.15rem 1rem;
      }
    }

    @media (max-width: 960px) {
      .page-header {
        grid-template-columns: 1fr;
      }

      .page-header__focus {
        grid-template-columns: 42px minmax(0, 1fr);
      }
    }

  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  readonly eyebrow = input('Workspace');
  readonly title = input.required<string>();
  readonly description = input('');
  readonly focusLabel = input('Keep momentum');
  readonly focusCopy = input('The next best action is ready when you are.');
  readonly focusIcon = input('bolt');
}
