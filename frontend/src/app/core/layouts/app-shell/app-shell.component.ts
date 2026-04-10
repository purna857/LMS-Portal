import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButton } from '@angular/material/button';

import { NotificationApiService } from '@app/core/api/services/notification-api.service';
import type { NavItem } from '@app/core/models/navigation.model';
import { AuthService } from '@app/core/services/auth.service';
import { SessionService } from '@app/core/services/session.service';
import { WorkspaceSearchService } from '@app/core/services/workspace-search.service';
import { AppLogoComponent } from '@app/shared/components/app-logo/app-logo.component';
import { materialImports } from '@app/shared/material/material-imports';
import type { NotificationItem } from '@app/features/admin/models/admin.models';


const NAV_ITEMS: NavItem[] = [
  {
    section: 'General',
    label: 'Workspace Hub',
    caption: 'Role entry points and shared overview',
    icon: 'dashboard',
    route: '/app/dashboard/hub',
    roles: ['admin', 'instructor', 'student']
  },
  {
    section: 'Platform Control',
    label: 'Control Center',
    caption: 'Platform command center and health overview',
    icon: 'space_dashboard',
    route: '/app/dashboard/admin',
    roles: ['admin']
  },
  {
    section: 'Platform Control',
    label: 'Instructor Reviews',
    caption: 'Approve or reject teaching applications',
    icon: 'verified_user',
    route: '/app/admin/approvals',
    roles: ['admin']
  },
  {
    section: 'Platform Control',
    label: 'Catalog',
    caption: 'Course publishing, metadata, and governance',
    icon: 'library_books',
    route: '/app/admin/courses',
    roles: ['admin']
  },
  {
    section: 'Platform Control',
    label: 'Users',
    caption: 'Accounts, access, and role control',
    icon: 'groups',
    route: '/app/admin/users',
    roles: ['admin']
  },
  {
    section: 'Platform Control',
    label: 'Taxonomy',
    caption: 'Catalog structure and grouping',
    icon: 'category',
    route: '/app/admin/categories',
    roles: ['admin']
  },
  {
    section: 'Platform Control',
    label: 'Broadcasts',
    caption: 'Platform-wide communication',
    icon: 'campaign',
    route: '/app/admin/announcements',
    roles: ['admin']
  },
  {
    section: 'Platform Control',
    label: 'Reports',
    caption: 'Executive analytics and platform health',
    icon: 'monitoring',
    route: '/app/admin/analytics',
    roles: ['admin']
  },
  {
    section: 'Teaching Workflow',
    label: 'Teaching Center',
    caption: 'Course command center and portfolio summary',
    icon: 'school',
    route: '/app/dashboard/instructor',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Course Studio',
    caption: 'Create, edit, publish, and maintain courses',
    icon: 'library_books',
    route: '/app/instructor/courses',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Curriculum Builder',
    caption: 'Modules, lessons, and sequencing',
    icon: 'topic',
    route: '/app/instructor/content',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Assessments',
    caption: 'Quiz authoring and question sets',
    icon: 'quiz',
    route: '/app/instructor/quizzes',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Assignments',
    caption: 'Submission review and grading',
    icon: 'assignment',
    route: '/app/instructor/assignments',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Learners',
    caption: 'Enrollment and progress tracking',
    icon: 'group',
    route: '/app/instructor/students',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Insights',
    caption: 'Teaching performance and course analytics',
    icon: 'insights',
    route: '/app/instructor/analytics',
    roles: ['instructor']
  },
  {
    section: 'Teaching Workflow',
    label: 'Broadcasts',
    caption: 'Course communication and learner updates',
    icon: 'notifications_active',
    route: '/app/instructor/announcements',
    roles: ['instructor']
  },
  {
    section: 'Learning Path',
    label: 'Learning Center',
    caption: 'Learning dashboard and progress summary',
    icon: 'menu_book',
    route: '/app/dashboard/student',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'My Learning',
    caption: 'Continue enrolled courses',
    icon: 'cast_for_education',
    route: '/app/student/courses',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Browse Catalog',
    caption: 'Discover new courses to enroll in',
    icon: 'travel_explore',
    route: '/app/student/browse',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Assignments',
    caption: 'Due work and submissions',
    icon: 'task',
    route: '/app/student/assignments',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Quizzes',
    caption: 'Attempts and results',
    icon: 'fact_check',
    route: '/app/student/quizzes',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Results',
    caption: 'Review quiz outcomes and attempt history',
    icon: 'assessment',
    route: '/app/student/results',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Progress',
    caption: 'Completion and momentum',
    icon: 'timeline',
    route: '/app/student/progress',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Notifications',
    caption: 'Course and platform updates',
    icon: 'notifications',
    route: '/app/student/notifications',
    roles: ['student']
  },
  {
    section: 'Learning Path',
    label: 'Certificates',
    caption: 'View earned certificates when available',
    icon: 'workspace_premium',
    route: '/app/student/certificates',
    roles: ['student']
  },
  {
    section: 'Account',
    label: 'Profile',
    caption: 'Personal account settings',
    icon: 'person',
    route: '/app/profile',
    roles: ['admin', 'instructor', 'student']
  }
];


@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AppLogoComponent,
    ...materialImports
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly router = inject(Router);
  readonly workspaceSearch = inject(WorkspaceSearchService);

  readonly sidebarCollapsed = signal(false);
  readonly mobileNavOpen = signal(false);
  readonly sessionService = inject(SessionService);
  readonly mainScroller = viewChild<ElementRef<HTMLElement>>('mainScroller');
  readonly navScroller = viewChild<ElementRef<HTMLElement>>('navScroller');
  readonly desktop = toSignal(
    this.breakpointObserver.observe('(min-width: 960px)').pipe(map((state) => state.matches)),
    { initialValue: true }
  );
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly accessibleNavigationItems = computed(() => {
    const userRoles = this.sessionService.user()?.roles ?? [];

    return NAV_ITEMS.filter((item) => item.roles.some((role) => userRoles.includes(role)));
  });
  readonly navigationSections = computed(() => {
    const visibleItems = this.accessibleNavigationItems().filter((item) => item.route !== '/app/dashboard/hub');
    const sectionMap = new Map<string, NavItem[]>();

    for (const item of visibleItems) {
      const items = sectionMap.get(item.section) ?? [];
      items.push(item);
      sectionMap.set(item.section, items);
    }

    return Array.from(sectionMap.entries())
      .map(([section, items]) => ({
        section,
        items
      }))
      .filter((section) => section.items.length > 0);
  });
  readonly searchSections = computed(() => {
    const query = this.workspaceSearch.normalizedQuery();
    if (!query) {
      return [];
    }

    const visibleItems = this.accessibleNavigationItems().filter((item) =>
      `${item.section} ${item.label} ${item.caption} ${item.route}`.toLowerCase().includes(query)
    );
    const sectionMap = new Map<string, NavItem[]>();

    for (const item of visibleItems) {
      const items = sectionMap.get(item.section) ?? [];
      items.push(item);
      sectionMap.set(item.section, items);
    }

    return Array.from(sectionMap.entries()).map(([section, items]) => ({
      section,
      items
    }));
  });
  readonly compactBrand = computed(() => this.desktop() && this.sidebarCollapsed());

  readonly displayName = computed(() => {
    const user = this.sessionService.user();
    return user ? `${user.first_name} ${user.last_name}` : 'Guest';
  });
  readonly avatarUrl = computed(() => this.sessionService.user()?.avatar_url?.trim() ?? '');
  readonly initials = computed(() => {
    const user = this.sessionService.user();
    if (!user) {
      return 'G';
    }
    return `${user.first_name?.charAt(0) ?? ''}${user.last_name?.charAt(0) ?? ''}`.trim() || 'U';
  });
  readonly roleLabel = computed(() => this.sessionService.primaryRole() ?? 'user');
  readonly greeting = computed(() => {
    const role = this.roleLabel();
    if (role === 'admin') {
      return 'Administration workspace';
    }
    if (role === 'instructor') {
      return 'Teaching workspace';
    }
    if (role === 'student') {
      return 'Learning workspace';
    }
    return 'Portal workspace';
  });
  readonly roleSummary = computed(() => {
    const role = this.roleLabel();
    if (role === 'admin') {
      return 'Govern the platform, approvals, catalog, and reporting';
    }
    if (role === 'instructor') {
      return 'Create content, monitor learners, and manage delivery';
    }
    if (role === 'student') {
      return 'Continue learning, assessments, and progress tracking';
    }
    return 'Access the LMS portal workspace';
  });
  readonly notifications = signal<NotificationItem[]>([]);
  readonly notificationCount = computed(() => this.notifications().filter((notification) => !notification.is_read).length);
  readonly notificationCenterRoute = computed(() => {
    const role = this.roleLabel();
    if (role === 'admin') {
      return '/app/admin/announcements';
    }
    if (role === 'instructor') {
      return '/app/instructor/announcements';
    }
    return '/app/student/notifications';
  });
  readonly activeNav = computed(() => {
    const rawUrl = this.currentUrl();
    const url = rawUrl.startsWith('/app/student/learning')
      ? '/app/student/courses'
      : rawUrl;
    const userRoles = this.sessionService.user()?.roles ?? [];
    const visibleItems = this.accessibleNavigationItems()
      .filter((item) => item.roles.some((role) => userRoles.includes(role)))
      .sort((left, right) => right.route.length - left.route.length);

    return visibleItems.find((item) => url.startsWith(item.route)) ?? visibleItems[0] ?? NAV_ITEMS[0];
  });
  readonly pageEyebrow = computed(() => this.activeNav()?.section ?? 'Workspace');
  readonly pageTitle = computed(() => this.activeNav()?.label ?? 'Dashboard');
  readonly pageDescription = computed(
    () => this.activeNav()?.caption ?? 'Manage your LMS workspace from a unified portal shell.'
  );
  readonly toolbarSearchVisible = computed(() => true);
  readonly toolbarSearchPlaceholder = computed(() => {
    const role = this.roleLabel();
    if (role === 'admin') {
      return 'Search users, courses, approvals, reports';
    }
    if (role === 'instructor') {
      return 'Search courses, modules, lessons, quizzes';
    }
    if (role === 'student') {
      return 'Search courses, lessons, progress, notifications';
    }
    return 'Search workspace';
  });

  constructor() {
    effect(() => {
      this.currentUrl();
      this.mobileNavOpen.set(false);
      queueMicrotask(() => {
        this.mainScroller()?.nativeElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        this.navScroller()?.nativeElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    });

    this.loadNotifications();
  }

  loadNotifications(): void {
    this.notificationApi
      .listMyNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => {
          const sortedItems = [...items].sort(
            (left, right) => right.created_at.localeCompare(left.created_at)
          );
          this.notifications.set(sortedItems);
        },
        error: () => {
          this.notifications.set([]);
        }
      });
  }

  syncProfileMenuWidth(button: MatButton, trigger: { updatePosition(): void }): void {
    const nativeButton = (button as MatButton & { _elementRef: ElementRef<HTMLElement> })._elementRef.nativeElement;
    const width = Math.max(nativeButton.offsetWidth, 0);
    if (!width) {
      return;
    }

    requestAnimationFrame(() => {
      const panel = document.querySelector('.mat-mdc-menu-panel.shell-menu--profile') as HTMLElement | null;
      if (!panel) {
        return;
      }

      panel.style.width = `${width}px`;
      panel.style.minWidth = `${width}px`;
      panel.style.maxWidth = `${width}px`;

      requestAnimationFrame(() => trigger.updatePosition());
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.workspaceSearch.clear();
        void this.router.navigate(['/auth/login']);
      },
      error: () => {
        this.workspaceSearch.clear();
        this.sessionService.clearSession();
        void this.router.navigate(['/auth/login']);
      }
    });
  }

  toggleSidebar(): void {
    if (this.desktop()) {
      this.sidebarCollapsed.update((value) => !value);
    }
  }

  openMobileNav(): void {
    if (!this.desktop()) {
      this.mobileNavOpen.set(true);
    }
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }
}
