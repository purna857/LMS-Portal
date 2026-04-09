import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart, type ChartConfiguration, type ChartType, registerables } from 'chart.js';
import { Subject } from 'rxjs';


Chart.register(...registerables);

@Component({
  selector: 'app-dashboard-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-chart" [style.height.px]="height()">
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [`
    .dashboard-chart {
      position: relative;
      width: 100%;
      min-height: 220px;
    }

    canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardChartComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();

  readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartConfiguration['data']>();
  readonly options = input<ChartConfiguration['options']>({
    responsive: true,
    maintainAspectRatio: false
  });
  readonly height = input(240);

  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      this.type();
      this.data();
      this.options();
      this.height();
      this.refresh$.next();
    });

    this.refresh$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.viewReady) {
          return;
        }
        queueMicrotask(() => this.renderChart());
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  private renderChart(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) {
      return;
    }

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: this.type(),
      data: this.data(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this.options()
      }
    });
  }
}
