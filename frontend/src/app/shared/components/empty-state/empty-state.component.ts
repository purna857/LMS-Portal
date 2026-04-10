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
        <p class="empty-state__eyebrow">Keep momentum</p>
        <h2>{{ title() }}</h2>
        <p>{{ description() }}</p>
        <div class="empty-state__note">
          <span class="material-symbols-outlined">auto_awesome</span>
          <span>Small wins add up. Your next action will appear here as soon as the view changes.</span>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .empty-state {
      position: relative;
      isolation: isolate;
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
      padding: 1.35rem 1.4rem;
      border: 1px solid rgba(37, 99, 235, 0.12);
      border-radius: 24px;
      background:
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 30%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 247, 255, 0.9));
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06) !important;
      overflow: hidden;
    }

    .empty-state::before {
      content: '';
      position: absolute;
      inset: auto -60px -68px auto;
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(20, 184, 166, 0.12) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    .empty-state__orb {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(20, 184, 166, 0.16));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .empty-state__icon {
      color: var(--primary);
      font-size: 1.8rem;
      width: 1.8rem;
      height: 1.8rem;
    }

    .empty-state__copy {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.22rem;
      align-content: start;
      max-width: 60ch;
    }

    .empty-state__eyebrow {
      margin: 0 0 0.18rem;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.62rem;
      font-weight: 800;
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      font-size: 1.08rem;
      letter-spacing: -0.03em;
      line-height: 1.25;
    }

    p {
      color: var(--muted);
      max-width: 54ch;
      line-height: 1.55;
      font-size: 0.92rem;
    }

    .empty-state__note {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr);
      gap: 0.6rem;
      align-items: start;
      margin-top: 0.3rem;
      padding: 0.65rem 0.8rem;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(148, 163, 184, 0.14);
      color: #42526b;
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .empty-state__note .material-symbols-outlined {
      color: var(--primary);
      font-size: 1rem;
      line-height: 1;
    }

    @media (max-width: 640px) {
      .empty-state {
        grid-template-columns: 1fr;
        padding: 1.2rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  readonly icon = input('info');
  readonly title = input.required<string>();
  readonly description = input('');
}
