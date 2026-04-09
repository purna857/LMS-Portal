import { ChangeDetectionStrategy, Component, input } from '@angular/core';


@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="empty-state">
      <div class="empty-state__orb">
        <span class="material-symbols-outlined empty-state__icon">{{ icon() }}</span>
      </div>
      <div class="empty-state__copy">
        <h2>{{ title() }}</h2>
        <p>{{ description() }}</p>
      </div>
    </section>
  `,
  styles: [`
    .empty-state {
      display: grid;
      justify-items: start;
      gap: 1rem;
      padding: 2rem;
      border: 1px dashed rgba(37, 99, 235, 0.2);
      border-radius: var(--radius-lg);
      background:
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 30%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(244, 247, 255, 0.86));
    }

    .empty-state__orb {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(20, 184, 166, 0.14));
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65);
    }

    .empty-state__icon {
      color: var(--primary);
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }

    p {
      color: var(--muted);
      max-width: 48ch;
      line-height: 1.6;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  readonly icon = input('info');
  readonly title = input.required<string>();
  readonly description = input('');
}
