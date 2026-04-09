import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ChartConfiguration } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import type {
  CourseProgress,
  EnrolledCourseItem,
  ProgressSummary
} from '@app/features/student/models/student.models';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { DashboardChartComponent } from '@app/shared/components/dashboard-chart/dashboard-chart.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

interface ProgressCourseItem {
  course: EnrolledCourseItem;
  progress: CourseProgress | null;
}

interface SummaryCard {
  label: string;
  value: string;
  hint: string;
  icon: string;
}

interface LegendItem {
  label: string;
  value: number;
  color: string;
  hint: string;
}

@Component({
  selector: 'app-student-progress',
  standalone: true,
  imports: [DashboardChartComponent, EmptyStateComponent, ...materialImports],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly progressSummary = signal<ProgressSummary | null>(null);
  readonly courseItems = signal<ProgressCourseItem[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly totalCourses = computed(() => this.progressSummary()?.total_courses ?? this.courseItems().length);
  readonly completedCourses = computed(
    () => this.progressSummary()?.completed_courses ?? this.courseItems().filter((item) => this.isCompleted(item)).length
  );
  readonly inProgressCourses = computed(
    () => this.progressSummary()?.in_progress_courses ?? this.courseItems().filter((item) => this.isInProgress(item)).length
  );
  readonly averageProgress = computed(() => {
    const summary = this.progressSummary();
    if (summary) {
      return Math.round(summary.average_progress_percentage);
    }

    const items = this.courseItems();
    if (!items.length) {
      return 0;
    }

    return Math.round(items.reduce((total, item) => total + (item.progress?.progress_percentage ?? 0), 0) / items.length);
  });
  readonly completedLessons = computed(() =>
    this.courseItems().reduce((total, item) => total + (item.progress?.completed_lessons ?? 0), 0)
  );
  readonly remainingLessons = computed(() =>
    this.courseItems().reduce(
      (total, item) =>
        total + Math.max((item.progress?.total_lessons ?? 0) - (item.progress?.completed_lessons ?? 0), 0),
      0
    )
  );
  readonly notStartedCourses = computed(
    () => this.courseItems().filter((item) => (item.progress?.progress_percentage ?? 0) === 0).length
  );
  readonly topCourses = computed(() =>
    [...this.courseItems()]
      .sort((left, right) => (right.progress?.progress_percentage ?? 0) - (left.progress?.progress_percentage ?? 0))
      .slice(0, 6)
  );
  readonly orderedCourses = computed(() =>
    [...this.courseItems()].sort((left, right) => {
      const leftDate = left.course.enrolled_at ? new Date(left.course.enrolled_at).getTime() : 0;
      const rightDate = right.course.enrolled_at ? new Date(right.course.enrolled_at).getTime() : 0;
      return rightDate - leftDate || left.course.title.localeCompare(right.course.title);
    })
  );
  readonly summaryCards = computed<SummaryCard[]>(() => [
    {
      label: 'Courses tracked',
      value: String(this.totalCourses()),
      hint: 'Live course coverage from your current enrollments.',
      icon: 'menu_book'
    },
    {
      label: 'Completed',
      value: String(this.completedCourses()),
      hint: 'Courses marked complete in the progress API.',
      icon: 'check_circle'
    },
    {
      label: 'In progress',
      value: String(this.inProgressCourses()),
      hint: 'Courses currently moving forward.',
      icon: 'trending_up'
    },
    {
      label: 'Average progress',
      value: `${this.averageProgress()}%`,
      hint: 'Rolling average across all enrolled courses.',
      icon: 'query_stats'
    }
  ]);
  readonly snapshotLegend = computed<LegendItem[]>(() => [
    {
      label: 'Completed',
      value: this.completedCourses(),
      color: '#16a34a',
      hint: 'Finished'
    },
    {
      label: 'In progress',
      value: this.inProgressCourses(),
      color: '#4e6cf0',
      hint: 'Active'
    },
    {
      label: 'Not started',
      value: this.notStartedCourses(),
      color: '#dbeafe',
      hint: 'Queued'
    }
  ]);
  readonly activityChartData = computed<ChartConfiguration<'bar' | 'line'>['data']>(() => {
    const items = this.topCourses();

    return {
      labels: items.map((item, index) => `${index + 1}. ${this.shortLabel(item.course.title, 14)}`),
      datasets: [
        {
          type: 'bar',
          label: 'Lessons completed',
          data: items.map((item) => item.progress?.completed_lessons ?? 0),
          backgroundColor: '#4e6cf0',
          borderRadius: 14,
          maxBarThickness: 28
        },
        {
          type: 'line',
          label: 'Progress %',
          data: items.map((item) => item.progress?.progress_percentage ?? 0),
          borderColor: '#18c4b8',
          backgroundColor: 'rgba(24, 196, 184, 0.12)',
          fill: true,
          tension: 0.42,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#18c4b8',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  });
  readonly snapshotChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: ['Completed', 'In progress', 'Not started'],
    datasets: [
      {
        data: [this.completedCourses(), this.inProgressCourses(), this.notStartedCourses()],
        backgroundColor: ['#16a34a', '#4e6cf0', '#dbeafe'],
        borderWidth: 0
      }
    ]
  }));
  readonly courseProgressChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const items = this.topCourses();

    return {
      labels: items.map((item) => this.shortLabel(item.course.title, 18)),
      datasets: [
        {
          label: 'Completion %',
          data: items.map((item) => item.progress?.progress_percentage ?? 0),
          backgroundColor: '#4e6cf0',
          borderRadius: 12,
          maxBarThickness: 22
        }
      ]
    };
  });
  readonly lessonBalanceChartData = computed<ChartConfiguration<'bar' | 'line'>['data']>(() => {
    const items = this.topCourses();

    return {
      labels: items.map((item) => this.shortLabel(item.course.title, 18)),
      datasets: [
        {
          type: 'bar',
          label: 'Completed lessons',
          data: items.map((item) => item.progress?.completed_lessons ?? 0),
          backgroundColor: '#f472b6',
          borderRadius: 12,
          maxBarThickness: 28,
          stack: 'lesson-balance'
        },
        {
          type: 'bar',
          label: 'Remaining lessons',
          data: items.map((item) =>
            Math.max((item.progress?.total_lessons ?? 0) - (item.progress?.completed_lessons ?? 0), 0)
          ),
          backgroundColor: '#dbeafe',
          borderRadius: 12,
          maxBarThickness: 28,
          stack: 'lesson-balance'
        }
      ]
    };
  });
  readonly trendChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const items = this.orderedCourses();
    let runningTotal = 0;

    return {
      labels: items.map((_, index) => `Course ${index + 1}`),
      datasets: [
        {
          label: 'Running average',
          data: items.map((item, index) => {
            runningTotal += item.progress?.progress_percentage ?? 0;
            return Number((runningTotal / (index + 1)).toFixed(1));
          }),
          borderColor: '#14b8a6',
          backgroundColor: 'rgba(20, 184, 166, 0.12)',
          fill: true,
          tension: 0.42,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#14b8a6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  });

  readonly comboChartOptions = signal<ChartConfiguration<'bar' | 'line'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#162033',
        displayColors: false,
        titleFont: { family: 'IBM Plex Sans' },
        bodyFont: { family: 'IBM Plex Sans' },
        callbacks: {
          label: (context) => `${context.dataset.label ?? 'Value'}: ${context.formattedValue}`
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.16)' },
        ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } }
      }
    }
  });
  readonly doughnutChartOptions = signal<ChartConfiguration<'doughnut'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#162033',
        titleFont: { family: 'IBM Plex Sans' },
        bodyFont: { family: 'IBM Plex Sans' }
      }
    }
  });
  readonly lineChartOptions = signal<ChartConfiguration<'line'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#162033',
        displayColors: false,
        titleFont: { family: 'IBM Plex Sans' },
        bodyFont: { family: 'IBM Plex Sans' },
        callbacks: {
          label: (context) => `${context.dataset.label ?? 'Value'}: ${context.formattedValue}%`
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } } },
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(148, 163, 184, 0.16)' },
        ticks: {
          color: '#627187',
          font: { family: 'IBM Plex Sans' },
          callback: (value) => `${value}%`
        }
      }
    }
  });
  readonly horizontalBarChartOptions = signal<ChartConfiguration<'bar'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    interaction: {
      mode: 'index',
      intersect: false
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#162033',
        displayColors: false,
        titleFont: { family: 'IBM Plex Sans' },
        bodyFont: { family: 'IBM Plex Sans' },
        callbacks: {
          label: (context) => `${context.dataset.label ?? 'Value'}: ${context.formattedValue}%`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(148, 163, 184, 0.16)' },
        ticks: {
          color: '#627187',
          font: { family: 'IBM Plex Sans' },
          callback: (value) => `${value}%`
        }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } }
      }
    }
  });
  readonly stackedBarChartOptions = signal<ChartConfiguration<'bar'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#162033',
        displayColors: false,
        titleFont: { family: 'IBM Plex Sans' },
        bodyFont: { family: 'IBM Plex Sans' },
        callbacks: {
          label: (context) => `${context.dataset.label ?? 'Value'}: ${context.formattedValue}`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.16)' },
        ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } }
      }
    }
  });

  constructor() {
    forkJoin({
      summary: this.studentPortalService.getProgressSummary(),
      courses: this.studentPortalService.listEnrolledCourses()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, courses }) => {
          this.progressSummary.set(summary);

          if (!courses.items.length) {
            this.courseItems.set([]);
            this.loading.set(false);
            return;
          }

          const progressRequests = courses.items.map((course) =>
            this.studentPortalService.getCourseProgress(course.course_id).pipe(catchError(() => of(null)))
          );

          forkJoin(progressRequests)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (progressList) => {
                this.courseItems.set(
                  courses.items.map((course, index) => ({
                    course,
                    progress: progressList[index]
                  }))
                );
                this.loading.set(false);
              },
              error: () => {
                this.courseItems.set([]);
                this.loading.set(false);
              }
            });
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(error.error?.detail ?? 'Unable to load progress data.');
          this.courseItems.set([]);
          this.loading.set(false);
        }
      });
  }

  private shortLabel(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
  }

  private isCompleted(item: ProgressCourseItem): boolean {
    return (item.progress?.progress_percentage ?? 0) >= 100 || item.progress?.progress_status?.toLowerCase() === 'completed';
  }

  private isInProgress(item: ProgressCourseItem): boolean {
    const percentage = item.progress?.progress_percentage ?? 0;
    const status = item.progress?.progress_status?.toLowerCase() ?? '';
    return (percentage > 0 && percentage < 100) || status === 'in_progress';
  }
}
