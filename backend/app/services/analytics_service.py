from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment
from app.models.course import Course, CourseInstructor
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.instructor_approval_request import InstructorApprovalRequest
from app.models.lesson import Lesson
from app.models.lesson_progress import LessonProgress
from app.models.quiz import Quiz
from app.models.role import Role
from app.models.user import User, UserRole
from app.schemas.analytics import (
    AdminDashboardStatsResponse,
    InstructorDashboardStatsResponse,
    StudentDashboardStatsResponse,
)


class AnalyticsServiceError(Exception):
    pass


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_admin_dashboard_stats(self, current_user: User) -> AdminDashboardStatsResponse:
        if not (current_user.is_superuser or self._has_role(current_user, "admin")):
            raise AnalyticsServiceError("You do not have permission to view admin analytics")

        total_students = await self._count_active_users_by_role("student")
        total_instructors = await self._count_active_users_by_role("instructor")
        total_courses = await self._count_rows(Course)
        published_courses = await self._count_rows(Course, Course.status == "published")
        total_enrollments = await self._count_rows(Enrollment)
        active_enrollments = await self._count_rows(
            Enrollment,
            Enrollment.status.in_(("active", "completed")),
        )
        total_assignments = await self._count_rows(Assignment)
        total_quizzes = await self._count_rows(Quiz)
        pending_approvals = await self._count_rows(
            InstructorApprovalRequest,
            InstructorApprovalRequest.status.in_(("submitted", "under_review")),
        )

        return AdminDashboardStatsResponse(
            total_students=total_students,
            total_instructors=total_instructors,
            total_courses=total_courses,
            published_courses=published_courses,
            total_enrollments=total_enrollments,
            active_enrollments=active_enrollments,
            total_assignments=total_assignments,
            total_quizzes=total_quizzes,
            pending_approvals=pending_approvals,
        )

    async def get_instructor_dashboard_stats(self, current_user: User) -> InstructorDashboardStatsResponse:
        if not (
            current_user.is_superuser
            or self._has_role(current_user, "admin")
            or self._has_role(current_user, "instructor")
        ):
            raise AnalyticsServiceError("You do not have permission to view instructor analytics")

        course_ids = await self._get_instructor_course_ids(current_user)
        if not course_ids:
            return InstructorDashboardStatsResponse(
                total_courses=0,
                published_courses=0,
                total_students=0,
                total_enrollments=0,
                total_assignments=0,
                total_quizzes=0,
                average_student_progress_percentage=0.0,
            )

        total_courses = len(course_ids)
        published_courses = await self._count_rows(
            Course,
            Course.id.in_(course_ids),
            Course.status == "published",
        )
        total_students = await self._count_distinct_enrolled_students(course_ids)
        total_enrollments = await self._count_rows(
            Enrollment,
            Enrollment.course_id.in_(course_ids),
            Enrollment.status.in_(("active", "completed")),
        )
        total_assignments = await self._count_rows(Assignment, Assignment.course_id.in_(course_ids))
        total_quizzes = await self._count_rows(Quiz, Quiz.course_id.in_(course_ids))
        average_progress_percentage = await self._calculate_average_progress_percentage_for_courses(course_ids)

        return InstructorDashboardStatsResponse(
            total_courses=total_courses,
            published_courses=published_courses,
            total_students=total_students,
            total_enrollments=total_enrollments,
            total_assignments=total_assignments,
            total_quizzes=total_quizzes,
            average_student_progress_percentage=average_progress_percentage,
        )

    async def get_student_dashboard_stats(self, current_user: User) -> StudentDashboardStatsResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise AnalyticsServiceError("Only students can view student analytics")

        progress_rows = await self._get_progress_rows(Enrollment.user_id == current_user.id)
        total_enrolled_courses = len(progress_rows)
        completed_courses = 0
        in_progress_courses = 0
        total_lessons = 0
        completed_lessons = 0

        for row in progress_rows:
            lessons_total = int(row.total_lessons or 0)
            lessons_completed = min(int(row.completed_lessons or 0), lessons_total)
            total_lessons += lessons_total
            completed_lessons += lessons_completed

            if lessons_total > 0 and lessons_completed == lessons_total:
                completed_courses += 1
            elif lessons_completed > 0:
                in_progress_courses += 1

        average_progress_percentage = self._average_progress_percentage(progress_rows)

        return StudentDashboardStatsResponse(
            total_enrolled_courses=total_enrolled_courses,
            completed_courses=completed_courses,
            in_progress_courses=in_progress_courses,
            average_progress_percentage=average_progress_percentage,
            completed_lessons=completed_lessons,
            total_lessons=total_lessons,
        )

    async def _count_rows(self, model: type, *filters: object) -> int:
        statement = select(func.count()).select_from(model)
        if filters:
            statement = statement.where(*filters)
        return int((await self.session.execute(statement)).scalar_one())

    async def _count_active_users_by_role(self, role_code: str) -> int:
        statement = (
            select(func.count(distinct(User.id)))
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.status == "active",
                Role.status == "active",
                Role.code == role_code,
            )
        )
        return int((await self.session.execute(statement)).scalar_one())

    async def _count_distinct_enrolled_students(self, course_ids: Sequence[UUID]) -> int:
        statement = (
            select(func.count(distinct(Enrollment.user_id)))
            .select_from(Enrollment)
            .join(User, User.id == Enrollment.user_id)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                Enrollment.course_id.in_(course_ids),
                Enrollment.status.in_(("active", "completed")),
                User.status == "active",
                Role.status == "active",
                Role.code == "student",
            )
        )
        return int((await self.session.execute(statement)).scalar_one())

    async def _get_instructor_course_ids(self, current_user: User) -> list[UUID]:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            statement = select(Course.id)
        else:
            statement = select(CourseInstructor.course_id).where(CourseInstructor.instructor_id == current_user.id)
        return list((await self.session.execute(statement)).scalars().all())

    async def _calculate_average_progress_percentage_for_courses(self, course_ids: Sequence[UUID]) -> float:
        rows = await self._get_progress_rows(Enrollment.course_id.in_(course_ids))
        return self._average_progress_percentage(rows)

    async def _get_progress_rows(self, *enrollment_filters: object) -> list[object]:
        published_lessons_subquery = (
            select(
                CourseModule.course_id.label("course_id"),
                func.count(Lesson.id).label("total_lessons"),
            )
            .select_from(CourseModule)
            .join(Lesson, Lesson.module_id == CourseModule.id)
            .where(
                CourseModule.status == "published",
                Lesson.status == "published",
            )
            .group_by(CourseModule.course_id)
            .subquery()
        )

        completed_lessons_subquery = (
            select(
                LessonProgress.enrollment_id.label("enrollment_id"),
                func.count(distinct(LessonProgress.lesson_id)).label("completed_lessons"),
            )
            .select_from(LessonProgress)
            .join(Enrollment, Enrollment.id == LessonProgress.enrollment_id)
            .join(Lesson, Lesson.id == LessonProgress.lesson_id)
            .join(CourseModule, CourseModule.id == Lesson.module_id)
            .where(
                LessonProgress.completed_at.is_not(None),
                CourseModule.status == "published",
                Lesson.status == "published",
                CourseModule.course_id == Enrollment.course_id,
            )
            .group_by(LessonProgress.enrollment_id)
            .subquery()
        )

        statement = (
            select(
                Enrollment.id.label("enrollment_id"),
                Enrollment.course_id.label("course_id"),
                func.coalesce(published_lessons_subquery.c.total_lessons, 0).label("total_lessons"),
                func.coalesce(completed_lessons_subquery.c.completed_lessons, 0).label("completed_lessons"),
            )
            .select_from(Enrollment)
            .outerjoin(
                published_lessons_subquery,
                published_lessons_subquery.c.course_id == Enrollment.course_id,
            )
            .outerjoin(
                completed_lessons_subquery,
                completed_lessons_subquery.c.enrollment_id == Enrollment.id,
            )
            .where(
                Enrollment.status.in_(("active", "completed")),
                *enrollment_filters,
            )
        )
        return list((await self.session.execute(statement)).all())

    def _average_progress_percentage(self, progress_rows: Sequence[object]) -> float:
        if not progress_rows:
            return 0.0

        percentages: list[float] = []
        for row in progress_rows:
            total_lessons = int(row.total_lessons or 0)
            completed_lessons = min(int(row.completed_lessons or 0), total_lessons)
            if total_lessons <= 0:
                percentages.append(0.0)
            else:
                percentages.append(round((completed_lessons / total_lessons) * 100, 2))

        return round(sum(percentages) / len(percentages), 2)

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)

    def _has_explicit_role(self, current_user: User, role_code: str) -> bool:
        return role_code in self._role_codes(current_user)
