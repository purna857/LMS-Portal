from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseInstructor
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.lesson_progress import LessonProgress
from app.models.user import User
from app.schemas.progress import (
    CourseLessonProgressResponse,
    CourseProgressResponse,
    LessonProgressItemResponse,
    ProgressSummaryResponse,
    StudentCourseProgressItemResponse,
    StudentCourseProgressListResponse,
)
from app.utils.datetime import utc_now


class ProgressServiceError(Exception):
    pass


class ProgressService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def complete_lesson(self, lesson_id: UUID, current_user: User) -> CourseProgressResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise ProgressServiceError("Only students can mark lessons complete")

        lesson, module, course = await self._get_lesson_context_or_raise(lesson_id)
        if module.status != "published" or course.status != "published":
            raise ProgressServiceError("Only lessons from published course content can be marked complete")
        enrollment = await self._get_active_enrollment_or_raise(current_user.id, course.id)

        progress = await self._get_lesson_progress(enrollment.id, lesson.id)
        if progress is None:
            progress = LessonProgress(
                enrollment_id=enrollment.id,
                lesson_id=lesson.id,
                completed_at=utc_now(),
                last_accessed_at=utc_now(),
            )
            self.session.add(progress)
        else:
            progress.last_accessed_at = utc_now()
            if progress.completed_at is None:
                progress.completed_at = utc_now()

        if enrollment.started_at is None:
            enrollment.started_at = utc_now()

        await self._update_enrollment_progress_status(enrollment)
        await self.session.commit()
        return await self.get_student_course_progress(course.id, current_user)

    async def get_student_course_progress(self, course_id: UUID, current_user: User) -> CourseProgressResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise ProgressServiceError("Only students can view their course progress")

        enrollment = await self._get_active_enrollment_or_raise(current_user.id, course_id)
        return await self._build_course_progress(enrollment)

    async def get_student_course_lesson_progress(
        self,
        course_id: UUID,
        current_user: User,
    ) -> CourseLessonProgressResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise ProgressServiceError("Only students can view their lesson progress")

        enrollment = await self._get_active_enrollment_or_raise(current_user.id, course_id)
        lessons = await self._get_published_course_lessons(course_id)
        lesson_ids = [lesson.id for lesson in lessons]
        if not lesson_ids:
            return CourseLessonProgressResponse(
                course_id=str(course_id),
                enrollment_id=str(enrollment.id),
                completed_lesson_ids=[],
                completed_module_ids=[],
                items=[],
            )

        statement = (
            select(LessonProgress)
            .where(
                LessonProgress.enrollment_id == enrollment.id,
                LessonProgress.lesson_id.in_(lesson_ids),
                LessonProgress.completed_at.is_not(None),
            )
            .order_by(LessonProgress.completed_at.asc())
        )
        progress_rows = (await self.session.execute(statement)).scalars().all()
        completed_lesson_ids = {row.lesson_id for row in progress_rows}

        module_to_lessons: dict[UUID, list[UUID]] = {}
        for lesson in lessons:
            module_to_lessons.setdefault(lesson.module_id, []).append(lesson.id)

        completed_module_ids = [
            str(module_id)
            for module_id, module_lesson_ids in module_to_lessons.items()
            if module_lesson_ids and all(lesson_id in completed_lesson_ids for lesson_id in module_lesson_ids)
        ]

        return CourseLessonProgressResponse(
            course_id=str(course_id),
            enrollment_id=str(enrollment.id),
            completed_lesson_ids=[str(row.lesson_id) for row in progress_rows],
            completed_module_ids=completed_module_ids,
            items=[
                LessonProgressItemResponse(
                    lesson_id=str(row.lesson_id),
                    completed_at=row.completed_at,
                )
                for row in progress_rows
            ],
        )

    async def list_course_student_progress(
        self,
        course_id: UUID,
        current_user: User,
    ) -> StudentCourseProgressListResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_instructor_or_admin_access(course, current_user)

        statement = (
            select(Enrollment)
            .options(selectinload(Enrollment.user))
            .where(
                Enrollment.course_id == course.id,
                Enrollment.status.in_(("active", "completed")),
            )
            .order_by(Enrollment.created_at.desc())
        )
        enrollments = (await self.session.execute(statement)).scalars().all()
        items: list[StudentCourseProgressItemResponse] = []
        for enrollment in enrollments:
            progress = await self._build_course_progress(enrollment)
            items.append(
                StudentCourseProgressItemResponse(
                    student_id=str(enrollment.user_id),
                    student_name=f"{enrollment.user.first_name} {enrollment.user.last_name}".strip(),
                    student_email=enrollment.user.email,
                    enrollment_id=str(enrollment.id),
                    total_lessons=progress.total_lessons,
                    completed_lessons=progress.completed_lessons,
                    progress_percentage=progress.progress_percentage,
                    progress_status=progress.progress_status,
                    started_at=progress.started_at,
                    completed_at=progress.completed_at,
                )
            )
        return StudentCourseProgressListResponse(items=items, total=len(items))

    async def get_progress_summary(self, current_user: User) -> ProgressSummaryResponse:
        if self._has_explicit_role(current_user, "student"):
            statement = select(Enrollment).where(
                Enrollment.user_id == current_user.id,
                Enrollment.status.in_(("active", "completed")),
            )
            enrollments = (await self.session.execute(statement)).scalars().all()
            progress_items = [await self._build_course_progress(enrollment) for enrollment in enrollments]
            return self._serialize_summary(progress_items)

        if current_user.is_superuser or self._has_role(current_user, "admin"):
            statement = select(Enrollment).where(Enrollment.status.in_(("active", "completed")))
            enrollments = (await self.session.execute(statement)).scalars().all()
            progress_items = [await self._build_course_progress(enrollment) for enrollment in enrollments]
            return self._serialize_summary(progress_items)

        if self._has_role(current_user, "instructor"):
            course_ids = await self._get_instructor_course_ids(current_user.id)
            if not course_ids:
                return ProgressSummaryResponse(
                    total_courses=0,
                    completed_courses=0,
                    in_progress_courses=0,
                    average_progress_percentage=0.0,
                )
            statement = select(Enrollment).where(
                Enrollment.course_id.in_(course_ids),
                Enrollment.status.in_(("active", "completed")),
            )
            enrollments = (await self.session.execute(statement)).scalars().all()
            progress_items = [await self._build_course_progress(enrollment) for enrollment in enrollments]
            return self._serialize_summary(progress_items)

        raise ProgressServiceError("You do not have permission to view progress summary")

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise ProgressServiceError("Course not found")
        return course

    async def _get_lesson_context_or_raise(self, lesson_id: UUID) -> tuple[Lesson, CourseModule, Course]:
        statement = (
            select(Lesson, CourseModule, Course)
            .join(CourseModule, Lesson.module_id == CourseModule.id)
            .join(Course, Course.id == CourseModule.course_id)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Lesson.id == lesson_id)
        )
        row = (await self.session.execute(statement)).one_or_none()
        if row is None:
            raise ProgressServiceError("Course not found for lesson")
        lesson, module, course = row
        return lesson, module, course

    async def _get_lesson_or_raise(self, lesson_id: UUID) -> Lesson:
        statement = select(Lesson).where(Lesson.id == lesson_id)
        lesson = (await self.session.execute(statement)).scalar_one_or_none()
        if lesson is None:
            raise ProgressServiceError("Lesson not found")
        if lesson.status != "published":
            raise ProgressServiceError("Only published lessons can be marked complete")
        return lesson

    async def _get_active_enrollment_or_raise(self, user_id: UUID, course_id: UUID) -> Enrollment:
        statement = (
            select(Enrollment)
            .options(selectinload(Enrollment.user))
            .where(
                Enrollment.user_id == user_id,
                Enrollment.course_id == course_id,
                Enrollment.status.in_(("active", "completed")),
            )
        )
        enrollment = (await self.session.execute(statement)).scalar_one_or_none()
        if enrollment is None:
            raise ProgressServiceError("Student is not enrolled in this course")
        return enrollment

    async def _get_lesson_progress(self, enrollment_id: UUID, lesson_id: UUID) -> LessonProgress | None:
        statement = select(LessonProgress).where(
            LessonProgress.enrollment_id == enrollment_id,
            LessonProgress.lesson_id == lesson_id,
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _get_published_course_lessons(self, course_id: UUID) -> list[Lesson]:
        statement = (
            select(Lesson)
            .join(CourseModule, CourseModule.id == Lesson.module_id)
            .where(
                CourseModule.course_id == course_id,
                CourseModule.status == "published",
                Lesson.status == "published",
            )
            .order_by(CourseModule.position.asc(), Lesson.position.asc())
        )
        return list((await self.session.execute(statement)).scalars().all())

    async def _build_course_progress(self, enrollment: Enrollment) -> CourseProgressResponse:
        lessons = await self._get_published_course_lessons(enrollment.course_id)
        total_lessons = len(lessons)

        lesson_ids = [lesson.id for lesson in lessons]
        completed_lessons = 0
        if lesson_ids:
            statement = select(LessonProgress).where(
                LessonProgress.enrollment_id == enrollment.id,
                LessonProgress.lesson_id.in_(lesson_ids),
                LessonProgress.completed_at.is_not(None),
            )
            completed_records = (await self.session.execute(statement)).scalars().all()
            completed_lessons = len(completed_records)

        progress_percentage = 0.0
        if total_lessons > 0:
            progress_percentage = round((completed_lessons / total_lessons) * 100, 2)

        progress_status = "not_started"
        if completed_lessons > 0 and completed_lessons < total_lessons:
            progress_status = "in_progress"
        elif total_lessons > 0 and completed_lessons == total_lessons:
            progress_status = "completed"

        return CourseProgressResponse(
            course_id=str(enrollment.course_id),
            enrollment_id=str(enrollment.id),
            total_lessons=total_lessons,
            completed_lessons=completed_lessons,
            progress_percentage=progress_percentage,
            progress_status=progress_status,
            started_at=enrollment.started_at,
            completed_at=enrollment.completed_at,
        )

    async def _update_enrollment_progress_status(self, enrollment: Enrollment) -> None:
        progress = await self._build_course_progress(enrollment)
        if progress.progress_status == "completed":
            enrollment.status = "completed"
            if enrollment.completed_at is None:
                enrollment.completed_at = utc_now()
        else:
            if enrollment.status == "completed":
                enrollment.status = "active"
                enrollment.completed_at = None
            if progress.completed_lessons > 0 and enrollment.started_at is None:
                enrollment.started_at = utc_now()

    async def _ensure_instructor_or_admin_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise ProgressServiceError("You do not have permission to view progress for this course")

    async def _get_instructor_course_ids(self, instructor_id: UUID) -> list[UUID]:
        statement = select(CourseInstructor.course_id).where(CourseInstructor.instructor_id == instructor_id)
        rows = (await self.session.execute(statement)).all()
        return [row[0] for row in rows]

    def _serialize_summary(self, progress_items: Sequence[CourseProgressResponse]) -> ProgressSummaryResponse:
        total_courses = len(progress_items)
        completed_courses = sum(1 for item in progress_items if item.progress_status == "completed")
        in_progress_courses = sum(1 for item in progress_items if item.progress_status == "in_progress")
        average_progress_percentage = 0.0
        if total_courses > 0:
            average_progress_percentage = round(
                sum(item.progress_percentage for item in progress_items) / total_courses,
                2,
            )
        return ProgressSummaryResponse(
            total_courses=total_courses,
            completed_courses=completed_courses,
            in_progress_courses=in_progress_courses,
            average_progress_percentage=average_progress_percentage,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)

    def _has_explicit_role(self, current_user: User, role_code: str) -> bool:
        return role_code in self._role_codes(current_user)
