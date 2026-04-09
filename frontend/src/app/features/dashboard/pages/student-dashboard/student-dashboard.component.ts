import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import type { ChartConfiguration } from 'chart.js';
import { catchError } from 'rxjs/operators';

import type {
  CourseProgress,
  EnrolledCourseItem,
  NotificationItem,
  ProgressSummary,
  StudentAssignmentRecord,
  StudentDashboardStats
} from '@app/features/student/models/student.models';
import { SessionService } from '@app/core/services/session.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { StudentPortalService } from '@app/features/student/services/student-portal.service';
import { DashboardChartComponent } from '@app/shared/components/dashboard-chart/dashboard-chart.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { materialImports } from '@app/shared/material/material-imports';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardChartComponent, EmptyStateComponent, ...materialImports],
  template: `
    <section class="page-section dashboard-page">
      <div class="overview-top-row">
            <mat-card class="surface-card student-hero-card">
        <mat-card-content>
          <p class="student-hero-card__eyebrow">Student</p>
          <h1>Good Evening, {{ displayName() }}</h1>
          <p class="student-hero-card__description">
            Track your learning momentum, upcoming classes, assignments, and progress from one calm workspace.
          </p>

          <div class="student-hero-card__chips">
            <span>{{ stats()?.total_enrolled_courses ?? 0 }} courses</span>
            <span>{{ stats()?.completed_lessons ?? 0 }} lessons completed</span>
            <span>{{ progressValue() }} average progress</span>
          </div>

          <div class="student-hero-card__highlights">
            @for (item of heroHighlights(); track item.title) {
              <article class="student-hero-card__highlight">
                <span class="student-hero-card__highlight-icon material-symbols-outlined" [class]="item.tone">
                  {{ item.icon }}
                </span>
                <div class="student-hero-card__highlight-body">
                  <p>{{ item.title }}</p>
                  <strong>{{ item.value }}</strong>
                  <span>{{ item.copy }}</span>
                </div>
              </article>
            }
          </div>
        </mat-card-content>
      </mat-card>

        <mat-card class="surface-card dashboard-kpi-card">
          <mat-card-content>
            <div class="dashboard-kpi-card__ring">
              <app-dashboard-chart
                type="doughnut"
                [height]="170"
                [data]="distributionChartData()"
                [options]="doughnutChartOptions()">
              </app-dashboard-chart>
              <div class="dashboard-kpi-card__ring-value">{{ progressValue() }}</div>
            </div>

            <div class="dashboard-kpi-card__list">
              <div class="dashboard-kpi-card__item">
                <strong>{{ stats()?.completed_lessons ?? 0 }} lessons completed</strong>
                <span>Lesson completion is the clearest signal of current learning momentum.</span>
              </div>
              <div class="dashboard-kpi-card__item">
                <strong>{{ stats()?.completed_courses ?? 0 }} completed courses</strong>
                <span>Completed courses move you closer to certificates and long-term mastery.</span>
              </div>
              <div class="dashboard-kpi-card__item">
                <strong>{{ filteredNotifications().length }} recent notifications</strong>
                <span>Stay current with deadlines, grading updates, and course announcements.</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="dashboard-metrics">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="stat-card skeleton skeleton--card"></div>
          }
        </div>
      }

      <div class="overview-grid overview-grid--summary">
        @for (group of overviewSummaryGroups(); track group.title) {
          <mat-card class="surface-card overview-summary-card">
            <mat-card-content>
              <div class="overview-card__header">
                <div>
                  <p class="overview-card__eyebrow">{{ group.title }}</p>
                  <h2>{{ group.subtitle }}</h2>
                </div>
                <span class="overview-summary-card__badge">{{ group.badge }}</span>
              </div>

              <div class="overview-summary-card__list">
                @for (item of group.items; track item.label) {
                  <article class="overview-summary-card__item">
                    <span class="overview-summary-card__icon material-symbols-outlined" [class]="item.tone">
                      {{ item.icon }}
                    </span>
                    <div>
                      <strong>{{ item.label }}</strong>
                      <p>{{ item.detail }}</p>
                    </div>
                    <span class="overview-summary-card__value">{{ item.value }}</span>
                  </article>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Upcoming classes</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading() && displayedCourses().length) {
              <div class="course-grid">
                @for (course of displayedCourses(); track course.enrollment_id) {
                  <article class="course-grid__card">
                    <div class="course-grid__head">
                      <div class="course-grid__thumb">{{ course.title.charAt(0) }}</div>
                      <div>
                        <strong>{{ course.title }}</strong>
                        <p>{{ course.short_description || course.slug }}</p>
                      </div>
                    </div>
                    <div class="course-grid__foot">
                      <span>{{ courseProgressPercentage(course.course_id) | number: '1.0-0' }}% progress</span>
                      <a mat-button [routerLink]="['/app/student/learning', course.course_id]">Open</a>
                    </div>
                  </article>
                }
              </div>
            } @else if (!loading()) {
              <app-empty-state
                [icon]="searchActive() ? 'search_off' : 'menu_book'"
                [title]="searchActive() ? 'No courses match your search' : 'No enrolled courses yet'"
                [description]="searchActive() ? 'Try a different keyword to narrow down your learning library.' : 'Browse the course catalog and enroll to begin your learning journey.'">
              </app-empty-state>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <a mat-button routerLink="/app/student/browse">Browse courses</a>
          </mat-card-actions>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Weekly progress</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-dashboard-chart
              type="bar"
              [height]="310"
              [data]="progressChartData()"
              [options]="barChartOptions()">
            </app-dashboard-chart>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="dashboard-split">
        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Learning streak</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!loading()) {
              <div class="streak-card">
                <div class="streak-card__lead">
                  <strong>{{ learningStreakDays() }} days without a break</strong>
                  <span>The record is based on your completed lesson activity.</span>
                </div>

                <div class="streak-card__week" aria-label="Learning streak by day of week">
                  @for (day of streakTimeline(); track day.label) {
                    <div class="streak-card__day" [class.streak-card__day--active]="day.active">
                      <span class="streak-card__day-icon material-symbols-outlined">local_fire_department</span>
                      <span>{{ day.label }}</span>
                    </div>
                  }
                </div>

                <div class="streak-card__footer">
                  <div class="streak-card__footer-item">
                    <span class="material-symbols-outlined">fiber_manual_record</span>
                    <span>{{ stats()?.completed_courses ?? 0 }} courses covered</span>
                  </div>

                  <div class="streak-card__footer-item">
                    <span class="material-symbols-outlined">fiber_manual_record</span>
                    <span>{{ assignmentRecords().length }} assignments completed</span>
                  </div>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-header>
            <mat-card-title>Latest assignment & notifications</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="achievement-list">
              <div class="achievement-list__item">
                <span class="material-symbols-outlined">workspace_premium</span>
                <div>
                  <strong>{{ stats()?.completed_courses ?? 0 }} course milestones</strong>
                  <p>Keep stacking completions to unlock certificates and long-term goals.</p>
                </div>
              </div>

              @if (latestGradedAssignment(); as gradedAssignment) {
                <div class="achievement-list__item">
                  <span class="material-symbols-outlined">task_alt</span>
                  <div>
                    <strong>{{ gradedAssignment.assignment_title }} graded</strong>
                    <p>
                      {{ gradedAssignment.score ?? 0 }} pts recorded ·
                      {{ gradedAssignment.feedback || 'Open assignments to review the full feedback.' }}
                    </p>
                  </div>
                </div>
              }

              @for (item of displayedNotifications(); track item.id) {
                <div class="achievement-list__item">
                  <span class="material-symbols-outlined">notifications</span>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.body }}</p>
                  </div>
                </div>
              }

              @if (!loading() && !displayedNotifications().length) {
                <app-empty-state
                  [icon]="searchActive() ? 'search_off' : 'notifications'"
                  [title]="searchActive() ? 'No notifications match your search' : 'No recent updates'"
                  [description]="searchActive() ? 'Try another keyword to narrow your notifications.' : 'Course and platform notifications will appear here as they arrive.'">
                </app-empty-state>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .dashboard-page {
      display: grid;
      gap: 1rem;
      font-family: 'IBM Plex Sans', sans-serif;
      color: var(--text-primary);
    }

    .dashboard-page :where(h1, h2, h3, h4, h5, h6, p, span, strong, a, button, label, input, textarea, small, mat-card-title, mat-card-subtitle) {
      font-family: inherit;
    }

    .dashboard-page .material-symbols-outlined,
    .dashboard-page .mat-icon {
      font-family: 'Material Symbols Outlined' !important;
    }

    .overview-top-row {
      display: grid;
      grid-template-columns: minmax(0, 1.32fr) minmax(320px, 0.88fr);
      gap: 1rem;
      align-items: stretch;
    }

    .overview-grid {
      display: grid;
      gap: 1rem;
    }

    .overview-grid--summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .student-hero-card,
    .dashboard-kpi-card,
    .stat-card,
    .surface-card {
      position: relative;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(251, 253, 255, 0.99));
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.045);
      overflow: hidden;
    }

    .student-hero-card mat-card-content {
      display: grid;
      gap: 0.7rem;
      padding: 1.25rem 1.25rem 1.2rem;
    }

    .student-hero-card__eyebrow {
      display: inline-flex;
      width: fit-content;
      margin: 0;
      padding: 0.33rem 0.72rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.65rem;
      font-weight: 700;
    }

    .student-hero-card h1 {
      margin: 0;
      font-size: clamp(1.35rem, 1.9vw, 1.9rem);
      letter-spacing: -0.04em;
      line-height: 1.08;
    }

    .student-hero-card__description {
      max-width: 42rem;
      margin: 0;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.5;
    }

    .student-hero-card__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .student-hero-card__chips span {
      display: inline-flex;
      align-items: center;
      min-height: 2.1rem;
      padding: 0 0.9rem;
      border-radius: 999px;
      background: #f7fbff;
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: #42526b;
      font-size: 0.7rem;
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
    }

    .student-hero-card__highlights {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
      margin-top: 0.15rem;
    }

    .student-hero-card__highlight {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 0.7rem;
      align-items: center;
      min-height: 88px;
      padding: 0.78rem 0.85rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.13);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
    }

    .student-hero-card__highlight-icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1rem;
    }

    .student-hero-card__highlight-icon.tone-teal { background: rgba(24, 196, 184, 0.12); color: #0f9f95; }
    .student-hero-card__highlight-icon.tone-blue { background: rgba(78, 108, 240, 0.12); color: #3557df; }
    .student-hero-card__highlight-icon.tone-pink { background: rgba(244, 114, 182, 0.14); color: #db2777; }
    .student-hero-card__highlight-icon.tone-orange { background: rgba(251, 146, 60, 0.14); color: #ea580c; }

    .student-hero-card__highlight-body {
      min-width: 0;
    }

    .student-hero-card__highlight-body p {
      margin: 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.11em;
      font-size: 0.58rem;
      font-weight: 800;
    }

    .student-hero-card__highlight-body strong {
      display: block;
      margin-top: 0.24rem;
      font-size: 0.84rem;
      line-height: 1.22;
      letter-spacing: -0.03em;
      color: var(--text-primary);
    }

    .student-hero-card__highlight-body span {
      display: block;
      margin-top: 0.22rem;
      color: var(--muted);
      font-size: 0.66rem;
      line-height: 1.35;
    }

    .overview-top-row .dashboard-kpi-card {
      min-height: 100%;
    }

    .overview-top-row .dashboard-kpi-card__ring {
      min-height: 168px;
    }

    .overview-top-row .dashboard-kpi-card__list {
      display: grid;
      gap: 0.75rem;
    }

    .overview-top-row .dashboard-kpi-card__item strong {
      display: block;
      font-size: 0.88rem;
      line-height: 1.3;
    }

    .overview-top-row .dashboard-kpi-card__item span {
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.45;
    }

    .overview-card__eyebrow {
      margin: 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.58rem;
      font-weight: 800;
    }

    .overview-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.95rem;
    }

    .overview-card__header h2 {
      margin: 0.3rem 0 0;
      font-size: 0.88rem;
      line-height: 1.28;
      letter-spacing: -0.028em;
    }

    .dashboard-page mat-card-title,
    .dashboard-page .mat-mdc-card-title {
      font-size: 0.92rem;
      line-height: 1.25;
      letter-spacing: -0.018em;
    }

    .overview-performance-card__badge,
    .overview-summary-card__badge,
    .overview-card-header__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2rem;
      padding: 0 0.75rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary);
      font-size: 0.66rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      white-space: nowrap;
    }

    .overview-performance-card__chart {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 225px;
      margin-top: 0.5rem;
    }

    .overview-performance-card__center {
      position: absolute;
      display: grid;
      gap: 0.15rem;
      place-items: center;
      text-align: center;
    }

    .overview-performance-card__center strong {
      font-size: 1.8rem;
      line-height: 1;
      letter-spacing: -0.05em;
    }

    .overview-performance-card__center span {
      color: var(--muted);
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .overview-performance-card__stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.7rem;
      margin-top: 0.75rem;
    }

    .overview-performance-card__stats div {
      display: grid;
      gap: 0.22rem;
      padding: 0.75rem 0.85rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      background: #fff;
    }

    .overview-performance-card__stats strong {
      font-size: 0.92rem;
      line-height: 1.2;
    }

    .overview-performance-card__stats span {
      color: var(--muted);
      font-size: 0.68rem;
      line-height: 1.35;
    }

    .overview-summary-card__list {
      display: grid;
      gap: 0.65rem;
    }

    .overview-summary-card__item {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.7rem 0.75rem;
      border-radius: 18px;
      background: #fdfefe;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .overview-summary-card__icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1rem;
    }

    .overview-summary-card__icon.tone-teal { background: rgba(24, 196, 184, 0.12); color: #0f9f95; }
    .overview-summary-card__icon.tone-blue { background: rgba(78, 108, 240, 0.12); color: #3557df; }
    .overview-summary-card__icon.tone-pink { background: rgba(244, 114, 182, 0.14); color: #db2777; }
    .overview-summary-card__icon.tone-orange { background: rgba(251, 146, 60, 0.14); color: #ea580c; }

    .overview-summary-card__item strong {
      display: block;
      font-size: 0.84rem;
      line-height: 1.25;
    }

    .overview-summary-card__item p {
      margin: 0.22rem 0 0;
      color: var(--muted);
      font-size: 0.7rem;
      line-height: 1.35;
    }

    .overview-summary-card__value {
      color: var(--primary-strong);
      font-size: 0.92rem;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .streak-card {
      display: grid;
      gap: 0.95rem;
      padding: 0.15rem 0 0.05rem;
    }

    .streak-card__lead {
      display: grid;
      gap: 0.35rem;
    }

    .streak-card__lead strong {
      font-size: 1.04rem;
      line-height: 1.2;
      letter-spacing: -0.035em;
      color: var(--text-primary);
    }

    .streak-card__lead span {
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.45;
    }

    .streak-card__week {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.4rem;
    }

    .streak-card__day {
      display: grid;
      justify-items: center;
      gap: 0.35rem;
      padding: 0.55rem 0.15rem 0.35rem;
      border-radius: 14px;
      border: 1px solid rgba(203, 213, 225, 0.12);
      background: linear-gradient(180deg, #f8fafc 0%, #f4f7fb 100%);
      color: #94a3b8;
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1;
    }

    .streak-card__day-icon {
      font-size: 1.15rem;
      line-height: 1;
      color: #cbd5e1;
    }

    .streak-card__day--active {
      border-color: rgba(251, 146, 60, 0.24);
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(255, 252, 247, 0.98));
      color: #b45309;
      box-shadow: 0 10px 18px rgba(251, 146, 60, 0.09);
    }

    .streak-card__day--active .streak-card__day-icon {
      color: #f97316;
    }

    .streak-card__footer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem 1.1rem;
      align-items: center;
    }

    .streak-card__footer-item {
      display: inline-flex;
      gap: 0.45rem;
      align-items: center;
      color: var(--text-primary);
      font-size: 0.72rem;
      line-height: 1.3;
    }

    .streak-card__footer-item .material-symbols-outlined {
      color: #64748b;
      font-size: 0.68rem;
      line-height: 1;
    }

    .streak-card__footer-item span {
      color: var(--muted);
    }

    .overview-main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.8fr);
      gap: 1rem;
      align-items: start;
    }

    .overview-side-stack {
      display: grid;
      gap: 1rem;
    }

    .overview-side-card,
    .overview-upcoming-card,
    .course-table-card {
      min-height: 100%;
    }

    .overview-card-header {
      padding: 1.15rem 1.15rem 0;
    }

    .overview-card-subtitle {
      margin: 0.28rem 0 0;
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.45;
    }

    .overview-card-header__badge {
      align-self: flex-start;
    }

    .upcoming-list {
      display: grid;
      gap: 0.8rem;
    }

    .upcoming-list__item {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: 0.85rem;
      align-items: center;
      padding: 0.85rem;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 20px;
      background: #fff;
    }

    .upcoming-list__badge,
    .course-table__thumb {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: #4e6cf0;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .upcoming-list__title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .upcoming-list__title-row strong,
    .course-table__course strong {
      font-size: 0.92rem;
      line-height: 1.25;
    }

    .upcoming-list__title-row p,
    .course-table__course p {
      margin: 0.18rem 0 0;
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.45;
    }

    .overview-pill,
    .course-table__status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 1.85rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      background: #edf4ff;
      color: var(--primary);
      font-size: 0.64rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      white-space: nowrap;
    }

    .upcoming-list__bar,
    .course-table__bar {
      height: 7px;
      border-radius: 999px;
      background: #e5eefb;
      overflow: hidden;
    }

    .upcoming-list__bar span,
    .course-table__bar span {
      display: block;
      width: 0;
      height: 100%;
      border-radius: inherit;
      background: #18c4b8;
    }

    .upcoming-list__body {
      display: grid;
      gap: 0.5rem;
    }

    .sidebar-stat {
      display: grid;
      gap: 0.15rem;
      padding: 0.85rem 0.95rem;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(78, 108, 240, 0.06), rgba(255, 255, 255, 0.96));
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .sidebar-stat strong {
      font-size: 1rem;
      line-height: 1.2;
    }

    .sidebar-stat span {
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.35;
    }

    .sidebar-mini-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
      margin-top: 0.8rem;
    }

    .sidebar-mini-list div {
      display: grid;
      gap: 0.16rem;
      padding: 0.72rem 0.8rem;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      background: #fff;
    }

    .sidebar-mini-list strong {
      font-size: 0.9rem;
    }

    .sidebar-mini-list span {
      color: var(--muted);
      font-size: 0.66rem;
      line-height: 1.3;
    }

    .assignment-card,
    .sidebar-notifications__item {
      display: grid;
      gap: 0.25rem;
      padding: 0.82rem 0.9rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      background: #fff;
    }

    .assignment-card strong,
    .sidebar-notifications__item strong {
      font-size: 0.88rem;
      line-height: 1.25;
    }

    .assignment-card p,
    .sidebar-notifications__item p {
      margin: 0;
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.4;
    }

    .assignment-card__meta {
      display: grid;
      gap: 0.18rem;
      margin-top: 0.35rem;
    }

    .assignment-card__meta span {
      color: var(--muted);
      font-size: 0.68rem;
      line-height: 1.35;
    }

    .sidebar-notifications {
      display: grid;
      gap: 0.65rem;
    }

    .sidebar-notifications__item {
      grid-template-columns: 36px minmax(0, 1fr);
      align-items: start;
    }

    .sidebar-notifications__icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
    }

    .course-table-card .mat-mdc-card-content {
      padding-top: 0.25rem;
    }

    .course-table {
      display: grid;
      gap: 0.65rem;
    }

    .course-table__row {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(180px, 1fr) minmax(120px, auto) auto;
      gap: 0.85rem;
      align-items: center;
      padding: 0.82rem 0.9rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      background: #fff;
    }

    .course-table__course {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      gap: 0.8rem;
      align-items: center;
    }

    .course-table__progress {
      display: grid;
      gap: 0.3rem;
    }

    .course-table__progress strong {
      font-size: 0.84rem;
      text-align: right;
    }

    .course-table__meta {
      display: grid;
      gap: 0.2rem;
      justify-items: start;
    }

    .course-table__meta p {
      margin: 0;
      color: var(--muted);
      font-size: 0.68rem;
      line-height: 1.35;
    }

    .overview-grid--loading {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .overview-skeleton {
      min-height: 260px;
      border-radius: 28px;
      background: linear-gradient(90deg, rgba(226, 232, 240, 0.58), rgba(241, 245, 249, 0.88), rgba(226, 232, 240, 0.58));
      background-size: 200% 100%;
      animation: pulse 1.4s ease-in-out infinite;
    }

    @keyframes pulse {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }

    .dashboard-hero--student {
      align-items: stretch;
    }

    .hero-card__eyebrow {
      display: inline-flex;
      width: fit-content;
      margin: 0 0 0.45rem;
      padding: 0.34rem 0.72rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.66rem;
      font-weight: 700;
    }

    .hero-card h1 {
      margin: 0;
      font-size: clamp(1.55rem, 2.2vw, 2.2rem);
      letter-spacing: -0.04em;
      line-height: 1.06;
    }

    .hero-card__description {
      max-width: 42rem;
      margin: 0.65rem 0 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .hero-card__search-empty {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 0.8rem;
      align-items: start;
      margin-top: 1.1rem;
      padding: 0.95rem 1rem;
      border: 1px dashed rgba(37, 99, 235, 0.18);
      border-radius: 18px;
      background: rgba(238, 244, 255, 0.58);
    }

    .hero-card__search-empty .material-symbols-outlined {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1.2rem;
    }

    .hero-card__search-empty strong {
      display: block;
      font-size: 0.92rem;
      line-height: 1.25;
    }

    .hero-card__search-empty p {
      margin: 0.3rem 0 0;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .spotlight-grid {
      display: grid;
      gap: 0.9rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 1.15rem;
    }

    .spotlight-card {
      display: grid;
      gap: 0.75rem;
      padding: 0.9rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 18px;
      background: #fff;
    }

    .spotlight-card__meta,
    .course-grid__head {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 0.9rem;
      align-items: center;
    }

    .spotlight-card__badge,
    .course-grid__thumb {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: #4e6cf0;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
    }

    .spotlight-card__meta strong,
    .course-grid__head strong,
    .recommend-grid__card strong,
    .achievement-list__item strong {
      font-size: 0.9rem;
    }

    .spotlight-card__meta p,
    .course-grid__head p,
    .recommend-grid__card p,
    .achievement-list__item p {
      margin: 0.28rem 0 0;
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.45;
    }

    .spotlight-card__progress {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.7rem;
      align-items: center;
    }

    .spotlight-card__bar {
      height: 8px;
      border-radius: 999px;
      background: #e5eefb;
      overflow: hidden;
    }

    .spotlight-card__bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #18c4b8;
    }

    .dashboard-kpi-card__ring {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 168px;
    }

    .dashboard-kpi-card__ring-value {
      position: absolute;
      font-size: 1.45rem;
      font-weight: 800;
      letter-spacing: -0.05em;
    }

    .metric-card__top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .metric-card__icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 1.05rem;
    }

    .metric-card__label,
    .metric-card__hint {
      display: block;
    }

    .metric-card__label {
      margin: 0;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.6rem;
      font-weight: 700;
    }

    .metric-card__value {
      display: block;
      margin-top: 0.9rem;
      font-size: clamp(1.3rem, 1.5vw, 1.7rem);
      letter-spacing: -0.03em;
      line-height: 1.05;
    }

    .metric-card__hint {
      margin-top: 0.45rem;
      color: var(--muted);
      line-height: 1.35;
      font-size: 0.72rem;
    }

    .course-grid,
    .recommend-grid {
      display: grid;
      gap: 0.9rem;
    }

    .course-grid__card,
    .recommend-grid__card {
      padding: 1rem;
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 18px;
      background: #fff;
    }

    .course-grid__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1rem;
      color: var(--muted);
      font-size: 0.72rem;
    }

    .recommend-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .recommend-grid__tag {
      display: inline-flex;
      width: fit-content;
      margin-bottom: 0.8rem;
      padding: 0.3rem 0.6rem;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--primary);
      font-size: 0.64rem;
      font-weight: 700;
    }

    .achievement-list {
      display: grid;
      gap: 0.85rem;
    }

    .achievement-list__item {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 0.8rem;
      align-items: start;
      padding: 0.9rem 0;
      border-bottom: 1px solid var(--border);
    }

    .achievement-list__item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .achievement-list__item .material-symbols-outlined {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--primary);
    }

    @media (max-width: 900px) {
      .overview-top-row {
        grid-template-columns: 1fr;
      }

      .student-hero-card__highlight {
        grid-template-columns: 38px minmax(0, 1fr);
      }

      .student-hero-card__highlights {
        grid-template-columns: 1fr;
      }

      .overview-grid--summary {
        grid-template-columns: 1fr;
      }

      .overview-grid--loading {
        grid-template-columns: 1fr;
      }

      .spotlight-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentDashboardComponent {
  private readonly studentPortalService = inject(StudentPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly sessionService = inject(SessionService);
  private readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly loading = signal(true);
  readonly stats = signal<StudentDashboardStats | null>(null);
  readonly progressSummary = signal<ProgressSummary | null>(null);
  readonly enrolledCourses = signal<EnrolledCourseItem[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly assignmentRecords = signal<StudentAssignmentRecord[]>([]);
  readonly courseProgressById = signal<Record<string, CourseProgress>>({});
  readonly errorMessage = signal<string | null>(null);
  readonly displayName = computed(() => {
    const user = this.sessionService.user();
    return user ? `${user.first_name} ${user.last_name}`.trim() : 'Learner';
  });
  readonly progressValue = computed(() => `${this.progressSummary()?.average_progress_percentage.toFixed(1) ?? '0.0'}%`);
  readonly searchQuery = computed(() => this.workspaceSearch.query().trim());
  readonly normalizedSearchQuery = computed(() => this.searchQuery().toLowerCase());
  readonly searchActive = computed(() => this.normalizedSearchQuery().length > 0);
  readonly filteredCourses = computed(() => {
    const query = this.normalizedSearchQuery();
    if (!query) {
      return this.enrolledCourses();
    }

    return this.enrolledCourses().filter((course) =>
      [course.title, course.short_description, course.slug, course.primary_instructor_name, course.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
  readonly filteredNotifications = computed(() => {
    const query = this.normalizedSearchQuery();
    if (!query) {
      return this.notifications();
    }

    return this.notifications().filter((item) =>
      `${item.title} ${item.body} ${item.notification_type}`
        .toLowerCase()
        .includes(query)
    );
  });
  readonly displayedCourses = computed(() => {
    const courses = this.filteredCourses();
    return this.searchActive() ? courses : courses.slice(0, 5);
  });
  readonly displayedNotifications = computed(() => {
    const notifications = this.filteredNotifications();
    return this.searchActive() ? notifications : notifications.slice(0, 4);
  });
  readonly heroCourses = computed(() => this.filteredCourses().slice(0, 2));
  readonly recommendedCourses = computed(() => this.filteredCourses().slice(0, 3));
  readonly latestGradedAssignment = computed(
    () => this.assignmentRecords().find((item) => item.status === 'graded' || item.score !== null && item.score !== undefined) ?? null
  );
  readonly heroHighlights = computed(() => {
    const stats = this.stats();
    const progress = this.progressSummary();
    if (!stats || !progress) {
      return [];
    }

    const firstCourse = this.enrolledCourses()[0] ?? null;
    const firstCourseProgress = firstCourse ? this.courseProgressPercentage(firstCourse.course_id) : 0;
    const notificationCount = this.filteredNotifications().length;

    return [
      {
        title: 'Current focus',
        value: firstCourse?.title ?? 'Browse your next course',
        copy: firstCourse
          ? `${firstCourseProgress.toFixed(0)}% complete · Resume your next lesson.`
          : 'Open the course catalog to start your next path.',
        icon: firstCourse ? 'play_circle' : 'search',
        tone: 'tone-blue'
      },
      {
        title: 'Learning streak',
        value: `${this.learningStreakDays()} days`,
        copy: 'A steady rhythm keeps momentum moving.',
        icon: 'local_fire_department',
        tone: 'tone-orange'
      },
      {
        title: 'Live activity',
        value: `${notificationCount} alerts`,
        copy: `${stats.completed_courses} completed courses · ${stats.in_progress_courses} active tracks.`,
        icon: 'notifications',
        tone: 'tone-pink'
      }
    ];
  });
  readonly overviewSummaryGroups = computed(() => {
    const stats = this.stats();
    const progress = this.progressSummary();
    if (!stats || !progress) {
      return [];
    }

    return [
      {
        title: 'Learning Snapshot',
        subtitle: 'Your course load and learning pace at a glance.',
        badge: `${stats.total_enrolled_courses} total`,
        items: [
          {
            icon: 'menu_book',
            label: 'Courses enrolled',
            detail: `${stats.in_progress_courses} in progress`,
            value: String(stats.total_enrolled_courses),
            tone: 'tone-teal'
          },
          {
            icon: 'workspace_premium',
            label: 'Courses completed',
            detail: 'Completed courses move you closer to certificates.',
            value: String(stats.completed_courses),
            tone: 'tone-blue'
          },
          {
            icon: 'schedule',
            label: 'Hours learned',
            detail: 'Based on recent completed lesson volume.',
            value: `${Math.max(stats.completed_lessons * 2.5, 2.5).toFixed(1)}h`,
            tone: 'tone-pink'
          }
        ]
      },
      {
        title: 'Activity Snapshot',
        subtitle: 'Recent course, assignment, and alert activity.',
        badge: `${this.displayedNotifications().length} alerts`,
        items: [
          {
            icon: 'notifications',
            label: 'Notifications',
            detail: 'Course and platform announcements awaiting review.',
            value: String(this.displayedNotifications().length),
            tone: 'tone-blue'
          },
          {
            icon: 'task_alt',
            label: 'Graded assignments',
            detail: 'Recently scored work from your active courses.',
            value: String(this.assignmentRecords().filter((item) => item.status === 'graded' || item.score !== null && item.score !== undefined).length),
            tone: 'tone-teal'
          },
          {
            icon: 'timeline',
            label: 'Average progress',
            detail: 'Blended completion across your active courses.',
            value: `${progress.average_progress_percentage.toFixed(0)}%`,
            tone: 'tone-orange'
          }
        ]
      }
    ];
  });
  readonly progressChartData = signal<ChartConfiguration<'bar' | 'line'>['data']>({
    labels: [],
    datasets: []
  });
  readonly distributionChartData = signal<ChartConfiguration<'doughnut'>['data']>({
    labels: [],
    datasets: []
  });
  readonly barChartOptions = signal<ChartConfiguration<'bar' | 'line'>['options']>({
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
      y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.16)' }, ticks: { color: '#627187', font: { family: 'IBM Plex Sans' } } }
    }
  });
  readonly doughnutChartOptions = signal<ChartConfiguration<'doughnut'>['options']>({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#162033', titleFont: { family: 'IBM Plex Sans' }, bodyFont: { family: 'IBM Plex Sans' } }
    }
  });
  readonly metricCards = computed(() => {
    const stats = this.stats();
    const progress = this.progressSummary();
    if (!stats || !progress) {
      return [];
    }

    return [
      { label: 'Courses Enrolled', value: String(stats.total_enrolled_courses), hint: `${stats.in_progress_courses} currently in progress`, icon: 'menu_book' },
      { label: 'Hours Learned This Week', value: `${Math.max(stats.completed_lessons * 2.5, 2.5).toFixed(1)}h`, hint: 'Based on recent completed lesson volume', icon: 'schedule' },
      { label: 'Current Streak', value: `${Math.max(stats.completed_lessons, 1)} days`, hint: 'Steady learning consistency improves completion confidence', icon: 'local_fire_department' },
      { label: 'Avg Score', value: `${progress.average_progress_percentage.toFixed(0)}%`, hint: 'Average progress across active courses', icon: 'workspace_premium' }
    ];
  });

  courseProgress(courseId: string): CourseProgress | null {
    return this.courseProgressById()[courseId] ?? null;
  }

  courseProgressPercentage(courseId: string): number {
    return this.courseProgress(courseId)?.progress_percentage ?? this.progressSummary()?.average_progress_percentage ?? 0;
  }

  learningStreakDays(): number {
    return Math.max(this.stats()?.completed_lessons ?? 0, 0);
  }

  streakTimeline(): Array<{ label: string; active: boolean }> {
    const labels = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const activeDays = Math.min(this.learningStreakDays(), labels.length);
    return labels.map((label, index) => ({
      label,
      active: index < activeDays
    }));
  }

  private loadCourseProgress(courses: EnrolledCourseItem[]): void {
    if (!courses.length) {
      this.courseProgressById.set({});
      return;
    }

    forkJoin(
      courses.map((course) =>
        this.studentPortalService.getCourseProgress(course.course_id).pipe(
          catchError(() => of(null))
        )
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((progressItems) => {
        const nextMap: Record<string, CourseProgress> = {};
        progressItems.forEach((progress, index) => {
          const courseId = courses[index]?.course_id;
          if (courseId && progress) {
            nextMap[courseId] = progress;
          }
        });
        this.courseProgressById.set(nextMap);
      });
  }

  constructor() {
    forkJoin({
      stats: this.studentPortalService.getDashboardStats(),
      progressSummary: this.studentPortalService.getProgressSummary(),
      enrolledCourses: this.studentPortalService.listEnrolledCourses(),
      notifications: this.studentPortalService.listNotifications().pipe(
        catchError(() => of({ items: [], total: 0 }))
      ),
      assignmentRecords: this.studentPortalService.listMyAssignmentSubmissions().pipe(
        catchError(() => of({ items: [], total: 0 }))
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, progressSummary, enrolledCourses, notifications, assignmentRecords }) => {
          this.stats.set(stats);
          this.progressSummary.set(progressSummary);
          this.enrolledCourses.set(enrolledCourses.items);
          this.notifications.set(notifications.items);
          this.assignmentRecords.set(assignmentRecords.items);
          this.loadCourseProgress(enrolledCourses.items);
          this.progressChartData.set({
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [
              {
                type: 'bar',
                label: 'Lessons',
                data: [1, 2, 2.5, 3, 3.5, 4],
                backgroundColor: '#4e6cf0',
                borderRadius: 14,
                maxBarThickness: 34
              },
              {
                type: 'line',
                label: 'Progress',
                data: [0.8, 1.6, 2.1, 2.8, 3.2, 3.8],
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(24, 196, 184, 0.10)',
                tension: 0.42,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHitRadius: 16
              }
            ]
          });
          this.distributionChartData.set({
            labels: ['In Progress Courses', 'Completed Courses', 'Remaining Lessons', 'Notifications'],
            datasets: [
              {
                data: [
                  stats.in_progress_courses,
                  stats.completed_courses,
                  Math.max(stats.total_lessons - stats.completed_lessons, 0),
                  notifications.items.length
                ],
                backgroundColor: ['#18c4b8', '#4e6cf0', '#9fd8ff', '#d8e7ff'],
                borderWidth: 0
              }
            ]
          });
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(error.error?.detail ?? 'Unable to load the student dashboard.');
          this.loading.set(false);
          this.snackBar.open(this.errorMessage() ?? 'Unable to load the student dashboard.', 'Dismiss', { duration: 4500 });
        }
      });
  }
}

