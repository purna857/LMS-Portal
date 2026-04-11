import type { MessageResponse } from '@app/core/models/auth.model';
import type { NotificationItem } from '@app/features/admin/models/admin.models';
import type { CourseDetail, CourseListItem } from '@app/features/admin/models/admin.models';
import type { Assignment, QuizDetail, QuizListItem } from '@app/features/instructor/models/instructor.models';
import type { CourseModule, Lesson } from '@app/features/instructor/models/instructor.models';

export type {
  Assignment,
  CourseDetail,
  CourseListItem,
  CourseModule,
  Lesson,
  MessageResponse,
  NotificationItem,
  QuizDetail,
  QuizListItem
};

export interface StudentDashboardStats {
  total_enrolled_courses: number;
  completed_courses: number;
  in_progress_courses: number;
  average_progress_percentage: number;
  completed_lessons: number;
  total_lessons: number;
}

export interface ProgressSummary {
  total_courses: number;
  completed_courses: number;
  in_progress_courses: number;
  average_progress_percentage: number;
}

export interface EnrolledCourseItem {
  enrollment_id: string;
  course_id: string;
  title: string;
  slug: string;
  short_description?: string | null;
  thumbnail_url?: string | null;
  status: string;
  enrolled_at?: string | null;
  published_at?: string | null;
  primary_instructor_name?: string | null;
  progress?: number | null;
}

export interface EnrolledCourseListResponse {
  items: EnrolledCourseItem[];
  total: number;
}

export interface EnrollmentResponse {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  enrolled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  progress?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CourseProgress {
  course_id: string;
  enrollment_id: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  progress_status: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface LessonProgressItem {
  lesson_id: string;
  completed_at?: string | null;
}

export interface CourseLessonProgress {
  course_id: string;
  enrollment_id: string;
  completed_lesson_ids: string[];
  completed_module_ids: string[];
  items: LessonProgressItem[];
}

export interface AssignmentSubmitPayload {
  submission_text?: string | null;
  submission_link?: string | null;
  submission_file_url?: string | null;
  submission_file_name?: string | null;
  submission_file_size_bytes?: number | null;
}

export interface AssignmentUploadResponse {
  file_url: string;
  file_name: string;
  file_size_bytes: number;
}

export interface AssignmentSubmissionResponse {
  id: string;
  assignment_id: string;
  enrollment_id: string;
  submission_text?: string | null;
  submission_link?: string | null;
  submission_file_url?: string | null;
  submission_file_name?: string | null;
  submission_file_size_bytes?: number | null;
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

export interface StudentAssignmentRecord {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_title: string;
  submission_text?: string | null;
  submission_link?: string | null;
  submission_file_url?: string | null;
  submission_file_name?: string | null;
  submission_file_size_bytes?: number | null;
  status: string;
  submitted_at: string;
  graded_at?: string | null;
  score?: number | null;
  feedback?: string | null;
  is_late: boolean;
}

export interface StudentAssignmentRecordListResponse {
  items: StudentAssignmentRecord[];
  total: number;
}

export interface QuizAttemptAnswerInput {
  question_id: string;
  selected_option_ids: string[];
}

export interface QuizAttemptSubmitPayload {
  answers: QuizAttemptAnswerInput[];
}

export interface QuizAttemptAnswerResult {
  question_id: string;
  question_text: string;
  selected_option_ids: string[];
  correct_option_ids: string[];
  is_correct: boolean;
  earned_points: number;
  max_points: number;
}

export interface QuizAttemptResult {
  attempt_id: string;
  quiz_id: string;
  enrollment_id: string;
  attempt_number: number;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  submitted_at: string;
  answers: QuizAttemptAnswerResult[];
}

export interface QuizAttemptHistoryItem {
  attempt_id: string;
  attempt_number: number;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  submitted_at: string;
}

export interface QuizAttemptHistoryResponse {
  items: QuizAttemptHistoryItem[];
  total: number;
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
