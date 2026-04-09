import { ChangeDetectionStrategy, Component, input } from '@angular/core';


@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <div class="logo" [class.logo--compact]="compact()">
      <div class="logo__mark">L</div>
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
      gap: 0.9rem;
    }

    .logo__mark {
      display: grid;
      place-items: center;
      width: 2.8rem;
      height: 2.8rem;
      border-radius: 18px;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.28), transparent 40%),
        linear-gradient(135deg, #1d4ed8, #14b8a6);
      color: #fff;
      font-weight: 800;
      font-size: 1.15rem;
      box-shadow: 0 18px 32px rgba(29, 78, 216, 0.28);
    }

    .logo__text {
      display: grid;
      line-height: 1.05;
    }

    .logo__title {
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .logo__subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.78rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppLogoComponent {
  readonly compact = input(false);
}
