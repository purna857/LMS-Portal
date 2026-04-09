import type {
  AnnouncementResponse,
  CourseCategory,
  CourseDetail,
  CourseListItem,
  CourseListResponse,
  CoursePublishActionResponse,
  CourseUpdatePayload,
  NotificationItem
} from '@app/features/admin/models/admin.models';

export type {
  AnnouncementResponse,
  CourseCategory,
  CourseDetail,
  CourseListItem,
  CourseListResponse,
  CoursePublishActionResponse,
  CourseUpdatePayload,
  NotificationItem
};

export interface CourseCreatePayload {
  category_id?: string | null;
  title: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  visibility: 'public' | 'private' | 'restricted';
  estimated_duration_minutes?: number | null;
  is_featured: boolean;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  position: number;
  status: 'draft' | 'published' | 'archived';
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseModuleListResponse {
  items: CourseModule[];
  total: number;
}

export interface CourseModulePayload {
  title: string;
  description?: string | null;
  position?: number | null;
  status: 'draft' | 'published' | 'archived';
  is_preview: boolean;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  lesson_type: 'video' | 'text' | 'resource_link';
  content?: string | null;
  video_url?: string | null;
  resource_url?: string | null;
  duration_minutes?: number | null;
  position: number;
  status: 'draft' | 'published' | 'archived';
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonListResponse {
  items: Lesson[];
  total: number;
}

export interface LessonPayload {
  title: string;
  lesson_type: 'video' | 'text' | 'resource_link';
  content?: string | null;
  video_url?: string | null;
  resource_url?: string | null;
  duration_minutes?: number | null;
  position?: number | null;
  status: 'draft' | 'published' | 'archived';
  is_preview: boolean;
}

export interface Assignment {
  id: string;
  course_id: string;
  module_id?: string | null;
  lesson_id?: string | null;
  title: string;
  description?: string | null;
  instructions?: string | null;
  max_score: number;
  pass_score?: number | null;
  due_at?: string | null;
  allow_late_submission: boolean;
  status: 'draft' | 'published' | 'closed' | 'archived';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentListResponse {
  items: Assignment[];
  total: number;
}

export interface AssignmentPayload {
  module_id?: string | null;
  lesson_id?: string | null;
  title: string;
  description?: string | null;
  instructions?: string | null;
  max_score: number;
  pass_score?: number | null;
  due_at?: string | null;
  allow_late_submission: boolean;
  status: 'draft' | 'published' | 'closed' | 'archived';
}

export interface AssignmentSubmission {
  submission_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  submission_text?: string | null;
  submission_link?: string | null;
  submission_file_url?: string | null;
  submission_file_name?: string | null;
  submission_file_size_bytes?: number | null;
  feedback?: string | null;
  status: string;
  submitted_at: string;
  graded_at?: string | null;
  score?: number | null;
  is_late: boolean;
}

export interface AssignmentSubmissionListResponse {
  items: AssignmentSubmission[];
  total: number;
}

export interface AssignmentSubmissionDetail {
  id: string;
  assignment_id: string;
  enrollment_id: string;
  submission_text?: string | null;
  submission_link?: string | null;
  status: string;
  submitted_at: string;
  graded_at?: string | null;
  graded_by?: string | null;
  score?: number | null;
  feedback?: string | null;
  is_late: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentGradePayload {
  score: number;
  feedback?: string | null;
}

export interface QuizListItem {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  passing_score?: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  status: 'draft' | 'published' | 'archived';
  question_count: number;
  total_points: number;
  published_at?: string | null;
  created_at: string;
}

export interface QuizListResponse {
  items: QuizListItem[];
  total: number;
}

export interface QuizQuestionOptionInput {
  option_text: string;
  is_correct: boolean;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  explanation?: string | null;
  points: number;
  position: number;
  allow_multiple_answers: boolean;
  options: {
    id: string;
    option_text: string;
    position: number;
    is_correct: boolean;
  }[];
  created_at: string;
  updated_at: string;
}

export interface QuizDetail {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  passing_score?: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  status: 'draft' | 'published' | 'archived';
  published_at?: string | null;
  question_count: number;
  total_points: number;
  questions: QuizQuestion[];
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizPayload {
  title: string;
  description?: string | null;
  instructions?: string | null;
  passing_score?: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  status: 'draft' | 'published' | 'archived';
}

export interface QuizQuestionPayload {
  question_text: string;
  explanation?: string | null;
  points: number;
  position?: number | null;
  allow_multiple_answers: boolean;
  options: QuizQuestionOptionInput[];
}

export interface StudentEnrollment {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  enrolled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface EnrolledStudentsResponse {
  items: StudentEnrollment[];
  total: number;
}

export interface EnrollmentStats {
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  dropped_enrollments: number;
  suspended_enrollments: number;
}

export interface StudentCourseProgress {
  student_id: string;
  student_name: string;
  student_email: string;
  enrollment_id: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  progress_status: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface StudentCourseProgressListResponse {
  items: StudentCourseProgress[];
  total: number;
}

export interface InstructorDashboardStats {
  total_courses: number;
  published_courses: number;
  total_students: number;
  total_enrollments: number;
  total_assignments: number;
  total_quizzes: number;
  average_student_progress_percentage: number;
}

export interface CourseAnnouncementPayload {
  title: string;
  body: string;
  include_students: boolean;
  include_instructors: boolean;
}
