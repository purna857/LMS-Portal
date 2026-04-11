from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseInstructor
from app.models.enrollment import Enrollment
from app.models.user import User, UserRole
from app.schemas.enrollment import (
    EnrolledCourseItemResponse,
    EnrolledCoursesListResponse,
    EnrolledStudentsListResponse,
    EnrollmentResponse,
    EnrollmentStatsResponse,
    StudentEnrollmentItemResponse,
)
from app.utils.datetime import utc_now


class EnrollmentServiceError(Exception):
    pass


class EnrollmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def enroll_in_course(self, course_id: UUID, current_user: User) -> EnrollmentResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise EnrollmentServiceError("Only students can enroll in courses")

        course = await self._get_course_or_raise(course_id)
        if course.status != "published":
            raise EnrollmentServiceError("Only published courses can be enrolled")

        existing = await self._get_enrollment_by_user_and_course(current_user.id, course.id)
        if existing is not None:
            raise EnrollmentServiceError("Student is already enrolled in this course")

        enrollment = Enrollment(
            user_id=current_user.id,
            course_id=course.id,
            status="active",
            enrolled_at=utc_now(),
            progress=0.0,
        )
        self.session.add(enrollment)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise EnrollmentServiceError("Student is already enrolled in this course") from exc
        await self.session.refresh(enrollment)
        return self._serialize_enrollment(enrollment)

    async def assign_course_to_student(
        self,
        course_id: UUID,
        student_id: UUID,
        current_user: User,
    ) -> EnrollmentResponse:
        if not (current_user.is_superuser or self._has_role(current_user, "admin")):
            raise EnrollmentServiceError("Only admins can assign courses to students")

        course = await self._get_course_or_raise(course_id)
        student = await self._get_user_or_raise(student_id)

        if not self._has_explicit_role(student, "student"):
            raise EnrollmentServiceError("Selected user is not a student")

        existing = await self._get_enrollment_by_user_and_course(student.id, course.id)
        if existing is not None:
            raise EnrollmentServiceError("Student is already enrolled in this course")

        enrollment = Enrollment(
            user_id=student.id,
            course_id=course.id,
            status="active",
            enrolled_at=utc_now(),
            progress=0.0,
        )
        self.session.add(enrollment)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise EnrollmentServiceError("Student is already enrolled in this course") from exc
        await self.session.refresh(enrollment)
        return self._serialize_enrollment(enrollment)

    async def list_student_enrolled_courses(self, current_user: User) -> EnrolledCoursesListResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise EnrollmentServiceError("Only students can view enrolled courses")

        statement = (
            select(Enrollment)
            .options(
                selectinload(Enrollment.course).selectinload(Course.instructors).selectinload(CourseInstructor.instructor)
            )
            .where(
                Enrollment.user_id == current_user.id,
                Enrollment.status.in_(("active", "completed")),
            )
            .order_by(Enrollment.created_at.desc())
        )
        enrollments = (await self.session.execute(statement)).scalars().all()
        items = []
        for enrollment in enrollments:
            primary_instructor = next(
                (item for item in enrollment.course.instructors if item.is_primary and item.instructor),
                None,
            )
            instructor_name = None
            if primary_instructor and primary_instructor.instructor:
                instructor_name = (
                    f"{primary_instructor.instructor.first_name} {primary_instructor.instructor.last_name}"
                ).strip()
            items.append(
                EnrolledCourseItemResponse(
                    enrollment_id=str(enrollment.id),
                    course_id=str(enrollment.course_id),
                    title=enrollment.course.title,
                    slug=enrollment.course.slug,
                    short_description=enrollment.course.short_description,
                    thumbnail_url=enrollment.course.thumbnail_url,
                    status=enrollment.status,
                    enrolled_at=enrollment.enrolled_at,
                    published_at=enrollment.course.published_at,
                    primary_instructor_name=instructor_name,
                    progress=float(enrollment.progress) if enrollment.progress is not None else None,
                )
            )
        return EnrolledCoursesListResponse(items=items, total=len(items))

    async def list_course_students(self, course_id: UUID, current_user: User) -> EnrolledStudentsListResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_instructor_or_admin_access(course, current_user)

        statement = (
            select(Enrollment)
            .options(selectinload(Enrollment.user))
            .where(Enrollment.course_id == course.id)
            .order_by(Enrollment.created_at.desc())
        )
        enrollments = (await self.session.execute(statement)).scalars().all()
        items = [
            StudentEnrollmentItemResponse(
                enrollment_id=str(enrollment.id),
                student_id=str(enrollment.user_id),
                student_name=f"{enrollment.user.first_name} {enrollment.user.last_name}".strip(),
                student_email=enrollment.user.email,
                status=enrollment.status,
                enrolled_at=enrollment.enrolled_at,
                started_at=enrollment.started_at,
                completed_at=enrollment.completed_at,
                progress=float(enrollment.progress) if enrollment.progress is not None else None,
            )
            for enrollment in enrollments
        ]
        return EnrolledStudentsListResponse(items=items, total=len(items))

    async def get_enrollment_stats(
        self,
        current_user: User,
        course_id: UUID | None = None,
    ) -> EnrollmentStatsResponse:
        if self._has_role(current_user, "student"):
            base_filters = [Enrollment.user_id == current_user.id]
        else:
            if course_id is None:
                raise EnrollmentServiceError("course_id is required for instructor or admin enrollment stats")
            course = await self._get_course_or_raise(course_id)
            await self._ensure_instructor_or_admin_access(course, current_user)
            base_filters = [Enrollment.course_id == course.id]

        total_enrollments = await self._count_enrollments(base_filters)
        active_enrollments = await self._count_enrollments(base_filters + [Enrollment.status == "active"])
        completed_enrollments = await self._count_enrollments(base_filters + [Enrollment.status == "completed"])
        dropped_enrollments = await self._count_enrollments(base_filters + [Enrollment.status == "dropped"])
        suspended_enrollments = await self._count_enrollments(base_filters + [Enrollment.status == "suspended"])

        return EnrollmentStatsResponse(
            total_enrollments=total_enrollments,
            active_enrollments=active_enrollments,
            completed_enrollments=completed_enrollments,
            dropped_enrollments=dropped_enrollments,
            suspended_enrollments=suspended_enrollments,
        )

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise EnrollmentServiceError("Course not found")
        return course

    async def _get_enrollment_by_user_and_course(
        self,
        user_id: UUID,
        course_id: UUID,
    ) -> Enrollment | None:
        statement = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _ensure_instructor_or_admin_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise EnrollmentServiceError("You do not have permission to access enrollments for this course")

    async def _count_enrollments(self, filters: list[object]) -> int:
        statement = select(func.count(Enrollment.id)).where(*filters)
        return (await self.session.execute(statement)).scalar_one()

    def _serialize_enrollment(self, enrollment: Enrollment) -> EnrollmentResponse:
        return EnrollmentResponse(
            id=str(enrollment.id),
            user_id=str(enrollment.user_id),
            course_id=str(enrollment.course_id),
            status=enrollment.status,
            enrolled_at=enrollment.enrolled_at,
            started_at=enrollment.started_at,
            completed_at=enrollment.completed_at,
            progress=float(enrollment.progress) if enrollment.progress is not None else None,
            created_at=enrollment.created_at,
            updated_at=enrollment.updated_at,
        )

    async def _get_user_or_raise(self, user_id: UUID) -> User:
        statement = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        user = (await self.session.execute(statement)).scalar_one_or_none()
        if user is None:
            raise EnrollmentServiceError("Student not found")
        return user

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)

    def _has_explicit_role(self, current_user: User, role_code: str) -> bool:
        return role_code in self._role_codes(current_user)
