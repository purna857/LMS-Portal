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
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.15rem 1.2rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 22px;
      background: #ffffff;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
      font-family: 'IBM Plex Sans', sans-serif !important;
    }

    .page-header__copy {
      display: grid;
      gap: 0.2rem;
      max-width: 68ch;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.5rem, 2vw, 2rem);
      letter-spacing: -0.03em;
      line-height: 1.08;
      font-weight: 800;
      color: #172033;
    }

    .page-header__eyebrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      margin: 0 0 0.3rem;
      padding: 0.28rem 0.62rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.64rem;
    }

    .page-header__description {
      margin: 0.15rem 0 0;
      color: var(--muted);
      max-width: 60ch;
      line-height: 1.5;
      font-size: 0.88rem;
    }

  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  readonly eyebrow = input('Workspace');
  readonly title = input.required<string>();
  readonly description = input('');
}
