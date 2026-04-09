import { Routes } from '@angular/router';

import { authGuard } from '@app/core/guards/auth.guard';
import { guestGuard } from '@app/core/guards/guest.guard';
import { roleGuard } from '@app/core/guards/role.guard';


export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app/dashboard'
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () => import('@app/features/auth/pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'auth/signup',
    canActivate: [guestGuard],
    loadComponent: () => import('@app/features/auth/pages/signup/signup.component').then((m) => m.SignupComponent)
  },
  {
    path: 'auth/forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('@app/features/auth/pages/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'auth/reset-password',
    canActivate: [guestGuard],
    loadComponent: () => import('@app/features/auth/pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  {
    path: 'auth/forbidden',
    loadComponent: () => import('@app/features/auth/pages/forbidden/forbidden.component').then((m) => m.ForbiddenComponent)
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('@app/core/layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('@app/features/dashboard/pages/dashboard-redirect/dashboard-redirect.component').then((m) => m.DashboardRedirectComponent)
      },
      {
        path: 'dashboard/hub',
        loadComponent: () => import('@app/features/dashboard/pages/dashboard-home/dashboard-home.component').then((m) => m.DashboardHomeComponent)
      },
      {
        path: 'dashboard/admin',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/dashboard/pages/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent)
      },
      {
        path: 'dashboard/instructor',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/dashboard/pages/instructor-dashboard/instructor-dashboard.component').then((m) => m.InstructorDashboardComponent)
      },
      {
        path: 'dashboard/student',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/dashboard/pages/student-dashboard/student-dashboard.component').then((m) => m.StudentDashboardComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('@app/features/profile/pages/profile-home/profile-home.component').then((m) => m.ProfileHomeComponent)
      },
      {
        path: 'admin/analytics',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/admin/pages/reports/reports.component').then((m) => m.ReportsComponent)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/admin/pages/user-management/user-management.component').then((m) => m.UserManagementComponent)
      },
      {
        path: 'admin/approvals',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/admin/pages/instructor-approvals/instructor-approvals.component').then((m) => m.InstructorApprovalsComponent)
      },
      {
        path: 'admin/courses',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/admin/pages/course-management/course-management.component').then((m) => m.CourseManagementComponent)
      },
      {
        path: 'admin/categories',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/admin/pages/categories/categories.component').then((m) => m.CategoriesComponent)
      },
      {
        path: 'admin/announcements',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@app/features/admin/pages/announcements/announcements.component').then((m) => m.AnnouncementsComponent)
      },
      {
        path: 'instructor/courses',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/my-courses/my-courses.component').then((m) => m.MyCoursesComponent)
      },
      {
        path: 'instructor/content',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/content-management/content-management.component').then((m) => m.ContentManagementComponent)
      },
      {
        path: 'instructor/students',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/students/students.component').then((m) => m.StudentsComponent)
      },
      {
        path: 'instructor/assignments',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/assignments/assignments.component').then((m) => m.AssignmentsComponent)
      },
      {
        path: 'instructor/quizzes',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/quizzes/quizzes.component').then((m) => m.QuizzesComponent)
      },
      {
        path: 'instructor/analytics',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/analytics/analytics.component').then((m) => m.AnalyticsComponent)
      },
      {
        path: 'instructor/announcements',
        canActivate: [roleGuard],
        data: { roles: ['instructor'] },
        loadComponent: () => import('@app/features/instructor/pages/announcements/announcements.component').then((m) => m.AnnouncementsComponent)
      },
      {
        path: 'student/browse',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/browse-courses/browse-courses.component').then((m) => m.BrowseCoursesComponent)
      },
      {
        path: 'student/courses',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/my-learning/my-learning.component').then((m) => m.MyLearningComponent)
      },
      {
        path: 'student/browse/:courseId',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/course-details/course-details.component').then((m) => m.CourseDetailsComponent)
      },
      {
        path: 'student/learning/:courseId',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/lesson-view/lesson-view.component').then((m) => m.LessonViewComponent)
      },
      {
        path: 'student/learning/:courseId/lessons/:lessonId',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/lesson-view/lesson-view.component').then((m) => m.LessonViewComponent)
      },
      {
        path: 'student/assignments',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/assignments/assignments.component').then((m) => m.StudentAssignmentsComponent)
      },
      {
        path: 'student/quizzes',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/quizzes/quizzes.component').then((m) => m.StudentQuizzesComponent)
      },
      {
        path: 'student/results',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/results/results.component').then((m) => m.ResultsComponent)
      },
      {
        path: 'student/results/:attemptId',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/results/results.component').then((m) => m.ResultsComponent)
      },
      {
        path: 'student/progress',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/my-learning/my-learning.component').then((m) => m.MyLearningComponent)
      },
      {
        path: 'student/notifications',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/notifications/notifications.component').then((m) => m.StudentNotificationsComponent)
      },
      {
        path: 'student/certificates',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () => import('@app/features/student/pages/certificates/certificates.component').then((m) => m.CertificatesComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'app/dashboard'
  }
];
