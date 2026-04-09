from pydantic import BaseModel


class AdminDashboardStatsResponse(BaseModel):
    total_students: int
    total_instructors: int
    total_courses: int
    published_courses: int
    total_enrollments: int
    active_enrollments: int
    total_assignments: int
    total_quizzes: int
    pending_approvals: int


class InstructorDashboardStatsResponse(BaseModel):
    total_courses: int
    published_courses: int
    total_students: int
    total_enrollments: int
    total_assignments: int
    total_quizzes: int
    average_student_progress_percentage: float


class StudentDashboardStatsResponse(BaseModel):
    total_enrolled_courses: int
    completed_courses: int
    in_progress_courses: int
    average_progress_percentage: float
    completed_lessons: int
    total_lessons: int
