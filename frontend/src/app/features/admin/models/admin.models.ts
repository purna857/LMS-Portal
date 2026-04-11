export interface AdminDashboardStats {
  total_students: number;
  total_instructors: number;
  total_courses: number;
  published_courses: number;
  total_enrollments: number;
  active_enrollments: number;
  total_assignments: number;
  total_quizzes: number;
  pending_approvals: number;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  status: string;
  email_verified: boolean;
  is_superuser: boolean;
  roles: string[];
  last_login_at?: string | null;
  created_at: string;
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface InstructorApprovalItem {
  request_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_status: string;
  approval_status: string;
  headline?: string | null;
  expertise?: string | null;
  experience_years?: number | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  resume_file_url?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface InstructorApprovalListResponse {
  items: InstructorApprovalItem[];
  total: number;
}

export interface InstructorApprovalActionResponse {
  message: string;
  request_id: string;
  user_id: string;
  approval_status: string;
  user_status: string;
}

export interface CourseCategory {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  status: 'active' | 'inactive';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CourseCategoryPayload {
  name: string;
  slug: string;
  description?: string | null;
  status: 'active' | 'inactive';
  sort_order: number;
  parent_id?: string | null;
}

export interface CourseListItem {
  id: string;
  category_id?: string | null;
  category_name?: string | null;
  title: string;
  slug: string;
  short_description?: string | null;
  thumbnail_url?: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  status: string;
  visibility: 'public' | 'private' | 'restricted';
  estimated_duration_minutes?: number | null;
  is_featured: boolean;
  total_enrollments?: number;
  published_at?: string | null;
  created_at: string;
  primary_instructor_id?: string | null;
  primary_instructor_name?: string | null;
}

export interface CourseListResponse {
  items: CourseListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CourseDetail {
  id: string;
  category?: CourseCategory | null;
  title: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  status: string;
  visibility: 'public' | 'private' | 'restricted';
  estimated_duration_minutes?: number | null;
  is_featured: boolean;
  published_at?: string | null;
  archived_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  instructor_ids: string[];
}

export interface CourseUpdatePayload {
  category_id?: string | null;
  title?: string | null;
  slug?: string | null;
  short_description?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  level?: 'beginner' | 'intermediate' | 'advanced' | null;
  language?: string | null;
  visibility?: 'public' | 'private' | 'restricted' | null;
  estimated_duration_minutes?: number | null;
  is_featured?: boolean | null;
}

export interface CoursePublishActionResponse {
  message: string;
  course_id: string;
  status: string;
}

export interface AnnouncementResponse {
  id: string;
  announcement_type: 'platform' | 'course';
  course_id?: string | null;
  title: string;
  body: string;
  target_roles: string[];
  include_students: boolean;
  include_instructors: boolean;
  created_by?: string | null;
  created_at: string;
}

export interface PlatformAnnouncementPayload {
  title: string;
  body: string;
  target_roles?: string[] | null;
}

export interface NotificationItem {
  id: string;
  announcement_id?: string | null;
  course_id?: string | null;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
}

export interface AdminAssignmentTrackerItem {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_title: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  submitted_at: string;
  graded_at?: string | null;
  score?: number | null;
  max_score: number;
  feedback?: string | null;
  is_late: boolean;
  submission_file_url?: string | null;
  submission_file_name?: string | null;
}

export interface AdminAssignmentTrackerListResponse {
  items: AdminAssignmentTrackerItem[];
  total: number;
}

export interface UserListQuery {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  role?: string;
}

export interface CourseListQuery {
  limit?: number;
  offset?: number;
  search?: string;
  category_id?: string;
  level?: string;
  language?: string;
  status?: string;
}
