"""SQLAlchemy models package for LMS modules."""

from app.models.announcement import Announcement, Notification
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.course import Course, CourseInstructor
from app.models.course_category import CourseCategory
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.instructor_approval_request import InstructorApprovalRequest
from app.models.lesson import Lesson
from app.models.lesson_progress import LessonProgress
from app.models.login_audit_log import LoginAuditLog
from app.models.quiz import Quiz, QuizAttempt, QuizAttemptAnswer, QuizQuestion, QuizQuestionOption
from app.models.refresh_token import RefreshToken
from app.models.role import Role
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile

__all__ = [
    "Course",
    "Announcement",
    "Assignment",
    "AssignmentSubmission",
    "CourseCategory",
    "CourseInstructor",
    "CourseModule",
    "Enrollment",
    "InstructorApprovalRequest",
    "Lesson",
    "LessonProgress",
    "LoginAuditLog",
    "Notification",
    "Quiz",
    "QuizAttempt",
    "QuizAttemptAnswer",
    "QuizQuestion",
    "QuizQuestionOption",
    "RefreshToken",
    "Role",
    "User",
    "UserRole",
    "UserProfile",
]
