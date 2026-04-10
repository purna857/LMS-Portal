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
          <span class="logo__subtitle">Learning Workspace</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.85rem;
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
      display: grid;
      gap: 0.08rem;
      line-height: 1.02;
    }

    .logo__title {
      font-weight: 800;
      letter-spacing: -0.03em;
      font-size: 1.16rem;
      line-height: 1.02;
      white-space: nowrap;
    }

    .logo__subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.82rem;
      white-space: nowrap;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppLogoComponent {
  readonly compact = input(false);
}
