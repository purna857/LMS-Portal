import { ChangeDetectionStrategy, Component, input } from '@angular/core';


@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <div class="logo" [class.logo--compact]="compact()">
      <div class="logo__mark" aria-hidden="true">
        <img class="logo__image" src="assets/brand/lms-portal-mark.svg" alt="" />
      </div>
      @if (!compact()) {
        <div class="logo__text">
          <span class="logo__title">LMS Portal</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .logo {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-width: 0;
      flex: 1 1 auto;
    }

    .logo__mark {
      display: grid;
      place-items: center;
      width: 3.05rem;
      height: 3.05rem;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: none;
    }

    .logo__image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .logo__text {
      display: flex;
      align-items: center;
      min-width: 0;
      line-height: 1.02;
    }

    .logo__title {
      font-weight: 800;
      letter-spacing: -0.03em;
      font-size: 1.16rem;
      line-height: 1;
      display: block;
      white-space: nowrap;
    }

  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppLogoComponent {
  readonly compact = input(false);
}
