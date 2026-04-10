import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';

import { materialImports } from '@app/shared/material/material-imports';


export type BaseModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type BaseModalVariant = 'default' | 'destructive';

@Component({
  selector: 'app-base-modal',
  standalone: true,
  imports: [...materialImports],
  template: `
    <section
      class="base-modal"
      [class.base-modal--sm]="size() === 'sm'"
      [class.base-modal--md]="size() === 'md'"
      [class.base-modal--lg]="size() === 'lg'"
      [class.base-modal--xl]="size() === 'xl'"
      [class.base-modal--destructive]="variant() === 'destructive'">
      <ng-content select="app-modal-header"></ng-content>
      <ng-content select="app-modal-body"></ng-content>
      <ng-content select="app-modal-footer"></ng-content>
    </section>
  `,
  styles: [`
    app-base-modal {
      display: flex;
      width: 100%;
      height: 100%;
      max-height: 90vh;
      min-height: 0;
    }

    .base-modal {
      --base-modal-accent: var(--primary);
      --base-modal-text-soft: #667892;
      --base-modal-border: rgba(148, 163, 184, 0.16);
      --base-modal-surface: linear-gradient(180deg, rgba(255, 255, 255, 0.996), rgba(247, 250, 255, 0.992));
      --base-modal-section-border: rgba(148, 163, 184, 0.16);
      --base-modal-section-surface: linear-gradient(180deg, #fbfdff, #ffffff 72%);
      --base-modal-footer-surface: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 255, 0.995));
      --base-modal-footer-height: 92px;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      max-height: 90vh;
      min-height: 0;
      overflow: hidden;
      background: var(--base-modal-surface);
    }

    .base-modal--sm {
      width: min(92vw, 420px);
      max-width: min(92vw, 420px);
    }

    .base-modal--md {
      width: min(94vw, 560px);
      max-width: min(94vw, 560px);
    }

    .base-modal--lg {
      width: min(96vw, 840px);
      max-width: min(96vw, 840px);
    }

    .base-modal--xl {
      width: min(96vw, 1120px);
      max-width: min(96vw, 1120px);
    }

    .base-modal--destructive {
      --base-modal-accent: #c83c3c;
      --base-modal-border: rgba(200, 60, 60, 0.16);
      --base-modal-section-border: rgba(200, 60, 60, 0.16);
      --base-modal-surface: linear-gradient(180deg, rgba(255, 251, 251, 0.998), rgba(255, 246, 246, 0.992));
      --base-modal-section-surface: linear-gradient(180deg, #fffafa, #ffffff 72%);
      --base-modal-footer-surface: linear-gradient(180deg, rgba(255, 251, 251, 0.985), rgba(255, 245, 245, 0.995));
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BaseModalComponent {
  readonly size = input<BaseModalSize>('lg');
  readonly variant = input<BaseModalVariant>('default');
}

@Component({
  selector: 'app-modal-header',
  standalone: true,
  imports: [...materialImports],
  template: `
    <header class="base-modal__header">
      <div class="base-modal__heading">
        @if (eyebrow()) {
          <p class="base-modal__eyebrow">{{ eyebrow() }}</p>
        }
        <h2 class="base-modal__title">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="base-modal__subtitle">{{ subtitle() }}</p>
        }
      </div>

      <button
        mat-icon-button
        type="button"
        class="base-modal__close"
        [attr.aria-label]="closeLabel()"
        (click)="closeRequested.emit()">
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>
  `,
  styles: [`
    app-modal-header {
      display: block;
      flex: 0 0 auto;
      border-bottom: 1px solid var(--base-modal-border);
    }

    .base-modal__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.6rem 1.9rem 1.3rem;
      background: inherit;
    }

    .base-modal__heading {
      display: grid;
      gap: 0.42rem;
      min-width: 0;
      max-width: 52rem;
    }

    .base-modal__eyebrow {
      margin: 0;
      color: var(--base-modal-accent);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .base-modal__title {
      margin: 0;
      color: var(--text);
      font-size: clamp(1.9rem, 2vw, 2.35rem);
      line-height: 1.04;
      letter-spacing: -0.055em;
      font-weight: 800;
    }

    .base-modal__subtitle {
      margin: 0;
      color: var(--base-modal-text-soft);
      font-size: 1.02rem;
      line-height: 1.6;
      max-width: 46rem;
    }

    .base-modal__close {
      flex: 0 0 auto;
      width: 46px;
      height: 46px;
      border-radius: 15px;
      background: rgba(243, 247, 255, 0.96);
      color: var(--base-modal-accent);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }

    @media (max-width: 720px) {
      .base-modal__header {
        padding: 1.3rem 1.15rem 1rem;
      }
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalHeaderComponent {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly closeLabel = input('Close dialog');
  readonly closeRequested = output<void>();
}

@Component({
  selector: 'app-modal-body',
  standalone: true,
  template: `
    <div class="base-modal__body">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    app-modal-body {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    .base-modal__body {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1.5rem 1.9rem calc(1.5rem + var(--base-modal-footer-height));
      scrollbar-gutter: stable;
      overscroll-behavior: contain;
    }

    .base-modal__body > form,
    .base-modal__body > .base-modal__body-stack {
      display: grid;
      gap: 1rem;
      min-width: 0;
      align-content: start;
    }

    .base-modal__body::-webkit-scrollbar {
      width: 12px;
    }

    .base-modal__body::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.06);
      border-radius: 999px;
    }

    .base-modal__body::-webkit-scrollbar-thumb {
      background: rgba(37, 99, 235, 0.42);
      border: 3px solid rgba(255, 255, 255, 0.94);
      border-radius: 999px;
    }

    @media (max-width: 720px) {
      .base-modal__body {
        padding: 1rem 1.15rem calc(1rem + var(--base-modal-footer-height));
      }
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalBodyComponent {}

@Component({
  selector: 'app-modal-footer',
  standalone: true,
  template: `
    <footer class="base-modal__footer" [class.base-modal__footer--split]="align() === 'split'">
      <ng-content></ng-content>
    </footer>
  `,
  styles: [`
    app-modal-footer {
      display: block;
      flex: 0 0 auto;
      border-top: 1px solid var(--base-modal-border);
      background: var(--base-modal-footer-surface);
    }

    .base-modal__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.9rem;
      min-height: var(--base-modal-footer-height);
      padding: 1rem 1.9rem 1.2rem;
      flex-wrap: nowrap;
    }

    .base-modal__footer--split {
      justify-content: space-between;
    }

    .base-modal__footer .mat-mdc-button-base,
    .base-modal__footer a.mat-mdc-button-base {
      min-height: 2.95rem;
      min-width: 9rem;
      border-radius: 16px;
    }

    @media (max-width: 720px) {
      .base-modal__footer,
      .base-modal__footer--split {
        justify-content: flex-end;
        padding: 0.95rem 1.15rem 1.1rem;
        min-height: var(--base-modal-footer-height);
        flex-wrap: wrap;
      }

      .base-modal__footer .mat-mdc-button-base,
      .base-modal__footer a.mat-mdc-button-base {
        min-width: 0;
      }
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalFooterComponent {
  readonly align = input<'end' | 'split'>('end');
}

@Component({
  selector: 'app-modal-section',
  standalone: true,
  template: `
    <section class="base-modal__section">
      <div class="base-modal__section-header">
        <div class="base-modal__section-copy">
          <h3 class="base-modal__section-title">{{ title() }}</h3>
          @if (description()) {
            <p class="base-modal__section-description">{{ description() }}</p>
          }
        </div>
        <ng-content select="[sectionAction]"></ng-content>
      </div>

      <div class="base-modal__section-content">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styles: [`
    app-modal-section {
      display: block;
    }

    .base-modal__section {
      display: grid;
      gap: 1.2rem;
      padding: 1.35rem;
      border: 1px solid var(--base-modal-section-border);
      border-radius: 26px;
      background: var(--base-modal-section-surface);
    }

    .base-modal__section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .base-modal__section-copy {
      display: grid;
      gap: 0.32rem;
      min-width: 0;
    }

    .base-modal__section-title {
      margin: 0;
      color: var(--text);
      font-size: 1.06rem;
      line-height: 1.25;
      letter-spacing: -0.03em;
      font-weight: 700;
    }

    .base-modal__section-description {
      margin: 0;
      color: var(--base-modal-text-soft);
      font-size: 0.92rem;
      line-height: 1.55;
      max-width: 42rem;
    }

    .base-modal__section-content {
      display: grid;
      gap: 1rem;
      min-width: 0;
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalSectionComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}

@Component({
  selector: 'app-modal-form-grid',
  standalone: true,
  template: `
    <div class="base-modal__form-grid" [class.base-modal__form-grid--single]="columns() === 1">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    app-modal-form-grid {
      display: block;
      min-width: 0;
    }

    .base-modal__form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem 1.1rem;
      align-items: start;
      min-width: 0;
    }

    .base-modal__form-grid--single {
      grid-template-columns: 1fr;
    }

    .base-modal__form-grid > .modal-form-grid__full {
      grid-column: 1 / -1;
    }

    .base-modal__form-grid > .mat-mdc-form-field,
    .base-modal__form-grid > .mat-mdc-checkbox,
    .base-modal__form-grid > .mat-mdc-button-base,
    .base-modal__form-grid > div,
    .base-modal__form-grid > section {
      min-width: 0;
    }

    .base-modal__form-grid > .mat-mdc-form-field {
      width: 100%;
      margin: 0;
    }

    .base-modal__form-grid > .mat-mdc-checkbox.modal-form-grid__full {
      align-self: center;
      margin-top: 0.15rem;
    }

    @media (max-width: 720px) {
      .base-modal__form-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalFormGridComponent {
  readonly columns = input<1 | 2>(2);
}
